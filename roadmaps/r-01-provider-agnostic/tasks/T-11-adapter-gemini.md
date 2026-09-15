# T-11 — Implémenter l'adaptateur Gemini

> **Statut** : `TODO` · **Priorité** : `P1` · **Effort** : `M`

## But

Implémenter `src/llm/providers/gemini.ts` qui parle à l'API Google Gemini
(`generateContent` et `streamGenerateContent`). L'adaptateur gère
l'authentification par query param `?key=<key>` (Google AI Studio) ou bearer
(Vertex AI), traduit l'IR canonique vers le format `contents`/`parts`, et
parse les chunks SSE (tableaux JSON, pas lignes `data:` simples). Résultat :
`provider=gemini` permet à Molière de piloter `gemini-2.0-flash`,
`gemini-1.5-pro`, etc.

## Pré-requis

- T-02 (TODO) — contrat `ProviderAdapter`.
- T-03 (TODO) — IR canonique publié.
- T-04 (TODO) — `MoliereConfig.providers.gemini` typé
  `{apiKey, baseUrl?, defaultModel, authMode: "query" | "bearer"}`.
- T-05 (TODO) — `MOLIERE_GEMINI_API_KEY` chargé ; `MOLIERE_GEMINI_AUTH`
  (`query` par défaut, `bearer` pour Vertex AI).
- T-06 (TODO) — `gemini` enregistré dans `FACTORIES`.

## Fichiers touchés

- `src/llm/providers/gemini.ts` — **création**.
- `src/llm/providers/registry.ts` — ajout factory `gemini`.
- `tests/llm-providers-gemini.test.ts` — **création** : tests streaming,
  parsing `parts`, `functionCall`, usage, modes d'auth.

## Étapes

1. Définir `GEMINI_DEFAULTS` :

   ```ts
   export const GEMINI_DEFAULTS = {
     providerId: "gemini" as ProviderId,
     baseUrl: "https://generativelanguage.googleapis.com",
     defaultModel: "gemini-2.0-flash",
     authMode: "query" as "query" | "bearer",
   };
   ```

   Catalogue initial pour `listModels()` :

   ```ts
   [
     { id: "gemini-2.0-flash",        label: "Gemini 2.0 Flash",        contextWindow: 1_000_000 },
     { id: "gemini-1.5-pro",          label: "Gemini 1.5 Pro",          contextWindow: 2_000_000 },
     { id: "gemini-1.5-flash",        label: "Gemini 1.5 Flash",        contextWindow: 1_000_000 },
   ]
   ```

2. **Endpoint** :

   ```ts
   const baseUrl = config.baseUrl.replace(/\/$/, "");
   const streamUrl = `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
   const nonStreamUrl = `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
   ```

   Authentification :

   ```ts
   const authQuery = config.authMode === "query" ? `&key=${encodeURIComponent(config.apiKey)}` : "";
   const headers: Record<string, string> = { "Content-Type": "application/json" };
   if (config.authMode === "bearer") headers.Authorization = `Bearer ${config.apiKey}`;
   ```

3. **Conversion IR → Gemini** :

   ```ts
   function toGeminiContents(messages: Message[]): {
     systemInstruction?: { parts: Array<{ text: string }> };
     contents: Array<{ role: string; parts: unknown[] }>;
   }
   ```

   - `role: "system"` → concaténer dans `systemInstruction.parts`.
   - `role: "user"` → `contents.push({role: "user", parts: [{text: content}]})`
     ou `parts: [{functionResponse: {name, response: JSON.parse(content)}}]`
     si le user-message transporte un résultat d'outil (moderne).
   - `role: "assistant"` → `role: "model"`, `parts: [{text: content}]` ou
     `parts: [{functionCall: {name, args: JSON.parse(arguments)}}]`.
   - `role: "tool"` → convertir en `{role: "user", parts: [{functionResponse: {name, response: JSON.parse(content)}}]}`.

4. **Body streamé** :

   ```json
   {
     "contents": [...],
     "systemInstruction": { "parts": [{"text": "..."}] },
     "tools": [{ "functionDeclarations": [
       { "name": "...", "description": "...", "parameters": {...} }
     ]}],
     "generationConfig": { "temperature": 0.7 }
   }
   ```

   ⚠️ Gemini n'accepte pas `temperature` au niveau racine : il faut
   l'imbriquer dans `generationConfig`.

5. **Format de la réponse streamée** : Gemini renvoie un **tableau JSON**
   par chunk SSE (et non un objet unique comme OpenAI) :

   ```json
   [
     {
       "candidates": [
         { "content": { "role": "model", "parts": [{"text": "..."}] } }
       ],
       "usageMetadata": {
         "promptTokenCount": 12,
         "candidatesTokenCount": 34,
         "totalTokenCount": 46
       }
     }
   ]
   ```

   Chaque chunk est entouré de `[` `]`. Le parser doit :

   - tolérer les chunks séparés par `,\n` à l'intérieur du tableau,
   - accumuler tous les éléments du tableau dans le parsing global,
   - OU parser le flux comme un objet unique si Gemini renvoie `[ {...} ]`.

   Approche recommandée : **garder le pattern `data: <json>` SSE** puis
   `JSON.parse(payload)` qui retourne soit un objet, soit un tableau — gérer
   les deux :

   ```ts
   const data = JSON.parse(payload);
   const items = Array.isArray(data) ? data : [data];
   for (const item of items) {
     // accumulation texte / functionCall / usage
   }
   ```

