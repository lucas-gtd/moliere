import fs from "node:fs/promises";
import { writeFileAtomically } from "./atomic-write";

export const editFile = async (
  filePath: string,
  oldText: string,
  newText: string,
  displayPath = filePath,
) => {
  if (!oldText) {
    throw new Error('"oldText" ne peut pas être vide.');
  }

  const content = await fs.readFile(filePath, "utf-8");
  const firstIndex = content.indexOf(oldText);

  if (firstIndex === -1) {
    throw new Error(
      'Bloc "oldText" introuvable. Relisez le fichier et ciblez un bloc exact.',
    );
  }

  if (content.indexOf(oldText, firstIndex + oldText.length) !== -1) {
    throw new Error(
      'Bloc "oldText" ambigu : plusieurs occurrences trouvées. Fournissez un bloc plus spécifique.',
    );
  }

  const updatedContent =
    content.slice(0, firstIndex) +
    newText +
    content.slice(firstIndex + oldText.length);
  await writeFileAtomically(filePath, updatedContent);

  return `Fichier modifié : ${displayPath} (${oldText.length} caractères remplacés par ${newText.length}).`;
};

export const editFileMulti = async (
  filePath: string,
  edits: Array<{ oldText: string; newText: string }>,
  displayPath = filePath,
) => {
  if (edits.length === 0) throw new Error("Aucun edit fourni.");
  let content = await fs.readFile(filePath, "utf-8");

  for (let index = 0; index < edits.length; index += 1) {
    const edit = edits[index];
    if (!edit) continue;
    if (!edit.oldText) {
      throw new Error(`Edit #${index + 1} : "oldText" vide.`);
    }
    const firstIndex = content.indexOf(edit.oldText);
    if (firstIndex === -1) {
      throw new Error(
        `Edit #${index + 1} : bloc "oldText" introuvable.`,
      );
    }
    if (content.indexOf(edit.oldText, firstIndex + edit.oldText.length) !== -1) {
      throw new Error(
        `Edit #${index + 1} : bloc "oldText" ambigu.`,
      );
    }
    content =
      content.slice(0, firstIndex) +
      edit.newText +
      content.slice(firstIndex + edit.oldText.length);
  }

  await writeFileAtomically(filePath, content);

  return `Fichier modifié : ${displayPath} (${edits.length} édition${edits.length > 1 ? "s" : ""} appliquée${edits.length > 1 ? "s" : ""}).`;
};
