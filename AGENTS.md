# AGENTS.md — Instructions pour les agents de code

> Lu automatiquement par les assistants de codage (Copilot, Cursor, Claude Code,
> Continue, etc.) avant toute intervention sur ce dépôt. L'utilisateur final
> n'est pas concerné : pour la documentation utilisateur, voir `README.md`.

## 1. Identité du projet

Molière est un **agent de codage CLI** écrit en TypeScript strict, exécuté sur
**Bun 1.3+**, qui orchestre un LLM (MiniMax-M3, API OpenAI-compatible) avec un
système de tool calling et une interface TUI Ink 6 (React 19).

- Point d'entrée : `src/index.tsx` (CLI commander + Ink `render(<App/>)`).
- Boucle agent : `src/agent/loop.ts`.
- Registre d'outils : `src/tools/index.ts` → catégories `file-tools`,
  `search-tools`, `git-tools`, `command-tools`, `todo-tools`, `web-tools`,
  `user-tools`.
- Registre de slash commands : `src/commands/registry.ts`.
- TUI : `src/tui/app.tsx` et `src/tui/components/*`.

## 2. Règles non négociables

| #   | Règle                                                                                                                                                             | Raison                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| R1  | **Toujours utiliser Bun** (`bun install`, `bun test`, `bun run`).                                                                                                 | Pas de `package-lock.json` ; npm/yarn/pnpm interdits. |
| R2  | **Pas de dépendances hors `package.json`**. Ajout via `bun add <pkg>` puis commit.                                                                                | Cohérence lockless + Bun.                             |
| R3  | **TypeScript strict** : pas de `any` implicite, `noUncheckedIndexedAccess` actif.                                                                                 | `tsconfig.json` strict.                               |
| R4  | **JSX React 19** via `react-jsx` ; pas de React 18 ou antérieur.                                                                                                  | `<App/>` dans `src/index.tsx`.                        |
| R5  | **Aucune mutation hors `projectRoot`**. Utiliser `resolveProjectPath` / `resolveExistingProjectPath` / `resolveWritableProjectPath` (`src/tools/path-safety.ts`). | Sécurité chemins, blocage liens symboliques.          |
| R6  | **Aucune commande via shell**. Utiliser `runProcess` (`execFile`) avec liste d'arguments. `-e/-c/--eval` interdits pour les interpréteurs.                        | `src/tools/process.ts` + `command-tools.ts`.          |
| R7  | **Ne pas toucher** `~/.moliere/` (config globale) depuis un outil projet.                                                                                         | Séparation globale/projet stricte.                    |
| R8  | **Aucune suppression / déplacement destructif** via `runCommand` ; respecter `BLOCKED_COMMANDS` et `BLOCKED_GIT_SUBCOMMANDS`.                                     | Sécurité (`command-tools.ts`).                        |
| R9  | **Sorties d'outils = `string`** ; préfixer `Erreur :` en cas d'échec (`startsWith("Erreur")`).                                                                    | Convention `loop.ts` / `App.onToolResult`.            |
| R10 | **Tests = `bun test`** ; nouveaux tests dans `tests/*.test.ts`, fonctions pures uniquement.                                                                       | Pas de framework tiers.                               |

## 3. Patterns à suivre

### 3.1 Ajouter un outil

1. Créer (ou enrichir) un fichier catégorie dans `src/tools/`
   (`command-tools.ts`, `file-tools.ts`, `git-tools.ts`, `search-tools.ts`,
   `todo-tools.ts`, `user-tools.ts`, `web-tools.ts`).
2. Implémenter un `ToolDefinition` conforme à `src/tools/types.ts`.
3. Référencer le tableau dans `toolDefinitions` (`src/tools/index.ts`).
4. Valider les entrées via `requireString` / `optionalString` /
   `optionalInteger` / `optionalBoolean` / `optionalStringArray`
   (`src/tools/utils.ts`). Jeter `ToolInputError` sinon.
5. Pour toute écriture : appeler `context.onFileChanged?.(path)`.
6. Ajouter un test dans `tests/` ciblant au moins validation + happy path.

### 3.2 Ajouter une slash command

1. Définir `SlashCommand` conforme à `src/commands/types.ts`
   (`name`, `aliases?`, `description`, `category`, `execute`).
2. Exporter depuis un fichier dans `src/commands/` (regrouper par thème).
3. Référencer dans le tableau `COMMANDS` de `src/commands/registry.ts`.
4. Si mutation d'état TUI, utiliser `ctx.actions.*`
   (`setMessages`, `setTodos`, `setModel`, `setPermissionMode`, `setTheme`,
   `requestExit`, `requestResume`…).
5. Ajouter une assertion dans `tests/slash-commands.test.ts`.

### 3.3 Ajouter un sous-agent

Déposer un fichier `~/.moliere/agents/<nom>.md` avec frontmatter minimal :

