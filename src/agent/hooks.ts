import fs from "node:fs";
import path from "node:path";
import { runProcess } from "../tools/process";
import { PROJECT_HOOKS_PATH } from "../config";
import { getErrorMessage } from "../tools/utils";

export type HookEvent = "PreToolUse" | "PostToolUse" | "Stop" | "SessionStart";

export interface HookEntry {
  matcher?: string;
  command: string;
  args?: string[];
  timeoutMs?: number;
}

export interface HookConfig {
  PreToolUse?: HookEntry[];
  PostToolUse?: HookEntry[];
  Stop?: HookEntry[];
  SessionStart?: HookEntry[];
}

const readHooksConfig = (): HookConfig => {
  const filePath = path.join(process.cwd(), PROJECT_HOOKS_PATH);
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as HookConfig;
  } catch {
    return {};
  }
};

const matchMatcher = (matcher: string | undefined, toolName: string): boolean => {
  if (!matcher) return true;
  if (matcher === "*") return true;
  const patterns = matcher.split("|").map((m) => m.trim()).filter(Boolean);
  for (const pattern of patterns) {
    if (pattern === toolName) return true;
    if (pattern.includes("*")) {
      const regex = new RegExp(
        `^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
      );
      if (regex.test(toolName)) return true;
    }
  }
  return false;
};

export interface HookContext {
  toolName: string;
  args: Record<string, unknown>;
  projectRoot: string;
  result?: string;
  ok?: boolean;
}

export const runHooks = async (
  event: HookEvent,
  context: HookContext,
): Promise<{ proceed: boolean; output: string[] }> => {
  const config = readHooksConfig();
  const entries = config[event] ?? [];
  const outputs: string[] = [];
  for (const entry of entries) {
    if (!matchMatcher(entry.matcher, context.toolName)) continue;
    try {
      const result = await runProcess(entry.command, entry.args ?? [], {
        cwd: context.projectRoot,
        timeoutMs: entry.timeoutMs ?? 10_000,
        maxOutputChars: 20_000,
        env: {
          MOLIERE_HOOK_EVENT: event,
          MOLIERE_TOOL_NAME: context.toolName,
          MOLIERE_PROJECT_ROOT: context.projectRoot,
          MOLIERE_TOOL_OK: String(context.ok ?? true),
        },
      });
      outputs.push(
        `[hook ${event} ${entry.command}] exit=${result.exitCode}\n${result.stdout}\n${result.stderr}`.trim(),
      );
      if (event === "PreToolUse" && result.exitCode !== 0) {
        return { proceed: false, output: outputs };
      }
    } catch (error) {
      outputs.push(`[hook ${event} ${entry.command}] erreur : ${getErrorMessage(error)}`);
    }
  }
  return { proceed: true, output: outputs };
};

export const hasHooks = (event: HookEvent): boolean => {
  const config = readHooksConfig();
  return Boolean(config[event]?.length);
};

export const describeHooks = (): string => {
  const config = readHooksConfig();
  const lines: string[] = [];
  for (const event of ["PreToolUse", "PostToolUse", "Stop", "SessionStart"] as const) {
    const entries = config[event] ?? [];
    if (entries.length === 0) continue;
    lines.push(`${event} :`);
    for (const entry of entries) {
      lines.push(`  - matcher=${entry.matcher ?? "*"} -> ${entry.command}`);
    }
  }
  return lines.length === 0 ? "Aucun hook configuré." : lines.join("\n");
};
