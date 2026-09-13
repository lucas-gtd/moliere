import React from "react";
import { Box, Text } from "ink";

export interface AskUserGateProps {
  visible: boolean;
  question: string;
  options: Array<{ label: string; description?: string }>;
  multiSelect: boolean;
  onSelect: (selected: string | string[]) => void;
}

export const AskUserGate: React.FC<AskUserGateProps> = ({ visible, question, options, multiSelect, onSelect }) => {
  void onSelect;
  if (!visible) return null;
  return (
    <Box flexDirection="column" paddingX={1} marginY={1} borderStyle="single" borderColor="#6B7280">
      <Text color="#9CA3AF">Question{multiSelect ? " (sélection multiple)" : ""}</Text>
      <Text color="#E5E7EB">{question}</Text>
      <Text color="#6B7280"> </Text>
      {options.map((opt, index) => (
        <Text key={opt.label}>
          <Text color="#9CA3AF">  [{index + 1}] </Text>
          <Text color="#E5E7EB">{opt.label}</Text>
          {opt.description && <Text color="#6B7280">  — {opt.description}</Text>}
        </Text>
      ))}
    </Box>
  );
};
