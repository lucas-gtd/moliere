import type { SlashCommand } from "./types";
import { compactMessages } from "../agent/context";
import type { Message } from "../llm/types";
import { loadConfig } from "../config";

const fetchSummary = async (messages: Message[]): Promise<string> => {
  const config = loadConfig();
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
          content: "Résumez la conversation ci-dessous en moins de 400 mots, en français. Préservez fichiers modifiés, décisions clés, intentions et détails techniques.",
        },
        { role: "user", content: messages.map((m) => `[${m.role}] ${m.content ?? ""}`).join("\n") },
      ],
      stream: false,
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as { choices: Array<{ message: Message }> };
  return data.choices[0]?.message?.content ?? "";
};

export const compactCommand: SlashCommand = {
  name: "compact",
  description: "Résumer l'historique pour libérer du contexte",
  category: "session",
  execute: async (_args, context) => {
    const compacted = await compactMessages(context.messages, fetchSummary, 6);
    context.actions.setMessages(compacted);
    context.actions.setSessionDirty(true);
    const before = context.messages.length;
    const after = compacted.length;
    return `Historique compacté : ${before} → ${after} messages.`;
  },
};
