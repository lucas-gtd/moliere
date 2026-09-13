import React from "react";
import { Box, Text } from "ink";

export interface PermissionGateProps {
  visible: boolean;
  toolName: string;
  description: string;
  onDecision: (decision: "allow-once" | "allow-always" | "deny-once" | "deny-always") => void;
}

const OPTIONS: Array<{
  key: string;
  label: string;
  decision: "allow-once" | "allow-always" | "deny-once" | "deny-always";
}> = [
  { key: "1", label: "Une seule fois", decision: "allow-once" },
  { key: "2", label: "Toujours pour ce projet", decision: "allow-always" },
  { key: "3", label: "Refuser une fois", decision: "deny-once" },
  { key: "4", label: "Toujours refuser", decision: "deny-always" },
];

export const PermissionGate: React.FC<PermissionGateProps> = ({ visible, toolName, description, onDecision }) => {
  if (!visible) return null;
  return (
    <Box flexDirection="column" paddingX={1} marginY={1} borderStyle="single" borderColor="#6B7280">
      <Text color="#9CA3AF">Autorisation requise — {toolName}</Text>
      <Text color="#E5E7EB">{description}</Text>
      <Text color="#6B7280"> </Text>
      {OPTIONS.map((opt) => (
        <Text key={opt.key}>
          <Text color="#9CA3AF">  [{opt.key}] </Text>
          <Text color="#E5E7EB">{opt.label}</Text>
        </Text>
      ))}
      <Text color="#6B7280"> </Text>
      <Text color="#6B7280">Tapez 1, 2, 3 ou 4 (ou Entrée pour autoriser une fois).</Text>
    </Box>
  );
};
