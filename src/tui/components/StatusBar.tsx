import React from "react";
import { Box, Text } from "ink";
import { formatTokenCount } from "../../agent/tokens";

export interface StatusBarProps {
  model: string;
  tokens: { prompt: number; completion: number; total: number };
  status: "ready" | "thinking" | "acting" | "compacting";
  planMode?: boolean;
  cwd: string;
  fileChanges: number;
}

const statusLabel = (status: StatusBarProps["status"]): { label: string; color: string } => {
  switch (status) {
    case "ready":
      return { label: "Prêt", color: "#6B7280" };
    case "thinking":
      return { label: "Réflexion", color: "#9CA3AF" };
    case "acting":
      return { label: "Exécution", color: "#9CA3AF" };
    case "compacting":
      return { label: "Résumé", color: "#9CA3AF" };
  }
};

export const StatusBar: React.FC<StatusBarProps> = ({ model, tokens, status, planMode, cwd, fileChanges }) => {
  const { label, color } = statusLabel(status);
  const total = tokens.prompt + tokens.completion;
  return (
    <Box flexDirection="row" paddingX={1}>
      <Text color="#6B7280">{model}</Text>
      <Text color="#4B5563">  ·  </Text>
      <Text color={color}>{label}</Text>
      {planMode && (
        <>
          <Text color="#4B5563">  ·  </Text>
          <Text color="#9CA3AF">PLAN</Text>
        </>
      )}
      <Text color="#4B5563">  ·  </Text>
      <Text color="#9CA3AF">{formatTokenCount(total)} jetons</Text>
      {fileChanges > 0 && (
        <>
          <Text color="#4B5563">  ·  </Text>
          <Text color="#9CA3AF">{fileChanges} modifié{fileChanges > 1 ? "s" : ""}</Text>
        </>
      )}
      <Text color="#4B5563">  ·  </Text>
      <Text color="#6B7280">{cwd}</Text>
    </Box>
  );
};
