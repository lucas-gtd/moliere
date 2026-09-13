import type { SlashCommand } from "./types";

export const clearCommand: SlashCommand = {
  name: "clear",
  aliases: ["reset", "cls"],
  description: "Réinitialiser la conversation (en gardant l'historique)",
  category: "session",
  execute: (_args, context) => {
    context.actions.requestClear();
    return null;
  },
};

export const exitCommand: SlashCommand = {
  name: "exit",
  aliases: ["quit", "q"],
  description: "Quitter Molière",
  category: "general",
  execute: () => {
    return null;
  },
};

export const quitAlias: SlashCommand = {
  ...exitCommand,
  name: "quitter",
  description: "Quitter Molière (alias français)",
};

export const saveCommand: SlashCommand = {
  name: "save",
  description: "Sauvegarder la session actuelle",
  category: "session",
  execute: (_args, context) => {
    context.actions.saveSessionNow();
    return "Session sauvegardée.";
  },
};
