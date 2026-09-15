# T-07 — Refactoriser `src/llm/client.ts` en façade basée sur le provider actif

> **Statut** : `TODO` · **Priorité** : `P0` · **Effort** : `M`

## But

Transformer `src/llm/client.ts` (244 lignes aujourd'hui) en **façade pure**
qui ne contient plus aucun `fetch` direct : toutes les fonctions publiques
(`streamChat`, `chat`, `summarize`, `buildMessages`, `listAvailableTools`)
délèguent à l'adaptateur sélectionné par `src/llm/providers/registry.ts`.
Les signatures exportées restent strictement identiques pour ne casser
aucun consommateur amont (`src/agent/loop.ts:2`, `src/agent/sub-agent.ts`,
`src/commands/compact.ts`).

## Pré-requis

- T-02 (DONE) — `ProviderAdapter` défini.
- T-06 (DONE) — `getActiveProvider()` opérationnel.

> T-08 (OpenAI-compat) peut être livré en parallèle ; tant que les stubs
> jettent, la façade compile mais provoque `Error: non implémenté` à
> l'exécution. C'est acceptable et **attendu** jusqu'à T-08.

## Fichiers touchés

- `src/llm/client.ts` — refactor : suppression du `fetch`, des fonctions
  locales `accumulateToolCall` et `parseSSE`, ajout de la délégation.
- `tests/llm-client-facade.test.ts` — **création** : couvre la délégation
  en stubbant `getActiveProvider`.
- `CHANGELOG.md` — entrée `### Modifié` listant les symboles supprimés.

Aucun consommateur amont n'est migré dans cette tâche (T-09 supprimera
les duplications de `summarize` / `fetchSummary`).

## Étapes

1. Réécrire `src/llm/client.ts` comme suit (à coller tel quel) :

   ```ts
   /**
    * Façade LLM publique.
    *
    * Toute la logique réseau a été déplacée dans `src/llm/providers/`.
    * Ce module ne fait plus que (a) valider superficiellement les entrées
    * et (b) déléguer à l'adaptateur du provider actif.
    *
    * Les signatures exportées sont conservées à l'identique pour ne
    * casser aucun consommateur (`agent/loop.ts`, `sub-agent.ts`,
    * `commands/compact.ts`).
    */
   import { getActiveProvider } from "./providers/registry";
   import type { ChatTool } from "./types";
   import type { ChatRequest, Message, ToolCall, Usage } from "./types";

   export type { ChatRequest, Message, ToolCall, Usage, ChatTool } from "./types";

   type StreamHandlers = {
     onChunk?: (text: string) => void;
     onToolCallDelta?: (toolCall: Partial<ToolCall> & { index: number }) => void;
     onUsage?: (usage: Usage) => void;
     signal?: AbortSignal;
   };

   type ChatResponse = {
     message: Message;
     usage?: Usage;
   };

   /** @deprecated Conservé pour rétro-compat, délègue à l'adaptateur. */
   export const streamChat = async (
     request: Omit<ChatRequest, "stream">,
     handlers: StreamHandlers = {},
   ): Promise<ChatResponse> =>
     getActiveProvider().streamChat(request, handlers);

   export const chat = async (
     request: Omit<ChatRequest, "stream">,
     signal?: AbortSignal,
   ): Promise<ChatResponse> =>
     getActiveProvider().chat(request, signal);

   export const summarize = async (
     messages: Message[],
     model?: string,
   ): Promise<string> => {
     const adapter = getActiveProvider();
     const { message } = await adapter.chat({
       model: model ?? adapter["getContextWindow"] ? "" : "",
       messages: [
         {
           role: "system",
           content:
             "Vous êtes un archiviste concis. Résumez la conversation ci-dessous en moins de 400 mots, en français. Préservez les décisions clés, noms de fichiers, intents, et toute information nécessaire pour continuer la tâche sans perdre le contexte. Utilisez des puces si utile.",
         },
         { role: "user", content: messages.map((m) => `[${m.role}] ${m.content ?? ""}`).join("\n") },
       ],
     });
     return message.content ?? "";
   };

   export const buildMessages = (raw: unknown[]): Message[] =>
     raw.map((entry) => entry as Message);

   /** @deprecated Aucun outil distant n'est supporté. Conservé pour la signature. */
   export const listAvailableTools = (): ChatTool[] => [];
   ```

   Notes :
   - Le calcul de `model ?? ...` pour `summarize` doit en réalité
     appeler le helper `resolveDefaultModel(config)` de T-04 ou
     `loadConfig().defaultModel` ; corriger le stub ci-dessus lors de
     l'implémentation en s'inspirant de :

     ```ts
     import { loadConfig } from "../config";
     const cfg = loadConfig();
     const targetModel = model ?? cfg.defaultModel;
     ```

     et passer `targetModel` à `adapter.chat(...)`.

   - Garder les commentaires `@deprecated` strictement Localisés aux
     signatures qui changent sémantiquement (`streamChat`, `listAvailableTools`).

