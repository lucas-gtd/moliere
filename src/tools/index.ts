import fs from "node:fs/promises";
import path from "node:path";
import { editFile } from "./edit-file";
import { searchInFiles } from "./search-in-files";

const asString = (value: unknown, name: string) => {
  if (typeof value !== "string") {
    throw new Error(`"${name}" doit être une chaîne de caractères.`);
  }
  return value;
};

const writeFile = async (filePath: string, content: string) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, { encoding: "utf-8", flag: "wx" });
  return `Fichier créé : ${filePath} (${content.length} caractères).`;
};

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
      name: "writeFile",
      description: "Crée un fichier neuf; échoue s'il existe déjà.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Chemin" },
          content: { type: "string", description: "Contenu complet" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "editFile",
      description: "Remplace un bloc exact unique dans un fichier existant.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Chemin" },
          oldText: {
            type: "string",
            description: "Bloc exact à remplacer",
          },
          newText: { type: "string", description: "Remplacement" },
        },
        required: ["path", "oldText", "newText"],
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
      case "readFile": {
        const content = await fs.readFile(asString(args.path, "path"), "utf-8");
        return content;
      }
      case "writeFile":
        return writeFile(
          asString(args.path, "path"),
          asString(args.content, "content"),
        );
      case "editFile":
        return editFile(
          asString(args.path, "path"),
          asString(args.oldText, "oldText"),
          asString(args.newText, "newText"),
        );
      case "listDirectory": {
        const dirContent = await fs.readdir(asString(args.path, "path"));
        return dirContent.join(",");
      }
      case "searchInFiles":
        return searchInFiles(
          asString(args.query, "query"),
          typeof args.targetDirectory === "string"
            ? args.targetDirectory
            : undefined,
        );
      default:
        return `Erreur : L'outil "${name}" n'existe pas.`;
    }
  } catch (error: any) {
    return `Erreur lors de l'exécution de ${name} : ${error.message}`;
  }
};
