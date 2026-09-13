import {
  resolveProjectPath,
  toProjectRelativePath,
} from "./path-safety";
import { formatProcessResult, runProcess } from "./process";
import type { ToolDefinition } from "./types";
import {
  DEFAULT_MAX_OUTPUT_CHARS,
  MAX_OUTPUT_CHARS,
  optionalBoolean,
  optionalInteger,
  optionalString,
} from "./utils";

const gitStatusTool: ToolDefinition = {
  name: "gitStatus",
  description: "Affiche l'état git court du projet.",
  access: "read",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      maxOutputChars: {
        type: "integer",
        description: "Nombre maximum de caractères retournés",
      },
    },
  },
  execute: async (args, context) => {
    const maxOutputChars =
      optionalInteger(args, "maxOutputChars", {
        defaultValue: 12_000,
        min: 1_000,
        max: MAX_OUTPUT_CHARS,
      }) ?? 12_000;
    const result = await runProcess("git", ["status", "--short", "--branch"], {
      cwd: context.projectRoot,
      timeoutMs: 10_000,
      maxOutputChars,
    });

    if (result.exitCode === 0 && !result.stdout.trim()) return "Working tree clean.";
    return formatProcessResult("git status", result, maxOutputChars);
  },
};

const gitDiffTool: ToolDefinition = {
  name: "gitDiff",
  description: "Affiche un diff git limité, staged ou non, optionnellement pour un chemin.",
  access: "read",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      path: { type: "string", description: "Chemin cible optionnel dans le projet" },
      staged: { type: "boolean", description: "Lire le diff staged" },
      contextLines: { type: "integer", description: "Lignes de contexte du diff" },
      maxOutputChars: {
        type: "integer",
        description: "Nombre maximum de caractères retournés",
      },
    },
  },
  execute: async (args, context) => {
    const staged = optionalBoolean(args, "staged", false);
    const contextLines =
      optionalInteger(args, "contextLines", {
        defaultValue: 3,
        min: 0,
        max: 20,
      }) ?? 3;
    const maxOutputChars =
      optionalInteger(args, "maxOutputChars", {
        defaultValue: DEFAULT_MAX_OUTPUT_CHARS,
        min: 1_000,
        max: MAX_OUTPUT_CHARS,
      }) ?? DEFAULT_MAX_OUTPUT_CHARS;

    const diffArgs = ["diff", "--no-ext-diff", `--unified=${contextLines}`];
    if (staged) diffArgs.push("--staged");

    const requestedPath = optionalString(args, "path");
    if (requestedPath) {
      const resolvedPath = resolveProjectPath(context, requestedPath);
      diffArgs.push("--", toProjectRelativePath(context, resolvedPath));
    }

    const result = await runProcess("git", diffArgs, {
      cwd: context.projectRoot,
      timeoutMs: 10_000,
      maxOutputChars,
    });

    if (result.exitCode === 0 && !result.stdout.trim()) return "Aucun diff.";
    return formatProcessResult("git diff", result, maxOutputChars);
  },
};

const gitLogTool: ToolDefinition = {
  name: "gitLog",
  description: "Affiche les commits récents du projet.",
  access: "read",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      limit: { type: "integer", description: "Nombre de commits (1-30)" },
      path: { type: "string", description: "Chemin cible optionnel dans le projet" },
      maxOutputChars: {
        type: "integer",
        description: "Nombre maximum de caractères retournés",
      },
    },
  },
  execute: async (args, context) => {
    const limit =
      optionalInteger(args, "limit", { defaultValue: 10, min: 1, max: 30 }) ?? 10;
    const maxOutputChars =
      optionalInteger(args, "maxOutputChars", {
        defaultValue: 12_000,
        min: 1_000,
        max: MAX_OUTPUT_CHARS,
      }) ?? 12_000;
    const logArgs = ["log", "--oneline", "--decorate", "-n", String(limit)];

    const requestedPath = optionalString(args, "path");
    if (requestedPath) {
      const resolvedPath = resolveProjectPath(context, requestedPath);
      logArgs.push("--", toProjectRelativePath(context, resolvedPath));
    }

    const result = await runProcess("git", logArgs, {
      cwd: context.projectRoot,
      timeoutMs: 10_000,
      maxOutputChars,
    });

    if (result.exitCode === 0 && !result.stdout.trim()) return "Aucun commit.";
    return formatProcessResult("git log", result, maxOutputChars);
  },
};

export const gitTools: ToolDefinition[] = [
  gitStatusTool,
  gitDiffTool,
  gitLogTool,
];
