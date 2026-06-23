export type JsonObjectSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolAccess = "read" | "write" | "command";

export interface ToolExecutionContext {
  projectRoot: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JsonObjectSchema;
  access: ToolAccess;
  execute: (
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ) => Promise<string>;
}

export type OpenRouterTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonObjectSchema;
  };
};
