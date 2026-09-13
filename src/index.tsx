import { Command } from "commander";
import React from "react";
import { render } from "ink";
import { App } from "./tui/app";
import { loadConfig, updateGlobalConfig } from "./config";
import { THEMES, setActiveThemeName, type ThemeName } from "./branding/theme";
import { ensureDefaultAgents } from "./agent/agents";

const VERSION = "0.2.0";

const main = async () => {
  const program = new Command();
  program
    .name("Moliere")
    .description(
      "Moliere — agent de codage pour explorer, modifier, tester et versionner un projet local.",
    )
    .version(VERSION)
    .option("--model <id>", "Modele a utiliser pour cette session")
    .option("--theme <name>", "Theme visuel (default, soir, parchemin)")
    .option("--permissions <mode>", "Mode de permissions (default, accept-edits, plan, yolo)")
    .option("--plan", "Demarrer en mode plan (lecture seule)")
    .option("--resume <id>", "Reprendre une session sauvegardee")
    .option("--no-tui", "Desactiver la TUI (mode simple CLI)");

  program.parse(process.argv);

  const opts = program.opts();

  if (opts.theme) {
    const name = opts.theme as ThemeName;
    if (THEMES[name]) {
      setActiveThemeName(name);
      updateGlobalConfig(() => ({ theme: name }));
    }
  }

  if (opts.permissions) {
    const mode = opts.permissions as "default" | "accept-edits" | "plan" | "yolo";
    updateGlobalConfig(() => ({ permissionMode: mode }));
  }

  if (opts.model) {
    updateGlobalConfig(() => ({ defaultModel: opts.model }));
  }

  const config = loadConfig();
  if (!config.apiKey) {
    console.error("Aucune cle API trouvee.");
    console.error("Definissez MOLIERE_API_KEY dans votre .env ou dans ~/.moliere/config.json");
    process.exit(1);
  }

  ensureDefaultAgents();

  if (opts.tui === false) {
    console.log(`Moliere v${VERSION} · ${config.defaultModel}`);
    const { intro, outro, text, isCancel } = await import("@clack/prompts");
    intro("Session Moliere");
    while (true) {
      const answer = await text({ message: "Votre requete :" });
      if (isCancel(answer) || answer.toString().toLowerCase() === "quitter") break;
      console.log(`Mode simple : message recu — ${answer}`);
    }
    outro("Fin de session.");
    return;
  }

  const app = React.createElement(App);
  render(app);
};

main().catch((error) => {
  console.error("Erreur fatale :", error instanceof Error ? error.message : error);
  process.exit(1);
});
