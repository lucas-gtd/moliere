import fs from "node:fs/promises";

export const editFile = async (
  filePath: string,
  oldText: string,
  newText: string,
) => {
  if (!oldText) {
    throw new Error('"oldText" ne peut pas être vide.');
  }

  const content = await fs.readFile(filePath, "utf-8");
  const firstIndex = content.indexOf(oldText);

  if (firstIndex === -1) {
    throw new Error(
      'Bloc "oldText" introuvable. Relis le fichier et cible un bloc exact.',
    );
  }

  if (content.indexOf(oldText, firstIndex + oldText.length) !== -1) {
    throw new Error(
      'Bloc "oldText" ambigu : plusieurs occurrences trouvées. Fournis un bloc plus spécifique.',
    );
  }

  const updatedContent =
    content.slice(0, firstIndex) +
    newText +
    content.slice(firstIndex + oldText.length);
  await fs.writeFile(filePath, updatedContent, "utf-8");

  return `Fichier modifié : ${filePath} (${oldText.length} caractères remplacés par ${newText.length}).`;
};
