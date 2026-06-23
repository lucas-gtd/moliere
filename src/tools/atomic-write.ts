import fs from "node:fs/promises";
import path from "node:path";
import { getErrorMessage } from "./utils";

export const writeFileAtomically = async (filePath: string, content: string) => {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );

  let temporaryFileCreated = false;
  try {
    await fs.writeFile(temporaryPath, content, {
      encoding: "utf-8",
      flag: "wx",
    });
    temporaryFileCreated = true;
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    if (!temporaryFileCreated) throw error;

    try {
      await fs.rm(temporaryPath, { force: true });
    } catch (cleanupError) {
      throw new Error(
        `Ecriture echouee: ${getErrorMessage(error)}. Nettoyage echoue: ${getErrorMessage(cleanupError)}.`,
      );
    }

    throw error;
  }
};
