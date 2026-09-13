import React from "react";
import { Box, Text } from "ink";
import { visibleCommands } from "../../commands/registry";

export interface SlashMenuProps {
  visible: boolean;
  query: string;
  selectedIndex: number;
  onSelect: (commandName: string) => void;
}

export const SlashMenu: React.FC<SlashMenuProps> = ({ visible, query, selectedIndex, onSelect }) => {
  void onSelect;
  const commands = visibleCommands().filter((cmd) => !query || cmd.name.startsWith(query));
  if (!visible || commands.length === 0) return null;
  const limited = commands.slice(0, 8);
  const safeIndex = Math.max(0, Math.min(selectedIndex, limited.length - 1));

  return (
    <Box flexDirection="column" paddingX={1}>
      {limited.map((cmd, index) => {
        const isSelected = index === safeIndex;
        return (
          <Text key={cmd.name}>
            <Text color={isSelected ? "#9CA3AF" : "#6B7280"}>
              {isSelected ? "> " : "  "}
            </Text>
            <Text color={isSelected ? "#E5E7EB" : "#6B7280"} bold={isSelected}>
              /{cmd.name}
            </Text>
            <Text color="#6B7280">  —  {cmd.description}</Text>
          </Text>
        );
      })}
    </Box>
  );
};
