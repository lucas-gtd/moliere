# T-19 — Tests unitaires par adaptateur (mock `fetch`)

> **Statut** : `TODO` · **Priorité** : `P0` · **Effort** : `L`

## But

Poser la **base de test** pour chaque adaptateur provider livré par T-04 à T-13. Chaque adaptateur doit avoir un fichier `tests/providers/<provider>.adapter.test.ts` qui mocke `globalThis.fetch` via le helper `mock()` de Bun, construit des flux SSE synthétiques, et couvre a minima : streaming heureux avec tool calls, erreur HTTP 401 → `ProviderError{kind:"auth"}`, erreur HTTP 429 → `ProviderError{kind:"rate_limit"}`. Les tests doivent **aussi** vérifier l'accumulation correcte des deltas spécifiques au provider (`delta.tool_calls` OpenAI, `input_json_delta` Anthropic, `functionCall` Gemini).

## Pré-requis

- T-04 à T-13 (DONE) — adaptateurs livrés, `ProviderError` (T-17) exporté.
- `bun test` opérationnel, environnement sans appels réseau.

## Fichiers touchés

- `tests/providers/_helpers/sse.ts` — **nouveau** : helpers de fabrication de `ReadableStream` SSE.
- `tests/providers/_helpers/fetchMock.ts` — **nouveau** : installation/restauration du mock `globalThis.fetch`.
- `tests/providers/openai.adapter.test.ts` — **nouveau**.
- `tests/providers/anthropic.adapter.test.ts` — **nouveau**.
- `tests/providers/gemini.adapter.test.ts` — **nouveau**.
- `tests/providers/mistral.adapter.test.ts` — **nouveau**.
- `tests/providers/kimi.adapter.test.ts` — **nouveau**.
- `tests/providers/glm.adapter.test.ts` — **nouveau**.
- `tests/providers/copilot.adapter.test.ts` — **nouveau**.
- `tests/providers/deepseek.adapter.test.ts` — **nouveau**.
- `tests/providers/groq.adapter.test.ts` — **nouveau**.
- `tests/providers/openrouter.adapter.test.ts` — **nouveau**.
- `tests/providers/ollama.adapter.test.ts` — **nouveau**.
- `tests/providers/minimax.adapter.test.ts` — **nouveau** (régression sur l'existant).

## Étapes

1. **Helper SSE** — créer `tests/providers/_helpers/sse.ts` qui expose :

   ```ts
   import { ReadableStream } from "node:stream/web";

   export type SseFrame = string; // déjà formaté "data: <json>\n\n"

   export const sseStream = (frames: SseFrame[]): ReadableStream<Uint8Array> => {
     const encoder = new TextEncoder();
     let index = 0;
     return new ReadableStream({
       pull(controller) {
         if (index >= frames.length) {
           controller.close();
           return;
         }
         controller.enqueue(encoder.encode(frames[index]!));
         index += 1;
       },
     });
   };

   export const sseJson = (payload: unknown): SseFrame =>
     `data: ${JSON.stringify(payload)}\n\n`;

   export const sseDone = (): SseFrame => "data: [DONE]\n\n";
   ```

2. **Helper fetch mock** — `tests/providers/_helpers/fetchMock.ts` exporte :

   ```ts
   import { mock } from "bun:test";

   export const installFetchMock = (
     responder: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response,
   ): (() => void) => {
     const original = globalThis.fetch;
     const spy = mock(async (input: RequestInfo | URL, init?: RequestInit) =>
       responder(input, init),
     );
     globalThis.fetch = spy as unknown as typeof fetch;
     return () => {
       globalThis.fetch = original;
     };
   };
   ```

3. **Pattern de test par adaptateur** :

   ```ts
   import { afterEach, describe, expect, test } from "bun:test";
   import { installFetchMock } from "./_helpers/fetchMock";
   import { sseDone, sseJson, sseStream } from "./_helpers/sse";
   import { createOpenAIAdapter } from "../../src/llm/providers/openai";
   import { isProviderError } from "../../src/llm/providers/errors";

   describe("openai adapter", () => {
     let restoreFetch: (() => void) | undefined;
     afterEach(() => restoreFetch?.());

     test("happy path streaming with tool calls", async () => {
       const frames = [
         sseJson({ choices: [{ delta: { content: "Hello" }, index: 0 }] }),
         sseJson({
           choices: [{
             delta: {
               tool_calls: [{ index: 0, id: "call_1", function: { name: "readFile", arguments: "" } }],
             },
             index: 0,
           }],
         }),
         sseJson({
           choices: [{
             delta: { tool_calls: [{ index: 0, function: { arguments: "{\"path\":" } }] },
             index: 0,
           }],
         }),
         sseJson({
           choices: [{
             delta: { tool_calls: [{ index: 0, function: { arguments: "\"a.ts\"}" } }] },
             index: 0,
           }],
         }),
         sseJson({
           choices: [{ delta: {}, finish_reason: "tool_calls", index: 0 }],
           usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
         }),
         sseDone(),
       ];
       restoreFetch = installFetchMock(() =>
         new Response(sseStream(frames), { status: 200, headers: { "content-type": "text/event-stream" } }),
       );

       const adapter = createOpenAIAdapter({ apiKey: "sk-test", baseUrl: "https://api.openai.com/v1" });
       const events: Array<{ type: string; payload: unknown }> = [];
       for await (const ev of adapter.stream({ model: "gpt-4o-mini", messages: [{ role: "user", content: "hi" }] })) {
         events.push({ type: ev.type, payload: ev.payload });
       }

       const textEvents = events.filter((e) => e.type === "text");
       expect(textEvents.map((e) => e.payload).join("")).toBe("Hello");

       const toolCalls = events.filter((e) => e.type === "tool_call_delta");
       const last = toolCalls.at(-1)?.payload as { function: { name: string; arguments: string } };
       expect(last.function.name).toBe("readFile");
       expect(JSON.parse(last.function.arguments)).toEqual({ path: "a.ts" });
     });

     test("401 → ProviderError{kind:'auth'}", async () => {
       restoreFetch = installFetchMock(() => new Response("unauthorized", { status: 401 }));
       const adapter = createOpenAIAdapter({ apiKey: "sk-test", baseUrl: "https://api.openai.com/v1" });
       await expect(
         (async () => {
           for await (const _ of adapter.stream({ model: "gpt", messages: [] })) {
             /* noop */
           }
         })(),
       ).rejects.toSatisfy((err: unknown) => isProviderError(err) && err.kind === "auth");
     });

     test("429 → ProviderError{kind:'rate_limit'}", async () => {
       restoreFetch = installFetchMock(() => new Response("rate limit", { status: 429 }));
       const adapter = createOpenAIAdapter({ apiKey: "sk-test", baseUrl: "https://api.openai.com/v1" });
       await expect(
         (async () => {
           for await (const _ of adapter.stream({ model: "gpt", messages: [] })) {
             /* noop */
           }
         })(),
       ).rejects.toSatisfy((err: unknown) => isProviderError(err) && err.kind === "rate_limit");
     });
   });
   ```

4. **Spécificités à valider explicitement** :

   - **OpenAI** : vérifier que `delta.tool_calls` fragments (3 chunks successifs) s'accumulent en un seul `tool_call` complet avec `arguments` JSON valide parsable. Tester aussi le cas multi-tools (index 0 et 1).
   - **Anthropic** : vérifier `content_block_start` (`type: "tool_use"`) → `content_block_delta` avec `input_json_delta` partiel → `content_block_stop`. Doit produire un seul `tool_call`.
   - **Gemini** : tester la conversion `functionCall.args` (objet) → `tool_call.function.arguments` (string JSON). Tester le multi-candidats (`candidates[0].content.parts`).
   - **Ollama** : tester le mode non-streamé (`stream: false`) qui renvoie un seul JSON, et vérifier qu'il n'invoque jamais `Authorization`.
   - **Copilot** : tester que `integrationToken` est prioritaire sur `token`, et que le header `Editor-Version` est présent.
   - **OpenRouter** : tester le préfixe de modèle (`openai/gpt-4o-mini`) et le routage correct de `provider` dans le body.

5. Pour chaque adaptateur : tester **en plus** l'absence de leakage réseau (le test casse si `installFetchMock` n'est pas appelé — assertion explicite `expect(spy).toHaveBeenCalled()`).

