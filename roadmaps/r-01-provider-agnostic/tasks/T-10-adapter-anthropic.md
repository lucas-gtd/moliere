# T-10 — Implémenter l'adaptateur Anthropic (Messages API)

> **Statut** : `TODO` · **Priorité** : `P1` · **Effort** : `M`

## But

Implémenter `src/llm/providers/anthropic.ts` qui parle à l'API **Messages**
d'Anthropic (`POST /v1/messages`, headers `x-api-key` + `anthropic-version`,
streaming SSE avec events `message_start`/`content_block_*`/`message_delta`).
L'adaptateur traduit l'IR canonique (`Message`/`ToolCall`/`ChatTool`) vers
le format Anthropic, accumule les `tool_use` et émet l'usage agrégé.
Résultat : `provider=anthropic` permet à Molière de piloter Claude 3.5 Sonnet,
Claude 3 Opus, etc.

## Pré-requis

- T-02 (TODO) — contrat `ProviderAdapter` (signatures `streamChat`, `chat`,
  `listModels`).
- T-03 (TODO) — IR canonique publié.
- T-04 (TODO) — `MoliereConfig.providers.anthropic` typé
  `{apiKey, baseUrl?, defaultModel}`.
- T-05 (TODO) — `MOLIERE_ANTHROPIC_API_KEY` chargé.
- T-06 (TODO) — `anthropic` enregistré dans `FACTORIES` du registre.

## Fichiers touchés

- `src/llm/providers/anthropic.ts` — **création**.
- `src/llm/providers/registry.ts` — ajout factory `anthropic`.
- `src/llm/providers/openai-compat.ts` — pas de modification (réutilisé
  uniquement par la famille OpenAI-compat).
- `tests/llm-providers-anthropic.test.ts` — **création** : tests happy-path,
  parsing SSE multi-events, tool_use, usage, erreurs.

## Étapes

1. Définir `ANTHROPIC_DEFAULTS` :

   ```ts
   export const ANTHROPIC_DEFAULTS = {
     providerId: "anthropic" as ProviderId,
     baseUrl: "https://api.anthropic.com",
     defaultModel: "claude-3-5-sonnet-latest",
     apiVersion: "2023-06-01",
     maxTokens: 8192,
   };
   ```

   Catalogue initial pour `listModels()` :

   ```ts
   [
     { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet", contextWindow: 200_000 },
     { id: "claude-3-5-haiku-latest",  label: "Claude 3.5 Haiku",  contextWindow: 200_000 },
     { id: "claude-3-opus-latest",     label: "Claude 3 Opus",     contextWindow: 200_000 },
   ]
   ```

2. **Construction de la requête** : convertir l'IR canonique vers le format
   Messages API :

   ```ts
   function buildAnthropicBody(req: Omit<ChatRequest, "stream">, model: string) {
     const systemMessages = req.messages.filter((m) => m.role === "system");
     const system = systemMessages.map((m) => m.content ?? "").join("\n\n") || undefined;
     const messages = req.messages
       .filter((m) => m.role !== "system")
       .map(toAnthropicMessage); // voir étape 3
     const tools = req.tools?.map((t) => ({
       name: t.function.name,
       description: t.function.description,
       input_schema: t.function.parameters,
     }));
     return {
       model,
       system,
       messages,
       max_tokens: ANTHROPIC_DEFAULTS.maxTokens,
       tools,
       temperature: req.temperature ?? 0.7,
       stream: true,
     };
   }
   ```

3. **Conversion message IR → Anthropic** :

   - `role: "user"` → `content: string` ou tableau de `content_blocks`.
   - `role: "assistant"` avec `tool_calls` → tableau de blocks :
     `{type: "text", text: content}` puis `{type: "tool_use", id, name, input}`.
   - `role: "tool"` → `{type: "tool_result", tool_use_id: tool_call_id, content}`.

4. **Endpoint & headers** :

   ```ts
   const url = `${config.baseUrl.replace(/\/$/, "")}/v1/messages`;
   const headers = {
     "Content-Type": "application/json",
     "x-api-key": config.apiKey,
     "anthropic-version": ANTHROPIC_DEFAULTS.apiVersion,
   };
   ```

   ⚠️ **Pas de header `Authorization: Bearer`** — Anthropic rejette la requête
   en 401 si les deux sont présents.

