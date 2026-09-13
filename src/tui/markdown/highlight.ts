import { highlight } from "cli-highlight";

const supportsColor = process.stdout.isTTY ?? true;

const SAFE_LANGS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "yaml",
  "yml",
  "html",
  "css",
  "scss",
  "md",
  "markdown",
  "sh",
  "bash",
  "sql",
  "py",
  "python",
  "rs",
  "rust",
  "go",
  "java",
  "c",
  "cpp",
  "rb",
  "ruby",
  "php",
  "toml",
  "xml",
]);

const detectLanguage = (info: string | undefined, content: string): string => {
  const normalized = (info ?? "").toLowerCase().trim();
  if (normalized && SAFE_LANGS.has(normalized)) return normalized;
  if (normalized === "typescript") return "ts";
  if (normalized === "javascript") return "js";
  if (normalized === "python" || normalized === "py") return "python";
  if (normalized === "rust" || normalized === "rs") return "rust";
  if (normalized === "shell" || normalized === "sh" || normalized === "bash") return "bash";
  const firstLine = content.split("\n")[0] ?? "";
  if (firstLine.startsWith("#!/usr/bin/env python")) return "python";
  if (firstLine.startsWith("#!") && firstLine.includes("bash")) return "bash";
  if (firstLine.startsWith("#!") && firstLine.includes("sh")) return "bash";
  if (firstLine.startsWith("<?xml")) return "xml";
  if (firstLine.startsWith("---")) return "yaml";
  return "ts";
};

export const highlightCode = (code: string, language?: string): string => {
  if (!code) return code;
  const lang = detectLanguage(language, code);
  if (!supportsColor) {
    return code;
  }
  try {
    return highlight(code, { language: lang, ignoreIllegals: true });
  } catch {
    return code;
  }
};
