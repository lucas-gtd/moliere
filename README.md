# Molière — agent de codage CLI

<div align="center">

**Un agent de codage terminal pour explorer, modifier, tester et versionner un projet local.**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)
![MiniMax](https://img.shields.io/badge/MiniMax-M3-FF6A00?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-22C55E?style=for-the-badge)

</div>

Molière est un agent de codage CLI écrit en TypeScript, propulsé par [Bun](https://bun.sh). Il s'appuie sur l'API MiniMax et propose une interface TUI Ink, des slash commands, un système de permissions à quatre modes, des sous-agents dédiés, un plan mode, des hooks et la persistance des sessions.

## Sommaire

- [Installation](#installation)
- [Lancement](#lancement)
- [Commandes slash](#commandes-slash)
- [Outils](#outils)
- [Modes de permissions](#modes-de-permissions)
- [Sous-agents](#sous-agents)
- [Hooks](#hooks)
- [Contexte de projet](#contexte-de-projet)
- [Thèmes](#thèmes)
- [Architecture](#architecture)
- [Sécurité](#sécurité)
- [Tests](#tests)
- [Contribution](#contribution)
- [Crédits](#crédits)

## Installation

```bash
bun install
cp .env.example .env
```

Renseignez ensuite votre clé API dans `.env` :

```env
MOLIERE_API_KEY=sk-xxxxxxxx
MOLIERE_DEFAULT_MODEL=MiniMax-M3
```

Obtenez une clé sur [api.minimax.io](https://api.minimax.io).

## Lancement

```bash
bun start
```

Options CLI :

| Option                 | Effet                                       |
| ---------------------- | ------------------------------------------- |
| `--model <id>`         | Modèle pour cette session                   |
| `--theme <nom>`        | `default`, `soir` ou `parchemin`            |
| `--permissions <mode>` | `default`, `accept-edits`, `plan` ou `yolo` |
| `--plan`               | Démarrer en mode plan (lecture seule)       |
| `--resume <id>`        | Reprendre une session sauvegardée           |
| `--no-tui`             | Mode CLI simple sans TUI                    |

## Commandes slash

| Commande                      | Rôle                                                        |
| ----------------------------- | ----------------------------------------------------------- |
| `/help` (`/aide`)             | Affiche les commandes slash                                 |
| `/clear`                      | Réinitialise la conversation                                |
| `/exit` (`/quit`, `/quitter`) | Quitte Molière                                              |
| `/status`                     | État détaillé (modèle, session, fichiers, hooks)            |
| `/cost`                       | Jetons consommés cette session                              |
| `/config`                     | Configuration (clé masquée, modèles)                        |
| `/model <id>`                 | Change le modèle                                            |
| `/theme <nom>`                | Change le thème visuel                                      |
| `/permissions <mode>`         | Change le mode de permissions                               |
| `/plan` / `/unplan`           | Active ou désactive le mode plan                            |
| `/init`                       | Crée un fichier `MOLIERE.md` à la racine                    |
| `/compact`                    | Résume l'historique pour libérer du contexte                |
| `/doctor`                     | Diagnostic de l'environnement                               |
| `/sessions`                   | Liste, reprend ou supprime une session                      |
| `/agents`                     | Liste ou lance un sous-agent (`/agents run <nom> <prompt>`) |
| `/save`                       | Sauvegarde immédiate de la session                          |

## Outils

Quatorze outils sont exposés au modèle, organisés par catégorie.

### Lecture

- `readFile` — Lit un fichier (avec `startLine`/`endLine` pour les gros fichiers)
- `listDirectory` — Liste un dossier
- `tree` — Vue arborescente compacte
- `findFiles` — Recherche par motif (`*.ts`, `src/**/*.ts`)
- `searchInFiles` — `git grep` avec fallback
- `gitStatus`, `gitDiff`, `gitLog` — Inspection Git

### Écriture

- `writeFile` — Crée un nouveau fichier
- `editFile` — Remplace un bloc exact unique
- `multiEditFile` — Applique plusieurs remplacements en séquence

### Commande

- `runCommand` — Exécute une commande sans shell, limitée au projet

### Planification et dialogue

- `todoWrite` / `todoRead` — Gestion de la liste de tâches
- `askUser` — Question fermée (2 à 4 options)

### Réseau

- `webFetch` — Récupère le contenu textuel d'une URL (autorisation requise)

## Modes de permissions

| Mode           | Lecture | Écriture | Commande | Web    |
| -------------- | ------- | -------- | -------- | ------ |
| `default`      | ✓       | prompt   | prompt   | prompt |
| `accept-edits` | ✓       | ✓        | prompt   | prompt |
| `plan`         | ✓       | refus    | refus    | refus  |
| `yolo`         | ✓       | ✓        | ✓        | ✓      |

Quand un prompt apparaît, quatre choix sont proposés :

```
[1] Une seule fois
[2] Toujours pour ce projet
[3] Refuser une fois
[4] Toujours refuser
```

Les choix persistants sont stockés dans `.moliere/permissions.json`.

## Sous-agents

Trois sous-agents sont fournis par défaut dans `~/.moliere/agents/` :

- `explorer` — Cartographie le code en lecture seule
- `tester` — Lance les tests, analyse les échecs
- `refactor` — Propose des refactorings sans les appliquer

Créez vos propres agents dans `~/.moliere/agents/<nom>.md` avec un frontmatter YAML :

```markdown
---
name: mon-agent
description: ...
tools: readFile, searchInFiles
---

Vous êtes un sous-agent spécialisé...
```

Lancement : `/agents run mon-agent <prompt>`.

## Hooks

Le fichier `.moliere/hooks.json` permet d'exécuter des commandes shell avant ou après chaque outil :

```json
{
  "PreToolUse": [
    { "matcher": "editFile|writeFile", "command": "bun run lint:fix" }
  ],
  "PostToolUse": [{ "matcher": "runCommand", "command": "echo done" }],
  "Stop": [
    { "command": "osascript -e 'display notification \"Molière a terminé\"'" }
  ]
}
```

Un hook `PreToolUse` retournant un code non nul bloque l'outil.

## Contexte de projet

Créez un fichier `MOLIERE.md` à la racine pour donner du contexte persistant à l'agent (équivalent de `CLAUDE.md`). La commande `/init` en amorce un.

## Thèmes

- `default` — **Classique**, bleu, or, ivoire
- `soir` — **Soir**, contrastes sombres
- `parchemin` — **Parchemin**, sépia et tons chauds

Sélection : `/theme <nom>` ou `--theme <nom>`.

## Architecture

```
src/
├── branding/    Identité visuelle, ASCII art, thèmes
├── llm/         Client MiniMax (streaming, tool calls, usage)
├── tools/       Registre d'outils et définitions
├── agent/       Boucle agent, permissions, hooks, sous-agents, compaction
├── commands/    Commandes slash et leur registre
├── tui/         Interface Ink (composants, Markdown, diff)
├── session/     Persistance des sessions
├── config.ts    Configuration globale et projet
└── index.tsx    Point d'entrée (commander + Ink)
```

## Sécurité

- Chemins résolus via `realpath` pour bloquer les évasions hors projet
- Commandes exécutées **sans shell** (`execFile`)
- Liste noire des commandes destructrices (`rm`, `mv`, `sudo`, `kill`...)
- Pas d'évaluation inline (`-e`, `--eval`, `-c`) pour les interpréteurs
- Timeouts plafonnés (120 secondes)
- Sortie tronquée par défaut (80 Kio max)
- Permissions utilisateur avant chaque action mutative
- Hooks `PreToolUse` peuvent bloquer l'exécution

## Tests

```bash
bun test
```

Les tests couvrent les fonctions pures (parse, validation, glob, walk, Markdown, diff, art).

## Contribution

Les contributions sont les bienvenues. Consultez [`CONTRIBUTING.md`](./CONTRIBUTING.md) pour la mise en place, les conventions de code et le processus de pull request. Les agents de code automatisés (Copilot, Cursor, Claude Code, etc.) doivent lire [`AGENTS.md`](./AGENTS.md) avant toute intervention. Pour les questions de comportement de la communauté, voir [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md). Pour signaler une faille de sécurité, voir [`SECURITY.md`](./SECURITY.md).

## Crédits

- **API** : [MiniMax](https://api.minimax.io)
- **Interface** : [Ink](https://github.com/vadimdemedes/ink) · [Marked](https://marked.js.org) · [cli-highlight](https://github.com/fredericrous/chalk-syntax)
