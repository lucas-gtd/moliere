# T-04 — Étendre `MoliereConfig` avec un registre de providers

> **Statut** : `TODO` · **Priorité** : `P0` · **Effort** : `M`

## But

Faire évoluer `MoliereConfig` pour porter un **registre typé** de providers
et un provider actif, tout en conservant les champs existants utilisés
aujourd'hui (`apiKey`, `defaultModel`, `baseUrl`) en alias rétro-compatibles.
Cette tâche ne charge pas encore les données d'env ou de fichiers
(`MOLIERE_*_API_KEY`) — ce chargement est traité en T-05. Elle se limite à
**déclarer les types et les slots** dans `src/config.ts`.

## Pré-requis

- T-01 (DONE) — audit des champs `apiKey`, `defaultModel`, `baseUrl`.
- T-02 (DONE) — `ProviderId` défini dans
  `src/llm/providers/types.ts`.

## Fichiers touchés

- `src/config.ts` — ajout des interfaces `ProviderConfig` et
  `ProviderEntry`, mise à jour de `MoliereConfig`, ajout des helpers
  `getActiveProvider(config)` et `resolveDefaultModel(provider)`.
- `CHANGELOG.md` — entrée sous `## [Non publié] > ### Modifié`.

Aucun import depuis `src/llm/client.ts` n'est impacté (la façade continue de
lire `apiKey` / `baseUrl` / `defaultModel`).

## Étapes

1. Ouvrir `src/config.ts` et ajouter, après la ligne 7
   (`export type PermissionMode = ...`), le bloc suivant :

   ```ts
   import type { ProviderId } from "./llm/providers/types";

   export interface ProviderConfig {
     id: ProviderId;
     label: string;
     apiKey?: string;
     baseUrl?: string;
     defaultModel: string;
     enabled: boolean;
     authStyle: "bearer" | "x-api-key" | "query" | "oauth";
   }

   export type ProvidersRegistry = Record<ProviderId, ProviderConfig>;
   ```

2. Mettre à jour l'interface `MoliereConfig` (lignes 9-20) pour devenir :

   ```ts
   export interface MoliereConfig {
     /** Clé API du provider actif — rétro-compat. */
     apiKey?: string;
     /** Endpoint du provider actif — rétro-compat. */
     baseUrl: string;
     /** Modèle du provider actif — rétro-compat. */
     defaultModel: string;
     /** Identifiant du provider actif (1.4+). */
     activeProvider: ProviderId;
     /** Registre complet des providers configurés. */
     providers: ProvidersRegistry;
     /** Thème, permissions, etc. — inchangés. */
     theme: ThemeName;
     permissionMode: PermissionMode;
     maxToolRounds: number;
     maxOutputChars: number;
     planMode: boolean;
     sessionId?: string;
     customModels: string[];
   }
   ```

3. Ajouter, en bas de `src/config.ts`, deux helpers utilisés ensuite par
   T-05 et T-06 :

   ```ts
   export const getActiveProvider = (config: MoliereConfig): ProviderConfig => {
     const provider = config.providers[config.activeProvider];
     if (!provider) {
       throw new Error(
         `Provider actif "${config.activeProvider}" absent du registre.`,
       );
     }
     return provider;
   };

   export const resolveDefaultModel = (
     config: MoliereConfig,
     modelOverride?: string,
   ): string => {
     if (modelOverride) return modelOverride;
     const provider = getActiveProvider(config);
     return provider.defaultModel;
   };
   ```

4. `loadConfig` continue de retourner **toujours** les trois champs
   rétro-compatibles alimentés depuis la **section du provider actif**
   (la plomberie d'écriture dans `loadConfig` arrive en T-05). Pour
   cette tâche, **ne pas modifier** `loadConfig` ; uniquement préparer
   les types.

5. Documenter dans `CHANGELOG.md`, sous `## [Non publié] > ### Modifié` :

   ```markdown
   - `MoliereConfig` étendu avec `providers: ProvidersRegistry` et
     `activeProvider: ProviderId`. Les champs `apiKey`, `baseUrl`,
     `defaultModel` sont conservés en alias du provider actif pour la
     rétro-compatibilité (tâche r-01.4).
   ```

6. Vérifier la compilation. Comme `loadConfig` n'est pas encore branché
   sur le nouveau schéma, aucune erreur ne doit apparaître, **mais**
   `bunx tsc --noEmit` signalera des propriétés manquantes sur les
   littéraux internes : corriger ces sites en ajoutant une **valeur
   provisoire** (par ex. `activeProvider: "openai-compat"`, `providers:
   {} as ProvidersRegistry`) jusqu'à la T-05.

## Critères d'acceptation

- [ ] Nouveaux types `ProviderId`, `ProviderConfig`, `ProvidersRegistry`
      exportés depuis `src/config.ts` (réexportés depuis
      `src/llm/providers/types.ts`, pas dupliqués).
- [ ] `MoliereConfig` porte `providers` et `activeProvider` sans casser
      `apiKey`, `baseUrl`, `defaultModel`.
- [ ] Helpers `getActiveProvider` et `resolveDefaultModel` exportés.
- [ ] `bunx tsc --noEmit` retourne 0.
- [ ] `bun test` passe (rétro-compat respectée).

## Pièges & anti-patterns

- ❌ Définir `ProviderId` dans `src/config.ts` au lieu de l'importer de
  `src/llm/providers/types.ts` : créerait deux sources de vérité (R3 et
  cassera T-02).
- ❌ Casser la rétro-compatibilité en supprimant `apiKey`/`baseUrl`/
  `defaultModel` : `src/llm/client.ts:54,76` et `src/agent/loop.ts:75-76`
  les lisent encore (T-07 + T-09 corrigeront ces sites).
- ❌ Définir `ProvidersRegistry` comme `Map<...>` au lieu d'un record :
  le projet privilégie les objets littéraux pour la sérialisation JSON.
- ❌ Oublier d'exporter `ProviderConfig` et `ProvidersRegistry` :
  consommés par `loadConfig` (T-05) et `registry.ts` (T-06).
- ✅ Réutiliser les champs rétro-compatibles comme **vue** sur le provider
  actif (jamais comme source primaire).
- ✅ Garder `authStyle` dès maintenant pour éviter une migration
  supplémentaire lors de l'ajout des adaptateurs non-bearer (T-10, T-11).

## Références

- `AGENTS.md` — règle R3 strict + section 3 (conventions ajout de
  provider) ; règle R5 (chemins) sans impact ici.
- `src/llm/providers/types.ts` — source de `ProviderId`.
- `src/config.ts:9-20` — définition actuelle de `MoliereConfig`.
- `src/llm/client.ts:54,191` — usages actuels des champs rétro-compatibles
  à conserver pour T-07.
- T-05 — remplira `loadConfig` selon ce nouveau schéma.
- T-06 — utilisera `getActiveProvider` pour sélectionner l'adaptateur.
