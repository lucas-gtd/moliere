import { diffLines } from "diff";

const RED = "\x1b[38;5;131m";
const GREEN = "\x1b[38;5;107m";
const DIM = "\x1b[38;5;246m";
const RESET = "\x1b[0m";

export const renderInlineDiff = (oldText: string, newText: string): string => {
  const parts = diffLines(oldText, newText);
  return parts
    .map((part) => {
      const color = part.added ? GREEN : part.removed ? RED : DIM;
      const prefix = part.added ? "+" : part.removed ? "-" : " ";
      return part.value
        .split("\n")
        .filter((line, index, lines) => !(index === lines.length - 1 && line === ""))
        .map((line) => `${color}${prefix} ${line}${RESET}`)
        .join("\n");
    })
    .join("\n");
};

export const renderUnifiedDiff = (oldText: string, newText: string, label?: string): string => {
  const header = label ? `\x1b[1;38;5;75m${label}\x1b[0m\n` : "";
  return header + renderInlineDiff(oldText, newText);
};
