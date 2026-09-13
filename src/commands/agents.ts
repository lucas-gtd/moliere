import fs from "node:fs";
import path from "node:path";
import type { SlashCommand } from "./types";
import { runSubAgent } from "../agent/sub-agent";
import { loadAgents, ensureDefaultAgents } from "../agent/agents";
import { listSessions, deleteSession } from "../session/store";

export const agentsCommand: SlashCommand = {
  name: "agents",
  description: "Lister et exécuter les sous-agents disponibles",
  category: "agent",
  execute: async (args, context) => {
    ensureDefaultAgents();
    const agents = loadAgents();
    const parts = args.trim().split(/\s+/);
    const subcommand = parts[0];

    if (!subcommand || subcommand === "list") {
      const lines = ["Sous-agents disponibles :"];
      for (const agent of agents) {
        lines.push(`  • ${agent.name} [${agent.source}] — ${agent.description}`);
      }
      lines.push("");
      lines.push("Usage : /agents run <nom> <prompt>");
      return lines.join("\n");
    }

    if (subcommand === "run") {
      const name = parts[1];
      const prompt = parts.slice(2).join(" ");
      if (!name || !prompt) return "Usage : /agents run <nom> <prompt>";
      const response = await context.actions.runSubAgent(name, prompt);
      context.actions.pushMessage({ role: "assistant", content: response });
      return null;
    }

    return `Sous-commande inconnue : ${subcommand}. Utilisez /agents list ou /agents run.`;
  },
};

export const sessionsCommand: SlashCommand = {
  name: "sessions",
  description: "Lister, reprendre ou supprimer une session sauvegardée",
  category: "session",
  execute: (args) => {
    const parts = args.trim().split(/\s+/);
    const subcommand = parts[0];

    if (!subcommand || subcommand === "list") {
      const sessions = listSessions();
      if (sessions.length === 0) return "Aucune session sauvegardée.";
      const lines = ["Sessions sauvegardées :"];
      for (const s of sessions.slice(0, 20)) {
        const date = new Date(s.updatedAt).toISOString().slice(0, 16).replace("T", " ");
        lines.push(`  • ${s.id} — ${date} — ${s.title} (${s.messageCount} messages)`);
      }
      return lines.join("\n");
    }

    if (subcommand === "resume") {
      const id = parts[1];
      if (!id) return "Usage : /sessions resume <id>";
      return `RESUME::${id}`;
    }

    if (subcommand === "delete") {
      const id = parts[1];
      if (!id) return "Usage : /sessions delete <id>";
      const ok = deleteSession(id);
      return ok ? `Session ${id} supprimée.` : `Session ${id} introuvable.`;
    }

    return `Sous-commande inconnue : ${subcommand}.`;
  },
};

export const doctorCommand: SlashCommand = {
  name: "doctor",
  description: "Diagnostic de l'environnement",
  category: "tools",
  execute: () => {
    const lines: string[] = [];
    lines.push("Diagnostic de l'environnement :");
    lines.push(`  Bun          : ${process.versions.bun ?? "(non disponible)"}`);
    lines.push(`  Node         : ${process.versions.node}`);
    lines.push(`  Plateforme   : ${process.platform} ${process.arch}`);
    lines.push(`  TTY          : ${Boolean(process.stdout.isTTY)}`);
    lines.push(`  Couleur      : ${process.stdout.isTTY ? "oui" : "désactivée"}`);
    lines.push(`  Largeur      : ${process.stdout.columns ?? "?"}`);
    lines.push(`  CWD          : ${process.cwd()}`);
    const apiKey = process.env.MOLIERE_API_KEY;
    lines.push(`  Clé API      : ${apiKey ? "définie" : "MANQUANTE"}`);
    const moliereDir = path.join(process.cwd(), ".moliere");
    lines.push(`  .moliere/    : ${fs.existsSync(moliereDir) ? "présent" : "absent"}`);
    return lines.join("\n");
  },
};

export const initCommand: SlashCommand = {
  name: "init",
  description: "Initialiser MOLIERE.md avec une description du projet",
  category: "tools",
  execute: async (_args, context) => {
    await context.actions.requestInitProject();
    return null;
  },
};