6. Ajouter une cible `bun test tests/providers/` qui permet de relancer uniquement cette suite pendant le dev.

## Critères d'acceptation

- [ ] `bun test tests/providers/` passe avec 3 cas minimum par adaptateur (13 adaptateurs × 3 = 39 tests).
- [ ] `bun test tests/providers/openai.adapter.test.ts` démontre l'accumulation correcte des `delta.tool_calls`.
- [ ] `bun test tests/providers/anthropic.adapter.test.ts` démontre l'accumulation correcte des `input_json_delta`.
- [ ] `bun test tests/providers/gemini.adapter.test.ts` démontre la conversion `functionCall` objet → string JSON.
- [ ] Aucun appel réseau réel : si l'environnement offline, `bun test` doit toujours passer (mock strict).
- [ ] `bunx tsc --noEmit` retourne 0.

## Pièges & anti-patterns

- ❌ Utiliser `nock`, `msw` ou autre lib tierce : rester sur `mock()` de `bun:test` (R2).
- ❌ Oublier de restaurer `globalThis.fetch` après chaque test — fuite vers les autres suites.
- ❌ Tester uniquement le happy-path (oublier les codes d'erreur).
- ❌ Émettre des frames SSE sans `\n\n` final — le parseur silicera l'erreur.
- ❌ Utiliser `as any` pour typer le payload JSON (`unknown` suffit, R3).
- ✅ Préférer `rejects.toSatisfy((err) => isProviderError(err) && ...)` plutôt qu'`err.kind === ...` direct : force la discrimination stricte.
- ✅ Garder les frames SSE **petites** et auto-contenues dans chaque test (lisibilité).

## Références

- `AGENTS.md` R2 — `bun add` interdit, rester avec `bun:test` builtin.
- `AGENTS.md` R10 — tests dans `tests/*.test.ts`.
- `AGENTS.md` R3 — pas de `any`, typer les payloads JSON en `unknown`.
- [`Bun — mock()`](https://bun.sh/docs/test/mocks#mock-functions).
- [`Bun — ReadableStream`](https://bun.sh/docs/api/streams#readable-streams).
