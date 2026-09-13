import fs from "node:fs/promises";
import {
  resolveExistingProjectPath,
  toDisplayPath,
  toProjectRelativePath,
} from "./path-safety";
import { formatProcessResult, runProcess } from "./process";
import type { ToolDefinition } from "./types";
import {
  DEFAULT_MAX_OUTPUT_CHARS,
  hasBinaryMarker,
  optionalBoolean,
  optionalInteger,
  optionalString,
  requireString,
  ToolInputError,
  truncateText,
} from "./utils";
import { walkFiles } from "./walk";

const MAX_SEARCH_FILE_BYTES = 1_000_000;

const fallbackSearch = async (
  rootPath: string,
  query: string,
  options: {
    context: Parameters<ToolDefinition["execute"]>[1];
    caseSensitive: boolean;
    maxResults: number;
  },
) => {
  const { files, truncated } = await walkFiles(rootPath, {
    includeHidden: false,
    maxFiles: 2_000,
  });
  const normalizedQuery = options.caseSensitive ? query : query.toLowerCase();
  const matches: string[] = [];

  for (const filePath of files) {
    if (matches.length >= options.maxResults) break;

    const stats = await fs.stat(filePath);
    if (!stats.isFile() || stats.size > MAX_SEARCH_FILE_BYTES) continue;

    const content = await fs.readFile(filePath, "utf-8");
    if (hasBinaryMarker(content)) continue;

    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      const haystack = options.caseSensitive ? line : line.toLowerCase();
      if (!haystack.includes(normalizedQuery)) continue;

      matches.push(
        `${toDisplayPath(options.context, filePath)}:${index + 1}:${line}`,
      );
      if (matches.length >= options.maxResults) break;
    }
  }

  if (matches.length === 0) return `Aucun résultat trouvé pour "${query}".`;
  const notice =
    truncated || matches.length >= options.maxResults
      ? `\n\n[tronqué : précisez targetDirectory ou maxResults pour affiner]`
      : "";
  return truncateText(matches.join("\n") + notice, DEFAULT_MAX_OUTPUT_CHARS);
};

const searchInFilesTool: ToolDefinition = {
  name: "searchInFiles",
  description:
    "Recherche un texte dans les fichiers du projet avec git grep sécurisé et résultats limités.",
  access: "read",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      query: { type: "string", description: "Texte exact à rechercher" },
      targetDirectory: {
        type: "string",
        description: "Sous-dossier cible. Défaut : racine du projet",
      },
      caseSensitive: {
        type: "boolean",
        description: "Recherche sensible à la casse. Défaut : true",
      },
      maxResults: {
        type: "integer",
        description: "Nombre maximum de lignes de résultat",
      },
    },
    required: ["query"],
  },
  execute: async (args, context) => {
    const query = requireString(args, "query");
    if (!query.trim()) throw new ToolInputError('"query" ne peut pas être vide.');

    const targetDirectory = optionalString(args, "targetDirectory") ?? ".";
    const rootPath = await resolveExistingProjectPath(context, targetDirectory);
    const caseSensitive = optionalBoolean(args, "caseSensitive", true);
    const maxResults =
      optionalInteger(args, "maxResults", {
        defaultValue: 100,
        min: 1,
        max: 500,
      }) ?? 100;

    const gitArgs = [
      "grep",
      "--untracked",
      "-n",
      "-I",
      `--max-count=${maxResults}`,
      "-e",
      query,
      "--",
      toProjectRelativePath(context, rootPath),
    ];
    if (!caseSensitive) gitArgs.splice(4, 0, "-i");

    const result = await runProcess("git", gitArgs, {
      cwd: context.projectRoot,
      timeoutMs: 10_000,
      maxOutputChars: DEFAULT_MAX_OUTPUT_CHARS,
    });

    if (result.exitCode === 0) {
      const lines = result.stdout.trimEnd().split("\n").filter(Boolean);
      const limitedLines = lines.slice(0, maxResults);
      const notice =
        lines.length > limitedLines.length
          ? `\n\n[tronqué : ${lines.length - limitedLines.length} lignes omises]`
          : "";
      return limitedLines.length > 0
        ? truncateText(limitedLines.join("\n") + notice, DEFAULT_MAX_OUTPUT_CHARS)
        : `Aucun résultat trouvé pour "${query}".`;
    }

    if (result.exitCode === 1 && !result.stderr.trim()) {
      return `Aucun résultat trouvé pour "${query}".`;
    }

    const gitUnavailable =
      result.exitCode === 128 ||
      result.exitCode === 127 ||
      result.stderr.includes("not a git repository");
    if (gitUnavailable) {
      return fallbackSearch(rootPath, query, {
        context,
        caseSensitive,
        maxResults,
      });
    }

    return formatProcessResult("git grep", result, DEFAULT_MAX_OUTPUT_CHARS);
  },
};

export const searchTools: ToolDefinition[] = [searchInFilesTool];
