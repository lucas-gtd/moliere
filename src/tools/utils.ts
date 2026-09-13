export const DEFAULT_MAX_OUTPUT_CHARS = 20_000;
export const MAX_OUTPUT_CHARS = 80_000;

export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolInputError";
  }
}

export const isNodeError = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error;

export const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

export const parseJsonObject = (text: string): Record<string, unknown> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text || "{}");
  } catch {
    throw new ToolInputError(
      `Les arguments fournis ne sont pas un JSON valide (${text}).`,
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ToolInputError("Les arguments doivent être un objet JSON.");
  }

  return parsed as Record<string, unknown>;
};

export const requireString = (
  args: Record<string, unknown>,
  name: string,
) => {
  const value = args[name];
  if (typeof value !== "string") {
    throw new ToolInputError(`"${name}" doit être une chaîne de caractères.`);
  }
  if (value.includes("\0")) {
    throw new ToolInputError(`"${name}" contient un caractère nul interdit.`);
  }
  return value;
};

export const optionalString = (
  args: Record<string, unknown>,
  name: string,
) => {
  const value = args[name];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new ToolInputError(`"${name}" doit être une chaîne de caractères.`);
  }
  if (value.includes("\0")) {
    throw new ToolInputError(`"${name}" contient un caractère nul interdit.`);
  }
  return value;
};

export const optionalBoolean = (
  args: Record<string, unknown>,
  name: string,
  defaultValue: boolean,
) => {
  const value = args[name];
  if (value === undefined || value === null) return defaultValue;
  if (typeof value !== "boolean") {
    throw new ToolInputError(`"${name}" doit être un booléen.`);
  }
  return value;
};

export const optionalInteger = (
  args: Record<string, unknown>,
  name: string,
  options: { defaultValue?: number; min?: number; max?: number } = {},
) => {
  const value = args[name];
  if (value === undefined || value === null) return options.defaultValue;
  if (!Number.isInteger(value)) {
    throw new ToolInputError(`"${name}" doit être un entier.`);
  }

  const numberValue = value as number;
  if (options.min !== undefined && numberValue < options.min) {
    throw new ToolInputError(`"${name}" doit être >= ${options.min}.`);
  }
  if (options.max !== undefined && numberValue > options.max) {
    throw new ToolInputError(`"${name}" doit être <= ${options.max}.`);
  }
  return numberValue;
};

export const optionalStringArray = (
  args: Record<string, unknown>,
  name: string,
  defaultValue: string[] = [],
) => {
  const value = args[name];
  if (value === undefined || value === null) return defaultValue;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new ToolInputError(`"${name}" doit être un tableau de chaînes.`);
  }

  const stringValues = value as string[];
  for (const entry of stringValues) {
    if (entry.includes("\0")) {
      throw new ToolInputError(`"${name}" contient un caractère nul interdit.`);
    }
  }
  return stringValues;
};

export const truncateText = (
  text: string,
  maxChars = DEFAULT_MAX_OUTPUT_CHARS,
) => {
  const cappedMax = Math.min(maxChars, MAX_OUTPUT_CHARS);
  if (text.length <= cappedMax) return text;

  const omitted = text.length - cappedMax;
  return `${text.slice(0, cappedMax)}\n\n... [sortie tronquée : ${omitted} caractères omis]`;
};

export const countLines = (text: string) => {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
};

export const hasBinaryMarker = (text: string) => text.includes("\0");

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Kio`;
  return `${(bytes / 1024 / 1024).toFixed(2)} Mio`;
};
