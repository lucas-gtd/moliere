import { loadConfig } from "../config";
import type { ChatTool } from "./types";
import type { ChatRequest, Message, ToolCall, Usage } from "./types";
export type { ChatRequest, Message, ToolCall, Usage, ChatTool } from "./types";

const config = loadConfig();

type StreamHandlers = {
  onChunk?: (text: string) => void;
  onToolCallDelta?: (toolCall: Partial<ToolCall> & { index: number }) => void;
  onUsage?: (usage: Usage) => void;
  signal?: AbortSignal;
};

type ChatResponse = {
  message: Message;
  usage?: Usage;
};

const accumulateToolCall = (
  existing: ToolCall,
  delta: { id?: string; type?: string; function?: { name?: string; arguments?: string } },
): ToolCall => {
  const updated: ToolCall = {
    id: delta.id ?? existing.id,
    type: "function",
    function: {
      name: existing.function.name,
      arguments: existing.function.arguments,
    },
  };
  if (delta.function?.name) {
    updated.function.name += delta.function.name;
  }
  if (delta.function?.arguments) {
    updated.function.arguments += delta.function.arguments;
  }
  return updated;
};

const parseSSE = (chunk: string) => {
  const lines = chunk.split("\n");
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  return dataLines;
};

export const streamChat = async (
  request: Omit<ChatRequest, "stream">,
  handlers: StreamHandlers = {},
): Promise<ChatResponse> => {
  if (!config.apiKey) {
    throw new Error("Clé API Molière absente. Configurez MOLIERE_API_KEY dans .env.");
  }

  const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      tools: request.tools,
      temperature: request.temperature ?? 0.7,
      stream: true,
      stream_options: { include_usage: true },
    }),
    signal: handlers.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Erreur HTTP ${response.status}: ${text.slice(0, 240)}`);
  }
  if (!response.body) throw new Error("Aucun flux de réponse reçu.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let buffer = "";
  let fullText = "";
  const toolCalls = new Map<number, ToolCall>();
  let usage: Usage | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const rawLine = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      const line = rawLine.replace(/\r$/, "");

      if (line.startsWith("data:")) {
        const payload = line.slice(5).trim();
        if (payload && payload !== "[DONE]") {
          try {
            const data = JSON.parse(payload) as {
              choices?: Array<{
                delta?: {
                  content?: string;
                  tool_calls?: Array<{
                    index?: number;
                    id?: string;
                    type?: string;
                    function?: { name?: string; arguments?: string };
                  }>;
                };
                finish_reason?: string;
              }>;
              usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
            };

            if (data.usage && (data.usage.prompt_tokens || data.usage.total_tokens)) {
              usage = {
                promptTokens: data.usage.prompt_tokens ?? 0,
                completionTokens: data.usage.completion_tokens ?? 0,
                totalTokens: data.usage.total_tokens ?? 0,
              };
              handlers.onUsage?.(usage);
            }

            const choice = data.choices?.[0];
            const delta = choice?.delta;
            if (delta?.content) {
              fullText += delta.content;
              handlers.onChunk?.(delta.content);
            }
            if (delta?.tool_calls) {
              for (const partial of delta.tool_calls) {
                const index = partial.index ?? 0;
                const existing = toolCalls.get(index) ?? {
                  id: "",
                  type: "function" as const,
                  function: { name: "", arguments: "" },
                };
                const updated = accumulateToolCall(existing, partial);
                toolCalls.set(index, updated);
                handlers.onToolCallDelta?.({
                  index,
                  id: partial.id ?? "",
                  function: {
                    name: partial.function?.name ?? "",
                    arguments: partial.function?.arguments ?? "",
                  },
                });
              }
            }
          } catch {
          }
        }
      }
      newlineIndex = buffer.indexOf("\n");
    }
  }

  if (toolCalls.size > 0) {
    const ordered = [...toolCalls.entries()]
      .sort(([left], [right]) => left - right)
      .map(([index, toolCall]) => ({
        ...toolCall,
        id: toolCall.id || `tool_call_${index}`,
      }));

    return {
      message: {
        role: "assistant",
        content: fullText || null,
        tool_calls: ordered,
      },
      usage,
    };
  }

  return {
    message: { role: "assistant", content: fullText },
    usage,
  };
};

export const chat = async (
  request: Omit<ChatRequest, "stream">,
): Promise<ChatResponse> => {
  if (!config.apiKey) {
    throw new Error("Clé API Molière absente.");
  }
  const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      tools: request.tools,
      temperature: request.temperature ?? 0.7,
      stream: false,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Erreur HTTP ${response.status}: ${text.slice(0, 240)}`);
  }
  const data = (await response.json()) as {
    choices: Array<{ message: Message }>;
    usage?: Usage;
  };
  return {
    message: data.choices[0]!.message,
    usage: data.usage,
  };
};

export const summarize = async (
  messages: Message[],
  model?: string,
): Promise<string> => {
  const { message } = await chat({
    model: model ?? config.defaultModel,
    messages: [
      {
        role: "system",
        content:
          "Vous êtes un archiviste concis. Résumez la conversation ci-dessous en moins de 400 mots, en français. Préservez les décisions clés, noms de fichiers, intents, et toute information nécessaire pour continuer la tâche sans perdre le contexte. Utilisez des puces si utile.",
      },
      { role: "user", content: messages.map((m) => `[${m.role}] ${m.content ?? ""}`).join("\n") },
    ],
  });
  return message.content ?? "";
};

export const buildMessages = (raw: unknown[]): Message[] =>
  raw.map((entry) => entry as Message);

export const listAvailableTools = (): ChatTool[] => [];
