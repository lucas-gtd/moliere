import type { SlashCommand } from "./types";
import { COPY } from "../branding/copy";

const formatMode = (mode: string): string => {
  switch (mode) {
    case "default":
      return "défaut (confirmation à chaque action)";
    case "accept-edits":
      return "acceptation automatique des modifications de fichiers";
    case "plan":
      return "mode plan (lecture seule)";
    case "yolo":
      return "audacieux (toutes les actions)";
    default:
      return mode;
  }
};

export const helpCommand: SlashCommand = {
  name: "help",
  aliases: ["aide", "h"],
  description: "Afficher l'aide des commandes slash",
  category: "general",
  execute: (_args, context) => {
    const lines: string[] = [];
    lines.push(`${COPY.projectName} — commandes slash`);
    lines.push("");
    lines.push("Général :");
    lines.push("  /help                — afficher cette aide");
    lines.push("  /clear               — réinitialiser la conversation");
    lines.push("  /exit, /quit         — quitter");
    lines.push("");
    lines.push("Session :");
    lines.push("  /status              — état de la session courante");
    lines.push("  /cost                — tokens consommés");
    lines.push("  /sessions            — lister/reprendre une session");
    lines.push("  /save                — sauvegarder maintenant");
    lines.push("");
    lines.push("Modèle & configuration :");
    lines.push("  /model               — choisir le modèle");
    lines.push("  /config              — configuration actuelle");
    lines.push("  /theme               — changer de thème");
    lines.push("  /permissions         — mode de permissions");
    lines.push("  /plan                — entrer/sortir du mode plan");
    lines.push("");
    lines.push("Outils :");
    lines.push("  /init                — créer MOLIERE.md");
    lines.push("  /compact             — résumer l'historique");
    lines.push("  /doctor              — diagnostic de l'environnement");
    lines.push("");
    lines.push("Agents :");
    lines.push("  /agents              — lister les sous-agents");
    lines.push("");
    lines.push(`Mode courant : ${formatMode("default")} (sera ajusté en ${context.state.model}).`);
    return lines.join("\n");
  },
};
