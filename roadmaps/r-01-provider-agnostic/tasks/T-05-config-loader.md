# T-05 — Charger la config multi-providers (env + fichiers)

> **Statut** : `TODO` · **Priorité** : `P0` · **Effort** : `M`

## But

Faire de `loadConfig()` (`src/config.ts:67-105`) la source de vérité unique
des providers configurés, en lisant :

- les variables d'environnement (`MOLIERE_PROVIDER`,
  `MOLIERE_OPENAI_COMPAT_API_KEY`, `MOLIERE_ANTHROPIC_API_KEY`,
  `MOLIERE_GEMINI_API_KEY`, `MOLIERE_COPILOT_TOKEN`,
  `MOLIERE_*_BASE_URL`, `MOLIERE_*_DEFAULT_MODEL`),
- les fichiers `~/.moliere/config.json` et `<cwd>/.moliere/config.json`,
- avec priorité `process.env > global > projet > défaut codé en dur`.

Les champs rétro-compatibles `apiKey`, `baseUrl`, `defaultModel` sont
alimentés par **projection** depuis le provider actif, de sorte que
`src/llm/client.ts:54` et `src/agent/loop.ts:75-76` continuent de lire
correctement.

## Pré-requis

- T-04 (DONE) — types `ProviderConfig` / `ProvidersRegistry` /
  `getActiveProvider` disponibles.

## Fichiers touchés

- `src/config.ts` — `loadConfig` réécrit selon l'ordre de priorité
  ci-dessus ; ajout d'un parseur `expandProviders` privé.
- `tests/config.test.ts` — **création** : couvre priorité env/global/projet,
  projection vers les champs rétro-compatibles, gestion d'erreur (provider
  inconnu), valeur par défaut `openai-compat`.
- `CHANGELOG.md` — entrée `### Modifié`.

## Étapes

1. Dans `src/config.ts`, ajouter en tête (après les imports) la table des
   providers par défaut, c'est-à-dire une fonction pure qui renvoie le
   catalogue « hors config » :

   ```ts
   const DEFAULT_PROVIDER_CATALOG: Record<ProviderId, Omit<ProviderConfig, "apiKey">> = {
     "openai-compat": {
       id: "openai-compat",
       label: "OpenAI compatible",
       baseUrl: "https://api.openai.com/v1",
       defaultModel: "gpt-4o-mini",
       enabled: true,
       authStyle: "bearer",
     },
     "anthropic": {
       id: "anthropic",
       label: "Anthropic Claude",
       baseUrl: "https://api.anthropic.com",
       defaultModel: "claude-3-5-sonnet-latest",
       enabled: true,
       authStyle: "x-api-key",
     },
     "gemini": {
       id: "gemini",
       label: "Google Gemini",
       baseUrl: "https://generativelanguage.googleapis.com/v1beta",
       defaultModel: "gemini-1.5-pro",
       enabled: true,
       authStyle: "query",
     },
     "copilot": {
       id: "copilot",
       label: "GitHub Copilot",
       baseUrl: "https://api.githubcopilot.com",
       defaultModel: "gpt-4o",
       enabled: true,
       authStyle: "oauth",
     },
   };
   ```

   > Ce défaut **remplace** la valeur codée en dur `https://api.minimax.io/v1`
   > de l'ancien `loadConfig`. La valeur MiniMax reste disponible via un
   > override explicite (`MOLIERE_OPENAI_COMPAT_BASE_URL=https://api.minimax.io/v1`)
   > ou via `~/.moliere/config.json`.

2. Implémenter la fonction `resolveEnvProvider` (à ajouter juste avant
   `loadConfig`) :

   ```ts
   const resolveEnvProvider = (): ProviderId | undefined => {
     const raw = process.env.MOLIERE_PROVIDER;
     if (!raw) return undefined;
     if ((PROVIDER_IDS as readonly string[]).includes(raw)) {
       return raw as ProviderId;
     }
     throw new Error(
       `MOLIERE_PROVIDER="${raw}" invalide. Valeurs attendues : ${PROVIDER_IDS.join(", ")}.`,
     );
   };
   ```

