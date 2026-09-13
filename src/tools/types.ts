export type JsonObjectSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolAccess = "read" | "write" | "command" | "web" | "ask";

export interface ToolExecutionContext {
  projectRoot: string;
  permissions?: {
    mode: "default" | "accept-edits" | "plan" | "yolo";
    allowed: Set<string>;
    denied: Set<string>;
  };
  signal?: AbortSignal;
  onFileChanged?: (path: string) => void;
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

export type ChatCompletionTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonObjectSchema;
  };
};

export interface ToolCallResult {
  toolCallId: string;
  toolName: string;
  ok: boolean;
  output: string;
  error?: string;
}
