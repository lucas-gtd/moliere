import React from "react";
import { Box, Text } from "ink";
import { CHECK, CROSS, BULLET } from "../../branding/art";

export type ToolStatus = "running" | "success" | "error" | "denied";

export interface ToolCardProps {
  name: string;
  status: ToolStatus;
  argsPreview: string;
  result?: string;
  durationMs?: number;
}

const statusIcon = (status: ToolStatus): string => {
  switch (status) {
    case "running":
      return "\u00B7";
    case "success":
      return CHECK;
    case "error":
      return CROSS;
    case "denied":
      return BULLET;
  }
};

export const ToolCard: React.FC<ToolCardProps> = ({ name, status, argsPreview, result, durationMs }) => {
  const icon = statusIcon(status);
  const resultPreview = result
    ? result.length > 600
      ? `${result.slice(0, 600)}\n\x1b[38;5;246m... [tronqué]\x1b[0m`
      : result
    : null;
  return (
    <Box flexDirection="column" marginY={1} paddingX={1}>
      <Box flexDirection="row">
        <Text>
          <Text color="#6B7280">[{icon}] </Text>
          <Text color="#9CA3AF">{name}</Text>
          <Text color="#6B7280">  ·  </Text>
          <Text color="#6B7280">{argsPreview}</Text>
          {typeof durationMs === "number" && (
            <>
              <Text color="#6B7280">  ·  </Text>
              <Text color="#6B7280">{durationMs}ms</Text>
            </>
          )}
        </Text>
      </Box>
      {resultPreview && (
        <Box flexDirection="column" marginTop={1} paddingLeft={2}>
          <Text color="#9CA3AF">{resultPreview}</Text>
        </Box>
      )}
      {status === "denied" && (
        <Text color="#6B7280">Action refusée par l'utilisateur.</Text>
      )}
    </Box>
  );
};
