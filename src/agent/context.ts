import type { Message } from "../llm/types";

export const COMPACT_SYSTEM_PROMPT = `Vous êtes un archiviste expert. Résumez la conversation suivante en moins de 400 mots, en français, à la troisième personne.`;

export const compactMessages = async (
  messages: Message[],
  summarizer: (messages: Message[]) => Promise<string>,
  keepRecent = 6,
): Promise<Message[]> => {
  if (messages.length <= keepRecent + 2) return messages;

  const system = messages.find((m) => m.role === "system");
  const head = system ? [system] : [];
  const rest = messages.filter((m) => m !== system);

  const toSummarize = rest.slice(0, rest.length - keepRecent);
  const recent = rest.slice(-keepRecent);

  if (toSummarize.length === 0) return messages;

  const summary = await summarizer(toSummarize);

  const summaryMessage: Message = {
    role: "system",
    content: `Résumé des échanges précédents :\n\n${summary}`,
  };

  return [...head, summaryMessage, ...recent];
};

export const shouldCompact = (
  estimatedTokens: number,
  contextWindow: number,
  threshold = 0.75,
): boolean => estimatedTokens / contextWindow >= threshold;