```markdown
---
name: mon-agent
description: ...
tools: readFile, searchInFiles
---

Vous êtes ...
```

Frontmatter parsé par `parseFrontmatter` (`src/agent/agents.ts`, YAML simple clé:valeur ; `tools` = liste CSV). Lancement : `/agents run <nom> <prompt>`.

### 3.4 Ajouter un hook

Éditer `.moliere/hooks.json` (projet cible). Format :

```json
{ "PreToolUse": [...], "PostToolUse": [...], "Stop": [...], "SessionStart": [...] }
```

Chaque entrée : `{ matcher?: "toolA|toolB" | "*", command, args?, timeoutMs? }`.

### 3.5 Ajouter un thème

1. Ajouter une entrée dans `THEMES` (`src/branding/theme.ts`) avec
   `name`, `label`, `palette: Palette` (toutes les couleurs de `Palette`).
2. Mettre à jour le type `ThemeName` et `VALID_THEMES` dans `src/config.ts`.
3. Utiliser `setActiveThemeName(name)` et `getActivePalette()` côté TUI.

## 4. Anti-patterns

- ❌ `import { exec } from "node:child_process"` → utiliser `runProcess`.
- ❌ `fs.writeFile` direct sans `resolveWritableProjectPath`.
- ❌ `JSON.parse(argsText)` direct → utiliser `parseJsonObject`.
- ❌ Outil `access: "read"` qui modifie des fichiers.
- ❌ Outil retournant `void` ou un objet non-string (convention = string).
- ❌ Outil qui ignore `context.signal` (AbortController).
- ❌ Slash command qui mute `SessionState` sans passer par `ctx.actions`.
- ❌ Hook `PreToolUse` dépendant d'un état non déterministe.
- ❌ Magic strings pour `PermissionMode` / `ThemeName` — utiliser les types.
- ❌ `any`, `@ts-ignore`, `as unknown as X` non justifiés.
- ❌ Sortie d'outil > 80 000 caractères (plafond `MAX_OUTPUT_CHARS`).
- ❌ Modifier `src/index.tsx` pour shunter la TUI sans mettre à jour `--no-tui`.

## 5. Validation avant commit

```bash
bun install                 # synchro lockless
bunx tsc --noEmit           # TypeScript strict
bun test                    # tests unitaires
bun start --help            # smoke CLI
```

Toute PR doit :

- Passer `bun test`.
- 0 erreur `tsc --noEmit`.
- Documenter dans `CHANGELOG.md` (`Added` / `Changed` / `Fixed`).
- Référencer les symboles touchés avec leur chemin (`src/agent/loop.ts:runAgentLoop`).

## 6. Architecture en 30 secondes

```
CLI (commander) → src/index.tsx
                 ↓
        TUI (Ink) src/tui/app.tsx
                 ↓
        Slash command ? → src/commands/registry.ts
                 ↓ non
        runAgentLoop (src/agent/loop.ts)
            ├── streamChat (src/llm/client.ts) ── SSE ──► MiniMax
            ├── shouldPrompt → src/agent/permissions.ts
            ├── runHooks    → src/agent/hooks.ts
            ├── executeTool → src/tools/*
            └── compact     → src/agent/context.ts
                                 ↓
                          src/session/store.ts (sauvegarde)
```

Sous-agents (`src/agent/sub-agent.ts`) réutilisent `runAgentLoop` avec permissions `yolo` et sous-ensemble d'outils.

## 7. Glossaire des ancres

| Sujet               | Fichier / symbole                                                       |
| ------------------- | ----------------------------------------------------------------------- |
| Boucle principale   | `src/agent/loop.ts` → `runAgentLoop`                                    |
| Décision permission | `src/agent/permissions.ts` → `shouldPrompt`, `applyDecision`            |
| Sécurité chemins    | `src/tools/path-safety.ts` → `resolveProjectPath`                       |
| Sécurité process    | `src/tools/command-tools.ts` → `validateExecutable`, `BLOCKED_COMMANDS` |
| SSE OpenAI-compat   | `src/llm/client.ts` → `streamChat`, `parseSSE`                          |
| Outil abstrait      | `src/tools/types.ts` → `ToolDefinition`, `ToolAccess`                   |
| Gates TUI           | `src/tui/components/PermissionGate.tsx`, `AskUserGate.tsx`              |
| Session save        | `src/session/store.ts` → `saveSession`, `loadSession`                   |
| Thème               | `src/branding/theme.ts` → `THEMES`, `getActivePalette`                  |
| Sous-agents         | `src/agent/agents.ts` → `loadAgents`, `parseFrontmatter`                |
| Compaction          | `src/agent/context.ts` → `compactMessages`, `shouldCompact`             |
| Tokens              | `src/agent/tokens.ts` → `accumulateStats`, `estimateMessagesTokens`     |
