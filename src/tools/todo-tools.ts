import { optionalString, requireString, ToolInputError } from "./utils";
import type { ToolDefinition, ToolExecutionContext } from "./types";

export type TodoStatus = "pending" | "in_progress" | "completed";

export interface TodoItem {
  status: TodoStatus;
  content: string;
  activeForm?: string;
}

export const TODO_KEY = Symbol.for("moliere.todos");

export const setTodos = (
  context: ToolExecutionContext & Record<symbol, unknown>,
  todos: TodoItem[],
) => {
  (context as unknown as Record<symbol, unknown>)[TODO_KEY] = todos;
};

export const getTodos = (
  context: ToolExecutionContext & Record<symbol, unknown>,
): TodoItem[] => {
  return ((context as unknown as Record<symbol, unknown>)[TODO_KEY] as TodoItem[] | undefined) ?? [];
};

const VALID_STATUS: TodoStatus[] = ["pending", "in_progress", "completed"];

const todoWriteTool: ToolDefinition = {
  name: "todoWrite",
  description:
    "Met à jour la liste de tâches de l'agent. Utilisez-la pour planifier les tâches complexes et marquer leur progression.",
  access: "write",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      todos: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: { type: "string", enum: ["pending", "in_progress", "completed"] },
            content: { type: "string" },
            activeForm: { type: "string" },
          },
          required: ["status", "content"],
        },
        description: "Liste complète et ordonnée des tâches courantes",
      },
    },
    required: ["todos"],
  },
  execute: async (args, context) => {
    const raw = args.todos;
    if (!Array.isArray(raw)) throw new ToolInputError('"todos" doit être un tableau.');
    const todos: TodoItem[] = raw.map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        throw new ToolInputError(`Todo #${index + 1} invalide.`);
      }
      const e = entry as Record<string, unknown>;
      if (typeof e.content !== "string" || !e.content.trim()) {
        throw new ToolInputError(`Todo #${index + 1} : "content" requis.`);
      }
      const status = typeof e.status === "string" ? (e.status as TodoStatus) : "pending";
      if (!VALID_STATUS.includes(status)) {
        throw new ToolInputError(`Todo #${index + 1} : status invalide (${status}).`);
      }
      return {
        status,
        content: e.content,
        activeForm: typeof e.activeForm === "string" ? e.activeForm : undefined,
      };
    });
    setTodos(context as unknown as ToolExecutionContext & Record<symbol, unknown>, todos);
    const pending = todos.filter((t) => t.status !== "completed").length;
    return `Todo mise à jour : ${todos.length} tâche(s), ${pending} en attente.`;
  },
};

const todoReadTool: ToolDefinition = {
  name: "todoRead",
  description: "Lit la liste de tâches courantes de l'agent.",
  access: "read",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
  execute: async (_args, context) => {
    const todos = getTodos(context as unknown as ToolExecutionContext & Record<symbol, unknown>);
    if (todos.length === 0) return "Aucune tâche en cours.";
    return todos
      .map((t, i) => `${i + 1}. [${t.status}] ${t.content}${t.activeForm ? ` — ${t.activeForm}` : ""}`)
      .join("\n");
  },
};

export const todoTools: ToolDefinition[] = [todoWriteTool, todoReadTool];
