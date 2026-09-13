# Molière — l'agent de codage artisanal français

<div align="center">

**Un agent de codage CLI complet, rapide et autonome, fier de son art de vivre.**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)
![MiniMax](https://img.shields.io/badge/MiniMax-M3-FF6A00?style=for-the-badge)
![Status](https://img.shields.io/badge/status-active-22C55E?style=for-the-badge)
![Made in France](https://img.shields.io/badge/Made%20in-France-0055A4?style=for-the-badge)

---

**Comprendre. Modifier. Vérifier.**

---

</div>

Molière est un agent de codage terminal conçu pour explorer, modifier, tester et versionner un projet local. Il s'exprime en français, respecte votre atelier, et refuse de saboter votre code. Sous le capot : une interface **TUI Ink** soignée, des **slash commands** à la Claude Code, un système de **permissions** à quatre modes, des **sous-agents** dédiés, un **plan mode**, des **hooks**, et la **persistance des sessions**.

L'API utilisée est l'**API MiniMax** (`https://api.minimax.io/v1`) — française, souveraine, compatible OpenAI.

---

## Sommaire

- [Installation](#installation)
- [Lancement](#lancement)
- [Premier contact](#premier-contact)
- [Commandes slash](#commandes-slash)
- [Outils disponibles](#outils-disponibles)
- [Modes de permissions](#modes-de-permissions)
- [Sous-agents](#sous-agents)
- [Hooks](#hooks)
- [Contexte de projet](#contexte-de-projet)
- [Thèmes](#thèmes)
- [Personnalisation](#personnalisation)
- [Architecture](#architecture)
- [Sécurité](#sécurité)
- [Crédits](#crédits)

---

## Installation

```bash
bun install
cp .env.example .env
```

Ajoutez ensuite votre clé API dans `.env` :

```env
MOLIERE_API_KEY=sk-moliere-xxxxxxxx
MOLIERE_DEFAULT_MODEL=MiniMax-M3
```

Vous pouvez obtenir une clé API MiniMax sur [api.minimax.io](https://api.minimax.io).

---

## Lancement

```bash
bun start
# ou directement
bun src/index.tsx
```

Options :

| Option | Effet |
|---|---|
| `--model <id>` | Changer le modèle pour la session |
| `--theme <nom>` | `default`, `soir` ou `parchemin` |
| `--permissions <mode>` | `default`, `accept-edits`, `plan` ou `yolo` |
| `--plan` | Démarrer en mode plan (lecture seule) |
| `--resume <id>` | Reprendre une session sauvegardée |
| `--no-tui` | Mode simple sans TUI (fallback) |

---

## Premier contact

Au démarrage, vous verrez :

```
 ⚜ M O L I È R E ⚜  v0.2.0  ·  MiniMax-M3
 ══════════════════════════════════════════════════════════════════════

 ✎ Vous ❧ Que puis-je faire pour vous ?▍
 ⚜ Entrée pour envoyer · / pour les commandes

 ⚜ MiniMax-M3  ·  Prêt  ·  0 jetons  ·  ~/dev/mon-projet
 ⚜ ❖  « Castigat ridendo mores. »
    — Molière, à votre service.
```

Posez une question en français, par exemple : `Quels sont les fichiers TypeScript du dossier src ?`

Molière explore, agit et répond avec une carte d'outil colorée. Chaque appel d'outil affiche son nom, ses arguments, sa durée et son résultat.

---

## Commandes slash

| Commande | Rôle |
|---|---|
| `/help` | Affiche l'aide des commandes slash |
| `/clear` | Réinitialise la conversation |
| `/exit` (`/quit`, `/quitter`) | Quitte Molière |
| `/status` | État détaillé : modèle, session, fichiers modifiés, hooks |
| `/cost` | Jetons consommés cette session |
| `/config` | Configuration (clé API masquée, modèles) |
| `/model <id>` | Change le modèle MiniMax |
| `/theme <nom>` | Change le thème visuel |
| `/permissions <mode>` | Change le mode de permissions |
| `/plan` | Active le mode plan |
| `/unplan` | Désactive le mode plan |
| `/init` | Crée un fichier `MOLIERE.md` à la racine |
| `/compact` | Résume l'historique pour libérer du contexte |
| `/doctor` | Diagnostic de l'environnement |
| `/sessions` | Liste, reprend ou supprime une session |
| `/agents` | Liste ou lance un sous-agent (`/agents run <nom> <prompt>`) |
| `/save` | Sauvegarde immédiate de la session |

---

## Outils disponibles

Molière expose 14 outils au modèle, organisés par catégorie :

### Lecture
- `readFile` — Lit un fichier (avec `startLine`/`endLine` pour les gros fichiers)
- `listDirectory` — Liste un dossier
- `tree` — Vue arborescente compacte
- `findFiles` — Recherche par motif (`*.ts`, `src/**/*.ts`)
- `searchInFiles` — `git grep` sécurisé avec fallback
- `gitStatus`, `gitDiff`, `gitLog` — Inspection Git

### Écriture
- `writeFile` — Crée un nouveau fichier
- `editFile` — Remplace un bloc exact unique
- `multiEditFile` — Applique plusieurs remplacements en séquence

### Commande
- `runCommand` — Exécute une commande sans shell, limitée au projet

### Planification & dialogue
- `todoWrite` / `todoRead` — Gestion de la liste de tâches
- `askUser` — Pose une question fermée (2-4 options)

### Réseau
- `webFetch` — Récupère le contenu textuel d'une URL (autorisation requise)

---

## Modes de permissions

| Mode | Lecture | Écriture | Commande | Web |
|---|---|---|---|---|
| `default` | ✓ | prompt | prompt | prompt |
| `accept-edits` | ✓ | ✓ | prompt | prompt |
| `plan` | ✓ | refus | refus | refus |
| `yolo` | ✓ | ✓ | ✓ | ✓ |

Quand un prompt apparaît, quatre choix vous sont proposés :

```
[1] Une seule fois
[2] Toujours pour ce projet
[3] Refuser une fois
[4] Toujours refuser
```

Les choix "toujours" sont persistés dans `.moliere/permissions.json`.

---

## Sous-agents

Trois sous-agents sont fournis par défaut dans `~/.moliere/agents/` :

- `explorer` — Cartographie le code en lecture seule
- `tester` — Lance les tests, analyse les échecs
- `refactor` — Propose des refactorings sans appliquer

Création dans `~/.moliere/agents/<nom>.md` avec frontmatter YAML :

```markdown
---
name: mon-agent
description: ...
tools: readFile, searchInFiles
---
Vous êtes un sous-agent spécialisé...
```

Lancement : `/agents run mon-agent <prompt>`.

---

## Hooks

`.moliere/hooks.json` permet d'exécuter des commandes shell avant/après les outils :

```json
{
  "PreToolUse": [
    { "matcher": "editFile|writeFile", "command": "bun run lint:fix" }
  ],
  "PostToolUse": [
    { "matcher": "runCommand", "command": "echo done" }
  ],
  "Stop": [
    { "command": "osascript -e 'display notification \"Molière a terminé\"'" }
  ]
}
```

Si un hook `PreToolUse` retourne un code non nul, l'outil est bloqué.

---

## Contexte de projet

Créez un fichier `MOLIERE.md` à la racine pour donner du contexte persistant à Molière (équivalent de `CLAUDE.md`). Vous pouvez utiliser `/init` pour amorcer.

---

## Thèmes

- `default` — **Bleu de France**, or, ivoire (équilibre classique)
- `soir` — **Soir d'opéra**, contrastes sombres
- `parchemin` — **Parchemin**, sépia et tons chauds

Sélection : `/theme <nom>` ou `--theme <nom>`.

---

## Personnalisation

- Config globale : `~/.moliere/config.json`
- Sessions : `~/.moliere/sessions/*.json`
- Sous-agents : `~/.moliere/agents/*.md`
- Permissions par projet : `./.moliere/permissions.json`
- Hooks par projet : `./.moliere/hooks.json`
- Contexte : `./MOLIERE.md`

---

## Architecture

```
src/
├── branding/    Identité visuelle, ASCII art, thèmes
├── llm/         Client MiniMax (streaming, tool calls, usage)
├── tools/       Registre d'outils et définitions
├── agent/       Boucle agent, permissions, hooks, sous-agents, compaction
├── commands/    Commandes slash et leur registre
├── tui/         Interface Ink (composants, Markdown, diff, surlignage)
├── session/     Persistance des sessions
├── config.ts    Configuration globale et projet
└── index.tsx    Point d'entrée (commander + Ink)
```

---

## Sécurité

- Chemins bloqués hors du projet (`path-safety.ts`)
- Symlinks résolus via `realpath` pour éviter les évasions
- Commandes exécutées **sans shell** (`execFile`)
- Liste noire de commandes destructrices (`rm`, `mv`, `sudo`, `kill`...)
- Pas d'évaluation inline (`-e`, `--eval`, `-c`) pour les interpréteurs
- Timeouts plafonnés (120 secondes)
- Sortie tronquée par défaut (80 Kio max)
- Permissions utilisateur avant chaque action mutative
- Hooks `PreToolUse` peuvent bloquer l'exécution

---

## Tests

```bash
bun test
```

14 tests couvrent les fonctions pures (parse, validation, glob, walk, Markdown, diff, art).

---

## Crédits

- **API** : [MiniMax](https://api.minimax.io)
- **Interface** : [Ink](https://github.com/vadimdemedes/ink) · [Marked](https://marked.js.org) · [cli-highlight](https://github.com/fredericrous/chalk-syntax)
- **Citations** : Molière lui-même.

<div align="center">

---

*« Le vrai mérite est de bien faire, sans espérer qu'on en parle. »*

**Molière, à votre service.**

</div>
