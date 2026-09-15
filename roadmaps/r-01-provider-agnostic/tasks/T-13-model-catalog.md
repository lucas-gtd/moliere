# T-13 — Refactoriser `src/llm/models.ts` en catalogue multi-provider

> **Statut** : `TODO` · **Priorité** : `P0` · **Effort** : `S`

## But

Remplacer le tableau monolithique `MODELS` (`src/llm/models.ts:3-10`,
uniquement `MiniMax-M3`) par un **catalogue structuré par provider**
`MODELS_BY_PROVIDER: Record<ProviderId, ModelInfo[]>`. Les helpers publics
`getModel(id, provider?)` et `listModels(opts?)` deviennent polymorphes et
permettent de filtrer / fusionner selon le provider actif. Résultat : le
code consommateur (`/config`, `/model`, `/provider info`, status bar) peut
afficher ou sélectionner un modèle en fonction de son provider sans
re-parser des chaînes.

## Pré-requis

- T-02 (TODO) — type `ProviderId` exporté (union littérale).
- T-04 (TODO) — `MoliereConfig.providers` typé, contenant au minimum les
  providers cibles.
- T-08/T-10/T-11/T-12 (TODO) — chaque adaptateur expose `listModels()` ;
  le catalogue statique `models.ts` sert de **fallback** quand l'adaptateur
  ne peut pas être instancié (pas de clé API configurée).

## Fichiers touchés

- `src/llm/models.ts` — réécriture complète (structure `Record`, helpers
  polymorphes).
- `src/llm/types.ts` — ajout éventuel du type `ProviderId` si non couvert
  par T-02 (sinon ré-export depuis le contrat).
- `src/commands/config.ts` — `modelCommand` et `configCommand` migrés vers
  les nouvelles signatures.
- `tests/llm-models-catalog.test.ts` — **création** : tests `getModel`,
  `listModels`, fusion avec `customModels`, fallback par provider.

## Étapes

1. Définir le type `ProviderId` (union littérale alignée sur T-04) :

   ```ts
   export type ProviderId =
     | "openai"
     | "anthropic"
     | "gemini"
     | "mistral"
     | "kimi"
     | "glm"
     | "deepseek"
     | "groq"
     | "openrouter"
     | "copilot"
     | "minimax";
   ```

