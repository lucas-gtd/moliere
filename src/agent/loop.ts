import { moliereTools, executeTool, getToolDefinition, isAskTool, isMutatingTool, isWebTool } from "../tools";
import { streamChat, type ChatRequest, type Message, type ToolCall, type Usage } from "../llm/client";
import { loadConfig } from "../config";
import {
  applyDecision,
  describePermission,
  loadPermissions,
  shouldPrompt,
  type PermissionDecision,
  type PermissionState,
} from "./permissions";
import { runHooks, hasHooks, type HookContext } from "./hooks";
import {
  accumulateStats,
  createTokenStats,
  estimateMessagesTokens,
  type TokenStats,
} from "./tokens";
import { compactMessages, shouldCompact } from "./context";
import { clearAskRequest, clearAskResolved, getAskResolved, setAskResolved } from "../tools/user-tools";
import type { TodoItem } from "../tools/todo-tools";

export interface AgentCallbacks {
  onAssistantChunk: (text: string) => void;
  onAssistantComplete: (text: string) => void;
  onToolStart: (toolCall: ToolCall) => void;
  onToolResult: (toolCall: ToolCall, result: string, isError: boolean) => void;
  onToolPermissionRequired: (
    toolCall: ToolCall,
    toolDescription: string,
  ) => Promise<PermissionDecision>;
  onAskUserRequired: (
    toolCall: ToolCall,
    question: string,
    header: string | undefined,
    options: Array<{ label: string; description?: string }>,
    multiSelect: boolean,
  ) => Promise<string | string[]>;
  onTokensUpdated: (stats: TokenStats) => void;
  onTodosChanged: (todos: TodoItem[]) => void;
  onHooksTriggered: (lines: string[]) => void;
  onAgentDone: () => void;
  onAgentError: (error: Error) => void;
}

export interface AgentOptions {
  maxToolRounds?: number;
  contextWindow?: number;
  compactThreshold?: number;
  planMode?: boolean;
}

export interface AgentState {
  todos: TodoItem[];
  filesChanged: Set<string>;
  permissionState: PermissionState;
  abortController: AbortController;
}

const DEFAULT_MAX_TOOL_ROUNDS = 12;
const DEFAULT_CONTEXT_WINDOW = 200_000;

export const createAgentState = (
  mode: PermissionState["mode"],
  planMode: boolean,
): AgentState => ({
  todos: [],
  filesChanged: new Set<string>(),
  permissionState: loadPermissions(mode),
  abortController: new AbortController(),
});

const summarize = async (messages: Message[]): Promise<string> => {
  const config = loadConfig();
  if (!config.apiKey) throw new Error("Clé API manquante.");
  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.defaultModel,
      messages: [
        {
          role: "system",
          content:
            "Résumez la conversation en moins de 400 mots, en français. Préservez les décisions clés, fichiers modifiés, intentions et détails techniques nécessaires à la poursuite.",
        },
        {
          role: "user",
          content: messages.map((m) => `[${m.role}] ${m.content ?? ""}`).join("\n"),
        },
      ],
      stream: false,
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as { choices: Array<{ message: Message }> };
  return data.choices[0]?.message?.content ?? "";
};

const runPreToolUseHooks = async (
  toolCall: ToolCall,
  state: AgentState,
  callbacks: AgentCallbacks,
): Promise<{ proceed: boolean; outputs: string[] }> => {
  if (!hasHooks("PreToolUse")) return { proceed: true, outputs: [] };
  const ctx: HookContext = {
    toolName: toolCall.function.name,
    args: safeParse(toolCall.function.arguments),
    projectRoot: process.cwd(),
  };
  const result = await runHooks("PreToolUse", ctx);
  if (result.output.length > 0) callbacks.onHooksTriggered(result.output);
  return { proceed: result.proceed, outputs: result.output };
};

const runPostToolUseHooks = async (
  toolCall: ToolCall,
  result: string,
  ok: boolean,
  state: AgentState,
  callbacks: AgentCallbacks,
): Promise<void> => {
  if (!hasHooks("PostToolUse")) return;
  const ctx: HookContext = {
    toolName: toolCall.function.name,
    args: safeParse(toolCall.function.arguments),
    projectRoot: process.cwd(),
    result,
    ok,
  };
  const hookResult = await runHooks("PostToolUse", ctx);
  if (hookResult.output.length > 0) callbacks.onHooksTriggered(hookResult.output);
};

