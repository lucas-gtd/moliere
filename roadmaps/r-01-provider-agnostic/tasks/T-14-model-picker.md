# T-14 — Mettre à jour `/model` pour grouper par provider

> **Statut** : `TODO` · **Priorité** : `P1` · **Effort** : `S`

## But

Faire de la slash command `/model` un **sélecteur multi-provider** : quand
elle est invoquée sans argument, elle liste les modèles groupés par provider
avec une indentation claire ; quand elle reçoit `<provider>:<model>` (ou
juste `<model>` dans le provider actif), elle bascule le modèle. Le but est
que l'utilisateur n'ait plus à connaître le nom exact du modèle par cœur :
`/model` sert de menu navigable. Sortie de `/status` cohérente.

## Pré-requis

- T-04 (TODO) — `MoliereConfig.providers` typé, `activeProvider` chargé.
- T-05 (TODO) — `loadConfig` expose `activeProvider`.
- T-06 (TODO) — `getActiveProvider()` accessible depuis le contexte TUI.
- T-13 (TODO) — `MODELS_BY_PROVIDER`, `getModel`, `listModels` opérationnels.
- T-15 (TODO) — `/provider use` opérationnel (sinon le changement de modèle
  cross-provider échoue).

## Fichiers touchés

- `src/commands/config.ts` — réécriture de `modelCommand` (lignes 72-88).
- `tests/commands-model.test.ts` — **création** ou enrichissement de
  `tests/slash-commands.test.ts` : tests groupage, parsing `provider:model`.

## Étapes

1. **Format de sortie `/model`** (sans argument) :

   ```
   Modèles disponibles (provider actif : anthropic) :

     anthropic
       • claude-3-5-sonnet-latest  — Claude 3.5 Sonnet  (200 000)
       • claude-3-5-haiku-latest   — Claude 3.5 Haiku   (200 000)
       • claude-3-opus-latest      — Claude 3 Opus      (200 000)

     openai
       • gpt-4o      — GPT-4o      (128 000)
       • gpt-4o-mini — GPT-4o mini (128 000)

     minimax
       • MiniMax-M3  — MiniMax M3  (200 000)

   Usage :
     /model <model>                        # modèle du provider actif
     /model <provider>:<model>             # bascule le provider si besoin
     /model                                # ce menu
   ```

   Format par ligne :

   ```ts
   `  • ${m.id.padEnd(width)}  — ${m.label}  (${formatTokenCount(m.contextWindow)})`;
   ```

2. **Format accepté `/model <arg>`** :

   - `<model>` (ex. `gpt-4o-mini`) → cherche dans le provider actif ;
     si trouvé : `setModel(arg)` ; si non trouvé : message d'erreur avec
     suggestion `/model <provider>:<model>`.
   - `<provider>:<model>` (ex. `anthropic:claude-3-5-sonnet-latest`) :
     1. split sur le **premier** `:` (`split(":", 2)`),
     2. valide que `provider` est un `ProviderId` connu,
     3. valide que `model` appartient à `MODELS_BY_PROVIDER[provider]`,
     4. si provider ≠ actif, appelle `actions.setProvider(provider)`
        (méthode ajoutée en T-15),
     5. appelle `actions.setModel(model)`,
     6. retourne :

        ```
        Provider actif : anthropic
        Modèle actif   : claude-3-5-sonnet-latest
        ```

3. **Comportement en cas d'erreur** :

   - provider inconnu :

     ```
     Provider "foo" inconnu. Disponibles : anthropic, openai, gemini, minimax, …
     ```

   - modèle absent du provider :

     ```
     Modèle "gpt-4o" introuvable pour le provider "anthropic".
     Tapez /model pour voir les modèles disponibles.
     ```

4. **Mise à jour de `statusCommand`** (`src/commands/config.ts:14-39`) pour
   afficher aussi le provider actif :

   ```ts
   const activeProvider = loadConfig().activeProvider ?? "minimax";
   lines.push(`  Provider      : ${activeProvider}`);
   lines.push(`  Modèle        : ${context.state.model}${model?.description ? ` (${model.description})` : ""}`);
   ```

