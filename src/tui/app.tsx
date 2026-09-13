import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { Header } from "./components/Header";
import { Conversation, StreamingPreview, type ToolEntry } from "./components/Conversation";
import { Input } from "./components/Input";
import { StatusBar } from "./components/StatusBar";
import { SlashMenu } from "./components/SlashMenu";
import { PermissionGate } from "./components/PermissionGate";
import { AskUserGate } from "./components/AskUserGate";
import { loadConfig, saveGlobalConfig } from "../config";
import { ensureDefaultAgents } from "../agent/agents";
import { runAgentLoop, createAgentState, type AgentState, type AgentCallbacks } from "../agent/loop";
import { findCommand, visibleCommands, type SlashCommandContext } from "../commands";
import { renderStartupBanner } from "../branding/art";
import { setActiveTheme, setActiveThemeName, THEMES } from "../branding/theme";
import { saveSession, loadSession, deriveTitle } from "../session/store";
import type { Message, ToolCall } from "../llm/types";
import type { TodoItem } from "../tools/todo-tools";
import type { PermissionDecision } from "../agent/permissions";
import { runSubAgent } from "../agent/sub-agent";

const VERSION = "0.2.0";

const SYSTEM_PROMPT = `Tu es Molière, un agent de codage expert, hautement performant, autonome et pragmatique. Tu t'exprimes en français de manière claire et concise. Tu peux :

- Explorer : tree, listDirectory, findFiles, searchInFiles
- Lire : readFile (avec startLine/endLine pour les gros fichiers)
- Écrire : writeFile (nouveaux fichiers), editFile, multiEditFile (plusieurs edits en séquence)
- Inspecter : gitStatus, gitDiff, gitLog
- Exécuter : runCommand (sans shell, limité au projet)
- Planifier : todoWrite, todoRead
- Dialoguer : askUser (pour questions fermées à l'utilisateur)
- Le web : webFetch (autorisation requise)

Préfère les chemins relatifs au projet, limite les sorties volumineuses, utilise editFile avec un bloc exact et unique, réserve writeFile aux nouveaux fichiers, n'exécute jamais de commande destructive. Pour les changements complexes, utilise multiEditFile plutôt que plusieurs editFile. Pour les questions à choix multiple à l'utilisateur, utilise askUser. Pour planifier, utilise todoWrite avant de commencer.

Tu réponds en français avec un ton poli et précis. Tu cites tes sources (fichiers lus, commandes exécutées). Si une commande échoue, tu proposes un correctif ou une autre approche. Tu adaptes ton effort à la tâche : questions simples → réponses courtes, modifications → exploration préalable, refactor → todoWrite puis actions séquentielles.

Tu peux utiliser le Markdown pour tes réponses (titres, listes, blocs de code). Pour les diffs, tu présentes le contexte avant/après sous forme de blocs de code.`;

interface SessionState {
  sessionId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  todos: TodoItem[];
  filesChanged: Set<string>;
  model: string;
  tokens: { prompt: number; completion: number; total: number };
  dirty: boolean;
  inputHistory: string[];
  historyIndex: number;
}

const generateSessionId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createInitialState = (model: string): SessionState => ({
  sessionId: generateSessionId(),
  title: "Nouvelle session",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messages: [],
  todos: [],
  filesChanged: new Set<string>(),
  model,
  tokens: { prompt: 0, completion: 0, total: 0 },
  dirty: false,
  inputHistory: [],
  historyIndex: -1,
});