5. **Streaming SSE** : boucle `reader.read()`, split sur `\n`, parsing JSON
   par ligne `data: {json}` (mêmes conventions qu'OpenAI mais **events
   différents**) :

   | Event                  | Effet                                                                                              |
   | ---------------------- | -------------------------------------------------------------------------------------------------- |
   | `message_start`        | Initialiser `usage.input_tokens` ; émettre `onUsage` partiel.                                      |
   | `content_block_start`  | Si `block.type === "tool_use"`, créer une entrée dans `toolCalls[index]` avec `{id, name, input:{}}`. |
   | `content_block_delta`  | Si `delta.type === "text_delta"`, accumuler `fullText` et `onChunk(delta.text)`.                   |
   |                        | Si `delta.type === "input_json_delta"`, concaténer dans `toolCalls[index].input`.                    |
   | `content_block_stop`   | Finaliser le block (pas d'action particulière).                                                     |
   | `message_delta`        | Capturer `delta.stop_reason` + `usage.output_tokens`. Émettre `onUsage` agrégé.                    |
   | `message_stop`         | Clore la boucle ; retourner `{message, usage}`.                                                    |

   Erreurs natives (`event: "error"`) : `{type: "error", error: {type, message}}`.
   Mapper `401`/`403` → `auth`, `429` → `rate_limit`, `400` `invalid_request_error`
   → `context_length` si le message le mentionne.

6. **Accumulation des tool calls** :

   ```ts
   type Pending = { id: string; name: string; arguments: string };
   const toolCalls = new Map<number, Pending>();
   // content_block_start: toolCalls.set(index, { id, name, arguments: "" })
   // content_block_delta (input_json_delta): toolCalls.get(index)!.arguments += delta.partial_json
   // À la fin: JSON.parse(toolCalls.get(index)!.arguments) pour `input`
   ```

   Sérialiser dans l'IR final : chaque `ToolCall` doit avoir
   `function.arguments` sous forme de **string JSON** (cohérent avec
   `ChatTool.parameters` consommé par les tools Molière).

7. **Usage** : agréger `input_tokens` (de `message_start.message.usage`)
   + `output_tokens` (de `message_delta.usage`) :

   ```ts
   usage = {
     promptTokens: msgStartUsage.input_tokens,
     completionTokens: msgDeltaUsage.output_tokens,
     totalTokens: msgStartUsage.input_tokens + msgDeltaUsage.output_tokens,
   };
   ```

8. **`chat` non-streamé** : `POST /v1/messages` avec `stream: false`, le
   serveur renvoie directement `{content: [...], usage, stop_reason}`. Pas de
   parsing SSE, juste `await response.json()`.

9. **`listModels()`** : retourner le catalogue statique ci-dessus (étape 1).
   Pas d'endpoint distant au runtime pour rester déterministe.

10. Brancher dans `src/llm/providers/registry.ts` :

    ```ts
    anthropic: (c) => buildAnthropicAdapter(mergeConfig("anthropic", c)),
    ```

11. Tests `tests/llm-providers-anthropic.test.ts` :
    - mock `globalThis.fetch` ; émettre une séquence d'events SSE ;
    - tester accumulation `tool_use` (3 deltas `input_json_delta` →
      arguments JSON complet) ;
    - tester `onChunk` sur `text_delta` ;
    - tester `onUsage` agrégé avec input + output tokens ;
    - tester erreur 401 (header `Authorization: Bearer` envoyé par erreur →
      la requête **doit** échouer en pré-vol TS : interdire ce header dans
      l'adaptateur) ;
    - tester propagation `AbortSignal`.

## Critères d'acceptation

- [ ] `src/llm/providers/anthropic.ts` exporte `buildAnthropicAdapter` et
      `ANTHROPIC_DEFAULTS`.
- [ ] `rg -n 'Authorization: Bearer' src/llm/providers/anthropic.ts` retourne
      vide.
- [ ] La conversion IR ↔ Anthropic supporte les 3 rôles `user` /
      `assistant` (avec `tool_calls`) / `tool`.
- [ ] `bun test tests/llm-providers-anthropic.test.ts` passe.
- [ ] `bunx tsc --noEmit` retourne 0.

## Pièges & anti-patterns

- ❌ Envoyer `Authorization: Bearer` en plus de `x-api-key` : Anthropic
  renvoie 401, et le diagnostic n'est pas immédiat.
- ❌ Oublier `max_tokens` (obligatoire dans Messages API, défaut 8192 dans
  `ANTHROPIC_DEFAULTS` mais à exposer via options).
- ❌ Parser les events SSE ligne par ligne sans tolérer les commentaires
  `: keep-alive` (Anthropic en envoie) — les ignorer.
- ❌ Convertir `tool_use.input` en objet directement via `JSON.parse` à
  chaque delta : les deltas sont des **fragments** JSON partiels, à
  concaténer **avant** parse final.
- ❌ Émettre un seul `onUsage` par event SSE : il faut attendre
  `message_delta.usage.output_tokens` pour avoir le total.
- ❌ Réutiliser `parseSSE` d'`openai-compat.ts` tel quel : le format
  Anthropic envoie `event: <type>\ndata: <json>` — il faut soit dupliquer
  le helper en privé, soit extraire un module `src/llm/sse.ts` (à faire en
  T-19 ou plus tard).
- ✅ Stocker `toolCalls` dans une `Map<number, Pending>` indexée par
  l'ordre d'arrivée des `content_block_start` (Anthropic ne fournit pas
  d'index explicite, contrairement à OpenAI).
- ✅ Tester avec un mock qui envoie `event:` et `data:` sur deux lignes
  distinctes (format réel Anthropic).

## Références

- `AGENTS.md` — règles R3 (TS strict), R9 (préfixe `Erreur :`), R10 (tests
  `bun test`).
- https://docs.anthropic.com/en/api/messages — Messages API reference.
- https://docs.anthropic.com/en/api/messages-streaming — SSE event spec.
- https://docs.anthropic.com/en/api/tool-use — format `tool_use` /
  `tool_result`.
- `src/llm/types.ts` — IR canonique à respecter.
- `src/llm/providers/openai-compat.ts` — modèle de structure
  (factory + types exportés).
