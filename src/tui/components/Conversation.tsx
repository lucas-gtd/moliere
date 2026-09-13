import React from "react";
import { Box, Text } from "ink";
import { MessageView } from "./MessageView";
import { ToolCard, type ToolStatus } from "./ToolCard";
import { TodoPanel } from "./TodoPanel";
import { renderMarkdown } from "../markdown/render";
import type { Message } from "../../llm/types";
import type { TodoItem } from "../../tools/todo-tools";

export interface ToolEntry {
  id: string;
  name: string;
  argsPreview: string;
  status: ToolStatus;
  result?: string;
  durationMs?: number;
}

export interface ConversationProps {
  messages: Message[];
  tools: ToolEntry[];
  todos: TodoItem[];
  hooksOutput: string[];
}

const ConversationInner: React.FC<ConversationProps> = ({ messages, tools, todos, hooksOutput }) => {
  const items: React.ReactNode[] = [];

  messages.forEach((message, index) => {
    if (message.role === "tool") {
      const toolName = message.name ?? "tool";
      const toolId = message.tool_call_id ?? `idx-${index}`;
      const toolEntry = tools.find((t) => t.id === toolId);
      const status: ToolStatus = toolEntry?.status ?? "success";
      items.push(
        <ToolCard
          key={`tool-${message.tool_call_id ?? `m${index}-${toolName}`}`}
          name={toolName}
          status={status}
          argsPreview={toolEntry?.argsPreview ?? ""}
          result={toolEntry?.result ?? (typeof message.content === "string" ? message.content : "")}
          durationMs={toolEntry?.durationMs}
        />,
      );
      return;
    }
    if (message.role === "assistant" || message.role === "user" || message.role === "system") {
      items.push(
        <MessageView
          key={`msg-${index}-${message.role}-${message.tool_calls?.length ?? 0}`}
          role={message.role}
          content={message.content ?? ""}
        />,
      );
    }
  });

  if (todos.length > 0) {
    items.push(<TodoPanel key={`todos-panel-${todos.length}`} todos={todos} />);
  }

  if (hooksOutput.length > 0) {
    items.push(
      <Box key={`hooks-box-${hooksOutput.length}`} flexDirection="column" paddingX={1} marginY={1}>
        <Text color="#6B7280">Hooks</Text>
        {hooksOutput.map((line, index) => (
          <Text key={`hook-line-${hooksOutput.length}-${index}`} color="#6B7280">{line}</Text>
        ))}
      </Box>,
    );
  }

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      {items}
    </Box>
  );
};

export const Conversation: React.FC<ConversationProps> = (props) => {
  return <ConversationInner {...props} />;
};

export const StreamingPreview: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  return (
    <Box flexDirection="column" paddingX={1} marginY={1}>
      <Text color="#E5E7EB">{renderMarkdown(text)}<Text color="#9CA3AF">▍</Text></Text>
    </Box>
  );
};
