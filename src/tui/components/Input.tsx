import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useInput } from "ink";

export interface InputProps {
  onSubmit: (text: string) => void;
  onChange?: (value: string) => void;
  onHistory?: (direction: "prev" | "next") => string | null;
  onTabComplete?: (currentValue: string) => string | null;
  placeholder?: string;
  disabled?: boolean;
}

const useBlink = (intervalMs = 600): boolean => {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setVisible((v) => !v), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return visible;
};

export const Input: React.FC<InputProps> = ({
  onSubmit,
  onChange,
  onHistory,
  onTabComplete,
  placeholder,
  disabled,
}) => {
  const [value, setValue] = useState("");
  const valueRef = useRef("");
  const blink = useBlink(600);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.tab) {
        const completed = onTabComplete?.(valueRef.current);
        if (completed !== null && completed !== undefined) {
          setValue(completed);
        }
        return;
      }

      if (key.return) {
        const submitted = valueRef.current;
        if (submitted.trim().length === 0) return;
        onSubmit(submitted);
        setValue("");
        return;
      }

      if (key.upArrow) {
        const prev = onHistory?.("prev");
        if (prev !== null && prev !== undefined) {
          setValue(prev);
        }
        return;
      }

      if (key.downArrow) {
        const next = onHistory?.("next");
        if (next !== null && next !== undefined) {
          setValue(next);
        }
        return;
      }

      if (key.backspace || key.delete) {
        setValue((v) => {
          const next = v.slice(0, Math.max(0, v.length - 1));
          onChange?.(next);
          return next;
        });
        return;
      }

      if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) return;

      if (key.ctrl && input === "c") {
        process.exit(0);
      }

      setValue((v) => {
        const next = v + input;
        onChange?.(next);
        return next;
      });
    },
    { isActive: !disabled },
  );

  const isPlaceholder = !value;
  const displayText = value || placeholder || "Saisissez votre demande et appuyez sur Entrée.";
  const isSlash = value.startsWith("/");

  return (
    <Box flexDirection="column" paddingX={1} marginY={1} borderStyle="single" borderColor="#374151">
      <Box flexDirection="row">
        {isPlaceholder ? (
          <Text color="#6B7280">{blink ? "▍ " : "  "}{displayText}</Text>
        ) : (
          <Text color={isSlash ? "#9CA3AF" : "#E5E7EB"}>{displayText}{blink ? "▍" : " "}</Text>
        )}
      </Box>
    </Box>
  );
};
