import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { editFile, editFileMulti } from "./edit-file";
import {
  resolveExistingProjectPath,
  resolveProjectPath,
  resolveWritableProjectPath,
  toDisplayPath,
} from "./path-safety";
import type { ToolDefinition, ToolExecutionContext } from "./types";
import {
  DEFAULT_MAX_OUTPUT_CHARS,
  hasBinaryMarker,
  optionalBoolean,
  optionalInteger,
  optionalString,
  optionalStringArray,
  requireString,
  ToolInputError,
  truncateText,
} from "./utils";
import { shouldSkipEntry, walkFiles } from "./walk";

const DEFAULT_READ_BYTES = 24_000;
const MAX_READ_BYTES = 120_000;
const DEFAULT_MAX_ENTRIES = 200;
const MAX_TREE_DEPTH = 5;

const readFirstBytes = async (filePath: string, maxBytes: number) => {
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytesRead).toString("utf-8");
  } finally {
    await handle.close();
  }
};

const readLineRange = async (
  filePath: string,
  startLine: number,
  endLine: number,
  maxBytes: number,
) => {
  const stream = createReadStream(filePath, { encoding: "utf-8" });
  const reader = createInterface({ input: stream, crlfDelay: Infinity });
  const selectedLines: string[] = [];
  let currentLine = 0;
  let collectedChars = 0;
  let truncatedByBytes = false;
  let stoppedAfterEndLine = false;

  try {
    for await (const line of reader) {
      currentLine += 1;
      if (currentLine < startLine) continue;
      if (currentLine > endLine) {
        stoppedAfterEndLine = true;
        break;
      }

      collectedChars += line.length + 1;
      if (collectedChars > maxBytes) {
        truncatedByBytes = true;
        break;
      }

      selectedLines.push(line);
    }
  } finally {
    reader.close();
    stream.destroy();
  }

  return {
    text: selectedLines.join("\n"),
    lineCountSeen: currentLine,
    truncatedByBytes,
    stoppedAfterEndLine,
  };
};

const renderEntry = (entry: import("node:fs").Dirent) => {
  if (entry.isDirectory()) return `[dir]  ${entry.name}`;
  if (entry.isSymbolicLink()) return `[link] ${entry.name}`;
  return `[file] ${entry.name}`;
};

const escapeRegex = (value: string) =>
  value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");

const globToRegExp = (pattern: string) => {
  let regex = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    const nextCharacter = pattern[index + 1];
    if (character === "*" && nextCharacter === "*") {
      regex += ".*";
      index += 1;
    } else if (character === "*") {
      regex += "[^/]*";
    } else if (character === "?") {
      regex += "[^/]";
    } else {
      regex += escapeRegex(character ?? "");
    }
  }
  regex += "$";
  return new RegExp(regex, "i");
};

const matchesPattern = (pattern: string, relativePath: string) => {
  const normalizedPattern = pattern.split(path.sep).join("/");
  const normalizedRelativePath = relativePath.split(path.sep).join("/");
  const candidate = normalizedPattern.includes("/")
    ? normalizedRelativePath
    : path.posix.basename(normalizedRelativePath);
  return globToRegExp(normalizedPattern).test(candidate);
};

