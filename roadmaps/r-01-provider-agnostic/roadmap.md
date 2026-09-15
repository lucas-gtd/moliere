# Roadmap r-01 — Provider-agnostic

> **Objectif** : faire de Molière un agent capable de parler à n'importe quel
> provider de tokens (Anthropic, OpenAI, Gemini, Mistral, Kimi, GLM, GitHub
> Copilot, DeepSeek, Groq, OpenRouter, etc.) sans dupliquer la logique agent ni
> réécrire les outils.

## Contexte & invariants

- **Aujourd'hui** : Molière est couplé à une seule API OpenAI-compatible
  (MiniMax). Le client (`src/llm/client.ts`) appelle
  `${baseUrl}/chat/completions` avec `Authorization: Bearer`, parse du SSE
  OpenAI, et suppose `delta.tool_calls[i].function.{name, arguments}`.
- **3 sites dupliquent** la même requête HTTP : `src/llm/client.ts:50`,
  `src/agent/loop.ts:76`, `src/commands/compact.ts:6`.
- **Cible** : un registre de providers, un adaptateur par famille d'API, et un
  **IR canonique** interne que la boucle agent consomme sans savoir qui parle
  en face.
- **Hors scope** : entraînement, fine-tuning, tool-use spécifique à un modèle,
  multimodal (vision/voice) — uniquement le chat + tool calling textuels.

## Familles d'API ciblées

| Famille        | Providers                                                         | Stratégie                              |
| -------------- | ----------------------------------------------------------------- | -------------------------------------- |
| OpenAI-compat  | OpenAI, Mistral, Kimi (Moonshot), GLM (Zhipu), DeepSeek, Groq, OpenRouter, MiniMax | 1 adaptateur paramétrable              |
| Anthropic      | Anthropic Claude (Messages API)                                   | Adaptateur dédié (headers, SSE events) |
| Gemini         | Google Gemini (generateContent / streamGenerateContent)           | Adaptateur dédié (parts, query key)    |
| GitHub Copilot | GitHub Copilot Chat                                               | Adaptateur dédié (OAuth, allow-list)   |

## Organisation

Chaque tâche vit dans son propre fichier
[`tasks/T-XX-<slug>.md`](tasks/) avec :

- le **but**,
- les **fichiers touchés** (chemins absolus),
- les **étapes** numérotées,
- les **critères d'acceptation** (`bun test`, `bunx tsc --noEmit`),
- les **pièges** / anti-patterns à éviter (cf. `AGENTS.md`).

L'ordre T-XX reflète l'ordre d'exécution recommandé (fondations → adaptateurs
→ UX → docs → validation).

## Tableau des tâches

