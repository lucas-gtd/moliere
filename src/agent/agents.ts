import fs from "node:fs";
import path from "node:path";
import { GLOBAL_AGENTS_DIR, PROJECT_AGENTS_DIR } from "../config";

export interface AgentDefinition {
  name: string;
  description: string;
  prompt: string;
  tools?: string[];
  model?: string;
  source: "global" | "project";
}

const parseFrontmatter = (text: string): { data: Record<string, unknown>; body: string } => {
  if (!text.startsWith("---")) return { data: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { data: {}, body: text };
  const frontmatterBlock = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\n/, "");
  const data: Record<string, unknown> = {};
  for (const line of frontmatterBlock.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    if (key) data[key] = value.replace(/^["']|["']$/g, "");
  }
  return { data, body };
};

const readAgentFile = (filePath: string, source: "global" | "project"): AgentDefinition | null => {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const { data, body } = parseFrontmatter(content);
    const name = typeof data.name === "string" ? data.name : path.basename(filePath, ".md");
    const description = typeof data.description === "string" ? data.description : "Sous-agent Molière.";
    return {
      name,
      description,
      prompt: body.trim(),
      tools: typeof data.tools === "string" ? data.tools.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
      model: typeof data.model === "string" ? data.model : undefined,
      source,
    };
  } catch {
    return null;
  }
};

const ensureDir = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
    }
  }
};

export const loadAgents = (): AgentDefinition[] => {
  const agents: AgentDefinition[] = [];
  for (const [dir, source] of [
    [GLOBAL_AGENTS_DIR, "global"],
    [path.join(process.cwd(), PROJECT_AGENTS_DIR), "project"],
  ] as const) {
    ensureDir(dir);
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      const agent = readAgentFile(path.join(dir, entry), source);
      if (agent) agents.push(agent);
    }
  }
  return agents;
};

export const getAgent = (name: string): AgentDefinition | undefined =>
  loadAgents().find((a) => a.name === name);

export const ensureDefaultAgents = (): void => {
  ensureDir(GLOBAL_AGENTS_DIR);
  const defaults: Array<{ file: string; content: string }> = [
    {
      file: "explorer.md",
      content: `---
name: explorer
description: Explore le projet en lecture seule pour cartographier le code.
tools: readFile, listDirectory, tree, findFiles, searchInFiles, gitStatus, gitLog
---
Vous êtes un explorateur de code. Votre rôle est de cartographier une zone du projet en lecture seule. Utilisez readFile, searchInFiles, tree, listDirectory. Ne modifiez rien. Produisez un résumé structuré des fichiers et fonctions clés trouvés.`,
    },
    {
      file: "tester.md",
      content: `---
name: tester
description: Lance les tests et lint du projet, résume les échecs.
tools: runCommand, readFile, gitStatus
---
Vous êtes un testeur. Lancez les tests (bun test, npm test, etc.), analysez les échecs, proposez des correctifs sans les appliquer.`,
    },
    {
      file: "refactor.md",
      content: `---
name: refactor
description: Propose des refactorings en lecture seule, suggère les diffs.
tools: readFile, searchInFiles, gitDiff
---
Vous êtes un refactorer. Analysez le code, proposez des refactorings sous forme de suggestions de diff sans les écrire vous-même.`,
    },
  ];
  for (const def of defaults) {
    const target = path.join(GLOBAL_AGENTS_DIR, def.file);
    if (!fs.existsSync(target)) {
      try {
        fs.writeFileSync(target, def.content, "utf-8");
      } catch {
      }
    }
  }
};
