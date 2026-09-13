import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { ThemeName } from "./branding/theme";

export type PermissionMode = "default" | "accept-edits" | "plan" | "yolo";

export interface MoliereConfig {
  apiKey?: string;
  defaultModel: string;
  baseUrl: string;
  theme: ThemeName;
  permissionMode: PermissionMode;
  maxToolRounds: number;
  maxOutputChars: number;
  planMode: boolean;
  sessionId?: string;
  customModels: string[];
}

export const GLOBAL_CONFIG_DIR = path.join(os.homedir(), ".moliere");
export const GLOBAL_CONFIG_PATH = path.join(GLOBAL_CONFIG_DIR, "config.json");
export const GLOBAL_SESSIONS_DIR = path.join(GLOBAL_CONFIG_DIR, "sessions");
export const GLOBAL_AGENTS_DIR = path.join(GLOBAL_CONFIG_DIR, "agents");
export const GLOBAL_COMMANDS_DIR = path.join(GLOBAL_CONFIG_DIR, "commands");
export const PROJECT_CONFIG_DIR = ".moliere";
export const PROJECT_HOOKS_PATH = path.join(PROJECT_CONFIG_DIR, "hooks.json");
export const PROJECT_PERMISSIONS_PATH = path.join(PROJECT_CONFIG_DIR, "permissions.json");
export const PROJECT_COMMANDS_DIR = path.join(PROJECT_CONFIG_DIR, "commands");
export const PROJECT_AGENTS_DIR = path.join(PROJECT_CONFIG_DIR, "agents");
export const PROJECT_CONTEXT_FILE = "MOLIERE.md";

const VALID_THEMES = new Set<ThemeName>(["default", "soir", "parchemin"]);
const VALID_MODES = new Set<PermissionMode>([
  "default",
  "accept-edits",
  "plan",
  "yolo",
]);

const ensureGlobalDirs = () => {
  for (const dir of [
    GLOBAL_CONFIG_DIR,
    GLOBAL_SESSIONS_DIR,
    GLOBAL_AGENTS_DIR,
    GLOBAL_COMMANDS_DIR,
  ]) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
      }
    }
  }
};

const readJsonSafe = <T>(filePath: string): T | null => {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
};

export const loadConfig = (): MoliereConfig => {
  ensureGlobalDirs();

  const globalConfig = readJsonSafe<Partial<MoliereConfig>>(GLOBAL_CONFIG_PATH) ?? {};
  const projectConfig = readJsonSafe<Partial<MoliereConfig>>(
    path.join(process.cwd(), PROJECT_CONFIG_DIR, "config.json"),
  ) ?? {};

  const merged: MoliereConfig = {
    apiKey: process.env.MOLIERE_API_KEY ?? globalConfig.apiKey ?? projectConfig.apiKey,
    defaultModel:
      process.env.MOLIERE_DEFAULT_MODEL ??
      globalConfig.defaultModel ??
      projectConfig.defaultModel ??
      "MiniMax-M3",
    baseUrl:
      process.env.MOLIERE_BASE_URL ??
      globalConfig.baseUrl ??
      projectConfig.baseUrl ??
      "https://api.minimax.io/v1",
    theme: (globalConfig.theme ?? projectConfig.theme ?? "default") as ThemeName,
    permissionMode: (globalConfig.permissionMode ??
      projectConfig.permissionMode ??
      "default") as PermissionMode,
    maxToolRounds:
      globalConfig.maxToolRounds ?? projectConfig.maxToolRounds ?? 12,
    maxOutputChars:
      globalConfig.maxOutputChars ?? projectConfig.maxOutputChars ?? 80_000,
    planMode: false,
    sessionId: globalConfig.sessionId,
    customModels:
      globalConfig.customModels ?? projectConfig.customModels ?? [],
  };

  if (!VALID_THEMES.has(merged.theme)) merged.theme = "default";
  if (!VALID_MODES.has(merged.permissionMode)) merged.permissionMode = "default";

  return merged;
};

export const saveGlobalConfig = (partial: Partial<MoliereConfig>): void => {
  ensureGlobalDirs();
  const current = readJsonSafe<Partial<MoliereConfig>>(GLOBAL_CONFIG_PATH) ?? {};
  const merged = { ...current, ...partial };
  fs.writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(merged, null, 2), "utf-8");
};

export const updateGlobalConfig = (
  updater: (current: MoliereConfig) => Partial<MoliereConfig>,
): void => {
  const current = loadConfig();
  saveGlobalConfig(updater(current));
};

export const maskApiKey = (key?: string): string => {
  if (!key) return "(non définie)";
  if (key.length <= 8) return "\u2022".repeat(key.length);
  return `${key.slice(0, 4)}${"\u2022".repeat(key.length - 8)}${key.slice(-4)}`;
};
