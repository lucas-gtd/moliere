import fs from "node:fs/promises";
import path from "node:path";
import { isNodeError, ToolInputError } from "./utils";
import type { ToolExecutionContext } from "./types";

const isInsideOrSame = (root: string, candidate: string) => {
  const relative = path.relative(root, candidate);
  return (
    relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
};

export const resolveProjectPath = (
  context: ToolExecutionContext,
  inputPath = ".",
) => {
  const requestedPath = inputPath.trim() || ".";
  if (requestedPath.includes("\0")) {
    throw new ToolInputError("Le chemin contient un caractère nul interdit.");
  }

  const projectRoot = path.resolve(context.projectRoot);
  const resolvedPath = path.isAbsolute(requestedPath)
    ? path.resolve(requestedPath)
    : path.resolve(projectRoot, requestedPath);

  if (!isInsideOrSame(projectRoot, resolvedPath)) {
    throw new ToolInputError(
      `Accès refusé hors du projet : ${requestedPath}.`,
    );
  }

  return resolvedPath;
};

export const resolveExistingProjectPath = async (
  context: ToolExecutionContext,
  inputPath = ".",
) => {
  const resolvedPath = resolveProjectPath(context, inputPath);
  const [realRoot, realTarget] = await Promise.all([
    fs.realpath(context.projectRoot),
    fs.realpath(resolvedPath),
  ]);

  if (!isInsideOrSame(realRoot, realTarget)) {
    throw new ToolInputError(`Accès refusé via lien symbolique : ${inputPath}.`);
  }

  return resolvedPath;
};

export const resolveWritableProjectPath = async (
  context: ToolExecutionContext,
  inputPath: string,
) => {
  const resolvedPath = resolveProjectPath(context, inputPath);
  const realRoot = await fs.realpath(context.projectRoot);

  let nearestExistingParent = path.dirname(resolvedPath);
  while (true) {
    try {
      const stats = await fs.stat(nearestExistingParent);
      if (!stats.isDirectory()) {
        throw new ToolInputError(
          `Le parent n'est pas un dossier : ${nearestExistingParent}.`,
        );
      }
      break;
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        const nextParent = path.dirname(nearestExistingParent);
        if (nextParent === nearestExistingParent) throw error;
        nearestExistingParent = nextParent;
        continue;
      }
      throw error;
    }
  }

  const realParent = await fs.realpath(nearestExistingParent);
  if (!isInsideOrSame(realRoot, realParent)) {
    throw new ToolInputError(`Accès refusé via parent symbolique : ${inputPath}.`);
  }

  return resolvedPath;
};

export const toProjectRelativePath = (
  context: ToolExecutionContext,
  absolutePath: string,
) => {
  const relative = path.relative(path.resolve(context.projectRoot), absolutePath);
  return relative ? relative.split(path.sep).join("/") : ".";
};

export const toDisplayPath = (
  context: ToolExecutionContext,
  absolutePath: string,
) => toProjectRelativePath(context, absolutePath);
