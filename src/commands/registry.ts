import type { SlashCommand } from "./types";
import { helpCommand } from "./help";
import { clearCommand, exitCommand, saveCommand } from "./session";
import {
  configCommand,
  costCommand,
  modelCommand,
  permissionsCommand,
  planCommand,
  planOffCommand,
  statusCommand,
  themeCommand,
} from "./config";
import { agentsCommand, doctorCommand, initCommand, sessionsCommand } from "./agents";
import { compactCommand } from "./compact";

export const COMMANDS: SlashCommand[] = [
  helpCommand,
  clearCommand,
  exitCommand,
  saveCommand,
  statusCommand,
  costCommand,
  configCommand,
  modelCommand,
  themeCommand,
  permissionsCommand,
  planCommand,
  planOffCommand,
  compactCommand,
  initCommand,
  doctorCommand,
  sessionsCommand,
  agentsCommand,
];

const byName = new Map<string, SlashCommand>();
for (const cmd of COMMANDS) {
  byName.set(cmd.name, cmd);
  for (const alias of cmd.aliases ?? []) byName.set(alias, cmd);
}

export const findCommand = (name: string): SlashCommand | undefined => {
  const normalized = name.startsWith("/") ? name.slice(1) : name;
  return byName.get(normalized);
};

export const visibleCommands = (): SlashCommand[] =>
  COMMANDS.filter((cmd) => !cmd.hidden);
