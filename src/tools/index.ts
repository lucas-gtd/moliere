import { commandTools } from "./command-tools";
import { fileTools } from "./file-tools";
import { gitTools } from "./git-tools";
import { searchTools } from "./search-tools";
import { todoTools } from "./todo-tools";
import { userTools } from "./user-tools";
import { webTools } from "./web-tools";
import type { ChatCompletionTool, ToolDefinition } from "./types";
import { getErrorMessage, parseJsonObject } from "./utils";

const toolDefinitions: ToolDefinition[] = [
  ...fileTools,
  ...searchTools,
  ...gitTools,
  ...commandTools,
  ...todoTools,
  ...webTools,
  ...userTools,
];

const toolsByName = new Map(
  toolDefinitions.map((tool) => [tool.name, tool] as const),
);

export const moliereTools: ChatCompletionTool[] = toolDefinitions.map((tool) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  },
}));

export const toolNames = toolDefinitions.map((tool) => tool.name);

export const getToolDefinition = (name: string): ToolDefinition | undefined =>
  toolsByName.get(name);

export const isMutatingTool = (name: string) => {
  const tool = toolsByName.get(name);
  if (!tool) return false;
  return tool.access !== "read";
};

export const isWebTool = (name: string) => {
  const tool = toolsByName.get(name);
  return tool?.access === "web";
};

export const isAskTool = (name: string) => {
  const tool = toolsByName.get(name);
  return tool?.access === "ask";
};

export const executeTool = async (
  name: string,
  argsText: string,
  context?: Partial<Parameters<ToolDefinition["execute"]>[1]>,
): Promise<string> => {
  try {
    const tool = toolsByName.get(name);
    if (!tool) {
      return `Erreur : l'outil "${name}" n'existe pas.`;
    }

    const args = parseJsonObject(argsText);
    return await tool.execute(args, {
      projectRoot: context?.projectRoot ?? process.cwd(),
      permissions: context?.permissions,
      signal: context?.signal,
      onFileChanged: context?.onFileChanged,
    });
  } catch (error) {
    return `Erreur lors de l'exécution de ${name} : ${getErrorMessage(error)}`;
  }
};