const safeParse = (text: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(text || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
  }
  return {};
};

const executeWithPermission = async (
  toolCall: ToolCall,
  state: AgentState,
  callbacks: AgentCallbacks,
): Promise<{ result: string; error: boolean }> => {
  const def = getToolDefinition(toolCall.function.name);
  const access = def?.access ?? "read";

  if (isAskTool(toolCall.function.name)) {
    callbacks.onToolStart(toolCall);
    const toolResult = await executeTool(toolCall.function.name, toolCall.function.arguments, {
      projectRoot: process.cwd(),
      signal: state.abortController.signal,
      onFileChanged: (p) => state.filesChanged.add(p),
    });
    callbacks.onToolResult(toolCall, toolResult, false);
    await runPostToolUseHooks(toolCall, toolResult, true, state, callbacks);
    return { result: toolResult, error: false };
  }

  if (shouldPrompt(toolCall.function.name, access, state.permissionState)) {
    const description = describePermission(toolCall.function.name, access);
    const decision = await callbacks.onToolPermissionRequired(toolCall, description);
    const allowed = applyDecision(state.permissionState, toolCall.function.name, decision);
    if (!allowed) {
      const message = "Action refusée par l'utilisateur.";
      callbacks.onToolResult(toolCall, message, true);
      return { result: message, error: true };
    }
  }

  if (state.permissionState.mode === "plan" && isMutatingTool(toolCall.function.name)) {
    const message = "Mode plan actif : aucune action destructive n'est autorisée.";
    callbacks.onToolResult(toolCall, message, true);
    return { result: message, error: true };
  }

  const preCheck = await runPreToolUseHooks(toolCall, state, callbacks);
  if (!preCheck.proceed) {
    const message = "Bloqué par un hook PreToolUse.";
    callbacks.onToolResult(toolCall, message, true);
    return { result: message, error: true };
  }

  callbacks.onToolStart(toolCall);
  const toolResult = await executeTool(toolCall.function.name, toolCall.function.arguments, {
    projectRoot: process.cwd(),
    signal: state.abortController.signal,
    onFileChanged: (p) => state.filesChanged.add(p),
  });

  const isError = toolResult.startsWith("Erreur");
  callbacks.onToolResult(toolCall, toolResult, isError);
  await runPostToolUseHooks(toolCall, toolResult, !isError, state, callbacks);
  return { result: toolResult, error: isError };
};

const handleAskTool = async (
  toolCall: ToolCall,
  state: AgentState,
  callbacks: AgentCallbacks,
): Promise<Message> => {
  const askReq = await callbacks.onAskUserRequired(
    toolCall,
    safeParse(toolCall.function.arguments).question as string ?? "",
    safeParse(toolCall.function.arguments).header as string | undefined,
    (safeParse(toolCall.function.arguments).options as Array<{ label: string; description?: string }>) ?? [],
    Boolean(safeParse(toolCall.function.arguments).multiSelect),
  );

  const answer = Array.isArray(askReq) ? askReq.join(", ") : askReq;
  const toolResult = `L'utilisateur a répondu : ${answer}`;
  callbacks.onToolResult(toolCall, toolResult, false);
  return {
    role: "tool",
    name: toolCall.function.name,
    tool_call_id: toolCall.id,
    content: toolResult,
  };
};