| #     | Titre                                                                              | Statut   | Description                                                                                                                                                                                                                          |
| ----- | ---------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-01  | [Audit du couplage actuel au provider MiniMax](tasks/T-01-audit-couplage.md)        | TODO     | Cartographier tous les sites qui hardcodent l'API MiniMax/OpenAI-compat (config, client, modèles, branding, docs, slash commands, CLI) afin de figer la liste exhaustive des points à découpler.                                      |
| T-02  | [Définir le contrat `ProviderAdapter`](tasks/T-02-provider-adapter-contract.md)    | TODO     | Spécifier l'interface TypeScript que chaque adaptateur doit implémenter : `chat`, `streamChat`, `listModels`, normalisation des erreurs, hooks `prepareRequest`/`normalizeResponse`. Aucun code modifié encore, uniquement le contrat. |
| T-03  | [Introduire un IR canonique pour messages/tools](tasks/T-03-canonical-ir.md)       | TODO     | Faire de `Message` / `ToolCall` / `Usage` / `ChatTool` le langage pivot interne ; ajouter un module `src/llm/ir.ts` qui sert de référence unique et documente les invariants (rôles, multi-tool, parallel tool calls, refus).          |
| T-04  | [Étendre `MoliereConfig` avec un registre de providers](tasks/T-04-config-providers.md) | TODO   | Ajouter `providers: Record<ProviderId, ProviderConfig>`, `activeProvider: ProviderId`, validation des clés API par provider, et fusion globale/projet pour les nouvelles clés.                                                        |
| T-05  | [Charger la config multi-providers (env + fichiers)](tasks/T-05-config-loader.md)   | TODO     | Étendre `loadConfig` pour reconnaître `MOLIERE_PROVIDER`, `MOLIERE_ANTHROPIC_API_KEY`, `MOLIERE_GEMINI_API_KEY`, `MOLIERE_COPILOT_TOKEN`, etc., avec priorité env > global > projet et validation Zod-free par `VALID_PROVIDERS`.       |
| T-06  | [Implémenter le registre de providers](tasks/T-06-provider-registry.md)             | TODO     | Créer `src/llm/providers/registry.ts` : `getActiveProvider()`, `listProviders()`, `getProvider(id)`, lazy-init des adaptateurs, mise en cache du `defaultModel` résolu.                                                                |
| T-07  | [Refactoriser `src/llm/client.ts` en façade basée sur le provider actif](tasks/T-07-client-facade.md) | TODO | Le client public ne fait plus de `fetch` ; il délègue tout à l'adaptateur actif. Conserver la signature `streamChat`, `chat`, `summarize`, `buildMessages` pour ne rien casser en amont (`agent/loop.ts`, `sub-agent.ts`).          |
| T-08  | [Implémenter l'adaptateur OpenAI-compat](tasks/T-08-adapter-openai-compat.md)      | TODO     | Centraliser le code historique (`Authorization: Bearer`, `/chat/completions`, parsing SSE OpenAI, accumulation des tool calls) dans `src/llm/providers/openai-compat.ts` paramétrable par `baseUrl`/`apiKey`/`defaultModel`.          |
| T-09  | [Supprimer les `fetch` directs dans `loop.ts` et `compact.ts`](tasks/T-09-remove-duplicate-fetches.md) | TODO | Remplacer les deux `summarize` / `fetchSummary` locaux par appels à `summarize` du client façade (ou injection d'un summarizer depuis le registre). But : un seul chemin HTTP par session.                                                |
| T-10  | [Implémenter l'adaptateur Anthropic](tasks/T-10-adapter-anthropic.md)              | TODO     | Nouveau fichier `src/llm/providers/anthropic.ts` : `x-api-key`, `anthropic-version: 2023-06-01`, endpoint `/v1/messages`, parsing des SSE events `message_start` / `content_block_start` / `content_block_delta` / `message_delta`, accumulation `input_tokens`/`output_tokens`. |
| T-11  | [Implémenter l'adaptateur Gemini](tasks/T-11-adapter-gemini.md)                    | TODO     | Nouveau fichier `src/llm/providers/gemini.ts` : `?key=...` en query, endpoint `:streamGenerateContent?alt=sse`, traduction `parts` ↔ messages, mapping `functionCall` ↔ tool calls, support du mode non-streamé via `generateContent`.       |
| T-12  | [Implémenter l'adaptateur GitHub Copilot](tasks/T-12-adapter-copilot.md)           | TODO     | Nouveau fichier `src/llm/providers/copilot.ts` : header `Authorization: Bearer <oauth>`, `Editor-Version` + `Copilot-Integration-Token`, endpoint `https://api.githubcopilot.com`, allow-list de modèles, refresh du token sur 401.        |
| T-13  | [Refactoriser `src/llm/models.ts` en catalogue multi-provider](tasks/T-13-model-catalog.md) | TODO | Réorganiser `MODELS` en `MODELS_BY_PROVIDER`, exposer `listModels({provider?, merged?: boolean})`, `getModel(id, provider?)`, conserver `customModels` (qui devient global). Documenter les `contextWindow` par défaut.                |
| T-14  | [Mettre à jour `/model` pour grouper par provider](tasks/T-14-model-picker.md)      | TODO     | Adapter la slash command `/model` pour afficher un menu groupé, accepter `<provider>:<model>` (ex. `anthropic:claude-3-5-sonnet-latest`) et valider que le modèle appartient au provider actif (ou le change si différent).               |
| T-15  | [Ajouter `/provider list|use|info`](tasks/T-15-provider-commands.md)                | TODO     | Nouvelle slash command : `/provider` (état), `/provider list`, `/provider use <id>`, `/provider info <id>` (modèles, mode d'auth, baseUrl masquée). Met à jour `activeProvider` via `ctx.actions`.                                          |
| T-16  | [CLI `--provider` et erreurs neutres dans `src/index.tsx`](tasks/T-16-cli-flags.md)  | TODO     | Ajouter `--provider <id>` au programme commander, valider la présence de la clé du provider choisi (pas juste `MOLIERE_API_KEY`), et remplacer les messages d'erreur « Molière / MiniMax » par un libellé générique.                        |
| T-17  | [Normaliser les erreurs cross-provider](tasks/T-17-error-normalization.md)          | TODO     | Introduire `ProviderError` typé (`auth`, `rate_limit`, `context_length`, `content_filter`, `upstream`, `network`) + `asProviderError()` ; chaque adaptateur mappe les erreurs natives vers ce format. Le `loop` peut alors réagir uniformément. |
| T-18  | [Mettre à jour `.env.example` et `MOLIERE.md.example`](tasks/T-18-env-examples.md)   | TODO     | Ajouter toutes les nouvelles variables (`MOLIERE_PROVIDER`, `MOLIERE_*_API_KEY`, etc.), retirer les références à `MiniMax`, expliquer la sélection de provider dans `MOLIERE.md.example`.                                                    |
| T-19  | [Tests unitaires par adaptateur (mock `fetch`)](tasks/T-19-adapter-tests.md)        | TODO     | Pour chaque adaptateur (openai-compat, anthropic, gemini, copilot) : tests happy-path, tests d'erreur, tests d'accumulation de tool calls en streaming, tests d'usage. Mocker `globalThis.fetch`.                                            |
| T-20  | [Tests du registre et de la sélection de provider](tasks/T-20-registry-tests.md)    | TODO     | Couvrir `loadConfig` multi-providers, `getActiveProvider`, fallback quand une clé manque, erreurs explicites (« clé manquante pour provider X »). Tests Bun, pas de framework tiers.                                                       |
| T-21  | [Documentation utilisateur (README + CHANGELOG)](tasks/T-21-docs.md)                | TODO     | Section « Providers » dans le README (matrice des providers, snippets `MOLIERE_PROVIDER=anthropic`, troubleshooting par code d'erreur). Entrée détaillée dans `CHANGELOG.md` sous `## [Unreleased]`.                                      |
| T-22  | [Validation finale](tasks/T-22-final-validation.md)                                 | TODO     | `bun install`, `bunx tsc --noEmit`, `bun test`, smoke CLI par provider disponible (au moins un provider réel via variable d'env). Vérifier qu'aucun `fetch`/`apiKey`/`baseUrl` n'est hardcodé hors de `src/llm/providers/`.             |

## Légende des statuts

- `TODO` : pas démarrée.
- `IN_PROGRESS` : en cours (un seul `in_progress` à la fois par convention).
- `DONE` : critères d'acceptation validés.

## Critères globaux de « DONE » pour la roadmap

- [ ] `bun test` passe sans erreur ni warning.
- [ ] `bunx tsc --noEmit` retourne 0.
- [ ] Aucun fichier hors `src/llm/providers/` ne contient un literal
      `https://api.minimax.io`, `MOLIERE_API_KEY`, `Authorization: Bearer`
      **en dur** (hors tests/docs).
- [ ] Les 4 familles d'API (OpenAI-compat, Anthropic, Gemini, Copilot)
      disposent d'un adaptateur implémenté et testé.
- [ ] `/provider use anthropic` suivi d'un prompt aboutit à un appel vers
      `api.anthropic.com` (vérifiable via `MOLIERE_VERBOSE=1` ou logs de dev).
- [ ] README et CHANGELOG à jour.