export const App: React.FC = () => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const config = loadConfig();
  const [state, setState] = useState<SessionState>(() => createInitialState(config.defaultModel));
  const [permissionMode, setPermissionMode] = useState(config.permissionMode);
  const [planMode, setPlanMode] = useState(false);
  const [themeName, setThemeName] = useState(config.theme);
  const [streaming, setStreaming] = useState("");
  const [streamingActive, setStreamingActive] = useState(false);
  const [status, setStatus] = useState<"ready" | "thinking" | "acting" | "compacting">("ready");
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [hooksOutput, setHooksOutput] = useState<string[]>([]);
  const [permissionRequest, setPermissionRequest] = useState<{
    toolCall: ToolCall;
    description: string;
    resolve: (decision: PermissionDecision) => void;
  } | null>(null);
  const [askRequest, setAskRequest] = useState<{
    toolCall: ToolCall;
    question: string;
    header?: string;
    options: Array<{ label: string; description?: string }>;
    multiSelect: boolean;
    resolve: (answer: string | string[]) => void;
  } | null>(null);
  const [slashMenuVisible, setSlashMenuVisible] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashSelected, setSlashSelected] = useState(0);
  const agentStateRef = useRef<AgentState | null>(null);
  const inputDisabledRef = useRef(false);
  const stateRef = useRef(state);
  const configRef = useRef(config);
  const columns = stdout?.columns ?? 80;

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    if (THEMES[themeName]) {
      setActiveThemeName(themeName);
    }
    setActiveTheme(themeName);
  }, [themeName]);

  useEffect(() => {
    ensureDefaultAgents();
  }, []);

  const updateState = useCallback((updater: Partial<SessionState> | ((s: SessionState) => Partial<SessionState>)) => {
    setState((prev) => {
      const patch = typeof updater === "function" ? updater(prev) : { ...updater };
      return { ...prev, ...patch, updatedAt: Date.now() };
    });
  }, []);

  const addAssistantMessage = useCallback((message: Message) => {
    updateState((s) => ({ messages: [...s.messages, message] }));
  }, [updateState]);

  const addUserMessage = useCallback((content: string) => {
    updateState((s) => {
      const nextHistory = [...s.inputHistory, content];
      return {
        messages: [...s.messages, { role: "user", content }],
        inputHistory: nextHistory,
        historyIndex: nextHistory.length,
      };
    });
  }, [updateState]);

  const setToolsById = useCallback((toolCallId: string, patch: Partial<ToolEntry>) => {
    setTools((prev) => prev.map((t) => (t.id === toolCallId ? { ...t, ...patch } : t)));
  }, []);

  const pushTool = useCallback((entry: ToolEntry) => {
    setTools((prev) => [...prev, entry]);
  }, []);

  const completeSlashCommand = useCallback((value: string): string | null => {
    if (!value.startsWith("/")) return null;
    const query = value.slice(1);
    const matches = visibleCommands().filter((cmd) => !query || cmd.name.startsWith(query));
    if (matches.length === 0) return null;
    const selected = matches[slashSelected] ?? matches[0];
    if (!selected) return null;
    return `/${selected.name}`;
  }, [slashSelected]);

  const getSlashFiltered = useCallback((query: string) => {
    return visibleCommands().filter((cmd) => !query || cmd.name.startsWith(query));
  }, []);

  const handleSubmit = useCallback(
    async (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) return;

      setSlashMenuVisible(false);
      setSlashQuery("");
      setSlashSelected(0);

      if (trimmed === "quitter" || trimmed === "exit" || trimmed === "quit") {
        exit();
        return;
      }

      if (trimmed.startsWith("/")) {
        const [cmdName, ...args] = trimmed.slice(1).split(/\s+/);
        const command = findCommand(cmdName ?? "");
        if (!command) {
          addAssistantMessage({ role: "system", content: `Commande inconnue : /${cmdName}. Tapez /help.` });
          return;
        }
        const ctx: SlashCommandContext = {
          messages: stateRef.current.messages,
          state: {
            todos: stateRef.current.todos,
            filesChanged: stateRef.current.filesChanged,
            model: stateRef.current.model,
            sessionId: stateRef.current.sessionId,
            cwd: process.cwd(),
          },
          actions: {
            setMessages: (messages) => updateState({ messages }),
            pushMessage: addAssistantMessage,
            setTodos: (todos) => updateState({ todos }),
            setModel: (model) => {
              updateState({ model });
              saveGlobalConfig({ defaultModel: model });
            },
            setPermissionMode: (mode) => {
              setPermissionMode(mode);
              saveGlobalConfig({ permissionMode: mode });
            },
            setPlanMode: (plan) => setPlanMode(plan),
            setTheme: (name) => {
              setThemeName(name);
              saveGlobalConfig({ theme: name });
            },
            requestExit: () => exit(),
            requestClear: () => updateState({ messages: [], todos: [], filesChanged: new Set(), dirty: true, inputHistory: [], historyIndex: 0 }),
            requestResume: (id) => {
              const session = loadSession(id);
              if (!session) {
                addAssistantMessage({ role: "system", content: `Session introuvable : ${id}.` });
                return;
              }
              updateState({
                messages: session.messages,
                sessionId: session.id,
                title: session.title,
                model: session.model,
                dirty: false,
              });
              addAssistantMessage({ role: "system", content: `Session ${id} reprise.` });
            },
            setSessionId: (id) => updateState({ sessionId: id }),
            setSessionTitle: (title) => updateState({ title }),
            setSessionDirty: (dirty) => updateState({ dirty }),
            setTokensUsed: (tokens) => updateState({ tokens: { ...stateRef.current.tokens, ...tokens } }),
            requestDoctor: () => {},
            requestInitProject: async () => {
              addAssistantMessage({
                role: "assistant",
                content: "Lancez `/init` ; créez un fichier MOLIERE.md manuellement ou demandez à l'agent de le faire.",
              });
            },
            runSubAgent: async (name, prompt) => {
              let buffer = "";
              await runSubAgent(name, prompt, {
                onChunk: (chunk) => { buffer += chunk; },
                onComplete: () => {},
                onError: (err) => { buffer += `\n[Erreur] ${err.message}`; },
              });
              return buffer;
            },
            saveSessionNow: () => {
              saveCurrentSession();
            },
          },
        };
        try {
          const result = await command.execute(args.join(" "), ctx);
          if (typeof result === "string") {
            if (result.startsWith("RESUME::")) {
              const id = result.slice("RESUME::".length);
              ctx.actions.requestResume(id);
            } else if (result) {
              addAssistantMessage({ role: "system", content: result });
            }
          }
        } catch (error) {
          addAssistantMessage({
            role: "system",
            content: `Erreur lors de l'exécution de /${command.name} : ${error instanceof Error ? error.message : String(error)}`,
          });
        }
        return;
      }

      addUserMessage(trimmed);

      const agentState = createAgentState(permissionMode, planMode);
      agentStateRef.current = agentState;
      inputDisabledRef.current = true;
      setStatus("thinking");
      setStreamingActive(true);
      setStreaming("");

      const systemPrompt: Message = { role: "system", content: SYSTEM_PROMPT };

      const callbacks: AgentCallbacks = {
        onAssistantChunk: (chunk: string) => {
          setStreaming((prev) => prev + chunk);
          setStatus("thinking");
        },
        onAssistantComplete: (text: string) => {
          setStreamingActive(false);
          setStreaming("");
          addAssistantMessage({ role: "assistant", content: text });
          setStatus("ready");
        },
        onToolStart: (toolCall: ToolCall) => {
          setStatus("acting");
          const args = tryParse(toolCall.function.arguments);
          const preview = formatArgsPreview(toolCall.function.name, args);
          pushTool({
            id: toolCall.id,
            name: toolCall.function.name,
            argsPreview: preview,
            status: "running",
          });
        },
        onToolResult: (toolCall: ToolCall, result: string, isError: boolean) => {
          const status = isError ? "error" : "success";
          setToolsById(toolCall.id, { status, result });
          addAssistantMessage({
            role: "tool",
            name: toolCall.function.name,
            tool_call_id: toolCall.id,
            content: result,
          });
        },
        onToolPermissionRequired: async (toolCall: ToolCall, description: string) => {
          return new Promise<PermissionDecision>((resolve) => {
            setPermissionRequest({ toolCall, description, resolve });
          });
        },
        onAskUserRequired: async (
          toolCall: ToolCall,
          question: string,
          header: string | undefined,
          options: Array<{ label: string; description?: string }>,
          multiSelect: boolean,
        ) => {
          return new Promise<string | string[]>((resolve) => {
            setAskRequest({ toolCall, question, header, options, multiSelect, resolve });
          });
        },
        onTokensUpdated: (stats) => {
          updateState({
            tokens: {
              prompt: stats.prompt,
              completion: stats.completion,
              total: stats.total,
            },
          });
        },
        onTodosChanged: (todos: TodoItem[]) => {
          updateState({ todos });
        },
        onHooksTriggered: (lines: string[]) => {
          setHooksOutput((prev) => [...prev, ...lines]);
        },
        onAgentDone: () => {
          setStatus("ready");
          inputDisabledRef.current = false;
        },
        onAgentError: (error: Error) => {
          setStatus("ready");
          inputDisabledRef.current = false;
          addAssistantMessage({
            role: "system",
            content: `Erreur : ${error.message}`,
          });
        },
      };

      const messages = [systemPrompt, ...stateRef.current.messages, { role: "user" as const, content: trimmed }];
      void runAgentLoop(messages, agentState, callbacks, {
        maxToolRounds: config.maxToolRounds,
      }).then((result) => {
        if (result.reason) {
          addAssistantMessage({ role: "system", content: result.reason });
        }
        setStatus("ready");
        inputDisabledRef.current = false;
        updateState({ dirty: true });
        if (stateRef.current.title === "Nouvelle session") {
          updateState({ title: deriveTitle(trimmed) });
        }
      });
    },
    [addAssistantMessage, addUserMessage, exit, permissionMode, planMode, pushTool, setToolsById, updateState, config.maxToolRounds],
  );

  const saveCurrentSession = useCallback(() => {
    const s = stateRef.current;
    saveSession({
      id: s.sessionId,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: Date.now(),
      messageCount: s.messages.length,
      tokensUsed: s.tokens.total,
      filesChanged: [...s.filesChanged],
      messages: s.messages,
      model: s.model,
    });
    updateState({ dirty: false });
  }, [updateState]);

  useInput((input, key) => {
    if (permissionRequest && key.return) {
      permissionRequest.resolve({ type: "allow-once" });
      setPermissionRequest(null);
      return;
    }
    if (askRequest && /^[0-9]$/.test(input)) {
      const index = parseInt(input, 10) - 1;
      const option = askRequest.options[index];
      if (option) {
        askRequest.resolve(option.label);
        setAskRequest(null);
      }
      return;
    }
    if (permissionRequest) {
      const trimmed = input.trim();
      if (trimmed === "1") {
        permissionRequest.resolve({ type: "allow-once" });
        setPermissionRequest(null);
      } else if (trimmed === "2") {
        permissionRequest.resolve({ type: "allow-always", toolName: permissionRequest.toolCall.function.name });
        setPermissionRequest(null);
      } else if (trimmed === "3") {
        permissionRequest.resolve({ type: "deny-once" });
        setPermissionRequest(null);
      } else if (trimmed === "4") {
        permissionRequest.resolve({ type: "deny-always", toolName: permissionRequest.toolCall.function.name });
        setPermissionRequest(null);
      }
    }
  });

  useEffect(() => {
    return () => {
      if (stateRef.current.dirty) {
        saveCurrentSession();
      }
    };
  }, [saveCurrentSession]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (stateRef.current.dirty) saveCurrentSession();
    }, 30_000);
    return () => clearInterval(interval);
  }, [saveCurrentSession]);

  const getHistoryItem = useCallback((direction: "prev" | "next"): string | null => {
    const history = stateRef.current.inputHistory;
    const currentIdx = stateRef.current.historyIndex;
    if (history.length === 0) return null;
    let nextIdx: number;
    if (direction === "prev") {
      nextIdx = currentIdx <= 0 ? 0 : currentIdx - 1;
      if (nextIdx >= history.length) nextIdx = history.length - 1;
    } else {
      nextIdx = currentIdx + 1;
      if (nextIdx >= history.length) return "";
    }
    updateState({ historyIndex: nextIdx });
    return history[nextIdx] ?? null;
  }, [updateState]);

  const onChange = useCallback((value: string) => {
    if (value.startsWith("/")) {
      const query = value.slice(1);
      const filtered = getSlashFiltered(query);
      setSlashQuery(query);
      setSlashSelected(0);
      setSlashMenuVisible(filtered.length > 0);
    } else {
      setSlashMenuVisible(false);
    }
  }, [getSlashFiltered]);

  return (
    <Box flexDirection="column" width={columns} height={stdout?.rows ?? 24}>
      <Box flexShrink={0} flexDirection="column">
        <Header model={state.model} version={VERSION} planMode={planMode} />
      </Box>

      <Box flexGrow={1} flexShrink={1} flexDirection="column" overflow="hidden">
        <Conversation
          messages={state.messages}
          tools={tools}
          todos={state.todos}
          hooksOutput={hooksOutput}
        />
        {streamingActive && <StreamingPreview text={streaming} />}
      </Box>

      <Box flexShrink={0} flexDirection="column">
        <SlashMenu
          visible={slashMenuVisible}
          query={slashQuery}
          selectedIndex={slashSelected}
          onSelect={() => {}}
        />
        <PermissionGate
          visible={Boolean(permissionRequest)}
          toolName={permissionRequest?.toolCall.function.name ?? ""}
          description={permissionRequest?.description ?? ""}
          onDecision={(decision) => {
            if (permissionRequest) {
              permissionRequest.resolve(decision as unknown as PermissionDecision);
              setPermissionRequest(null);
            }
          }}
        />
        <AskUserGate
          visible={Boolean(askRequest)}
          question={askRequest?.question ?? ""}
          options={askRequest?.options ?? []}
          multiSelect={askRequest?.multiSelect ?? false}
          onSelect={(selected) => {
            if (askRequest) {
              askRequest.resolve(selected);
              setAskRequest(null);
            }
          }}
        />
        <Input
          onSubmit={handleSubmit}
          onChange={onChange}
          onHistory={getHistoryItem}
          onTabComplete={completeSlashCommand}
          disabled={inputDisabledRef.current}
        />
        <StatusBar
          model={state.model}
          tokens={state.tokens}
          status={status}
          planMode={planMode}
          cwd={process.cwd()}
          fileChanges={state.filesChanged.size}
        />
      </Box>
    </Box>
  );
};

const tryParse = (text: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(text || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
  }
  return {};
};

const formatArgsPreview = (name: string, args: Record<string, unknown>): string => {
  if (name === "runCommand") {
    const command = typeof args.command === "string" ? args.command : "?";
    const arr = Array.isArray(args.args) ? (args.args as unknown[]).join(" ") : "";
    return `${command} ${arr}`.trim();
  }
  if (name === "readFile" || name === "writeFile" || name === "editFile" || name === "multiEditFile") {
    return typeof args.path === "string" ? args.path : "";
  }
  if (name === "searchInFiles") {
    return `query="${String(args.query ?? "")}"`;
  }
  if (name === "webFetch") {
    return String(args.url ?? "");
  }
  if (name === "todoWrite") {
    const count = Array.isArray(args.todos) ? args.todos.length : 0;
    return `${count} tâche(s)`;
  }
  if (name === "askUser") {
    return String(args.question ?? "");
  }
  if (name === "gitDiff" || name === "gitLog") {
    const path = typeof args.path === "string" ? args.path : "";
    return path;
  }
  const entries = Object.entries(args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ");
  return entries.slice(0, 80);
};

void renderStartupBanner;