export const runAgentLoop = async (
  messages: Message[],
  state: AgentState,
  callbacks: AgentCallbacks,
  options: AgentOptions = {},
): Promise<{ messages: Message[]; done: boolean; reason?: string }> => {
  const config = loadConfig();
  const maxToolRounds = options.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS;
  const contextWindow = options.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  const compactThreshold = options.compactThreshold ?? 0.75;

  const history = [...messages];
  let toolRounds = 0;
  let lastToolSignature = "";
  let repeatedSignatureCount = 0;
  const tokenStats = createTokenStats();

  try {
    while (true) {
      if (state.abortController.signal.aborted) {
        callbacks.onAgentDone();
        return { messages: history, done: false, reason: "Annulé." };
      }

      if (toolRounds >= maxToolRounds) {
        callbacks.onAgentDone();
        return {
          messages: history,
          done: false,
          reason: `Arrêt après ${maxToolRounds} tours d'outils.`,
        };
      }

      if (shouldCompact(estimateMessagesTokens(history), contextWindow, compactThreshold)) {
        try {
          const compacted = await compactMessages(history, summarize, 6);
          history.splice(0, history.length, ...compacted);
        } catch {
        }
      }

      let lastUsage: Usage | undefined;
      let fullText = "";
      const toolCalls = new Map<number, ToolCall>();

      const request: Omit<ChatRequest, "stream"> = {
        model: config.defaultModel,
        messages: history,
        tools: moliereTools,
        temperature: 0.7,
        signal: state.abortController.signal,
      };

      const response = await streamChat(request, {
        signal: state.abortController.signal,
        onChunk: (chunk) => {
          fullText += chunk;
          callbacks.onAssistantChunk(chunk);
        },
        onUsage: (usage) => {
          lastUsage = usage;
          accumulateStats(tokenStats, usage);
          callbacks.onTokensUpdated({ ...tokenStats });
        },
      });

      const assistantMessage = response.message;
      history.push(assistantMessage);
      callbacks.onAssistantComplete(assistantMessage.content ?? "");

      if (lastUsage) {
        accumulateStats(tokenStats, lastUsage);
        callbacks.onTokensUpdated({ ...tokenStats });
      }

      const toolCallsList = assistantMessage.tool_calls ?? [];
      if (toolCallsList.length === 0) {
        callbacks.onAgentDone();
        return { messages: history, done: true };
      }

      toolRounds += 1;

      const toolSignature = JSON.stringify(
        toolCallsList.map((tc) => ({ name: tc.function.name, args: safeParse(tc.function.arguments) })),
      );
      if (toolSignature === lastToolSignature) {
        repeatedSignatureCount += 1;
      } else {
        lastToolSignature = toolSignature;
        repeatedSignatureCount = 1;
      }
      if (repeatedSignatureCount > 2) {
        callbacks.onAgentDone();
        return {
          messages: history,
          done: false,
          reason: "Le modèle répète les mêmes appels d'outils.",
        };
      }

      const toolResults: Message[] = [];
      let index = 0;
      while (index < toolCallsList.length) {
        const tc = toolCallsList[index];
        if (!tc) break;

        if (isAskTool(tc.function.name)) {
          toolResults.push(await handleAskTool(tc, state, callbacks));
          index += 1;
          continue;
        }

        if (isMutatingTool(tc.function.name)) {
          const { result, error } = await executeWithPermission(tc, state, callbacks);
          toolResults.push({
            role: "tool",
            name: tc.function.name,
            tool_call_id: tc.id,
            content: error ? `Erreur : ${result}` : result,
          });
          index += 1;
          continue;
        }

        const batch: ToolCall[] = [];
        while (index < toolCallsList.length) {
          const next = toolCallsList[index];
          if (!next) break;
          if (isMutatingTool(next.function.name)) break;
          if (isAskTool(next.function.name)) break;
          batch.push(next);
          index += 1;
        }

        const batchResults = await Promise.all(
          batch.map(async (call) => {
            callbacks.onToolStart(call);
            const toolResult = await executeTool(call.function.name, call.function.arguments, {
              projectRoot: process.cwd(),
              signal: state.abortController.signal,
              onFileChanged: (p) => state.filesChanged.add(p),
            });
            const isError = toolResult.startsWith("Erreur");
            callbacks.onToolResult(call, toolResult, isError);
            await runPostToolUseHooks(call, toolResult, !isError, state, callbacks);
            return {
              role: "tool" as const,
              name: call.function.name,
              tool_call_id: call.id,
              content: isError ? `Erreur : ${toolResult}` : toolResult,
            };
          }),
        );
        toolResults.push(...batchResults);
      }

      history.push(...toolResults);
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    callbacks.onAgentError(err);
    return { messages: history, done: false, reason: err.message };
  }
};

export const abortAgent = (state: AgentState) => {
  state.abortController.abort();
};
