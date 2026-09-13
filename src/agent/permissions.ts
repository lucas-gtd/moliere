import fs from "node:fs";
import path from "node:path";
import {
  PROJECT_PERMISSIONS_PATH,
  GLOBAL_CONFIG_DIR,
  type PermissionMode,
} from "../config";

export interface PermissionState {
  mode: PermissionMode;
  allowed: Set<string>;
  denied: Set<string>;
}

export const createPermissionState = (mode: PermissionMode): PermissionState => ({
  mode,
  allowed: new Set(),
  denied: new Set(),
});

const readProjectPermissions = (): { allowed: string[]; denied: string[] } => {
  const filePath = path.join(process.cwd(), PROJECT_PERMISSIONS_PATH);
  if (!fs.existsSync(filePath)) return { allowed: [], denied: [] };
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return {
      allowed: Array.isArray(data.allowed) ? data.allowed : [],
      denied: Array.isArray(data.denied) ? data.denied : [],
    };
  } catch {
    return { allowed: [], denied: [] };
  }
};

export const loadPermissions = (mode: PermissionMode): PermissionState => {
  const state = createPermissionState(mode);
  const persisted = readProjectPermissions();
  for (const name of persisted.allowed) state.allowed.add(name);
  for (const name of persisted.denied) state.denied.add(name);
  return state;
};

export const persistPermissions = (state: PermissionState): void => {
  const filePath = path.join(process.cwd(), PROJECT_PERMISSIONS_PATH);
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) {
    try {
      fs.mkdirSync(directory, { recursive: true });
    } catch {
      return;
    }
  }
  const payload = {
    allowed: [...state.allowed].sort(),
    denied: [...state.denied].sort(),
  };
  try {
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
  } catch {
  }
};

export type PermissionDecision =
  | { type: "allow-once" }
  | { type: "allow-always"; toolName: string }
  | { type: "deny-once" }
  | { type: "deny-always"; toolName: string };

export const shouldPrompt = (
  toolName: string,
  toolAccess: "read" | "write" | "command" | "web" | "ask",
  state: PermissionState,
): boolean => {
  if (state.allowed.has(toolName)) return false;
  if (state.denied.has(toolName)) return false;

  switch (state.mode) {
    case "yolo":
      return false;
    case "accept-edits":
      if (toolAccess === "write" && toolName !== "runCommand") return false;
      if (toolAccess === "write") return true;
      return toolAccess !== "read";
    case "plan":
      return toolAccess === "command" || toolAccess === "web";
    case "default":
    default:
      return toolAccess !== "read";
  }
};

export const applyDecision = (
  state: PermissionState,
  toolName: string,
  decision: PermissionDecision,
): boolean => {
  switch (decision.type) {
    case "allow-once":
      return true;
    case "allow-always":
      state.allowed.add(decision.toolName);
      state.denied.delete(decision.toolName);
      persistPermissions(state);
      return true;
    case "deny-once":
      return false;
    case "deny-always":
      state.denied.add(decision.toolName);
      state.allowed.delete(decision.toolName);
      persistPermissions(state);
      return false;
  }
};

export const describePermission = (
  toolName: string,
  toolAccess: string,
): string => {
  switch (toolAccess) {
    case "write":
      return `L'outil ${toolName} va modifier des fichiers dans votre projet.`;
    case "command":
      return `L'outil ${toolName} va exécuter une commande système.`;
    case "web":
      return `L'outil ${toolName} va effectuer une requête réseau.`;
    case "ask":
      return `L'outil ${toolName} va vous poser une question.`;
    default:
      return `L'outil ${toolName} va lire des informations.`;
  }
};

export const ensureGlobalPermissionsDir = (): void => {
  if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
    try {
      fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
    } catch {
    }
  }
};
