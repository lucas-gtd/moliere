# T-08 — Implémenter l'adaptateur OpenAI-compat

> **Statut** : `TODO` · **Priorité** : `P0` · **Effort** : `M`

## But

Centraliser le code de transport OpenAI-compatible (Bearer auth, endpoint
`/chat/completions`, parsing SSE OpenAI, accumulation `delta.tool_calls`) dans
un seul module `src/llm/providers/openai-compat.ts` paramétrable par
`baseUrl`/`apiKey`/`defaultModel`. Le fichier devient l'adaptateur utilisé
par **tous** les providers de la famille OpenAI-compat : `openai`, `mistral`,
`kimi`, `glm`, `deepseek`, `groq`, `openrouter`, `minimax`. Résultat : la
boucle agent appelle `streamChat`/`chat` du registre sans connaître
l'endpoint réel.

## Pré-requis

- T-02 (TODO) — contrat `ProviderAdapter` publié.
- T-03 (TODO) — IR canonique (`Message`, `ToolCall`, `Usage`, `ChatTool`).
- T-04 (TODO) — `MoliereConfig.providers` étendu avec entrées par provider.
- T-05 (TODO) — `loadConfig` reconnaît `MOLIERE_<PROVIDER>_API_KEY`,
  `MOLIERE_<PROVIDER>_BASE_URL`.
- T-06 (TODO) — `src/llm/providers/registry.ts` opérationnel avec
  `getActiveProvider()`.

## Fichiers touchés

- `src/llm/providers/openai-compat.ts` — **création** : adaptateur unique
  paramétrable.
- `src/llm/providers/registry.ts` — branchement : enregistre
  `openai-compat` comme factory pour les 8 providers de la famille.
- `tests/llm-providers-openai-compat.test.ts` — **création** : tests
  happy-path, accumulation tool calls, gestion d'usage, erreurs HTTP.

## Étapes

1. Définir le type `OpenAICompatConfig` :

   ```ts
   export interface OpenAICompatConfig {
     baseUrl: string;       // ex. https://api.openai.com/v1
     apiKey: string;        // clé Bearer
     defaultModel: string;  // modèle par défaut du provider
     providerId: ProviderId;
   }
   ```

2. Définir `OPENAI_COMPAT_DEFAULTS: Record<ProviderId, OpenAICompatConfig>`
   avec les valeurs par défaut pour les 8 providers de la famille :

   | `providerId` | `baseUrl`                        | `defaultModel`           |
   | ------------ | -------------------------------- | ------------------------ |
   | `openai`     | `https://api.openai.com/v1`      | `gpt-4o`                 |
   | `mistral`    | `https://api.mistral.ai/v1`      | `mistral-large-latest`   |
   | `kimi`       | `https://api.moonshot.cn/v1`     | `moonshot-v1-128k`       |
   | `glm`        | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-plus`       |
   | `deepseek`   | `https://api.deepseek.com/v1`    | `deepseek-chat`          |
   | `groq`       | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile`|
   | `openrouter` | `https://openrouter.ai/api/v1`   | `openai/gpt-4o`          |
   | `minimax`    | `https://api.minimax.io/v1`      | `MiniMax-M3`             |

3. Implémenter `buildOpenAICompatAdapter(config: OpenAICompatConfig): ProviderAdapter`
   avec exactement la même logique que `src/llm/client.ts:50-186` (stream)
   et `src/llm/client.ts:188-221` (non-stream), déplacée telle quelle :

   ```ts
   const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
   const headers = {
     "Content-Type": "application/json",
     Authorization: `Bearer ${config.apiKey}`,
   };
   ```

4. **Streaming** : reprendre `parseSSE` (`src/llm/client.ts:41-48`) et
   `accumulateToolCall` (`src/llm/client.ts:20-39`) en privé dans le module.
   Boucle `while` sur `reader.read()`, gestion du buffer, split sur `\n`,
   `data:` + `JSON.parse` par chunk. Émettre :

   - `onChunk(text)` pour chaque `delta.content`,
   - `onToolCallDelta({index, id, function: {name, arguments}})` pour chaque
     entrée de `delta.tool_calls` (index nullable, défaut `0`),
   - `onUsage({promptTokens, completionTokens, totalTokens})` quand
     `data.usage` est présent (et `stream_options.include_usage: true` envoyé).

