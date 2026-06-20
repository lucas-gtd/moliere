import fs from "node:fs/promises";
import { searchInFiles } from "./search-in-files";

export const moliereTools = [
  {
    type: "function",
    function: {
      name: "readFile",
      description: "Lit le contenu d'un fichier sur le système local",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Le chemin relatif ou absolu du fichier à lire",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchInFiles",
      description:
        "Cherche un texte précis dans les fichiers du projet. Récursif par défaut et respecte le .gitignore.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Le texte exact à chercher" },
          targetDirectory: {
            type: "string",
            description:
              "Optionnel. Le sous-dossier ciblé pour limiter la profondeur. Laisse vide pour tout le projet.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listDirectory",
      description: "Affiche le contenu d'un dossier",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Le chemin relatif ou absolu du dossier",
          },
        },
        required: ["path"],
      },
    },
  },
];

export const executeTool = async (
  name: string,
  argsText: string,
): Promise<string> => {
  let args;
  try {
    args = JSON.parse(argsText);
  } catch (e) {
    return `Erreur : les arguments fournis ne sont pas un JSON valide (${argsText})`;
  }

  try {
    switch (name) {
      case "readFile":
        const content = await fs.readFile(args.path, "utf-8");
        return content;
      case "listDirectory":
        const dirContent = await fs.readdir(args.path);
        return dirContent.join(",");
      case "searchInFiles":
        return searchInFiles(args.query, args.targetDirectory);
      default:
        return `Erreur : L'outil "${name}" n'existe pas.`;
    }
  } catch (error: any) {
    return `Erreur lors de l'exécution de ${name} : ${error.message}`;
  }
};
