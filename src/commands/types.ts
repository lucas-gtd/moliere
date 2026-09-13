import type { Message } from "../llm/types";
import type { TodoItem } from "../tools/todo-tools";

export interface SlashCommandContext {
  messages: Message[];
  state: {
    todos: TodoItem[];
    filesChanged: Set<string>;
    model: string;
    sessionId: string;
    cwd: string;
  };
  actions: {
    setMessages: (messages: Message[]) => void;
    pushMessage: (message: Message) => void;
    setTodos: (todos: TodoItem[]) => void;
    setModel: (model: string) => void;
    setPermissionMode: (mode: "default" | "accept-edits" | "plan" | "yolo") => void;
    setPlanMode: (plan: boolean) => void;
    setTheme: (theme: "default" | "soir" | "parchemin") => void;
    requestExit: () => void;
    requestClear: () => void;
    requestResume: (sessionId: string) => void;
    setSessionId: (id: string) => void;
    setSessionTitle: (title: string) => void;
    setSessionDirty: (dirty: boolean) => void;
    setTokensUsed: (tokens: { prompt: number; completion: number; total: number }) => void;
    requestDoctor: () => void;
    requestInitProject: () => Promise<void>;
    runSubAgent: (name: string, prompt: string) => Promise<string>;
    saveSessionNow: () => void;
  };
}

export interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
  category: "general" | "session" | "config" | "agent" | "tools";
  hidden?: boolean;
  execute: (args: string, context: SlashCommandContext) => Promise<string | null> | string | null;
}
