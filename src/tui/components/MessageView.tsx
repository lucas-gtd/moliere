import React from "react";
import { Box, Text } from "ink";
import { renderMarkdown } from "../markdown/render";

export interface MessageProps {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}

export const MessageView: React.FC<MessageProps> = ({ role, content }) => {
  if (role === "user") {
    return (
      <Box flexDirection="column" marginY={1} paddingX={1}>
        <Text color="#E5E7EB">{content}</Text>
      </Box>
    );
  }

  if (role === "assistant") {
    const rendered = renderMarkdown(content || "");
    return (
      <Box flexDirection="column" marginY={1} paddingX={1}>
        <Text color="#E5E7EB">{rendered}</Text>
      </Box>
    );
  }

  if (role === "tool") {
    return (
      <Box flexDirection="column" marginY={1} paddingX={1}>
        <Text color="#6B7280">[outil] {content}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginY={1} paddingX={1}>
      <Text color="#9CA3AF">[système] {content}</Text>
    </Box>
  );
};
