# T-02 — Définir le contrat `ProviderAdapter`

> **Statut** : `TODO` · **Priorité** : `P0` · **Effort** : `S`

## But

Spécifier l'interface TypeScript `ProviderAdapter` que chaque adaptateur
(OpenAI-compat, Anthropic, Gemini, GitHub Copilot) implémentera. Le contrat
doit être **fermé sur la sortie, ouvert sur l'entrée** : seules les formes
canoniques de `src/llm/types.ts` traversent la frontière. Le fichier
`src/llm/providers/types.ts` est créé avec l'interface, sans encore
d'implémentation. Aucune logique existante n'est modifiée.

## Pré-requis

- T-01 (DONE) — liste des sites à découpler connue.
- T-03 (TODO mais peut être parallèle) — IR canonique déjà réfléchi : les
  types référencés ci-dessous (`Message`, `ChatTool`, `ModelInfo`, `Usage`,
  `ChatRequest`) existent déjà dans `src/llm/types.ts`.

## Fichiers touchés

- `src/llm/providers/types.ts` — **création** : contient
  `ProviderId`, `ProviderError`, `ProviderContext`, `StreamHandlers`,
  `ChatResult`, `ProviderAdapter`, plus les constantes `PROVIDER_IDS`.
- `src/llm/providers/README.md` — **création** : explique le rôle du dossier
  `providers/`, la convention d'implémentation, et donne un exemple minimal
  d'adaptateur vide.
- `package.json` — **pas de modification** (aucune dépendance ajoutée).

## Étapes

1. Créer `src/llm/providers/types.ts` avec le contenu suivant (à coller tel
   quel, sans modification) :

   ```ts
   // src/llm/providers/types.ts
   import type { Message, ModelInfo, ChatRequest, Usage, ChatTool } from "../types";

   export const PROVIDER_IDS = [
     "openai-compat",
     "anthropic",
     "gemini",
     "copilot",
   ] as const;

   export type ProviderId = (typeof PROVIDER_IDS)[number];

   export type ProviderErrorKind =
     | "auth"
     | "rate_limit"
     | "context_length"
     | "content_filter"
     | "upstream"
     | "network";

   export interface ProviderContext {
     apiKey: string;
     baseUrl?: string;
     defaultModel: string;
     fetch?: typeof fetch;
   }

   export interface ProviderError extends Error {
     provider: ProviderId;
     kind: ProviderErrorKind;
     status?: number;
     retryAfterMs?: number;
     modelId?: string;
   }

   export interface StreamHandlers {
     onChunk?: (text: string) => void;
     onToolCallDelta?: (delta: {
       index: number;
       id?: string;
       name?: string;
       argumentsDelta?: string;
     }) => void;
     onUsage?: (usage: Usage) => void;
     signal?: AbortSignal;
   }

   export interface ChatResult {
     message: Message;
     usage?: Usage;
   }

   export interface ProviderAdapter {
     readonly id: ProviderId;
     readonly label: string;
     chat(
       request: Omit<ChatRequest, "stream">,
       signal?: AbortSignal,
     ): Promise<ChatResult>;
     streamChat(
       request: Omit<ChatRequest, "stream">,
       handlers: StreamHandlers,
     ): Promise<ChatResult>;
     listModels(): Promise<ModelInfo[]>;
     getModel(id: string): ModelInfo | undefined;
     getContextWindow(modelId: string): number;
     buildTools(tools: ChatTool[]): unknown;
   }

   export interface ProviderFactory {
     readonly id: ProviderId;
     readonly label: string;
     create(ctx: ProviderContext): ProviderAdapter;
   }
   ```

2. Conserver `ProviderError` volontairement **minimale** ici (juste la
   surface) ; l'enrichissement (codes d'erreur spécifiques, helpers
   `asProviderError`) est traité en T-17.