const readFileTool: ToolDefinition = {
  name: "readFile",
  description:
    "Lit un fichier du projet. Utilisez startLine/endLine ou maxBytes pour limiter les gros fichiers.",
  access: "read",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      path: {
        type: "string",
        description: "Chemin relatif au projet, ou chemin absolu dans le projet",
      },
      startLine: {
        type: "integer",
        description: "Optionnel. Première ligne à lire (1-indexée)",
      },
      endLine: {
        type: "integer",
        description: "Optionnel. Dernière ligne à lire (incluse)",
      },
      maxBytes: {
        type: "integer",
        description: "Optionnel. Maximum de caractères lus ou retournés",
      },
    },
    required: ["path"],
  },
  execute: async (args, context) => {
    const requestedPath = requireString(args, "path");
    const filePath = await resolveExistingProjectPath(context, requestedPath);
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new ToolInputError(`Ce chemin n'est pas un fichier : ${requestedPath}.`);
    }

    const maxBytes =
      optionalInteger(args, "maxBytes", {
        defaultValue: DEFAULT_READ_BYTES,
        min: 1,
        max: MAX_READ_BYTES,
      }) ?? DEFAULT_READ_BYTES;
    const startLine = optionalInteger(args, "startLine", {
      min: 1,
      max: 1_000_000,
    });
    const endLine = optionalInteger(args, "endLine", {
      min: 1,
      max: 1_000_000,
    });

    const hasLineRange = startLine !== undefined || endLine !== undefined;
    if (hasLineRange) {
      const effectiveStartLine = startLine ?? 1;
      const effectiveEndLine = endLine ?? effectiveStartLine + 499;
      if (effectiveEndLine < effectiveStartLine) {
        throw new ToolInputError("endLine doit être supérieur ou égal à startLine.");
      }
      if (effectiveEndLine - effectiveStartLine > 999) {
        throw new ToolInputError("La lecture par plage est limitée à 1000 lignes.");
      }

      const sample = await readFirstBytes(filePath, Math.min(maxBytes, 4096));
      if (hasBinaryMarker(sample)) {
        throw new ToolInputError("Lecture refusée : le fichier semble binaire.");
      }

      const range = await readLineRange(
        filePath,
        effectiveStartLine,
        effectiveEndLine,
        maxBytes,
      );
      if (!range.text && range.lineCountSeen < effectiveStartLine) {
        return `Aucune ligne ${effectiveStartLine}-${effectiveEndLine} dans ${toDisplayPath(context, filePath)}.`;
      }

      const notices: string[] = [];
      if (range.truncatedByBytes) {
        notices.push(`[tronqué : limite maxBytes=${maxBytes} atteinte]`);
      } else if (range.stoppedAfterEndLine) {
        notices.push(`[plage lue : lignes ${effectiveStartLine}-${effectiveEndLine}]`);
      }
      return truncateText([range.text, ...notices].filter(Boolean).join("\n"), maxBytes);
    }

    const truncatedBySize = stats.size > maxBytes;
    const content = truncatedBySize
      ? await readFirstBytes(filePath, maxBytes)
      : await fs.readFile(filePath, "utf-8");

    if (hasBinaryMarker(content)) {
      throw new ToolInputError("Lecture refusée : le fichier semble binaire.");
    }

    const notice = truncatedBySize
      ? `\n\n[tronqué : fichier de ${stats.size} octets, seuls les ${maxBytes} premiers octets sont affichés]`
      : "";
    return truncateText(`${content}${notice}`, maxBytes + notice.length);
  },
};

const writeFileTool: ToolDefinition = {
  name: "writeFile",
  description: "Crée un nouveau fichier dans le projet ; échoue si le fichier existe déjà.",
  access: "write",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      path: { type: "string", description: "Chemin du nouveau fichier" },
      content: { type: "string", description: "Contenu complet du fichier" },
    },
    required: ["path", "content"],
  },
  execute: async (args, context) => {
    const requestedPath = requireString(args, "path");
    const content = requireString(args, "content");
    const filePath = await resolveWritableProjectPath(context, requestedPath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, { encoding: "utf-8", flag: "wx" });
    context.onFileChanged?.(filePath);
    return `Fichier créé : ${toDisplayPath(context, filePath)} (${content.length} caractères).`;
  },
};

const editFileTool: ToolDefinition = {
  name: "editFile",
  description: "Remplace un bloc exact unique dans un fichier existant du projet.",
  access: "write",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      path: { type: "string", description: "Chemin du fichier à modifier" },
      oldText: { type: "string", description: "Bloc exact à remplacer" },
      newText: { type: "string", description: "Bloc de remplacement" },
    },
    required: ["path", "oldText", "newText"],
  },
  execute: async (args, context) => {
    const requestedPath = requireString(args, "path");
    const filePath = await resolveExistingProjectPath(context, requestedPath);
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new ToolInputError(`Ce chemin n'est pas un fichier : ${requestedPath}.`);
    }

    const result = await editFile(
      filePath,
      requireString(args, "oldText"),
      requireString(args, "newText"),
      toDisplayPath(context, filePath),
    );
    context.onFileChanged?.(filePath);
    return result;
  },
};

