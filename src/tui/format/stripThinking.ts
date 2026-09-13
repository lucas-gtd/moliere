/**
 * Strip chain-of-thought reasoning blocks from assistant text.
 *
 * Models sometimes leak `<think>...</think>` reasoning inline. Those blocks
 * are internal scaffolding, not part of the user-facing answer, so we hide
 * them by default. If the model emits ONLY a think block, we keep an empty
 * string instead of nothing — the surrounding conversation remains
 * well-formed.
 */
export const stripThinking = (text: string): string => {
  if (!text) return text;
  // Greedy across the whole string, multi-line.
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

/**
 * Count text lines (after stripping thinking), useful for "N lines
 * masquées" hints in collapsed tool results.
 */
export const countLines = (text: string): number => {
  if (!text) return 0;
  return text.split("\n").length;
};
