import fs from "node:fs/promises";
import path from "node:path";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".moliere",
  ".cache",
  ".bun",
]);

export interface WalkFilesResult {
  files: string[];
  truncated: boolean;
}

export const shouldSkipEntry = (name: string, includeHidden: boolean) => {
  if (!includeHidden && name.startsWith(".")) {
    if (name === ".gitignore" || name === ".env.example") return false;
    return true;
  }
  return IGNORED_DIRECTORIES.has(name);
};

export const walkFiles = async (
  rootPath: string,
  options: {
    includeHidden: boolean;
    maxFiles: number;
    maxDepth?: number;
  },
): Promise<WalkFilesResult> => {
  const files: string[] = [];
  let truncated = false;

  const visit = async (directoryPath: string, depth: number): Promise<void> => {
    if (files.length >= options.maxFiles) {
      truncated = true;
      return;
    }
    if (options.maxDepth !== undefined && depth > options.maxDepth) return;

    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    entries.sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) {
        return left.isDirectory() ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });

    for (const entry of entries) {
      if (shouldSkipEntry(entry.name, options.includeHidden)) continue;

      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath, depth + 1);
      } else if (entry.isFile()) {
        files.push(entryPath);
        if (files.length >= options.maxFiles) {
          truncated = true;
          return;
        }
      }
    }
  };

  await visit(rootPath, 0);
  return { files, truncated };
};
