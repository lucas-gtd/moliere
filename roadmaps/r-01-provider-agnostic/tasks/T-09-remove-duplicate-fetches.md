# T-09 — Supprimer les `fetch` directs dans `loop.ts` et `compact.ts`

> **Statut** : `TODO` · **Priorité** : `P0` · **Effort** : `S`

## But

Éliminer les **deux copies dupliquées** de `fetch('/chat/completions')` qui
persistent dans la base de code (`src/agent/loop.ts:73-101` et
`src/commands/compact.ts:6-29`). Après cette tâche, le seul chemin HTTP du
projet passe par `src/llm/providers/<adapter>.ts` via la façade client.
Résultat : un seul point de modification pour ajouter un provider, brancher
un logger HTTP, ou normaliser les erreurs (T-17).

## Pré-requis

- T-07 (TODO) — `src/llm/client.ts` refactorisé en façade qui délègue à
  `getActiveProvider().chat()` / `.streamChat()`.
- T-08 (TODO) — adaptateur OpenAI-compat opérationnel (utilisé par défaut).

## Fichiers touchés

- `src/agent/loop.ts` — suppression de la fonction locale `summarize`
  (lignes 73-101), import depuis `../llm/client` mis à jour.
- `src/commands/compact.ts` — suppression de `fetchSummary` (lignes 6-29),
  import depuis `../llm/client` mis à jour.
- `tests/agent-loop-compaction.test.ts` — **création** : vérifier que
  `compactMessages` reçoit bien la fonction `summarize` du client.
- `tests/commands-compact.test.ts` — **création** : vérifier que
  `compactCommand` n'instancie plus de `fetch`.

## Étapes

1. **Avant** (état actuel, 3 fetchers dupliqués) :

   ```
   src/llm/client.ts     → chat()         ──► POST /chat/completions
   src/agent/loop.ts     → summarize()    ──► POST /chat/completions (copie)
   src/commands/compact.ts → fetchSummary()──► POST /chat/completions (copie)
   ```

   Tous trois partagent la même URL `${baseUrl}/chat/completions`, le même
   header `Authorization: Bearer ${apiKey}`, le même body minimal, le même
   parsing `data.choices[0].message.content`. Si le provider change (T-10,
   T-11), il faudrait modifier les trois sites.

2. **Après** (chemin unifié) :

   ```
   loop.ts summarize       ──┐
   compact.ts fetchSummary ──┼──► client.summarize ──► ProviderAdapter.chat()
                              │                          │
                              │                          ├─► openai-compat (T-08)
                              │                          ├─► anthropic    (T-10)
                              │                          ├─► gemini       (T-11)
                              │                          └─► copilot      (T-12)
   ```

   Un seul site connaît le format HTTP ; les deux callers reçoivent un
   `Promise<string>` (résumé).

3. **Modification de `src/agent/loop.ts`** :
   - Supprimer la définition `const summarize = async (messages: Message[]) => {...}`
     (lignes 73-101).
   - Importer `summarize` depuis `../llm/client` (déjà exporté en
     `src/llm/client.ts:223`, à déléguer en T-07).
   - Vérifier que l'appel `await compactMessages(history, summarize, 6)`
     (ligne 265) compile sans changement de signature.

4. **Modification de `src/commands/compact.ts`** :
   - Supprimer `const fetchSummary = async (messages: Message[]) => {...}`
     (lignes 6-29) et l'import `loadConfig` qui en dépendait.
   - Importer `summarize` depuis `../llm/client`.
   - Remplacer `compactMessages(context.messages, fetchSummary, 6)` par
     `compactMessages(context.messages, summarize, 6)` (ligne 36).

5. **Adaptation de `summarize` côté client (`src/llm/client.ts`)** :
   - En T-07, `summarize` devient :

     ```ts
     export const summarize = async (
       messages: Message[],
       model?: string,
     ): Promise<string> => {
       const adapter = getActiveProvider();
       const targetModel = model ?? adapter.defaultModel;
       const { message } = await adapter.chat({
         model: targetModel,
         messages: [
           { role: "system", content: SYSTEM_PROMPT_RESUME },
           { role: "user", content: messages.map((m) => `[${m.role}] ${m.content ?? ""}`).join("\n") },
         ],
       });
       return message.content ?? "";
     };
     ```

   - Le `SYSTEM_PROMPT_RESUME` (archiviste concis, < 400 mots, français)
     est centralisé ici — fini les divergences entre les 3 prompts locaux
     (« archiviste concis » en `client.ts:232`, « résumez la conversation »
     en `loop.ts:88`, idem en `compact.ts:19`).

6. Vérifier que plus aucun `fetch(` n'apparaît hors de
   `src/llm/providers/` :

   ```bash
   rg -n 'fetch\(' src --glob '!src/llm/providers/**'
   ```

   Résultat attendu : vide.

7. Tests :
   - `tests/agent-loop-compaction.test.ts` : stubber `client.summarize`,
     vérifier qu'il est appelé par `compactMessages` quand le contexte
     dépasse le seuil.
   - `tests/commands-compact.test.ts` : stubber `client.summarize`, vérifier
     que la slash command retourne bien
     `Historique compacté : <n> → <m> messages.`.

## Critères d'acceptation

- [ ] Plus aucune fonction `summarize` ou `fetchSummary` locale dans
      `src/agent/loop.ts` ni `src/commands/compact.ts`.
- [ ] `rg -n 'fetch\(' src` ne retourne que des résultats dans
      `src/llm/providers/`.
- [ ] Le prompt de résumé est défini à un seul endroit
      (`src/llm/client.ts` ou module dédié).
- [ ] `bun test` passe (incluant les nouveaux tests).
- [ ] `bunx tsc --noEmit` retourne 0.
- [ ] Aucun changement de comportement utilisateur (mêmes résumés, mêmes
      sorties de slash command).

## Pièges & anti-patterns

- ❌ Conserver un fallback `if (!config.apiKey) throw` dans `loop.ts` ou
  `compact.ts` : la validation de clé appartient au provider adapter
  (T-17).
- ❌ Mélanger les 3 prompts de résumé en un seul trop vague : préserver la
  sémantique « décisions clés, fichiers, intentions » du prompt original
  le plus complet.
- ❌ Introduire un import circulaire entre `loop.ts` et `client.ts` : si
  `summarize` doit appeler le registre, faire l'import en T-07.
- ❌ Modifier la signature de `compactMessages` : la fonction de
  `src/agent/context.ts` accepte déjà un `(messages: Message[]) => Promise<string>`
  générique — ne pas la coupler au LLM.
- ✅ Centraliser `SYSTEM_PROMPT_RESUME` dans un export nommé pour permettre
  les tests (et l'i18n future).
- ✅ Conserver le `try/catch` autour de `compactMessages` côté loop
  (`loop.ts:267`) : si la summarisation échoue, on continue avec
  l'historique complet plutôt que de crasher la session.

## Références

- `AGENTS.md` — règles R3 (TS strict), R9 (sortie string), R10 (tests).
- `src/agent/loop.ts:73-101` — `summarize` à supprimer.
- `src/commands/compact.ts:6-29` — `fetchSummary` à supprimer.
- `src/llm/client.ts:223-239` — `summarize` canonique cible.
- `src/agent/context.ts` — `compactMessages`, signature à respecter.
- `roadmaps/r-01-provider-agnostic/audit-snapshot.md` (T-01) — entrées
  « transport » confirmant les 3 sites.