5. **Body streamé** :

   ```json
   {
     "model": "<model>",
     "messages": <ChatRequest["messages"]>,
     "tools": <ChatRequest["tools"]>,
     "temperature": <0.7 par défaut>,
     "stream": true,
     "stream_options": { "include_usage": true }
   }
   ```

6. **Body non-streamé** (`chat`) :

   ```json
   {
     "model": "<model>",
     "messages": <...>,
     "tools": <...>,
     "temperature": <0.7 par défaut>,
     "stream": false
   }
   ```

   Retourner `{message: data.choices[0].message, usage: data.usage}` (structure
   identique à `src/llm/client.ts:213-220`).

7. **Gestion d'erreur** : sur `!response.ok`, jeter
   `new Error("Erreur HTTP ${status}: ${body.slice(0, 240)}")` (préfixe
   `Erreur :` exigé par R9). Le mapping vers `ProviderError` se fait en T-17
   dans la couche supérieure.

8. **Abort** : passer `request.signal` au `fetch` et le respecter dans la
   boucle de lecture (`reader.read()` rejette automatiquement si abort).

9. Brancher dans `src/llm/providers/registry.ts` :

   ```ts
   const FACTORIES: Record<ProviderId, (cfg: MoliereConfig) => ProviderAdapter> = {
     openai: (c) => buildOpenAICompatAdapter(mergeConfig("openai", c)),
     mistral: (c) => buildOpenAICompatAdapter(mergeConfig("mistral", c)),
     // ... idem pour kimi, glm, deepseek, groq, openrouter, minimax
   };
   ```

10. Tests `tests/llm-providers-openai-compat.test.ts` :
    - mock `globalThis.fetch` avec `Response` stubbé (readable stream factice),
    - tester accumulation de 3 deltas `tool_calls` successifs → `{id, function:{name,arguments}}` complet,
    - tester émission `onUsage` sur chunk final,
    - tester erreur HTTP 401 → `throw` avec préfixe `Erreur`,
    - tester propagation de `AbortSignal`.

## Critères d'acceptation

- [ ] `src/llm/providers/openai-compat.ts` exporte
      `buildOpenAICompatAdapter` et `OPENAI_COMPAT_DEFAULTS`.
- [ ] Aucune référence littérale à `https://api.minimax.io` hors de
      `src/llm/providers/openai-compat.ts` et `OPENAI_COMPAT_DEFAULTS.minimax`.
- [ ] `rg -n "Authorization: Bearer" src` ne renvoie que
      `src/llm/providers/openai-compat.ts`.
- [ ] `bun test tests/llm-providers-openai-compat.test.ts` passe.
- [ ] `bunx tsc --noEmit` retourne 0.

## Pièges & anti-patterns

- ❌ Dupliquer la fonction `parseSSE` dans plusieurs adaptateurs : la garder
  privée dans `openai-compat.ts` ; les autres providers OpenAI-compat la
  réutilisent via la factory.
- ❌ Oublier `stream_options.include_usage: true` dans le body streamé :
  l'`onUsage` ne sera jamais appelé et `tokenStats` restera vide.
- ❌ Mélanger les types `Message`/`ToolCall` IR avec des structures
  OpenAI natives : la conversion se fait **dans** l'adaptateur, le
  consommateur ne voit que l'IR.
- ❌ `JSON.parse(payload)` sans `try/catch` : les chunks SSE mal formés
  (`data:` vide, `[DONE]`) doivent être ignorés silencieusement
  (comportement actuel à conserver).
- ❌ Oublier `request.signal` : la croix d'annulation `Ctrl+C` ne coupe plus
  le flux réseau.
- ✅ Trier les `toolCalls` par `index` avant de retourner le message final
  (`src/llm/client.ts:165-170`).
- ✅ Trim de `data:` (espaces, `\r`) avant parse — robustesse SSE.

## Références

- `AGENTS.md` — règles R3 (TS strict), R9 (sortie string préfixée `Erreur :`),
  R10 (tests `bun test`).
- `src/llm/client.ts:20-239` — code source à migrer tel quel.
- `src/llm/types.ts` — IR canonique (`Message`, `ToolCall`, `Usage`).
- https://platform.openai.com/docs/api-reference/chat/streaming — spec SSE.
- https://docs.anthropic.com/en/api/openai-sdk — exemple d'API compatible.