3. Réécrire `loadConfig` en suivant cette structure (les noms internes
   peuvent varier, mais la logique doit être identique) :

   ```ts
   export const loadConfig = (): MoliereConfig => {
     ensureGlobalDirs();

     const globalConfig = readJsonSafe<Partial<MoliereConfig>>(GLOBAL_CONFIG_PATH) ?? {};
     const projectConfig = readJsonSafe<Partial<MoliereConfig>>(
       path.join(process.cwd(), PROJECT_CONFIG_DIR, "config.json"),
     ) ?? {};

     const activeProvider: ProviderId =
       resolveEnvProvider() ??
       (globalConfig.activeProvider as ProviderId | undefined) ??
       (projectConfig.activeProvider as ProviderId | undefined) ??
       "openai-compat";

     const providers: ProvidersRegistry = (PROVIDER_IDS as readonly ProviderId[]).reduce(
       (acc, id) => {
         const defaults = DEFAULT_PROVIDER_CATALOG[id];
         const fromGlobal = globalConfig.providers?.[id];
         const fromProject = projectConfig.providers?.[id];
         const apiKey =
           process.env[`MOLIERE_${id.toUpperCase().replace(/-/g, "_")}_API_KEY`] ??
           process.env[`MOLIERE_${id.toUpperCase().replace(/-/g, "_")}_TOKEN`] ??
           fromGlobal?.apiKey ??
           fromProject?.apiKey;
         const baseUrl =
           process.env[`MOLIERE_${id.toUpperCase().replace(/-/g, "_")}_BASE_URL`] ??
           fromGlobal?.baseUrl ??
           fromProject?.baseUrl ??
           defaults.baseUrl;
         const defaultModel =
           process.env[`MOLIERE_${id.toUpperCase().replace(/-/g, "_")}_DEFAULT_MODEL`] ??
           fromGlobal?.defaultModel ??
           fromProject?.defaultModel ??
           defaults.defaultModel;
         acc[id] = {
           ...defaults,
           ...fromProject,
           ...fromGlobal,
           id,
           apiKey,
           baseUrl,
           defaultModel,
           enabled: fromGlobal?.enabled ?? fromProject?.enabled ?? defaults.enabled,
         };
         return acc;
       },
       {} as ProvidersRegistry,
     );

     const active = providers[activeProvider];
     const merged: MoliereConfig = {
       apiKey: active.apiKey,
       baseUrl: active.baseUrl,
       defaultModel: active.defaultModel,
       activeProvider,
       providers,
       theme: (globalConfig.theme ?? projectConfig.theme ?? "default") as ThemeName,
       permissionMode: (globalConfig.permissionMode ??
         projectConfig.permissionMode ??
         "default") as PermissionMode,
       maxToolRounds: globalConfig.maxToolRounds ?? projectConfig.maxToolRounds ?? 12,
       maxOutputChars: globalConfig.maxOutputChars ?? projectConfig.maxOutputChars ?? 80_000,
       planMode: false,
       sessionId: globalConfig.sessionId,
       customModels: globalConfig.customModels ?? projectConfig.customModels ?? [],
     };

     if (!VALID_THEMES.has(merged.theme)) merged.theme = "default";
     if (!VALID_MODES.has(merged.permissionMode)) merged.permissionMode = "default";

     return merged;
   };
   ```

