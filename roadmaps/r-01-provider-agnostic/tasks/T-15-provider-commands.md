# T-15 — Ajouter `/provider list|use|info`

> **Statut** : `TODO` · **Priorité** : `P1` · **Effort** : `M`

## But

Introduire une nouvelle slash command `/provider` avec sous-commandes
`list`, `use`, `info` pour piloter le provider actif sans éditer
manuellement `.env`. `/provider list` affiche la matrice des providers
configurés ; `/provider use <id>` bascule `activeProvider` et persiste le
choix dans la config globale ; `/provider info <id>` détaille un provider
(mode d'auth, baseUrl masquée, modèles disponibles, clé API présente ou
non). Résultat : UX cohérente pour le multi-provider, sans quitter la TUI.

## Pré-requis

- T-04 (TODO) — `MoliereConfig.providers` + `activeProvider` typés.
- T-05 (TODO) — `loadConfig` charge `MOLIERE_PROVIDER`, `MOLIERE_<ID>_API_KEY`.
- T-06 (TODO) — `getActiveProvider()` et `listProviders()` du registre.
- T-13 (TODO) — `MODELS_BY_PROVIDER`, `listProviders`.
- T-14 (TODO) — `modelCommand` appelle `actions.setProvider` (introduit ici).

## Fichiers touchés

- `src/commands/provider.ts` — **création** : nouvelles slash commands.
- `src/commands/registry.ts` — enregistrement de `providerCommand` et de
  ses sous-commandes (registre plat : `/provider`, `/provider-list`,
  `/provider-use`, `/provider-info` ou dispatch interne — voir étape 2).
- `src/commands/types.ts` — ajout de `setProvider(providerId: string): void`
  dans `SlashCommandContext.actions`.
- `src/tui/app.tsx` — branchement `setProvider` dans le reducer TUI (un
  `useState` ou `setState` qui appelle `saveGlobalConfig`).
- `tests/commands-provider.test.ts` — **création** : tests dispatch,
  bascule, persistance.

## Étapes

1. **Étendre `SlashCommandContext.actions`** (`src/commands/types.ts:13-32`) :

   ```ts
   setProvider: (providerId: string) => void;
   ```

   Implémentation côté TUI (`src/tui/app.tsx`) :

   ```tsx
   const setProvider = (providerId: string) => {
     const valid = (listProviders() as string[]).includes(providerId);
     if (!valid) return;
     updateGlobalConfig((cfg) => ({ ...cfg, activeProvider: providerId }));
     setState((s) => ({ ...s, activeProvider: providerId as ProviderId }));
   };
   ```

2. **Choix d'API** : le registre `src/commands/registry.ts` attend des
   `SlashCommand` plats. On expose **une seule commande `/provider`** qui
   dispatche sur le premier argument (`list`, `use`, `info`, `""`).
   Convention identique à `/permissions` qui prend un argument.

   - `/provider` (sans argument) → état courant + menu d'aide.
   - `/provider list` → matrice des providers.
   - `/provider use <id>` → bascule.
   - `/provider info <id>` → détails.

