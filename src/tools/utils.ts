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
    throw new ToolInputError("Les arguments doivent etre un objet JSON.");
  }

  return parsed as Record<string, unknown>;
};

export const requireString = (
  args: Record<string, unknown>,
  name: string,
) => {
  const value = args[name];
  if (typeof value !== "string") {
    throw new ToolInputError(`"${name}" doit etre une chaine de caracteres.`);
  }
  if (value.includes("\0")) {
    throw new ToolInputError(`"${name}" contient un caractere nul interdit.`);
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
    throw new ToolInputError(`"${name}" doit etre une chaine de caracteres.`);
  }
  if (value.includes("\0")) {
    throw new ToolInputError(`"${name}" contient un caractere nul interdit.`);
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
    throw new ToolInputError(`"${name}" doit etre un booleen.`);
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
    throw new ToolInputError(`"${name}" doit etre un entier.`);
  }

  const numberValue = value as number;
  if (options.min !== undefined && numberValue < options.min) {
    throw new ToolInputError(`"${name}" doit etre >= ${options.min}.`);
  }
  if (options.max !== undefined && numberValue > options.max) {
    throw new ToolInputError(`"${name}" doit etre <= ${options.max}.`);
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
    throw new ToolInputError(`"${name}" doit etre un tableau de chaines.`);
  }

  const stringValues = value as string[];
  for (const entry of stringValues) {
    if (entry.includes("\0")) {
      throw new ToolInputError(`"${name}" contient un caractere nul interdit.`);
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
  return `${text.slice(0, cappedMax)}\n\n... [sortie tronquee: ${omitted} caracteres omis]`;
};

export const countLines = (text: string) => {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
};

export const hasBinaryMarker = (text: string) => text.includes("\0");
