import { loadConfig } from "../config";
import { moliereTools } from "../tools";

const config = loadConfig();

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

type StreamingToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export const streamChat = async (
  messages: Message[],
  onChunk: (text: string) => void,
): Promise<Message> => {
  if (!config.apiKey) throw new Error("Clé API manquante.");

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "HTTP-Referer": "https://github.com/moliere-agent",
        "X-Title": "Molière",
      },
      body: JSON.stringify({
        model: config.defaultModel,
        messages: messages,
        tools: moliereTools,
        stream: true,
      }),
    },
  );

  if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
  if (!response.body) throw new Error("Aucun flux de réponse reçu.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let fullResponse = "";
  let buffer = "";

  const toolCalls = new Map<number, StreamingToolCall>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith("data: ") && trimmedLine !== "data: [DONE]") {
        try {
          const data = JSON.parse(trimmedLine.slice(6));
          const delta = data.choices[0]?.delta || {};

          if (delta.content) {
            fullResponse += delta.content;
            onChunk(delta.content);
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const index = tc.index ?? 0;
              const existing = toolCalls.get(index) ?? {
                id: "",
                type: "function" as const,
                function: { name: "", arguments: "" },
              };

              if (tc.id) existing.id = tc.id;
              if (tc.type) existing.type = tc.type;
              if (tc.function?.name) existing.function.name += tc.function.name;
              if (tc.function?.arguments)
                existing.function.arguments += tc.function.arguments;

              toolCalls.set(index, existing);
            }
          }
        } catch (e) {
          // Silence parsing errors on split chunks
        }
      }
    }
  }

  if (toolCalls.size > 0) {
    const orderedToolCalls = [...toolCalls.entries()]
      .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
      .map(([index, toolCall]) => ({
        ...toolCall,
        id: toolCall.id || `tool_call_${index}`,
      }));

    return {
      role: "assistant",
      content: fullResponse || null,
      tool_calls: orderedToolCalls,
    };
  }

  return { role: "assistant", content: fullResponse };
};
