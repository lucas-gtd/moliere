import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export const searchInFiles = async (
  search: string,
  targetDirectory?: string,
) => {
  try {
    const targetPath = targetDirectory ? targetDirectory : ".";
    const command = `git grep --untracked -n -I --max-count=15 "${search}" -- "${targetPath}"`;
    const { stdout } = await execAsync(command);
    const MAX_CHARS = 10000;

    if (stdout.length > MAX_CHARS) {
      return (
        stdout.slice(0, MAX_CHARS) +
        `\n\n... [AVERTISSEMENT : Résultats tronqués. Précise un "targetDirectory" pour cibler un sous-dossier spécifique.]`
      );
    }

    return stdout || `Aucun résultat trouvé.`;
  } catch (error: any) {
    if (error.code === 1) {
      return `Aucun résultat trouvé pour "${search}" dans "${targetDirectory || "le projet"}".`;
    }
    if (error.message.includes("not a git repository")) {
      return `Erreur : Le projet n'est pas un dépôt Git.`;
    }
    return `Erreur lors de la recherche : ${error.message}`;
  }
};
