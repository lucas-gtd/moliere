import type { Message } from "../llm/types";

export interface TokenStats {
  prompt: number;
  completion: number;
  total: number;
  cumulative: number;
}

const estimateCharsPerToken = 4;

export const estimateTokens = (text: string): number =>
  Math.max(1, Math.ceil(text.length / estimateCharsPerToken));

export const estimateMessagesTokens = (messages: Message[]): number =>
  messages.reduce((sum, message) => {
    const content = typeof message.content === "string" ? message.content : "";
    let extra = estimateTokens(content);
    if (message.name) extra += estimateTokens(message.name);
    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        extra += estimateTokens(tc.function.name) + estimateTokens(tc.function.arguments);
      }
    }
    return sum + extra;
  }, 0);

export const createTokenStats = (): TokenStats => ({
  prompt: 0,
  completion: 0,
  total: 0,
  cumulative: 0,
});

export const accumulateStats = (
  stats: TokenStats,
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined,
): TokenStats => {
  if (!usage) return stats;
  const prompt = usage.promptTokens ?? 0;
  const completion = usage.completionTokens ?? 0;
  const total = usage.totalTokens ?? prompt + completion;
  stats.prompt += prompt;
  stats.completion += completion;
  stats.total += total;
  stats.cumulative += total;
  return stats;
};

export const formatTokenCount = (count: number): string => {
  if (count < 1_000) return `${count}`;
  if (count < 1_000_000) return `${(count / 1_000).toFixed(1)}K`;
  return `${(count / 1_000_000).toFixed(2)}M`;
};
