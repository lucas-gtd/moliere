import fs from "node:fs";
import path from "node:path";
import { GLOBAL_SESSIONS_DIR } from "../config";
import type { Message } from "../llm/types";

export interface SessionSummary {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  model: string;
  messageCount: number;
  tokensUsed: number;
  filesChanged: string[];
}

export interface SessionData extends SessionSummary {
  messages: Message[];
}

const ensureDir = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
    }
  }
};

const safeFileName = (id: string): string => id.replace(/[^a-zA-Z0-9_-]/g, "_");

export const saveSession = (data: SessionData): void => {
  ensureDir(GLOBAL_SESSIONS_DIR);
  const filePath = path.join(GLOBAL_SESSIONS_DIR, `${safeFileName(data.id)}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch {
  }
};

export const loadSession = (id: string): SessionData | null => {
  const filePath = path.join(GLOBAL_SESSIONS_DIR, `${safeFileName(id)}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as SessionData;
  } catch {
    return null;
  }
};

export const listSessions = (): SessionSummary[] => {
  ensureDir(GLOBAL_SESSIONS_DIR);
  const entries = fs.readdirSync(GLOBAL_SESSIONS_DIR).filter((e) => e.endsWith(".json"));
  const summaries: SessionSummary[] = [];
  for (const entry of entries) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(GLOBAL_SESSIONS_DIR, entry), "utf-8")) as SessionData;
      const { messages, ...summary } = data;
      void messages;
      summaries.push(summary);
    } catch {
    }
  }
  summaries.sort((a, b) => b.updatedAt - a.updatedAt);
  return summaries;
};

export const deleteSession = (id: string): boolean => {
  const filePath = path.join(GLOBAL_SESSIONS_DIR, `${safeFileName(id)}.json`);
  if (!fs.existsSync(filePath)) return false;
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
};

export const deriveTitle = (firstUserMessage: string | null | undefined): string => {
  if (!firstUserMessage) return "Session sans titre";
  const trimmed = firstUserMessage.trim();
  if (trimmed.length <= 60) return trimmed;
  return `${trimmed.slice(0, 57)}…`;
};
