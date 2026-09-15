# T-03 — Introduire un IR canonique pour messages / tools / usage

> **Statut** : `TODO` · **Priorité** : `P0` · **Effort** : `S`

## But

Faire de `Message`, `ToolCall`, `ChatTool`, `ModelInfo`, `ChatRequest` et
`Usage` la **langue pivot** de Molière. Le module `src/llm/ir.ts` créé ici
est un point d'entrée unique pour les consommateurs internes (boucle agent,
sous-agents, slash commands, TUI) et porte les invariants en JSDoc. Aucune
logique n'est modifiée : il s'agit d'un re-export typé + contrat
documentaire.

## Pré-requis

- T-01 (DONE) — liste des consommateurs internes (qui importe quoi depuis
  `src/llm/client.ts` et `src/llm/types.ts`) connue.
- T-02 peut être parallèle ; les types référencés existent déjà dans
  `src/llm/types.ts`.

## Fichiers touchés

- `src/llm/ir.ts` — **création** : re-export nominatif depuis
  `src/llm/types.ts` + bloc d'invariants en JSDoc.
- `src/llm/types.ts` — **lecture seule** : aucune modification.
- `CHANGELOG.md` — entrée sous `## [Non publié] > ### Ajouté`.

Aucun consommateur n'est migré dans cette tâche (migration vers `ir.ts` =
T-13, T-22).

## Étapes

1. Créer `src/llm/ir.ts` avec le contenu suivant (à coller tel quel) :

   ```ts
   // src/llm/ir.ts
   /**
    * IR canonique Molière.
    *
    * Cette couche est l'unique source de vérité interne pour la forme des
    * messages, appels d'outils et statistiques d'usage échangés entre
    * l'agent, les slash commands et les adaptateurs de provider.
    *
    * Les adaptateurs (voir `src/llm/providers/`) sont responsables de la
    * traduction vers/depuis leur format natif ; la boucle agent, elle, ne
    * connaît que ce module.
    */

   import type {
     ChatRequest,
     ChatTool,
     Message,
     ModelInfo,
     Role,
     ToolCall,
     Usage,
   } from "./types";

   export type {
     ChatRequest,
     ChatTool,
     Message,
     ModelInfo,
     Role,
     ToolCall,
     Usage,
   };

   export type {
     Message as CanonicalMessage,
     ToolCall as CanonicalToolCall,
   };

   /**
    * Invariants contractuels.
    *
    * - `Message.role === "assistant"` ⇒ peut contenir `tool_calls`. Dans ce
    *   cas, `content` peut être `null` ou une chaîne.
    * - `Message.role === "tool"` ⇒ `tool_call_id` non vide, `name` correspond
    *   au `ToolCall.function.name` qui a déclenché l'appel.
    * - `Message.role === "system" | "user"` ⇒ `content` non null.
    * - `ChatTool.function.parameters.type === "object"` ; les providers qui
    *   exigent un schéma plus strict le valident dans leur adaptateur.
    * - `ToolCall.function.arguments` reste une **chaîne JSON** (delta ou
    *   concaténation). L'analyse par `JSON.parse` est faite par l'agent via
    *   `safeParse` (`src/agent/loop.ts:138`).
    * - `Usage.totalTokens` doit refléter l'usage réel renvoyé par le
    *   provider ; si le provider omet cette valeur, l'adaptateur la calcule
    *   comme `promptTokens + completionTokens`.
    * - Les contenus multi-modaux (image, audio) sont **hors scope** ; un
    *   message Molière est strictement textuel ou `null`.
    */
   export const IR_INVARIANTS = {
     assistantMayHaveToolCalls: true,
     toolRequiresCallId: true,
     systemOrUserRequiresContent: true,
     argumentsAlwaysString: true,
     multimodalOutOfScope: true,
   } as const;
   ```

2. Ajouter à la fin de `src/llm/ir.ts` un petit récapitulatif de la
   migration à venir (pour les futurs agents) :

   ```ts
   /**
    * Note de migration :
    *
    * Les imports provenant de `./client` (`Message`, `ToolCall`, etc.)
    * doivent être reroutés vers `./ir` lorsque la migration débute (T-13).
    * Aujourd'hui, `./client` continue de réexporter ces types pour ne
    * casser personne.
    */
   ```

3. Documenter le contrat dans `CHANGELOG.md`, sous la section
   `## [Non publié]` :

   ```markdown
   ### Ajouté

   - Module `src/llm/ir.ts` : re-export canonique des types
     `Message` / `ToolCall` / `ChatTool` / `ModelInfo` / `ChatRequest` /
     `Usage`, accompagné d'invariants JSDoc partagés par tous les
     consommateurs internes.
   ```

4. Vérifier la compilation et la non-régression :

   ```bash
   bunx tsc --noEmit
   bun test
   ```

   Le résultat doit être identique : aucun import n'est encore dirigé
   vers `ir.ts`.

## Critères d'acceptation

- [ ] `src/llm/ir.ts` existe avec le contenu ci-dessus.
- [ ] Entrée CHANGELOG `### Ajouté` documentée.
- [ ] `bunx tsc --noEmit` retourne 0.
- [ ] `bun test` passe sans régression.
- [ ] `src/llm/types.ts` est intact (vérifier `git diff src/llm/types.ts`).

## Pièges & anti-patterns

- ❌ Dupliquer les types dans `ir.ts` au lieu de les re-exporter : casserait
  R3 (deux déclarations d'un même type) et le partage d'identité avec
  `types.ts`.
- ❌ Définir une nouvelle forme « allégée » (par ex. `type MessageV2`) ; la
  migration reste sur la forme existante pour limiter la portée.
- ❌ Importer `ir.ts` depuis `src/llm/client.ts` ou `src/llm/models.ts` à ce
  stade — la migration est planifiée en T-13.
- ❌ Inclure des helpers de conversion (`toIR`, `fromIR`) dans `ir.ts` : ils
  relèvent des adaptateurs (`src/llm/providers/`).
- ✅ Importer `from "./types"` avec un chemin relatif strict, conforme à
  `tsconfig.json` (`moduleResolution: bundler`).
- ✅ Documenter les invariants en français dans le JSDoc pour rester
  cohérent avec le ton du projet.

## Références

- `AGENTS.md` — règle R3 (TypeScript strict), R9 (sortie d'outils = string,
  ne s'applique pas ici car `ir.ts` ne produit pas d'outil mais des types).
- `src/llm/types.ts:1-54` — source des types re-exportés.
- `src/llm/client.ts:1-4` — convention actuelle de re-export
  (`export type { ... } from "./types"`), reproduite dans `ir.ts`.
- T-02 — définit `ProviderAdapter` et `ChatResult` qui réutilisent ces
  mêmes types.
- T-13 — refactor de `src/llm/models.ts` qui pointera vers `ir.ts`.
