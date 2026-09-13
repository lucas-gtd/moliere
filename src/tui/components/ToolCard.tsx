import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { CHECK, CROSS, BULLET } from "../../branding/art";

export type ToolStatus = "running" | "success" | "error" | "denied";

export interface ToolCardProps {
  name: string;
  status: ToolStatus;
  argsPreview: string;
  result?: string;
  durationMs?: number;
}

const MAX_PREVIEW_LINES = 4;
const MAX_PREVIEW_CHARS = 280;

const truncate = (result: string, maxChars: number, maxLines: number): { preview: string; hiddenLines: number; truncated: boolean } => {
  const lines = result.split("\n");
  const totalLines = lines.length;
  const totalChars = result.length;
  const isLineTruncated = totalLines > maxLines;
  const isCharTruncated = totalChars > maxChars;

  let previewLines = lines.slice(0, maxLines);
  // Also clamp preview line length to keep the card compact.
  previewLines = previewLines.map((line) => (line.length > maxChars ? line.slice(0, maxChars) + "…" : line));
  const preview = previewLines.join("\n");
  const truncated = isLineTruncated || isCharTruncated;
  const hiddenLines = Math.max(0, totalLines - maxLines);
  return { preview, hiddenLines, truncated };
};

export const ToolCard: React.FC<ToolCardProps> = ({ name, status, argsPreview, result, durationMs }) => {
  const previewInfo = result ? truncate(result, MAX_PREVIEW_CHARS, MAX_PREVIEW_LINES) : null;

  return (
    <Box flexDirection="column" marginY={1} paddingX={1}>
      <Box flexDirection="row" alignItems="center">
        {status === "running" ? (
          <Text color="#9CA3AF">
            <Spinner type="dots" />
            {"  "}
          </Text>
        ) : (
          <Text color="#6B7280">[{status === "denied" ? BULLET : status === "error" ? CROSS : CHECK}] </Text>
        )}
        <Text color="#9CA3AF">{name}</Text>
        {argsPreview && (
          <>
            <Text color="#4B5563">  ·  </Text>
            <Text color="#6B7280">{argsPreview}</Text>
          </>
        )}
        {typeof durationMs === "number" && (
          <>
            <Text color="#4B5563">  ·  </Text>
            <Text color="#6B7280">{durationMs}ms</Text>
          </>
        )}
        {status === "running" && (
          <Text color="#6B7280">  · exécution…</Text>
        )}
      </Box>
      {previewInfo && previewInfo.preview && (
        <Box flexDirection="column" marginTop={1} paddingLeft={2}>
          <Text color="#9CA3AF">{previewInfo.preview}</Text>
          {previewInfo.truncated && status !== "running" && (
            <Text color="#4B5563">
              {previewInfo.hiddenLines > 0
                ? `… (${previewInfo.hiddenLines} ligne${previewInfo.hiddenLines > 1 ? "s" : ""} masquée${previewInfo.hiddenLines > 1 ? "s" : ""})`
                : "… (tronqué)"}
            </Text>
          )}
        </Box>
      )}
      {status === "denied" && (
        <Box marginTop={1} paddingLeft={2}>
          <Text color="#6B7280">Action refusée par l'utilisateur.</Text>
        </Box>
      )}
    </Box>
  );
};