6. **Accumulation tool calls** : chaque `parts[].functionCall` est complet
   (pas de deltas). Quand un chunk contient un `functionCall`, l'ajouter à
   la liste `toolCalls`. Le `name` est directement disponible, `args` est
   déjà un objet → resérialiser en JSON string pour rester cohérent avec
   l'IR :

   ```ts
   const tc: ToolCall = {
     id: `gemini_call_${index}_${Date.now()}`,
     type: "function",
     function: {
       name: fc.name,
       arguments: JSON.stringify(fc.args ?? {}),
     },
   };
   ```

7. **Usage** : `usageMetadata.promptTokenCount` /
   `candidatesTokenCount` / `totalTokenCount`. Mapper vers
   `{promptTokens, completionTokens, totalTokens}`.

8. **Erreurs** : Gemini renvoie `{"error": {"code": 401, "message": "...",
   "status": "UNAUTHENTICATED"}}` avec status HTTP non-200. Préfixer
   `Erreur : ` (R9).

9. **Streaming SSE spécifique** : les chunks sont **encodés en JSON
   array**, donc `parseSSE` d'OpenAI ne suffit pas. Implémenter un parser
   privé ou un helper dans `src/llm/providers/gemini.ts` :

   ```ts
   // Gemini renvoie soit:
   //   data: {"candidates": [...]}        // objet seul
   //   data: [{...}, {...}]                // tableau
   // et utilise le préfixe data: comme SSE standard.
   ```

10. **`chat` non-streamé** : `POST :generateContent` (sans `?alt=sse`).
    Réponse = objet unique `{candidates: [...], usageMetadata: {...}}`.
    Extraire `candidates[0].content.parts[0]` selon le type.

11. **`listModels()`** : retourner le catalogue statique ci-dessus. (Un
    endpoint `GET /v1beta/models` existe mais filtrer les modèles
    disponibles coûte un round-trip ; garder statique par défaut.)

12. Tests `tests/llm-providers-gemini.test.ts` :
    - mock SSE avec chunks `data: {"candidates":...}`,
      `data: [{"candidates":...}]` ;
    - tester auth `?key=...` (query string présente, header
      `Authorization` absent) ;
    - tester auth `Bearer ...` (header présent, query string absente) ;
    - tester conversion `tool` → `functionResponse` ;
    - tester usage agrégé depuis `usageMetadata`.

## Critères d'acceptation

- [ ] `src/llm/providers/gemini.ts` exporte `buildGeminiAdapter` et
      `GEMINI_DEFAULTS`.
- [ ] Le mode d'auth est sélectionnable via `authMode: "query" | "bearer"`.
- [ ] La conversion IR supporte les 4 rôles (`system` → `systemInstruction`,
      `user`/`assistant`/`tool`).
- [ ] `bun test tests/llm-providers-gemini.test.ts` passe.
- [ ] `bunx tsc --noEmit` retourne 0.

## Pièges & anti-patterns

- ❌ Envoyer `temperature` au niveau racine du body : Gemini renvoie 400.
  Toujours l'imbriquer dans `generationConfig`.
- ❌ Oublir `?alt=sse` sur l'endpoint streamé : la réponse arrive en JSON
  monolithique sans streaming réel.
- ❌ Mapper `role: "tool"` sur `role: "tool"` côté Gemini : Gemini n'a pas
  ce rôle, utiliser `functionResponse` dans un message `user`.
- ❌ Ne pas gérer le format tableau dans le parsing SSE : provoque des
  `JSON.parse` successifs cassés.
- ❌ Stocker `args` comme objet dans l'IR : violerait l'invariant
  `ToolCall.function.arguments: string` partagé avec OpenAI/Anthropic.
- ❌ Mélanger les URLs `v1` et `v1beta` : Gemini 2.0 nécessite `v1beta`,
  rester cohérent.
- ✅ Documenter clairement le mapping `tool` → `functionResponse` dans un
  commentaire JSDoc du module.
- ✅ Préférer `parts: [{text}]` plutôt que `content: string` : Gemini attend
  un tableau de parts, pas une string.

## Références

- `AGENTS.md` — règles R3, R9, R10.
- https://ai.google.dev/api/rest — Gemini REST API reference.
- https://ai.google.dev/api/generate-content#stream — streaming spec.
- https://ai.google.dev/gemini-api/docs/function-calling — tool use format.
- `src/llm/providers/anthropic.ts` — modèle de structure (factory,
  defaults, tests mock fetch).
