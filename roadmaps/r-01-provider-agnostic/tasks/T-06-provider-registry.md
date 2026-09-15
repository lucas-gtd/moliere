# T-06 — Implémenter le registre de providers

> **Statut** : `TODO` · **Priorité** : `P0` · **Effort** : `M`

## But

Créer `src/llm/providers/registry.ts` qui :

- référence tous les `ProviderFactory` (un par famille d'API),
- expose `getActiveProvider(config?)` en résolution paresseuse avec cache
  LRU borné (au plus 4 adaptateurs vivants),
- expose `listProviders()` et `getProvider(id)` pour les slash commands
  (T-15) et le CLI (T-16),
- gère les erreurs de configuration (clé manquante, modèle par défaut
  absent du catalogue).

Aucun adaptateur n'est **implémenté** dans cette tâche (T-08 à T-12). En
conséquence, seuls les **squelettes** `openai-compat`, `anthropic`,
`gemini`, `copilot` sont déclarés ; ils jettent `Error: Non implémenté`.
Cette tâche peut donc être validée par les seuls tests de sélection /
erreur.

## Pré-requis

- T-02 (DONE) — `ProviderAdapter`, `ProviderFactory`, `ProviderId`,
  `ProviderContext` disponibles.
- T-04 (DONE) — `MoliereConfig.providers` et `getActiveProvider`.
- T-05 (DONE) — `loadConfig` retourne le provider actif peuplé.

## Fichiers touchés

- `src/llm/providers/registry.ts` — **création**.
- `src/llm/providers/stubs.ts` — **création** : 4 stubs `ProviderFactory`
  qui jettent `Error` (utilisés en attendant T-08, T-10, T-11, T-12).
- `tests/providers-registry.test.ts` — **création**.
- `CHANGELOG.md` — entrée `### Ajouté`.

## Étapes

1. Créer `src/llm/providers/stubs.ts` :

   ```ts
   import type { ProviderAdapter, ProviderContext, ProviderFactory } from "./types";

   const stubFactory = (id: ProviderFactory["id"], label: string): ProviderFactory => ({
     id,
     label,
     create(_ctx: ProviderContext): ProviderAdapter {
       throw new Error(`Provider "${id}" non implémenté (r-01.${id}).`);
     },
   });

   export const OPENAI_COMPAT_FACTORY: ProviderFactory = stubFactory("openai-compat", "OpenAI compatible");
   export const ANTHROPIC_FACTORY: ProviderFactory = stubFactory("anthropic", "Anthropic Claude");
   export const GEMINI_FACTORY: ProviderFactory = stubFactory("gemini", "Google Gemini");
   export const COPILOT_FACTORY: ProviderFactory = stubFactory("copilot", "GitHub Copilot");
   ```

2. Créer `src/llm/providers/registry.ts` :

   ```ts
   import { loadConfig } from "../../config";
   import { COPILOT_FACTORY, GEMINI_FACTORY, ANTHROPIC_FACTORY, OPENAI_COMPAT_FACTORY } from "./stubs";
   import {
     type ProviderAdapter,
     type ProviderContext,
     type ProviderFactory,
     type ProviderId,
     PROVIDER_IDS,
   } from "./types";

   const FACTORIES: Record<ProviderId, ProviderFactory> = {
     "openai-compat": OPENAI_COMPAT_FACTORY,
     "anthropic": ANTHROPIC_FACTORY,
     "gemini": GEMINI_FACTORY,
     "copilot": COPILOT_FACTORY,
   };

   const MAX_CACHED_ADAPTERS = 4;
   const cache = new Map<ProviderId, ProviderAdapter>();

   const evictIfNeeded = () => {
     while (cache.size > MAX_CACHED_ADAPTERS) {
       const oldest = cache.keys().next().value;
       if (!oldest) break;
       cache.delete(oldest);
     }
   };

   const buildContext = (config = loadConfig()): ProviderContext => {
     const provider = config.providers[config.activeProvider];
     if (!provider) {
       throw new Error(
         `Provider actif "${config.activeProvider}" absent du registre.`,
       );
     }
     if (!provider.apiKey && provider.authStyle !== "oauth") {
       throw new Error(
         `Clé API manquante pour le provider "${provider.id}". ` +
         `Définissez MOLIERE_${provider.id.toUpperCase().replace(/-/g, "_")}_API_KEY ` +
         `ou renseignez providers.${provider.id}.apiKey dans ~/.moliere/config.json.`,
       );
     }
     return {
       apiKey: provider.apiKey ?? "",
       baseUrl: provider.baseUrl,
       defaultModel: provider.defaultModel,
     };
   };

   export const listProviders = (): ProviderFactory[] =>
     PROVIDER_IDS.map((id) => FACTORIES[id]);

   export const getProvider = (id: ProviderId): ProviderFactory => {
     const factory = FACTORIES[id];
     if (!factory) {
       throw new Error(`Provider "${id}" inconnu. Connus : ${PROVIDER_IDS.join(", ")}.`);
     }
     return factory;
   };

   export const getActiveProvider = (config = loadConfig()): ProviderAdapter => {
     const cached = cache.get(config.activeProvider);
     if (cached) return cached;
     const factory = FACTORIES[config.activeProvider];
     if (!factory) {
       throw new Error(`Provider "${config.activeProvider}" non enregistré.`);
     }
     const adapter = factory.create(buildContext(config));
     cache.set(config.activeProvider, adapter);
     evictIfNeeded();
     return adapter;
   };

   /** Tests uniquement — vide le cache entre scénarios. */
   export const __resetRegistryForTests = () => cache.clear();
   ```

3. Créer `tests/providers-registry.test.ts` :

   ```ts
   import { describe, expect, test, beforeEach } from "bun:test";
   import { getActiveProvider, getProvider, listProviders, __resetRegistryForTests } from "../src/llm/providers/registry";

   describe("registry", () => {
     beforeEach(() => {
       __resetRegistryForTests();
       for (const key of Object.keys(process.env)) {
         if (key.startsWith("MOLIERE_")) delete process.env[key];
       }
     });

     test("listProviders retourne 4 entrées dans l'ordre PROVIDER_IDS", () => {
       const providers = listProviders();
       expect(providers.map((p) => p.id)).toEqual([
         "openai-compat",
         "anthropic",
         "gemini",
         "copilot",
       ]);
     });

     test("getProvider('inconnu') jette une erreur explicite", () => {
       // @ts-expect-error test volontaire d'un id invalide
       expect(() => getProvider("wat")).toThrow(/inconnu/);
     });

     test("getActiveProvider jette tant que les stubs ne sont pas remplacés", () => {
       process.env.MOLIERE_PROVIDER = "anthropic";
       process.env.MOLIERE_ANTHROPIC_API_KEY = "sk-ant-x";
       expect(() => getActiveProvider()).toThrow(/non implémenté/);
     });

     test("getActiveProvider jette une erreur de clé manquante", () => {
       process.env.MOLIERE_PROVIDER = "openai-compat";
       expect(() => getActiveProvider()).toThrow(/Clé API manquante/);
     });
   });
   ```

4. Documenter dans `CHANGELOG.md` :

   ```markdown
   ### Ajouté

   - Registre de providers (`src/llm/providers/registry.ts`) avec
     résolution paresseuse, cache borné et erreurs explicites (clé
     manquante, provider inconnu). Les stubs par famille sont définis
     dans `src/llm/providers/stubs.ts` et seront remplacés par les
     tâches r-01.8 à r-01.12.
   ```

5. Vérifier la suite de tests :

   ```bash
   bun test tests/providers-registry.test.ts
   bunx tsc --noEmit
   ```

   L'erreur `non implémenté` est attendue et fait partie des assertions.

## Critères d'acceptation

- [ ] `src/llm/providers/registry.ts` exporte `listProviders`,
      `getProvider`, `getActiveProvider`, `__resetRegistryForTests`.
- [ ] `src/llm/providers/stubs.ts` exporte les 4 `ProviderFactory` de
      stub.
- [ ] Tests `tests/providers-registry.test.ts` passent avec ≥ 4
      assertions.
- [ ] `bun test` global reste vert (les stubs jettent mais les tests
      existants ne les appellent pas).
- [ ] `bunx tsc --noEmit` retourne 0.

## Pièges & anti-patterns

- ❌ Ne pas tester `__resetRegistryForTests` exposé : nom préfixé `_` est
  toléré par les linters, mais documenter le **pourquoi** (« tests
  uniquement ») dans la JSDoc.
- ❌ Implémenter réellement les stubs dans cette tâche — c'est le rôle de
  T-08/T-10/T-11/T-12. Mélanger les étapes brouille la revue.
- ❌ Renvoyer `null` ou `undefined` depuis `getActiveProvider` quand la clé
  manque : toujours `throw` (l'utilisateur saura qu'il doit configurer,
  cf. T-16).
- ❌ Cacher pour toujours : sans la borne `MAX_CACHED_ADAPTERS`, un
  switch répété entre 4 providers en dev consomme la mémoire pour
  rien.
- ❌ Mélanger les concerns : la résolution de l'adaptateur ne doit **pas**
  déclencher de `fetch` distant. `getActiveProvider` est purement
  synchrone ; le I/O réseau appartient aux méthodes `chat`/`streamChat`.
- ✅ Utiliser `Map` plutôt qu'un objet indexé pour le cache (ordre
  d'insertion garanti → éviction LRU simple).
- ✅ Préfixer les variables d'env par `MOLIERE_<ID>_*` calculé
  dynamiquement pour rester aligné avec T-05.

## Références

- `AGENTS.md` — règle R3 (strict + `noUncheckedIndexedAccess` motive le
  test explicite de clé dans `FACTORIES[id]`), R9 (la couche registre
  n'est pas un outil, donc ne renvoie pas de string).
- `src/llm/providers/types.ts` — fournit `ProviderAdapter`,
  `ProviderContext`, `ProviderFactory`.
- `src/config.ts` — fournit `loadConfig` (T-05) et `getActiveProvider`
  (T-04) ; **attention** au conflit de nommage : `registry.getActiveProvider`
  prend un argument `config` optionnel et renvoie un `ProviderAdapter`,
  celui de `config.ts` renvoie un `ProviderConfig`. Cette collision est
  résolue par l'import explicite (le test ci-dessus utilise le chemin
  long).
- T-02 — fournit l'interface `ProviderFactory`.
- T-08, T-10, T-11, T-12 — remplaceront les stubs.
