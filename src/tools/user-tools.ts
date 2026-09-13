import { ToolInputError, optionalString, optionalStringArray, requireString } from "./utils";
import type { ToolDefinition, ToolExecutionContext } from "./types";

export const ASK_KEY = Symbol.for("moliere.ask");
export const ASK_OPTIONS_KEY = Symbol.for("moliere.ask.options");
export const ASK_RESOLVED_KEY = Symbol.for("moliere.ask.resolved");

export interface AskRequest {
  question: string;
  header?: string;
  options?: Array<{ label: string; description?: string }>;
  multiSelect?: boolean;
}

export interface AskResolved {
  answer: string | string[];
  cancelled: boolean;
}

export const setAskRequest = (
  context: ToolExecutionContext & Record<symbol, unknown>,
  request: AskRequest,
) => {
  (context as unknown as Record<symbol, unknown>)[ASK_KEY] = request;
};

export const getAskRequest = (
  context: ToolExecutionContext & Record<symbol, unknown>,
): AskRequest | undefined =>
  (context as unknown as Record<symbol, unknown>)[ASK_KEY] as AskRequest | undefined;

export const clearAskRequest = (
  context: ToolExecutionContext & Record<symbol, unknown>,
) => {
  delete (context as unknown as Record<symbol, unknown>)[ASK_KEY];
};

export const setAskResolved = (
  context: ToolExecutionContext & Record<symbol, unknown>,
  resolved: AskResolved,
) => {
  (context as unknown as Record<symbol, unknown>)[ASK_RESOLVED_KEY] = resolved;
};

export const getAskResolved = (
  context: ToolExecutionContext & Record<symbol, unknown>,
): AskResolved | undefined =>
  (context as unknown as Record<symbol, unknown>)[ASK_RESOLVED_KEY] as AskResolved | undefined;

export const clearAskResolved = (
  context: ToolExecutionContext & Record<symbol, unknown>,
) => {
  delete (context as unknown as Record<symbol, unknown>)[ASK_RESOLVED_KEY];
};

const askUserTool: ToolDefinition = {
  name: "askUser",
  description:
    "Pose une question fermée à l'utilisateur et attend sa réponse avant de continuer. Bloque l'agent jusqu'à réponse.",
  access: "ask",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      question: { type: "string", description: "Question à poser" },
      header: { type: "string", description: "En-tête court (max 12 caractères)" },
      options: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string" },
            description: { type: "string" },
          },
          required: ["label"],
        },
        description: "2 à 4 options proposées",
      },
      multiSelect: {
        type: "boolean",
        description: "Autoriser plusieurs réponses (défaut : false)",
      },
    },
    required: ["question"],
  },
  execute: async (args, context) => {
    const question = requireString(args, "question");
    const header = optionalString(args, "header");
    const optionsRaw = args.options;
    const options: Array<{ label: string; description?: string }> = [];
    if (Array.isArray(optionsRaw)) {
      for (const entry of optionsRaw) {
        if (!entry || typeof entry !== "object") continue;
        const e = entry as Record<string, unknown>;
        if (typeof e.label !== "string") continue;
        options.push({
          label: e.label,
          description: typeof e.description === "string" ? e.description : undefined,
        });
      }
    }
    const multiSelect = typeof args.multiSelect === "boolean" ? args.multiSelect : false;

    if (options.length < 2) {
      throw new ToolInputError('"options" doit contenir au moins 2 propositions.');
    }
    if (options.length > 4) {
      throw new ToolInputError('"options" ne peut pas dépasser 4 propositions.');
    }

    setAskRequest(context as unknown as ToolExecutionContext & Record<symbol, unknown>, {
      question,
      header,
      options,
      multiSelect,
    });
    return `En attente d'une réponse pour : ${question}`;
  },
};

export const userTools: ToolDefinition[] = [askUserTool];