3. Documenter chaque méthode en JSDoc dans le fichier source :

   - `chat` : renvoie `Promise<ChatResult>` même en cas d'erreur de format —
     les erreurs sont propagées sous forme de `throw new ProviderError(...)`.
   - `streamChat` : doit appeler `onChunk` pour chaque fragment textuel, et
     `onToolCallDelta` pour chaque incrément de `tool_call` ; `signal` est
     respecté via `AbortSignal`.
   - `listModels` : la résolution effective dépend de la famille d'API ; pour
     OpenAI-compat elle peut être statique, pour Anthropic/Gemini/Copilot
     elle peut appeler le catalogue distant.
   - `buildTools` : convertit la représentation canonique vers le schéma
     natif du provider (ex. Gemini attend `functionDeclarations`).

4. Ajouter `src/llm/providers/README.md` (5-10 lignes) :

   ```markdown
   # Providers Molière

   Chaque fichier de ce dossier implémente `ProviderAdapter`
   (voir `types.ts`) pour une famille d'API :

   - `openai-compat.ts` — OpenAI, Mistral, DeepSeek, Groq, OpenRouter, MiniMax, etc.
   - `anthropic.ts` — Claude (Messages API).
   - `gemini.ts` — Google Gemini (generateContent / streamGenerateContent).
   - `copilot.ts` — GitHub Copilot Chat.

   Pour ajouter un provider :
   1. Implémenter `ProviderAdapter` dans un nouveau fichier.
   2. Déclarer un `ProviderFactory` correspondant.
   3. Référencer le factory dans `registry.ts` (T-06).
   ```

5. Vérifier la compilation isolée du fichier :

   ```bash
   bunx tsc --noEmit src/llm/providers/types.ts
   ```

   (ou simplement `bunx tsc --noEmit` global — ne doit retourner aucune
   erreur puisque le fichier n'est référencé par rien d'autre à ce stade).

## Critères d'acceptation

- [ ] `src/llm/providers/types.ts` existe avec l'interface exacte ci-dessus.
- [ ] `src/llm/providers/README.md` existe avec la convention documentée.
- [ ] `bunx tsc --noEmit` retourne 0.
- [ ] `bun test` passe (aucun test existant ne référence encore le dossier
      `providers/`, donc régression impossible).
- [ ] Aucun fichier de `src/llm/client.ts` ou `src/agent/loop.ts` n'est
      modifié pour l'instant.

## Pièges & anti-patterns

- ❌ Oublier le `Omit<ChatRequest, "stream">` : la propriété `stream` doit
  rester interne à l'adaptateur (sinon double source de vérité entre
  signature et body).
- ❌ Utiliser `any` ou `as unknown as` pour le retour `buildTools` ; rester
  sur `unknown` (R3 strict).
- ❌ Mélanger erreurs provider (`ProviderError`) et `Error` natif dans un
  même `throw` ; toujours normaliser à `ProviderError`, même au prix d'un
  mapping (ce point est étoffé en T-17).
- ❌ Référencer `src/llm/providers/types.ts` depuis `src/llm/client.ts` à ce
  stade — la façade reste dépendante de `loadConfig()` jusqu'à T-07.
- ✅ `PROVIDER_IDS` est un `as const` pour garder le littéral étroit ;
  `ProviderId` en dérive.
- ✅ Conserver les noms de méthodes `chat` / `streamChat` identiques à ceux
  de `src/llm/client.ts` pour faciliter la migration T-07.

## Références

- `AGENTS.md` — règle R3 (TypeScript strict, `noUncheckedIndexedAccess`)
  motive le typage strict de `ProviderContext` ; règle R9 (sorties = string)
  ne s'applique pas aux adaptateurs car ils retournent des `Message`,
  `ChatResult`, etc. (objets du domaine IR).
- `roadmaps/r-01-provider-agnostic/roadmap.md` — familles d'API ciblées.
- `src/llm/types.ts:1-54` — source de vérité des types IR.
- T-17 — Normalisation d'erreurs cross-provider (complète `ProviderError`).