4. Ajouter le test `tests/config.test.ts` :

   ```ts
   import { describe, expect, test, beforeEach } from "bun:test";
   import { loadConfig } from "../src/config";

   describe("loadConfig — providers", () => {
     beforeEach(() => {
       for (const key of Object.keys(process.env)) {
         if (key.startsWith("MOLIERE_")) delete process.env[key];
       }
     });

     test("valeur par défaut : openai-compat sans clé", () => {
       const cfg = loadConfig();
       expect(cfg.activeProvider).toBe("openai-compat");
       expect(cfg.providers["openai-compat"].authStyle).toBe("bearer");
       expect(cfg.apiKey).toBeUndefined();
     });

     test("MOLIERE_PROVIDER=anthropic projette les bons champs", () => {
       process.env.MOLIERE_PROVIDER = "anthropic";
       process.env.MOLIERE_ANTHROPIC_API_KEY = "sk-ant-xxx";
       const cfg = loadConfig();
       expect(cfg.activeProvider).toBe("anthropic");
       expect(cfg.apiKey).toBe("sk-ant-xxx");
       expect(cfg.baseUrl).toBe("https://api.anthropic.com");
     });

     test("MOLIERE_PROVIDER invalide jette une erreur explicite", () => {
       process.env.MOLIERE_PROVIDER = "wat";
       expect(() => loadConfig()).toThrow(/MOLIERE_PROVIDER/);
     });
   });
   ```

   Adapter les imports (`bun:test`) et compléter si besoin avec un cas
   de priorité `global > projet`.

5. Documenter dans `CHANGELOG.md` :

   ```markdown
   ### Modifié

   - `loadConfig` lit désormais un registre de providers
     (`providers: ProvidersRegistry`) ainsi qu'un provider actif
     (`activeProvider: ProviderId`). Les variables d'environnement
     reconnues sont `MOLIERE_PROVIDER`, `MOLIERE_<ID>_API_KEY` /
     `MOLIERE_<ID>_TOKEN`, `MOLIERE_<ID>_BASE_URL`,
     `MOLIERE_<ID>_DEFAULT_MODEL`. Les champs `apiKey`, `baseUrl`,
     `defaultModel` de `MoliereConfig` deviennent des projections du
     provider actif (tâche r-01.5).
   ```

6. Vérifier :

   ```bash
   bun test tests/config.test.ts
   bunx tsc --noEmit
   ```

## Critères d'acceptation

- [ ] `loadConfig` lit les nouvelles variables d'environnement.
- [ ] `MOLIERE_PROVIDER` invalide produit une erreur explicite (pas
      silencieuse).
- [ ] Les trois champs `apiKey`, `baseUrl`, `defaultModel` de
      `MoliereConfig` reflètent le provider actif.
- [ ] `tests/config.test.ts` passe avec ≥ 3 assertions.
- [ ] `bun test` global reste vert.
- [ ] `bunx tsc --noEmit` retourne 0.

## Pièges & anti-patterns

- ❌ Sauter l'étape de **projection** (`apiKey = active.apiKey`) : casserait
  la rétro-compat et T-07 devrait réécrire `client.ts` plus largement.
- ❌ Priorité `process.env` inversée : doit rester la plus haute.
- ❌ Accepter silencieusement un `MOLIERE_PROVIDER` inconnu — préfère un
  `throw` explicite (l'erreur est catchée en T-16 par
  `src/index.tsx`).
- ❌ Utiliser `JSON.parse(fs.readFileSync(...))` direct — passer par
  `readJsonSafe` déjà présent.
- ❌ Casser `saveGlobalConfig` en oubliant que `MoliereConfig` a désormais
  des champs additionnels ; spreader `partial` reste correct mais un test
  manuel `save → load` est recommandé.
- ✅ Centraliser la lecture des variables dans une boucle sur `PROVIDER_IDS`
  pour rester ouvert à un futur `azure-openai` etc.
- ✅ Garder `customModels` qui survit à la refactor, alimenté
  indépendamment du provider.

## Références

- `AGENTS.md` — règle R3 (strict), R7 (ne pas toucher `~/.moliere/` depuis
  un outil projet ; `loadConfig` reste un outil noyau), R10 (tests).
- `src/config.ts:67-105` — implémentation actuelle à remplacer.
- `roadmaps/r-01-provider-agnostic/roadmap.md` — familles d'API ciblées.
- T-04 — fournisseur des types étendus.
- T-06 — consomme `getActiveProvider` pour résoudre l'adaptateur.
- T-16 — messages d'erreur utilisateur ; consommera l'erreur jetée par
  `resolveEnvProvider`.