2. Définir le **nouveau catalogue** `MODELS_BY_PROVIDER` :

   ```ts
   export const MODELS_BY_PROVIDER: Record<ProviderId, ModelInfo[]> = {
     minimax: [
       { id: "MiniMax-M3", label: "MiniMax M3", contextWindow: 200_000,
         description: "Modèle principal, équilibré et polyvalent." },
     ],
     openai: [
       { id: "gpt-4o",        label: "GPT-4o",        contextWindow: 128_000,
         description: "Multimodal, rapide, tool calling." },
       { id: "gpt-4o-mini",   label: "GPT-4o mini",   contextWindow: 128_000,
         description: "Variante économique." },
       { id: "o1-preview",    label: "o1-preview",    contextWindow: 128_000,
         description: "Raisonnement, sortie différée." },
       { id: "o1-mini",       label: "o1-mini",       contextWindow: 128_000,
         description: "Raisonnement léger." },
     ],
     anthropic: [
       { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet", contextWindow: 200_000,
         description: "Polyvalent, fort sur le code." },
       { id: "claude-3-5-haiku-latest",  label: "Claude 3.5 Haiku",  contextWindow: 200_000,
         description: "Rapide et économique." },
       { id: "claude-3-opus-latest",     label: "Claude 3 Opus",     contextWindow: 200_000,
         description: "Raisonnement profond." },
     ],
     gemini: [
       { id: "gemini-2.0-flash",  label: "Gemini 2.0 Flash",  contextWindow: 1_000_000,
         description: "Multimodal, très grande fenêtre." },
       { id: "gemini-1.5-pro",    label: "Gemini 1.5 Pro",    contextWindow: 2_000_000,
         description: "Contexte très long." },
       { id: "gemini-1.5-flash",  label: "Gemini 1.5 Flash",  contextWindow: 1_000_000,
         description: "Économique." },
     ],
     mistral: [
       { id: "mistral-large-latest", label: "Mistral Large", contextWindow: 128_000,
         description: "Haut de gamme." },
       { id: "mistral-small-latest", label: "Mistral Small", contextWindow: 32_000,
         description: "Rapide." },
     ],
     kimi: [
       { id: "moonshot-v1-128k", label: "Kimi (Moonshot) 128k", contextWindow: 128_000,
         description: "Spécialisé texte long chinois." },
     ],
     glm: [
       { id: "glm-4-plus",     label: "GLM-4 Plus",     contextWindow: 128_000,
         description: "Haut de gamme Zhipu." },
       { id: "glm-4-flash",    label: "GLM-4 Flash",    contextWindow: 128_000,
         description: "Économique." },
     ],
     deepseek: [
       { id: "deepseek-chat",     label: "DeepSeek Chat",     contextWindow: 64_000,
         description: "Modèle conversationnel." },
       { id: "deepseek-reasoner", label: "DeepSeek Reasoner", contextWindow: 64_000,
         description: "Raisonnement pas-à-pas." },
     ],
     groq: [
       { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)", contextWindow: 128_000,
         description: "Inférence ultra-rapide." },
     ],
     openrouter: [
       { id: "openai/gpt-4o",            label: "OpenRouter GPT-4o",         contextWindow: 128_000 },
       { id: "anthropic/claude-3.5-sonnet", label: "OpenRouter Claude 3.5", contextWindow: 200_000 },
     ],
     copilot: [
       { id: "gpt-4o",            label: "GPT-4o (Copilot)",       contextWindow: 128_000 },
       { id: "gpt-4o-mini",       label: "GPT-4o mini (Copilot)",  contextWindow: 128_000 },
       { id: "claude-3.5-sonnet", label: "Claude 3.5 Sonnet",      contextWindow: 200_000 },
       { id: "claude-3.7-sonnet", label: "Claude 3.7 Sonnet",      contextWindow: 200_000 },
       { id: "o1-preview",        label: "o1-preview",             contextWindow: 128_000 },
       { id: "o1-mini",           label: "o1-mini",                contextWindow: 128_000 },
       { id: "gemini-2.0-flash",  label: "Gemini 2.0 Flash",       contextWindow: 1_000_000 },
     ],
   };
   ```

3. Réécrire les helpers :

   ```ts
   export interface ListModelsOptions {
     provider?: ProviderId;       // filtre mono-provider
     merged?: boolean;            // true → tous providers concaténés (ordre déterministe)
     includeCustom?: boolean;     // true → ajoute customModels (T-04)
   }

   export const getModel = (
     id: string,
     provider?: ProviderId,
   ): ModelInfo | undefined => {
     if (provider) return MODELS_BY_PROVIDER[provider]?.find((m) => m.id === id);
     for (const models of Object.values(MODELS_BY_PROVIDER)) {
       const hit = models.find((m) => m.id === id);
       if (hit) return hit;
     }
     return undefined;
   };

   export const listModels = (
     options: ListModelsOptions | ProviderId | undefined = {},
     legacyCustomIds: string[] = [],   // rétrocompat avec listModels(extraIds)
   ): ModelInfo[] => {
     const opts: ListModelsOptions =
       typeof options === "string" ? { provider: options } : options;

     let models: ModelInfo[];
     if (opts.provider) {
       models = MODELS_BY_PROVIDER[opts.provider] ?? [];
     } else if (opts.merged) {
       models = Object.values(MODELS_BY_PROVIDER).flat();
     } else {
       // défaut : provider actif (résolu via loadConfig en T-05/T-06)
       const active = loadConfig().activeProvider ?? "minimax";
       models = MODELS_BY_PROVIDER[active] ?? [];
     }

     if (opts.includeCustom) {
       const known = new Set(models.map((m) => m.id));
       const extras = legacyCustomIds
         .filter((id) => !known.has(id))
         .map<ModelInfo>((id) => ({
           id,
           label: id,
           contextWindow: 200_000,
           description: "Modèle personnalisé.",
         }));
       models = [...models, ...extras];
     }
     return models;
   };

   export const listProviders = (): ProviderId[] =>
     Object.keys(MODELS_BY_PROVIDER) as ProviderId[];
   ```