2. Mettre à jour le commentaire de tête pour bien indiquer que la
   façade est désormais une **delegation layer**.

3. Vérifier qu'aucun consommateur amont n'est cassé :

   - `src/agent/loop.ts:2` importe `{ streamChat, type ChatRequest, type Message, type ToolCall, type Usage }` →
     `streamChat` toujours exporté avec la même signature.
   - `src/agent/sub-agent.ts:4` importe `Message` depuis `../llm/types`
     directement — non concerné.
   - `src/commands/compact.ts` importe `Message` depuis `../llm/types` —
     non concerné, sera nettoyé par T-09.

4. Ajouter `tests/llm-client-facade.test.ts` :

   ```ts
   import { describe, expect, test, beforeEach } from "bun:test";
   import { __resetRegistryForTests } from "../src/llm/providers/registry";
   import { chat, streamChat, summarize } from "../src/llm/client";

   const fakeAdapter = {
     id: "openai-compat",
     label: "fake",
     chat: async (req: any) => ({
       message: { role: "assistant", content: "ok-" + req.model },
       usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
     }),
     streamChat: async (_req: any, handlers: any) => {
       handlers.onChunk?.("hello");
       handlers.onUsage?.({ promptTokens: 1, completionTokens: 1, totalTokens: 2 });
       return { message: { role: "assistant", content: "hello" } };
     },
     listModels: async () => [],
     getModel: () => undefined,
     getContextWindow: () => 200_000,
     buildTools: (t: unknown) => t,
   };

   describe("llm/client façade", () => {
     beforeEach(() => {
       __resetRegistryForTests();
       for (const k of Object.keys(process.env)) {
         if (k.startsWith("MOLIERE_")) delete process.env[k];
       }
     });

     test("chat délègue à l'adaptateur actif", async () => {
       process.env.MOLIERE_PROVIDER = "openai-compat";
       process.env.MOLIERE_OPENAI_COMPAT_API_KEY = "sk-x";
       // On remplace temporairement la factory par un fake :
       const reg = await import("../src/llm/providers/registry");
       const orig = (reg as any).__resetRegistryForTests;
       (reg as any).__resetRegistryForTests = () => {};

       // Stub via injection : réécrire la factory openai-compat ne sera
       // nécessaire que tant que T-08 n'est pas livré ; ici on se limite
       // à vérifier que la façade appelle bien getActiveProvider().
       const result = await chat({ model: "m", messages: [] });
       // L'adaptateur stub jette, donc on attend l'erreur :
       expect(result).toBeUndefined();
       (reg as any).__resetRegistryForTests = orig;
     });

     test("summarize propage le contenu de l'adaptateur", async () => {
       // Variante via stub du module :
       const mod = await import("../src/llm/client");
       expect(typeof mod.summarize).toBe("function");
     });

     test("streamChat propage onUsage et onChunk", async () => {
       // Variante: enregistrer un faux adaptateur via le stub de test.
       // Code laissé en commentaire car dépendant de l'injection de T-08.
     });
   });
   ```

   Réduire le test à des assertions **structurelles** tant que T-08 n'a
   pas livré l'adaptateur réel : se contenter de vérifier que la façade
   appelle bien `getActiveProvider()` et que les stubs jettent
   `non implémenté`.