const multiEditFileTool: ToolDefinition = {
  name: "multiEditFile",
  description: "Applique plusieurs remplacements exacts sur un même fichier, dans l'ordre.",
  access: "write",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      path: { type: "string", description: "Chemin du fichier à modifier" },
      edits: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            oldText: { type: "string" },
            newText: { type: "string" },
          },
          required: ["oldText", "newText"],
        },
        description: "Liste de {oldText, newText} appliqués en séquence",
      },
    },
    required: ["path", "edits"],
  },
  execute: async (args, context) => {
    const requestedPath = requireString(args, "path");
    const editsRaw = args.edits;
    if (!Array.isArray(editsRaw)) {
      throw new ToolInputError('"edits" doit être un tableau.');
    }
    const edits = editsRaw.map((entry, index) => {
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof (entry as Record<string, unknown>).oldText !== "string" ||
        typeof (entry as Record<string, unknown>).newText !== "string"
      ) {
        throw new ToolInputError(`Edit #${index + 1} invalide.`);
      }
      return {
        oldText: (entry as { oldText: string }).oldText,
        newText: (entry as { newText: string }).newText,
      };
    });
    const filePath = await resolveExistingProjectPath(context, requestedPath);
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new ToolInputError(`Ce chemin n'est pas un fichier : ${requestedPath}.`);
    }
    const result = await editFileMulti(filePath, edits, toDisplayPath(context, filePath));
    context.onFileChanged?.(filePath);
    return result;
  },
};

const listDirectoryTool: ToolDefinition = {
  name: "listDirectory",
  description: "Liste un dossier du projet avec limites et filtrage simple.",
  access: "read",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      path: {
        type: "string",
        description: "Dossier à lister. Défaut : racine du projet",
      },
      includeHidden: {
        type: "boolean",
        description: "Inclure les fichiers et dossiers cachés",
      },
      maxEntries: {
        type: "integer",
        description: "Nombre maximum d'entrées retournées",
      },
    },
  },
  execute: async (args, context) => {
    const requestedPath = optionalString(args, "path") ?? ".";
    const directoryPath = await resolveExistingProjectPath(context, requestedPath);
    const stats = await fs.stat(directoryPath);
    if (!stats.isDirectory()) {
      throw new ToolInputError(`Ce chemin n'est pas un dossier : ${requestedPath}.`);
    }

    const includeHidden = optionalBoolean(args, "includeHidden", false);
    const maxEntries =
      optionalInteger(args, "maxEntries", {
        defaultValue: DEFAULT_MAX_ENTRIES,
        min: 1,
        max: 1_000,
      }) ?? DEFAULT_MAX_ENTRIES;
    const entries = (await fs.readdir(directoryPath, { withFileTypes: true }))
      .filter((entry) => !shouldSkipEntry(entry.name, includeHidden))
      .sort((left, right) => {
        if (left.isDirectory() !== right.isDirectory()) {
          return left.isDirectory() ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      });

    const visibleEntries = entries.slice(0, maxEntries);
    const output = visibleEntries.map(renderEntry).join("\n");
    const notice =
      entries.length > visibleEntries.length
        ? `\n\n[tronqué : ${entries.length - visibleEntries.length} entrées omises]`
        : "";
    return output ? `${output}${notice}` : "Dossier vide.";
  },
};

