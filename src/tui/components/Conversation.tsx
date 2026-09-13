import React from "react";
import { Box, Text } from "ink";
import { MessageView } from "./MessageView";
import { ToolCard, type ToolStatus } from "./ToolCard";
import { TodoPanel } from "./TodoPanel";
import { renderMarkdown } from "../markdown/render";
import { stripThinking } from "../format/stripThinking";
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
  /** Items hidden from the bottom. 0 = at the bottom (follow tail). */
  scrollOffset: number;
  /** Maximum number of items that fit in the visible viewport. */
  viewportItems: number;
  /** True if new content appeared below the current scroll position. */
  hasNewBelow: boolean;
  /** True when offset is 0 (auto-follow). */
  following: boolean;
}

const ConversationInner: React.FC<ConversationProps> = ({
  messages,
  tools,
  todos,
  hooksOutput,
  scrollOffset,
  viewportItems,
  hasNewBelow,
  following,
}) => {
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

  // Virtual-list slicing. We slice by item (not by line) — each MessageView /
  // ToolCard is one item. ConversationOverflow: items taller than the viewport
  // are still clipped by the parent Box's overflow="hidden"; scroll-back at
  // item granularity is good enough for chat history.
  const totalItems = items.length;
  const safeViewport = Math.max(1, viewportItems);
  const maxOffset = Math.max(0, totalItems - safeViewport);
  const clampedOffset = Math.min(Math.max(0, scrollOffset), maxOffset);
  const start = Math.max(0, totalItems - safeViewport - clampedOffset);
  const end = Math.min(totalItems, start + safeViewport);
  const visible = items.slice(start, end);
  const hiddenAbove = start;
  const hiddenBelow = Math.max(0, totalItems - end);

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      {hiddenAbove > 0 && (
        <Box paddingY={1} flexDirection="column">
          <Text color="#6B7280">
            ─── {hiddenAbove} message{hiddenAbove > 1 ? "s" : ""} masqué
            {hiddenAbove > 1 ? "s" : ""} au-dessus · PgUp/PgDn pour faire défiler ───
          </Text>
        </Box>
      )}
      {visible}
      {hiddenBelow > 0 && !following && (
        <Box paddingY={1} flexDirection="column">
          <Text color={hasNewBelow ? "#9CA3AF" : "#6B7280"}>
            {hasNewBelow ? "↓ " : ""}─── {hiddenBelow} message{hiddenBelow > 1 ? "s" : ""} en dessous · End pour suivre ───
          </Text>
        </Box>
      )}
    </Box>
  );
};

export const Conversation: React.FC<ConversationProps> = (props) => {
  return <ConversationInner {...props} />;
};

export const StreamingPreview: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  const cleaned = stripThinking(text);
  if (!cleaned) return null;
  return (
    <Box flexDirection="column" paddingX={1} marginY={1}>
      <Text color="#E5E7EB">{renderMarkdown(cleaned)}<Text color="#9CA3AF">▍</Text></Text>
    </Box>
  );
};
