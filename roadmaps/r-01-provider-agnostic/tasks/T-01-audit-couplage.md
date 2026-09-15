# T-01 — Audit du couplage actuel au provider MiniMax

> **Statut** : `TODO` · **Priorité** : `P0` · **Effort** : `XS`

## But

Cartographier de manière exhaustive tous les sites du code source qui
hardcodent le provider MiniMax (API OpenAI-compatible, URLs, variables
d'environnement, libellés marketing) afin de figer une **liste de référence**
qui sert de contrat d'entrée aux tâches T-02 à T-22. Aucune modification de
comportement n'est livrée ici, seulement un état des lieux reproductible.

## Pré-requis

- Aucun (tâche d'amorce, à exécuter en premier).

## Fichiers touchés

- `CHANGELOG.md` — ajout d'une annexe `## [Non publié] > ### Notes > Audit r-01`
  documentant la cartographie (lecture seule).
- `roadmaps/r-01-provider-agnostic/audit-snapshot.md` — **création** : sortie
  brute de l'audit, citée en référence par les tâches suivantes.

Aucun fichier de `src/` n'est modifié.

## Étapes

1. Depuis la racine du dépôt, exécuter :

   ```bash
   rg -n "MOLIERE_API_KEY" src tests
   rg -n "MOLIERE_BASE_URL" src tests
   rg -n "https://api.minimax.io" . --glob '!node_modules' --glob '!bun.lock'
   rg -n "Authorization: Bearer" src
   rg -n "chat/completions" src
   rg -n "MiniMax-M3" src tests .env.example README.md
   rg -n "api.minimax" .env.example README.md CHANGELOG.md MOLIERE.md.example
   ```

2. Reporter chaque occurrence dans
   `roadmaps/r-01-provider-agnostic/audit-snapshot.md` avec :
   - chemin absolu du fichier,
   - numéro de ligne (`fichier:ligne`),
   - extrait de 1 à 3 lignes,
   - catégorie (`config` / `transport` / `branding` / `outillage` / `docs`).

3. La liste minimale attendue (à valider/étendre) couvre au moins :

   | Catégorie   | Site                                                                 | Symptôme                                                          |
   | ----------- | -------------------------------------------------------------------- | ----------------------------------------------------------------- |
   | config      | `src/config.ts:76-86`                                                | `apiKey` / `baseUrl` / `defaultModel` uniques, défaut `minimax`. |
   | transport   | `src/llm/client.ts:50-186` (`streamChat`)                             | `Authorization: Bearer`, SSE OpenAI, accumulation `tool_calls`.   |
   | transport   | `src/llm/client.ts:188-221` (`chat`)                                  | Idem non-streamé.                                                 |
   | transport   | `src/agent/loop.ts:76-98` (`summarize`)                               | Duplication du `fetch` OpenAI-compat.                              |
   | transport   | `src/commands/compact.ts:6-29` (`fetchSummary`)                       | Idem, 3ᵉ copie.                                                   |
   | branding    | `src/index.tsx:48-52`                                                | Message d'erreur « Definissez MOLIERE_API_KEY ».                  |
   | outillage   | `src/commands/config.ts:55-62` (`configCommand`)                      | Lit `process.env.MOLIERE_*` au lieu de `loadConfig()`.            |
   | outillage   | `src/commands/agents.ts:91` (`doctorCommand`)                         | Affiche `MOLIERE_API_KEY`.                                        |
   | catalogue   | `src/llm/models.ts:3-10`                                              | Tableau statique mono-entrée `MiniMax-M3`.                        |
   | docs        | `.env.example` lignes 1-19                                            | Texte orienté MiniMax.                                            |
   | docs        | `README.md`, `MOLIERE.md.example`, `CHANGELOG.md`                    | Mentions MiniMax.                                                 |
   | sous-agent  | `src/agent/sub-agent.ts:58`                                           | Appelle `loadConfig()` mais n'en utilise pas la valeur (`defaultModel` non injecté). |

4. Vérifier l'absence d'occurrences hors `src/llm/` une fois la roadmap
   terminée (cible) en lançant :

   ```bash
   rg -n "MOLIERE_API_KEY" src | rg -v '^src/llm/'
   rg -n "Authorization: Bearer" src | rg -v '^src/llm/'
   ```

   Le résultat doit être vide après les tâches T-07 et T-09.

5. Publier l'annexe dans `CHANGELOG.md` sous le format déjà en place
   (`## [Non publié] > ### Notes > Audit r-01`) avec un tableau récapitulatif
   réduit à 10 lignes maximum pointant vers
   `roadmaps/r-01-provider-agnostic/audit-snapshot.md`.

## Critères d'acceptation

- [ ] `roadmaps/r-01-provider-agnostic/audit-snapshot.md` existe avec ≥ 10
      entrées (chemin:ligne, extrait, catégorie).
- [ ] Annexe ajoutée dans `CHANGELOG.md` (section `## [Non publié] > ### Notes`).
- [ ] `bun test` passe sans régression (aucune modification de code).
- [ ] `bunx tsc --noEmit` retourne 0.

## Pièges & anti-patterns

- ❌ Modifier `src/index.tsx:48-52` ou tout autre fichier source « pour
  homogénéiser » pendant l'audit : reste un travail de T-16.
- ❌ Considérer `tests/` comme site à découpler : par convention AGENTS.md R10
  les tests peuvent mocker librement.
- ❌ Inclure `bun.lock`, `node_modules/` : exclus par le `.gitignore` et sans
  valeur pour l'audit (cf. R1 Bun).
- ❌ Oublier `src/agent/sub-agent.ts:58` qui appelle `loadConfig()` sans
  consommer `defaultModel` : symptôme, pas bug, à conserver pour T-04.
- ✅ Citer systématiquement `file:line` (cf. section 5 d'`AGENTS.md`).
- ✅ Catégoriser chaque entrée pour aiguiller les tâches suivantes.

## Références

- `AGENTS.md` — règle R1 (Bun), R2 (pas de deps hors `package.json`), R9
  (sortie d'outils = string).
- `roadmaps/r-01-provider-agnostic/roadmap.md` — tableau des tâches (la
  cartographie sert de référence aux 21 autres tâches).
- `CHANGELOG.md` — modèle d'entrée « Note » déjà utilisé pour `AGENTS.md`.
