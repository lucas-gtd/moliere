import React from "react";
import { Box, Text } from "ink";

export interface HeaderProps {
  model: string;
  version: string;
  planMode?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ model, version, planMode }) => {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box flexDirection="row">
        <Text color="#9CA3AF">MOLIÈRE</Text>
        <Text color="#6B7280">  v{version}  ·  {model}</Text>
        {planMode && (
          <Text color="#9CA3AF">  ·  PLAN</Text>
        )}
      </Box>
    </Box>
  );
};
