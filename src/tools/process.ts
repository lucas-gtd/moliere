import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DEFAULT_MAX_OUTPUT_CHARS, truncateText } from "./utils";

const execFileAsync = promisify(execFile);

type ExecFileError = Error & {
  code?: number | string;
  stdout?: string | Buffer;
  stderr?: string | Buffer;
  signal?: NodeJS.Signals;
  killed?: boolean;
};

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

const toText = (value: unknown) => {
  if (Buffer.isBuffer(value)) return value.toString("utf-8");
  if (typeof value === "string") return value;
  return "";
};

const isExecFileError = (error: unknown): error is ExecFileError =>
  error instanceof Error;

export const runProcess = async (
  command: string,
  args: string[],
  options: {
    cwd: string;
    timeoutMs?: number;
    maxOutputChars?: number;
  },
): Promise<ProcessResult> => {
  const maxOutputChars = options.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS;

  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: options.cwd,
      timeout: options.timeoutMs,
      maxBuffer: Math.min(maxOutputChars * 2, 1_000_000),
      env: { ...process.env, CI: "1", NO_COLOR: "1" },
    });

    return {
      exitCode: 0,
      stdout: toText(stdout),
      stderr: toText(stderr),
      timedOut: false,
    };
  } catch (error) {
    if (!isExecFileError(error)) throw error;

    const commandNotFound = error.code === "ENOENT";
    return {
      exitCode:
        typeof error.code === "number" ? error.code : commandNotFound ? 127 : 1,
      stdout: toText(error.stdout),
      stderr: toText(error.stderr) || error.message,
      timedOut: Boolean(error.killed || error.signal === "SIGTERM"),
    };
  }
};

export const formatProcessResult = (
  title: string,
  result: ProcessResult,
  maxOutputChars = DEFAULT_MAX_OUTPUT_CHARS,
) => {
  const parts = [`${title} (exit ${result.exitCode})`];
  if (result.timedOut) parts.push("Processus arrete par timeout.");
  if (result.stdout.trim()) parts.push(`stdout:\n${result.stdout.trimEnd()}`);
  if (result.stderr.trim()) parts.push(`stderr:\n${result.stderr.trimEnd()}`);
  return truncateText(parts.join("\n\n"), maxOutputChars);
};
