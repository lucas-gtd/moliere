import { commandTools } from "./command-tools";
import { fileTools } from "./file-tools";
import { gitTools } from "./git-tools";
import { searchTools } from "./search-tools";
import type { OpenRouterTool, ToolDefinition } from "./types";
import { getErrorMessage, parseJsonObject } from "./utils";

const toolDefinitions: ToolDefinition[] = [
  ...fileTools,
  ...searchTools,
  ...gitTools,
  ...commandTools,
];

const toolsByName = new Map(
  toolDefinitions.map((tool) => [tool.name, tool] as const),
);

export const moliereTools: OpenRouterTool[] = toolDefinitions.map((tool) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  },
}));

export const isMutatingTool = (name: string) => {
  const tool = toolsByName.get(name);
  return tool?.access === "write" || tool?.access === "command";
};

export const executeTool = async (
  name: string,
  argsText: string,
): Promise<string> => {
  try {
    const tool = toolsByName.get(name);
    if (!tool) {
      return `Erreur : l'outil "${name}" n'existe pas.`;
    }

    const args = parseJsonObject(argsText);
    return await tool.execute(args, { projectRoot: process.cwd() });
  } catch (error) {
    return `Erreur lors de l'execution de ${name} : ${getErrorMessage(error)}`;
  }
};