const treeTool: ToolDefinition = {
  name: "tree",
  description: "Affiche une vue arborescente compacte d'un dossier du projet.",
  access: "read",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      path: { type: "string", description: "Dossier racine. Défaut : ." },
      maxDepth: { type: "integer", description: "Profondeur maximum (0-5)" },
      maxEntries: { type: "integer", description: "Nombre maximum d'entrées" },
      includeHidden: { type: "boolean", description: "Inclure les fichiers cachés" },
    },
  },
  execute: async (args, context) => {
    const requestedPath = optionalString(args, "path") ?? ".";
    const rootPath = await resolveExistingProjectPath(context, requestedPath);
    const stats = await fs.stat(rootPath);
    if (!stats.isDirectory()) {
      throw new ToolInputError(`Ce chemin n'est pas un dossier : ${requestedPath}.`);
    }

    const maxDepth =
      optionalInteger(args, "maxDepth", {
        defaultValue: 2,
        min: 0,
        max: MAX_TREE_DEPTH,
      }) ?? 2;
    const maxEntries =
      optionalInteger(args, "maxEntries", {
        defaultValue: DEFAULT_MAX_ENTRIES,
        min: 1,
        max: 1_000,
      }) ?? DEFAULT_MAX_ENTRIES;
    const includeHidden = optionalBoolean(args, "includeHidden", false);

    const lines = [toDisplayPath(context, rootPath)];
    let entryCount = 0;
    let truncated = false;

    const visit = async (directoryPath: string, depth: number): Promise<void> => {
      if (depth >= maxDepth || truncated) return;

      const entries = (await fs.readdir(directoryPath, { withFileTypes: true }))
        .filter((entry) => !shouldSkipEntry(entry.name, includeHidden))
        .sort((left, right) => {
          if (left.isDirectory() !== right.isDirectory()) {
            return left.isDirectory() ? -1 : 1;
          }
          return left.name.localeCompare(right.name);
        });

      for (const entry of entries) {
        if (entryCount >= maxEntries) {
          truncated = true;
          return;
        }

        entryCount += 1;
        const entryPath = path.join(directoryPath, entry.name);
        const marker = entry.isDirectory() ? "[dir]" : entry.isSymbolicLink() ? "[link]" : "[file]";
        lines.push(`${"  ".repeat(depth + 1)}${marker} ${entry.name}`);

        if (entry.isDirectory()) {
          await visit(entryPath, depth + 1);
        }
      }
    };

    await visit(rootPath, 0);
    if (truncated) lines.push(`[tronqué : limite maxEntries=${maxEntries} atteinte]`);
    return lines.join("\n");
  },
};

const findFilesTool: ToolDefinition = {
  name: "findFiles",
  description:
    "Trouve des fichiers par motif simple (*, **, ?) dans le projet, en ignorant les dossiers lourds par défaut.",
  access: "read",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      pattern: {
        type: "string",
        description: "Motif de nom ou chemin, ex : *.ts, src/**/*.ts",
      },
      targetDirectory: {
        type: "string",
        description: "Sous-dossier de recherche. Défaut : racine du projet",
      },
      includeHidden: {
        type: "boolean",
        description: "Inclure les fichiers et dossiers cachés",
      },
      maxResults: {
        type: "integer",
        description: "Nombre maximum de fichiers retournés",
      },
    },
    required: ["pattern"],
  },
  execute: async (args, context) => {
    const pattern = requireString(args, "pattern");
    if (!pattern.trim()) throw new ToolInputError('"pattern" ne peut pas être vide.');

    const targetDirectory = optionalString(args, "targetDirectory") ?? ".";
    const rootPath = await resolveExistingProjectPath(context, targetDirectory);
    const stats = await fs.stat(rootPath);
    if (!stats.isDirectory()) {
      throw new ToolInputError(`Ce chemin n'est pas un dossier : ${targetDirectory}.`);
    }

    const includeHidden = optionalBoolean(args, "includeHidden", false);
    const maxResults =
      optionalInteger(args, "maxResults", {
        defaultValue: 100,
        min: 1,
        max: 1_000,
      }) ?? 100;
    const { files, truncated } = await walkFiles(rootPath, {
      includeHidden,
      maxFiles: Math.max(maxResults * 4, maxResults),
    });

    const matches = files
      .map((filePath) => toDisplayPath(context, filePath))
      .filter((relativePath) => matchesPattern(pattern, relativePath))
      .slice(0, maxResults);

    if (matches.length === 0) return `Aucun fichier trouvé pour "${pattern}".`;
    const notice =
      truncated || matches.length >= maxResults
        ? `\n\n[tronqué : précisez le motif ou targetDirectory pour réduire les résultats]`
        : "";
    return truncateText(matches.join("\n") + notice, DEFAULT_MAX_OUTPUT_CHARS);
  },
};

export const fileTools: ToolDefinition[] = [
  readFileTool,
  writeFileTool,
  editFileTool,
  multiEditFileTool,
  listDirectoryTool,
  treeTool,
  findFilesTool,
];