4. Migrer `src/commands/config.ts` :
   - `configCommand` : remplacer `listModels()` par
     `listModels({ merged: true, includeCustom: true })` puis **grouper**
     l'affichage par provider (T-14) ;
   - `modelCommand` : utiliser `listModels({ includeCustom: true })` ;
   - `statusCommand` : `getModel(context.state.model)` reste compatible.

5. Garantir la rétrocompatibilité : `listModels(extraIds: string[])` est
   gardé comme overload pour ne pas casser les callers historiques. À terme
   (T-22), supprimer l'overload legacy.

6. Tests `tests/llm-models-catalog.test.ts` :
   - `getModel("gpt-4o", "openai")` retourne l'entrée OpenAI ;
   - `getModel("gpt-4o")` (sans provider) trouve l'entrée dans
     `MODELS_BY_PROVIDER.openai` ;
   - `listModels({ provider: "anthropic" })` retourne 3 entrées ;
   - `listModels({ merged: true })` retourne ≥ 25 entrées ;
   - `listModels({ provider: "minimax", includeCustom: true }, ["my-llama"])`
     ajoute `my-llama` avec `description: "Modèle personnalisé."` ;
   - `listProviders()` retourne tous les `ProviderId` ;
   - `getModel("unknown")` retourne `undefined`.

## Critères d'acceptation

- [ ] `src/llm/models.ts` exporte `MODELS_BY_PROVIDER`, `getModel`,
      `listModels`, `listProviders`, `ProviderId`.
- [ ] `MODELS_BY_PROVIDER` couvre les 11 providers du tableau.
- [ ] `getModel` supporte un argument `provider` optionnel.
- [ ] `listModels({merged:true})` retourne ≥ 25 modèles.
- [ ] `bun test tests/llm-models-catalog.test.ts` passe.
- [ ] `bunx tsc --noEmit` retourne 0.

## Pièges & anti-patterns

- ❌ Garder le tableau `MODELS: ModelInfo[]` historique en plus du Record :
  source de vérité = `MODELS_BY_PROVIDER`. Réexporter `MODELS` comme
  `Object.values(MODELS_BY_PROVIDER).flat()` pour la rétrocompat.
- ❌ Mélanger `contextWindow` incohérents (un modèle en `128_000`, un
  autre en `200_000`) entre providers : aligner sur la valeur officielle
  documentée.
- ❌ Oublier `copilot` dans le catalogue alors que T-12 le supporte :
  source de désynchronisation entre `/model` et la réalité.
- ❌ Hardcoder `defaultModel` à un seul endroit (ex. `MODELS_BY_PROVIDER`)
  au lieu de laisser `defaultModel` vivre dans `MoliereConfig.providers`
  (T-04) : risque d'incohérence entre provider choisi et modèle affiché.
- ❌ Utiliser `any` pour `provider?` dans `getModel` : profiter du type
  union pour l'auto-complétion et la détection de typos.
- ✅ Documenter `contextWindow` dans une JSDoc au-dessus de chaque entrée.
- ✅ Prévoir un test de non-régression : `getModel("MiniMax-M3")` doit
  toujours fonctionner (utilisé par `src/commands/config.ts:statusCommand`).

## Références

- `AGENTS.md` — règle R3 (TS strict, `noUncheckedIndexedAccess`).
- `src/llm/types.ts:34-39` — type `ModelInfo` à respecter.
- `src/llm/models.ts` (intégralité) — fichier à remplacer.
- `src/commands/config.ts:50-88` — consommateurs de `getModel` /
  `listModels`.
- T-04 (`MoliereConfig.providers`) — type `ProviderId` partagé.
- T-08/T-10/T-11/T-12 — `listModels()` par adaptateur (complément
  dynamique au catalogue statique).
