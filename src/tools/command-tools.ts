import path from "node:path";
import {
  resolveExistingProjectPath,
  toProjectRelativePath,
} from "./path-safety";
import { formatProcessResult, runProcess } from "./process";
import type { ToolDefinition } from "./types";
import {
  DEFAULT_MAX_OUTPUT_CHARS,
  MAX_OUTPUT_CHARS,
  optionalInteger,
  optionalString,
  optionalStringArray,
  requireString,
  ToolInputError,
} from "./utils";

const BLOCKED_COMMANDS = new Set([
  "bash",
  "sh",
  "zsh",
  "fish",
  "powershell",
  "pwsh",
  "rm",
  "rmdir",
  "mv",
  "dd",
  "mkfs",
  "mount",
  "umount",
  "chmod",
  "chown",
  "sudo",
  "su",
  "kill",
  "pkill",
  "killall",
  "shutdown",
  "reboot",
  "curl",
  "wget",
  "ssh",
  "scp",
  "sftp",
  "nc",
  "netcat",
]);

const BLOCKED_GIT_SUBCOMMANDS = new Set([
  "reset",
  "clean",
  "checkout",
  "restore",
  "switch",
  "rebase",
  "merge",
  "push",
]);

const INLINE_EVAL_FLAGS = new Set(["-e", "--eval", "-c"]);
const INLINE_EVAL_COMMANDS = new Set([
  "node",
  "bun",
  "python",
  "python3",
  "ruby",
  "perl",
]);

const validateExecutable = (
  command: string,
  context: Parameters<ToolDefinition["execute"]>[1],
) => {
  if (!command.trim()) throw new ToolInputError('"command" ne peut pas être vide.');
  if (command.includes("\0")) {
    throw new ToolInputError('"command" contient un caractère nul interdit.');
  }

  const executableName = path.basename(command);
  if (BLOCKED_COMMANDS.has(executableName)) {
    throw new ToolInputError(`Commande bloquée pour sécurité : ${executableName}.`);
  }

  if (command.includes("/") || command.includes("\\")) {
    return resolveExistingProjectPath(context, command);
  }

  if (!/^[a-zA-Z0-9._+-]+$/.test(command)) {
    throw new ToolInputError(
      '"command" doit être un exécutable simple, sans shell ni métacaractères.',
    );
  }

  return Promise.resolve(command);
};

const validateCommandArgs = (command: string, args: string[]) => {
  const executableName = path.basename(command);
  if (
    INLINE_EVAL_COMMANDS.has(executableName) &&
    args.some((arg) => INLINE_EVAL_FLAGS.has(arg))
  ) {
    throw new ToolInputError(
      "Exécution inline (-e/--eval/-c) bloquée. Créez un fichier de projet puis exécutez-le.",
    );
  }

  if (executableName === "git" && args[0] && BLOCKED_GIT_SUBCOMMANDS.has(args[0])) {
    throw new ToolInputError(
      `Sous-commande git bloquée pour sécurité : ${args[0]}. Utilisez les outils git dédiés.`,
    );
  }

  for (const arg of args) {
    if (arg.length > 4_000) {
      throw new ToolInputError("Un argument de commande dépasse 4000 caractères.");
    }
  }
};

const runCommandTool: ToolDefinition = {
  name: "runCommand",
  description:
    "Exécute une commande locale sans shell, limitée au projet, avec timeout et sortie plafonnée. Utile pour tests/builds.",
  access: "command",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      command: {
        type: "string",
        description: "Exécutable à lancer, ex : bun, npm, node, git",
      },
      args: {
        type: "array",
        items: { type: "string" },
        description: "Arguments séparés. Aucun shell n'est utilisé.",
      },
      cwd: {
        type: "string",
        description: "Dossier de travail dans le projet. Défaut : racine",
      },
      timeoutMs: {
        type: "integer",
        description: "Timeout en millisecondes (1000-120000)",
      },
      maxOutputChars: {
        type: "integer",
        description: "Nombre maximum de caractères stdout/stderr retournés",
      },
    },
    required: ["command"],
  },
  execute: async (args, context) => {
    const rawCommand = requireString(args, "command");
    const commandArgs = optionalStringArray(args, "args", []);
    const command = await validateExecutable(rawCommand, context);
    validateCommandArgs(path.basename(rawCommand), commandArgs);

    const cwdInput = optionalString(args, "cwd") ?? ".";
    const cwd = await resolveExistingProjectPath(context, cwdInput);
    const timeoutMs =
      optionalInteger(args, "timeoutMs", {
        defaultValue: 30_000,
        min: 1_000,
        max: 120_000,
      }) ?? 30_000;
    const maxOutputChars =
      optionalInteger(args, "maxOutputChars", {
        defaultValue: DEFAULT_MAX_OUTPUT_CHARS,
        min: 1_000,
        max: MAX_OUTPUT_CHARS,
      }) ?? DEFAULT_MAX_OUTPUT_CHARS;

    const result = await runProcess(command, commandArgs, {
      cwd,
      timeoutMs,
      maxOutputChars,
      signal: context.signal,
    });
    const title = `Commande : ${rawCommand} ${commandArgs.join(" ")} [cwd=${toProjectRelativePath(context, cwd)}]`;
    return formatProcessResult(title.trim(), result, maxOutputChars);
  },
};

export const commandTools: ToolDefinition[] = [runCommandTool];