3. **Implémentation** (`src/commands/provider.ts`) :

   ```ts
   import type { SlashCommand } from "./types";
   import { listProviders, MODELS_BY_PROVIDER } from "../llm/models";
   import { loadConfig, saveGlobalConfig, maskApiKey } from "../config";
   import type { ProviderId } from "../llm/types";

   const KNOWN_IDS = listProviders();

   const formatProviderRow = (id: ProviderId, active: boolean): string => {
     const cfg = loadConfig();
     const providerCfg = cfg.providers?.[id];
     const hasKey = Boolean(providerCfg?.apiKey) || Boolean(cfg.apiKey && id === (cfg.activeProvider ?? "minimax"));
     const mark = active ? "●" : "○";
     return `  ${mark} ${id.padEnd(12)} ${hasKey ? " clé présente" : " clé absente"}`;
   };

   export const providerCommand: SlashCommand = {
     name: "provider",
     description: "Piloter le provider actif (list|use|info)",
     category: "config",
     execute: (args, context) => {
       const parts = args.trim().split(/\s+/);
       const sub = parts[0] ?? "";
       const rest = parts.slice(1).join(" ");
       const config = loadConfig();
       const active = (config.activeProvider ?? "minimax") as ProviderId;

       if (sub === "" || sub === "help") {
         const lines: string[] = [];
         lines.push(`Provider actif : ${active}`);
         lines.push("");
         lines.push("Sous-commandes :");
         lines.push("  /provider              # état courant");
         lines.push("  /provider list         # tous les providers configurés");
         lines.push("  /provider use <id>     # basculer le provider actif");
         lines.push("  /provider info <id>    # détails d'un provider");
         return lines.join("\n");
       }

       if (sub === "list") {
         const lines: string[] = ["Providers configurés :\n"];
         for (const id of KNOWN_IDS) lines.push(formatProviderRow(id, id === active));
         lines.push("");
         lines.push("Légende : ● actif, ○ inactif");
         return lines.join("\n");
       }

       if (sub === "use") {
         const target = rest.trim() as ProviderId;
         if (!KNOWN_IDS.includes(target)) {
           return `Provider "${target}" inconnu. Disponibles : ${KNOWN_IDS.join(", ")}.`;
         }
         if (target === active) {
           return `Provider déjà actif : ${target}`;
         }
         context.actions.setProvider(target);
         return `Provider actif : ${target}`;
       }

       if (sub === "info") {
         const target = rest.trim() as ProviderId;
         if (!KNOWN_IDS.includes(target)) {
           return `Provider "${target}" inconnu. Disponibles : ${KNOWN_IDS.join(", ")}.`;
         }
         const models = MODELS_BY_PROVIDER[target] ?? [];
         const defaultModel = config.providers?.[target]?.defaultModel ?? models[0]?.id ?? "(non défini)";
         const baseUrl = config.providers?.[target]?.baseUrl ?? "(défaut)";
         const apiKey = config.providers?.[target]?.apiKey ?? "";
         const lines = [
           `Provider : ${target}`,
           `  Actif        : ${target === active ? "oui" : "non"}`,
           `  Base URL     : ${baseUrl}`,
           `  Clé API      : ${maskApiKey(apiKey) || "(non définie)"}`,
           `  Default model: ${defaultModel}`,
           `  Modèles      : ${models.length}`,
         ];
         for (const m of models) {
           lines.push(`    • ${m.id.padEnd(28)}  — ${m.label}`);
         }
         return lines.join("\n");
       }

       return `Sous-commande "${sub}" inconnue. Tapez /provider pour l'aide.`;
     },
   };
   ```

4. **Enregistrement** dans `src/commands/registry.ts` :

   ```ts
   import { providerCommand } from "./provider";
   // ...
   export const COMMANDS: SlashCommand[] = [
     // ... existants ...
     providerCommand,
   ];
   ```

5. **Tests** `tests/commands-provider.test.ts` :
   - mock `loadConfig` pour fixer `activeProvider` ;
   - tester `/provider` (sans arg) → contient `Provider actif : ...` ;
   - tester `/provider list` → contient les 11 providers, avec `●` sur
     l'actif et `○` sur les autres ;
   - tester `/provider use foo` → message d'erreur listant les providers
     valides ;
   - tester `/provider use openai` → appelle `setProvider("openai")` ;
   - tester `/provider info minimax` → contient `Base URL`,
     `Default model`, `Modèles`, la liste des modèles `minimax` ;
   - tester `/provider info bar` → erreur ;
   - tester dispatch `sub` inconnu → message d'erreur.

## Critères d'acceptation

- [ ] `src/commands/provider.ts` exporte `providerCommand`.
- [ ] `/provider`, `/provider list`, `/provider use <id>`, `/provider info <id>`
      fonctionnent et sont documentés dans `/help`.
- [ ] `actions.setProvider` est ajouté au contexte et déclenche la
      persistance via `saveGlobalConfig`.
- [ ] `/provider use` appelle bien `setProvider` et la valeur est lue au
      prochain démarrage.
- [ ] `/provider info` affiche la baseUrl, la clé masquée, le default
      model, et la liste des modèles.
- [ ] `bun test tests/commands-provider.test.ts` passe.
- [ ] `bunx tsc --noEmit` retourne 0.

## Pièges & anti-patterns

- ❌ Logger la clé API en clair dans `/provider info` : utiliser
  `maskApiKey` (`src/config.ts:121-125`).
- ❌ Implémenter `/provider use` en mutant `process.env` directement :
  passer par `saveGlobalConfig` + `updateGlobalConfig` pour respecter le
  cycle de vie de la config (cf. AGENTS.md R7 — ne pas toucher
  `~/.moliere/` depuis un outil projet, mais ici c'est une slash command,
  c'est le bon endroit).
- ❌ Utiliser `parts.shift()` sans `const rest = parts.join(" ")` : le
  `rest` doit conserver les espaces pour les IDs contenant un tiret
  (`claude-3-5-sonnet-latest` n'a pas d'espace mais on doit rester
  robuste à un `provider use openai gpt-4o` où `gpt-4o` est ignoré).
- ❌ Oublier de valider `rest.trim()` : `use` avec un ID vide (`/provider use`)
  doit retourner une erreur claire, pas crasher.
- ❌ Mélanger la validation `KNOWN_IDS.includes(target)` avec un `as
  ProviderId` non justifié : introduire un type guard
  `isProviderId(id: string): id is ProviderId`.
- ❌ Réimplémenter la résolution `defaultModel` dans `/provider info` :
  utiliser `config.providers?.[target]?.defaultModel` comme source de
  vérité (déjà calculée par T-05).
- ✅ Documenter la convention de masquage des clés dans la description de
  la commande.
- ✅ Conserver la rétrocompat : `/provider` sans arg doit fonctionner comme
  `/status` simplifié, même pour un utilisateur qui n'a jamais changé de
  provider.

## Références

- `AGENTS.md` — règles R3 (TS strict), R7 (séparation globale/projet pour
  la persistance), R9 (sortie string), R10 (tests).
- `src/commands/types.ts:13-32` — `actions` à étendre.
- `src/config.ts:107-119` — `saveGlobalConfig`, `updateGlobalConfig`.
- `src/llm/models.ts` (résultat de T-13) — `MODELS_BY_PROVIDER`,
  `listProviders`.
- `src/commands/config.ts:108-125` — modèle de dispatch à un argument
  (`/permissions`).
