import { runAgentLoop, type AgentCallbacks, type AgentState } from "./loop";
import { loadConfig } from "../config";
import { moliereTools } from "../tools";
import type { Message } from "../llm/types";
import { createTokenStats, accumulateStats } from "./tokens";
import { getAgent } from "./agents";

export interface SubAgentCallbacks {
  onChunk: (text: string) => void;
  onComplete: (text: string) => void;
  onToolStart?: (name: string) => void;
  onError?: (error: Error) => void;
  onStatus?: (status: string) => void;
}

export interface SubAgentResult {
  messages: Message[];
  tokens: { prompt: number; completion: number; total: number };
}

const createSubAgentCallbacks = (
  callbacks: SubAgentCallbacks,
  verbose: boolean,
): AgentCallbacks => ({
  onAssistantChunk: (chunk) => callbacks.onChunk(chunk),
  onAssistantComplete: (text) => callbacks.onComplete(text),
  onToolStart: (tc) => callbacks.onToolStart?.(tc.function.name),
  onToolResult: () => {},
  onToolPermissionRequired: async () => ({ type: "allow-once" as const }),
  onAskUserRequired: async (_, question) => {
    callbacks.onStatus?.(`Sous-agent demande : ${question}`);
    return "(réponse par défaut)";
  },
  onTokensUpdated: () => {},
  onTodosChanged: () => {},
  onHooksTriggered: () => {},
  onAgentDone: () => callbacks.onStatus?.("Sous-agent terminé."),
  onAgentError: (err) => callbacks.onError?.(err),
});

const noopState: AgentState = {
  todos: [],
  filesChanged: new Set<string>(),
  permissionState: {
    mode: "yolo",
    allowed: new Set<string>(),
    denied: new Set<string>(),
  },
  abortController: new AbortController(),
};

export const runSubAgent = async (
  agentName: string,
  prompt: string,
  callbacks: SubAgentCallbacks,
): Promise<SubAgentResult> => {
  const def = getAgent(agentName);
  const config = loadConfig();
  const systemPrompt = def?.prompt ?? `Vous êtes un sous-agent Molière nommé ${agentName}.`;
  const filteredTools = def?.tools
    ? moliereTools.filter((t) => def.tools?.includes(t.function.name))
    : moliereTools;

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ];

  const tokenStats = createTokenStats();
  const wrapped = createSubAgentCallbacks(callbacks, false);
  const originalTokens = wrapped.onTokensUpdated;
  wrapped.onTokensUpdated = (stats) => {
    tokenStats.prompt = stats.prompt;
    tokenStats.completion = stats.completion;
    tokenStats.total = stats.total;
    originalTokens(stats);
  };

  const result = await runAgentLoop(messages, noopState, wrapped, {
    maxToolRounds: 6,
    contextWindow: 200_000,
  });

  return {
    messages: result.messages,
    tokens: {
      prompt: tokenStats.prompt,
      completion: tokenStats.completion,
      total: tokenStats.total,
    },
  };
};
