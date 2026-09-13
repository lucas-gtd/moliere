import React from "react";
import { Box, Text } from "ink";

export interface TodoPanelProps {
  todos: Array<{ status: "pending" | "in_progress" | "completed"; content: string }>;
}

const statusIcon = (status: string): string => {
  switch (status) {
    case "completed":
      return "[x]";
    case "in_progress":
      return "[>]";
    default:
      return "[ ]";
  }
};

export const TodoPanel: React.FC<TodoPanelProps> = ({ todos }) => {
  if (todos.length === 0) return null;
  return (
    <Box flexDirection="column" paddingX={1} marginY={1}>
      <Text color="#6B7280">Tâches</Text>
      {todos.map((todo, index) => (
        <Text key={index}>
          <Text color="#6B7280">{statusIcon(todo.status)} </Text>
          <Text color="#9CA3AF">{todo.content}</Text>
        </Text>
      ))}
    </Box>
  );
};
