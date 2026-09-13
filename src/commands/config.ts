import type { SlashCommand } from "./types";
import { listModels, getModel } from "../llm/models";
import { formatTokenCount } from "../agent/tokens";
import { maskApiKey } from "../config";
import { listSessions } from "../session/store";
import { describeHooks } from "../agent/hooks";

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Kio`;
  return `${(n / 1024 / 1024).toFixed(2)} Mio`;
};

export const statusCommand: SlashCommand = {
  name: "status",
  description: "Afficher l'état détaillé de la session courante",
  category: "session",
  execute: (_args, context) => {
    const model = getModel(context.state.model);
    const sessions = listSessions();
    const tokens = context.state.todos;
    void tokens;
    const lines: string[] = [];
    lines.push("État de la session");
    lines.push("");
    lines.push(`  Modèle        : ${context.state.model}${model?.description ? ` (${model.description})` : ""}`);
    lines.push(`  Fenêtre       : ${model?.contextWindow ? formatTokenCount(model.contextWindow) : "?"} jetons`);
    lines.push(`  Session       : ${context.state.sessionId}`);
    lines.push(`  Répertoire    : ${context.state.cwd}`);
    lines.push(`  Fichiers modifiés : ${context.state.filesChanged.size}`);
    lines.push(`  Tâches        : ${context.state.todos.length}`);
    lines.push("");
    lines.push(`Sessions sauvegardées : ${sessions.length}`);
    lines.push("");
    lines.push("Hooks actifs :");
    lines.push(describeHooks().split("\n").map((l) => "  " + l).join("\n"));
    return lines.join("\n");
  },
};

export const costCommand: SlashCommand = {
  name: "cost",
  description: "Afficher les jetons consommés cette session",
  category: "session",
  execute: () => {
    return "Utilisez la barre de statut pour les jetons en direct.";
  },
};

export const configCommand: SlashCommand = {
  name: "config",
  description: "Afficher la configuration actuelle (clé API masquée)",
  category: "config",
  execute: () => {
    const apiKey = process.env.MOLIERE_API_KEY ?? "";
    const baseUrl = process.env.MOLIERE_BASE_URL ?? "https://api.minimax.io/v1";
    const model = process.env.MOLIERE_DEFAULT_MODEL ?? "MiniMax-M3";
    const lines: string[] = [];
    lines.push("Configuration :");
    lines.push(`  MOLIERE_API_KEY       = ${maskApiKey(apiKey)}`);
    lines.push(`  MOLIERE_BASE_URL      = ${baseUrl}`);
    lines.push(`  MOLIERE_DEFAULT_MODEL = ${model}`);
    lines.push("");
    lines.push("Modèles disponibles :");
    for (const m of listModels()) {
      lines.push(`  • ${m.id} — ${m.label}${m.description ? ` (${m.description})` : ""}`);
    }
    return lines.join("\n");
  },
};

export const modelCommand: SlashCommand = {
  name: "model",
  description: "Changer de modèle",
  category: "config",
  execute: (args, context) => {
    const trimmed = args.trim();
    if (!trimmed) {
      return "Modèles disponibles :\n" + listModels().map((m) => `  • ${m.id} — ${m.label}`).join("\n") + "\n\nUsage : /model <id>";
    }
    const available = listModels().some((m) => m.id === trimmed);
    if (!available) {
      return `Modèle "${trimmed}" inconnu. Utilisez /model sans argument pour la liste.`;
    }
    context.actions.setModel(trimmed);
    return `Modèle actif : ${trimmed}`;
  },
};

export const themeCommand: SlashCommand = {
  name: "theme",
  description: "Changer le thème visuel",
  category: "config",
  execute: (args, context) => {
    const trimmed = args.trim();
    const themes = ["default", "soir", "parchemin"];
    if (!trimmed) {
      return `Thèmes disponibles : ${themes.join(", ")}\n\nUsage : /theme <nom>`;
    }
    if (!themes.includes(trimmed)) {
      return `Thème "${trimmed}" inconnu.`;
    }
    context.actions.setTheme(trimmed as "default" | "soir" | "parchemin");
    return `Thème actif : ${trimmed}`;
  },
};

export const permissionsCommand: SlashCommand = {
  name: "permissions",
  aliases: ["perm"],
  description: "Changer le mode de permissions",
  category: "config",
  execute: (args, context) => {
    const modes = ["default", "accept-edits", "plan", "yolo"];
    const trimmed = args.trim();
    if (!trimmed) {
      return `Modes disponibles :\n  ${modes.join(", ")}\n\nUsage : /permissions <mode>`;
    }
    if (!modes.includes(trimmed)) {
      return `Mode "${trimmed}" inconnu.`;
    }
    context.actions.setPermissionMode(trimmed as "default" | "accept-edits" | "plan" | "yolo");
    return `Mode de permissions : ${trimmed}`;
  },
};

export const planCommand: SlashCommand = {
  name: "plan",
  description: "Activer/désactiver le mode plan",
  category: "config",
  execute: (_args, context) => {
    context.actions.setPlanMode(true);
    return "Mode plan activé. Les actions mutatives seront bloquées tant que vous restez dans ce mode.";
  },
};

export const planOffCommand: SlashCommand = {
  name: "unplan",
  aliases: ["plan-off"],
  description: "Désactiver le mode plan",
  category: "config",
  execute: (_args, context) => {
    context.actions.setPlanMode(false);
    return "Mode plan désactivé.";
  },
};

export const sizeCommand: SlashCommand = {
  name: "size",
  description: "Afficher la taille du projet",
  category: "tools",
  execute: () => {
    const cwd = process.cwd();
    return `Répertoire : ${cwd}`;
  },
};

void formatBytes;
