import { marked, type Tokens } from "marked";
import { highlightCode } from "./highlight";

const escapeAnsi = (text: string) => text.replace(/\x1b/g, "");

const colorizeHeading = (level: number, text: string): string => {
  switch (level) {
    case 1:
      return `\x1b[1;38;5;75m✦ ${text}\x1b[0m`;
    case 2:
      return `\x1b[1;38;5;179m❀ ${text}\x1b[0m`;
    case 3:
      return `\x1b[1;38;5;107m▸ ${text}\x1b[0m`;
    default:
      return `\x1b[1;38;5;246m${text}\x1b[0m`;
  }
};

const colorizeQuote = (text: string): string =>
  `\x1b[3;38;5;179m│ ${text.replace(/\n/g, "\n│ ")}\x1b[0m`;

const colorizeListItem = (text: string, ordered: boolean, index: number): string => {
  const marker = ordered ? `${index + 1}.` : "❧";
  return `\x1b[38;5;75m${marker}\x1b[0m ${text}`;
};

const colorizeCode = (code: string, lang?: string): string => {
  const highlighted = highlightCode(code, lang);
  return highlighted
    .split("\n")
    .map((line) => `\x1b[48;5;236m\x1b[38;5;230m ${line}\x1b[0m`)
    .join("\n");
};

const colorizeLink = (text: string, href: string): string => {
  const safeHref = escapeAnsi(href);
  return `\x1b[4;38;5;75m${text}\x1b[0m \x1b[38;5;246m(${safeHref})\x1b[0m`;
};

const colorizeBold = (text: string): string => `\x1b[1m${text}\x1b[0m`;

const colorizeItalic = (text: string): string => `\x1b[3m${text}\x1b[0m`;

const colorizeHr = (): string => `\x1b[38;5;246m${"─".repeat(60)}\x1b[0m`;

export const renderMarkdown = (source: string): string => {
  const tokens = marked.lexer(source);
  return tokens.map((token) => renderToken(token)).join("\n");
};

const renderToken = (token: Tokens.Generic): string => {
  switch (token.type) {
    case "heading":
      return colorizeHeading(token.depth, token.text);
    case "paragraph":
      return token.text;
    case "blockquote":
      return colorizeQuote(token.text);
    case "list":
      return token.items
        .map((item: Tokens.ListItem, index: number) => {
          const rendered = item.tokens.map((t: Tokens.Generic) => renderToken(t)).join("");
          return colorizeListItem(rendered, token.ordered, index);
        })
        .join("\n");
    case "code":
      return colorizeCode(token.text, token.lang);
    case "codespan":
      return `\x1b[38;5;179m${token.text}\x1b[0m`;
    case "link":
      return colorizeLink(token.text, token.href);
    case "strong":
      return colorizeBold(token.text);
    case "em":
      return colorizeItalic(token.text);
    case "hr":
      return colorizeHr();
    case "br":
      return "";
    case "table": {
      const header = `| ${token.header.map((cell: { text: string }) => renderTokenInline(cell.text)).join(" | ")} |`;
      const divider = `| ${token.header.map(() => "---").join(" | ")} |`;
      const rows = token.rows.map((row: Array<{ text: string }>) =>
        `| ${row.map((cell: { text: string }) => renderTokenInline(cell.text)).join(" | ")} |`,
      );
      return [header, divider, ...rows].join("\n");
    }
    default:
      return "text" in token ? token.text : "";
  }
};

const renderTokenInline = (text: string): string => text;