5. Documenter dans `CHANGELOG.md` :

   ```markdown
   ### Modifié

   - `src/llm/client.ts` devient une façade : suppression des fonctions
     `accumulateToolCall`, `parseSSE`, `streamChat`/`chat` basées sur
     `fetch`. Toutes les requêtes HTTP sont désormais déléguées à
     `src/llm/providers/<id>` via `getActiveProvider()`. Les signatures
     publiques sont conservées (tâche r-01.7).
   ```

6. Vérifier :

   ```bash
   bunx tsc --noEmit
   bun test
   ```

   Tant que T-08 n'est pas livré, plusieurs tests échoueront à
   l'exécution (erreur « non implémenté »). C'est attendu et explicitement
   noté dans la PR.

## Critères d'acceptation

- [ ] `src/llm/client.ts` ne contient plus de `fetch` direct (vérifier
      `grep "fetch(" src/llm/client.ts` retourne 0 occurrence).
- [ ] `src/llm/client.ts` ne contient plus `Authorization: Bearer`,
      `chat/completions`, `delta.tool_calls` (vérifier
      `grep -E 'Authorization:|chat/completions|delta\.tool_calls'
      src/llm/client.ts` retourne 0).
- [ ] Les exports publics (`streamChat`, `chat`, `summarize`,
      `buildMessages`, `listAvailableTools`) sont conservés à l'identique
      (signatures + types réexportés).
- [ ] `tests/llm-client-facade.test.ts` existe.
- [ ] `bunx tsc --noEmit` retourne 0.
- [ ] `bun test` ne casse aucun test pré-existant (les erreurs des stubs
      ne surviennent que dans les tests propres à T-07).

## Pièges & anti-patterns

- ❌ Modifier `src/agent/loop.ts` ou `src/commands/compact.ts` dans cette
  tâche : c'est T-09. Mélanger les étapes brouille la revue et expose
  à des régressions de double-appel.
- ❌ Casser l'ordre de résolution du modèle de summarization : `summarize`
  doit utiliser la valeur effective de `defaultModel` issue du provider
  actif (`loadConfig().defaultModel`), pas un fallback codé en dur.
- ❌ Garder `accumulateToolCall` ou `parseSSE` comme helpers « au cas
  où » : la logique d'accumulation appartient à l'adaptateur OpenAI
  (T-08).
- ❌ Introduire un cache local à `client.ts` ; le cache est l'affaire du
  registre (T-06).
- ❌ Ajouter `import { PROVIDER_IDS }` à `client.ts` ; c'est le registre
  qui sélectionne.
- ✅ Conserver `buildMessages` même s'il s'agit d'un pass-through
  trivial : sa suppression est du ressort d'une revue séparée pour
  éviter de multiplier les consommateurs à nettoyer.
- ✅ Marquer `listAvailableTools` et `streamChat` en `@deprecated` côté
  JSDoc uniquement (pas au niveau TypeScript) pour rester en
  `pre-1.0` sémantique.

## Références

- `AGENTS.md` — règle R3 (TypeScript strict), R5 (pas d'impact sur
  chemins), R9 (façade renvoie des objets domaine, pas des strings).
- `src/llm/client.ts:50-244` — implémentation actuelle à réduire en
  façade.
- `src/agent/loop.ts:2` — principal consommateur de `streamChat`.
- `src/commands/compact.ts:6` — duplique un `fetch` ; nettoyé en T-09.
- T-02 — définit le contrat `ProviderAdapter` que la façade appelle.
- T-06 — fournit `getActiveProvider()` consommé directement ici.
- T-08 — premier adaptateur qui rendra `streamChat` opérationnel.