5. **Implémentation** :

   ```ts
   export const modelCommand: SlashCommand = {
     name: "model",
     description: "Changer de modèle (groupé par provider)",
     category: "config",
     execute: (args, context) => {
       const trimmed = args.trim();
       const config = loadConfig();
       const activeProvider = (config.activeProvider ?? "minimax") as ProviderId;

       if (!trimmed) {
         const groups: string[] = [];
         groups.push(`Modèles disponibles (provider actif : ${activeProvider}) :\n`);
         for (const provider of listProviders()) {
           const models = listModels({ provider });
           if (models.length === 0) continue;
           groups.push(`  ${provider}`);
           const width = Math.max(...models.map((m) => m.id.length));
           for (const m of models) {
             groups.push(
               `    • ${m.id.padEnd(width)}  — ${m.label}  (${formatTokenCount(m.contextWindow)})`,
             );
           }
           groups.push("");
         }
         groups.push("Usage :");
         groups.push("  /model <model>             # modèle du provider actif");
         groups.push("  /model <provider>:<model>  # bascule le provider si besoin");
         return groups.join("\n");
       }

       let provider: ProviderId;
       let modelId: string;
       if (trimmed.includes(":")) {
         const [p, m] = trimmed.split(":", 2);
         provider = p as ProviderId;
         modelId = m ?? "";
         if (!listProviders().includes(provider)) {
           return `Provider "${provider}" inconnu. Disponibles : ${listProviders().join(", ")}.`;
         }
       } else {
         provider = activeProvider;
         modelId = trimmed;
       }

       const modelInfo = getModel(modelId, provider);
       if (!modelInfo) {
         return `Modèle "${modelId}" introuvable pour le provider "${provider}".\nTapez /model pour voir les modèles disponibles.`;
       }

       if (provider !== activeProvider) {
         context.actions.setProvider(provider);   // ajouté en T-15
       }
       context.actions.setModel(modelId);

       if (provider !== activeProvider) {
         return `Provider actif : ${provider}\nModèle actif   : ${modelId}`;
       }
       return `Modèle actif : ${modelId}`;
     },
   };
   ```

6. Tests :
   - mock `loadConfig` (via `bun:test` `mock.module` ou ré-export
     indirection) → `activeProvider = "anthropic"` ;
   - tester sortie groupée : contient `anthropic`, `claude-3-5-sonnet-latest`,
     et n'affiche pas le bloc `openai`/`gemini` sans leurs entrées ;
   - tester `/model gpt-4o` (provider actif anthropic) → erreur « introuvable
     pour le provider "anthropic" » ;
   - tester `/model openai:gpt-4o` → appelle `setProvider("openai")` puis
     `setModel("gpt-4o")` ;
   - tester provider inconnu `foo:bar` → message d'erreur listant les
     providers valides.

## Critères d'acceptation

- [ ] `/model` sans argument liste les modèles **groupés par provider**,
      avec `Usage :` en bas.
- [ ] `/model <provider>:<model>` valide `provider`, bascule le provider si
      nécessaire, puis `setModel`.
- [ ] `/model <model>` reste fonctionnel pour le provider actif (raccourci).
- [ ] `/status` affiche maintenant le provider actif.
- [ ] `bun test tests/commands-model.test.ts` passe.
- [ ] `bunx tsc --noEmit` retourne 0.

## Pièges & anti-patterns

- ❌ Casser le comportement actuel `/model <id>` qui marche pour le
  provider actif : c'est le raccourci que les utilisateurs tapent le plus
  souvent ; le préfixer d'erreur ne doit le désactiver qu'en cas
  d'ambiguïté (modèle présent dans plusieurs providers).
- ❌ `split(":")` sans limite : `claude-3-5-sonnet:variant:test` casse.
  Toujours `split(":", 2)`.
- ❌ Oublier le cas où le provider actif n'a pas le modèle demandé :
  message d'erreur confus qui ne précise pas qu'il faut préfixer par le
  provider.
- ❌ Utiliser `padEnd` avec une largeur calculée sur tous les providers :
  alignement incohérent entre blocs. Calculer la largeur par provider.
- ❌ Mélanger `actions.setProvider` (méthode T-15) sans vérifier qu'elle
  existe : introduire un **stub** dans `SlashCommandContext.actions` en T-15
  pour ne pas casser le type ici.
- ✅ Documenter dans la description de la commande
  (`description: "Changer de modèle (groupé par provider)"`) le nouveau
  format — apparaît dans `/help`.
- ✅ Préférer `formatTokenCount` (de `src/agent/tokens.ts`) à un formatage
  manuel pour rester cohérent avec `/status`.

## Références

- `AGENTS.md` — règle R3 (TS strict), règle R9 (sortie string préfixée
  `Erreur :` en cas d'erreur ; ici on utilise un format d'erreur custom
  cohérent), règle R10 (tests).
- `src/commands/config.ts:72-88` — `modelCommand` à remplacer.
- `src/commands/types.ts:13-32` — `actions` du contexte TUI (à étendre en
  T-15 avec `setProvider`).
- `src/llm/models.ts` (résultat de T-13) — helpers utilisés.
- `src/agent/tokens.ts` — `formatTokenCount` pour l'affichage cohérent.
