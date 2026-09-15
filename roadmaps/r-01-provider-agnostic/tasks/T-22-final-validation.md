# T-22 — Validation finale

> **Statut** : `TODO` · **Priorité** : `P0` · **Effort** : `S`

## But

Boucler la roadmap `r-01-provider-agnostic` par une **checklist de validation finale** outillée : commandes de build, lint, tests, smoke CLI, et audits statiques pour s'assurer qu'aucun fichier source (hors `src/llm/providers/` et `tests/`) ne hardcode encore `https://api.minimax.io` ou `Authorization: Bearer` (couplage résiduel au provider historique).

## Pré-requis

- T-16 à T-21 (DONE) — toutes les tâches précédentes mergées.

## Fichiers touchés

- Aucun code ajouté. Ce ticket produit un **CR de validation** à coller dans la PR.
- Optionnel : `roadmaps/r-01-provider-agnostic/VALIDATION.md` (nouveau) consignant les sorties de commandes.

## Étapes

Exécuter chaque commande et **coller la sortie** dans le CR. Une commande qui échoue bloque la fusion.

### 1. Installation et compilation

```bash
bun install
bunx tsc --noEmit
```

Attendu : 0 erreur TypeScript.

### 2. Tests unitaires

```bash
bun test
```

Attendu : toutes les suites passent. Les nouveaux fichiers suivants doivent figurer dans la sortie :

- `tests/providers/registry.test.ts`
- `tests/providers/resolveProvider.test.ts`
- `tests/providers/openai.adapter.test.ts`
- `tests/providers/anthropic.adapter.test.ts`
- `tests/providers/gemini.adapter.test.ts`
- `tests/providers/ollama.adapter.test.ts` (et les autres : mistral, kimi, glm, copilot, deepseek, groq, openrouter, minimax)
- `tests/provider-errors.test.ts`
- `tests/index-cli.test.ts`

### 3. Smoke CLI

```bash
bun start --help
bun start --provider openai --model gpt-4o-mini --no-tui --prompt "ping"
```

Attendu :

- `--help` liste `--provider <id>` et `--no-tui`.
- Sans clé OpenAI configurée, la commande affiche l'erreur neutre « Erreur : aucune clé API pour le provider "openai". ».
- Avec `MOLIERE_OPENAI_API_KEY=sk-test` exportée, la session démarre ou jette une erreur réseau (`ProviderError{kind:"network"}`).

Tester **aussi** :

```bash
bun start --provider ollama --model llama3.1 --no-tui --prompt "ping"
```

Attendu : démarre en indiquant `http://127.0.0.1:11434/v1`, échoue en `network` si Ollama n'est pas lancé.

### 4. Audit static du couplage résiduel

```bash
rg -n "https://api\.minimax\.io" src/ tests/
rg -n "MOLIERE_API_KEY" src/ tests/
rg -n "Authorization: Bearer" src/ tests/
rg -n "minimax\.io/v1/chat/completions" src/ tests/
```

Attendu : tous les résultats sont **soit** dans `src/llm/providers/minimax.ts` (compatibilité), **soit** dans les commentaires historiques de `MOLIERE.md.example`. Aucun résultat dans :

- `src/agent/`
- `src/commands/`
- `src/tui/`
- `src/index.tsx`
- `src/config.ts`
- `src/llm/client.ts` (doit désormais déléguer)
- `src/llm/models.ts` (doit contenir des modèles multi-providers ou être réécrit)
- `tests/` sauf les tests dédiés à `minimax.adapter`.

Si un résultat apparaît, ouvrir une PR de suivi pour supprimer le couplage.

### 5. Audit des `any` et `as unknown`

```bash
rg -n "\\bany\\b" src/llm/providers/ src/llm/client.ts tests/providers/ tests/provider-errors.test.ts
rg -n "as unknown as" src/ tests/
```

Attendu : 0 résultat (sauf justification documentée en commentaire d'en-tête de fichier, R3).

### 6. Audit des références `MiniMax-M3` hors provider dédié

```bash
rg -n "MiniMax-M3" src/ tests/
```

Attendu : résultats uniquement dans `src/llm/providers/minimax.ts` (et éventuellement `tests/providers/minimax.adapter.test.ts`).

### 7. Vérification de la documentation

```bash
rg -n "^## Providers" README.md
rg -n "^### Ajouté" CHANGELOG.md
rg -n "^### Modifié" CHANGELOG.md
```

Attendu : chaque `rg` retourne au moins une ligne (les sections sont présentes).

### 8. Smoke boucle agent

```bash
MOLIERE_PROVIDER=openai MOLIERE_OPENAI_API_KEY=sk-fake bun start --provider openai --model gpt-4o-mini --no-tui --prompt "exit"
```

Attendu : la session tente un appel, échoue en `auth` ou `network`, **n'invoque pas** `https://api.minimax.io/v1/chat/completions` (vérifier via la commande rg précédente).

### 9. Génération du rapport final

Rédiger dans `roadmaps/r-01-provider-agnostic/VALIDATION.md` (optionnel mais recommandé) un tableau récapitulatif :

| Étape | Commande | Résultat | Lien PR corrective |
| ----- | -------- | -------- | ------------------ |
| 1     | `bun install` | OK / KO |  |
| 2     | `bunx tsc --noEmit` | OK / KO |  |
| 3     | `bun test` | OK / KO |  |
| ...   | ... | ... | ... |

## Critères d'acceptation

- [ ] Toutes les commandes de l'étape 1 à 8 exécutées, sorties archivées.
- [ ] `rg "https://api\.minimax\.io" src/ tests/` retourne 0 résultat hors `src/llm/providers/minimax.ts`.
- [ ] `rg "MOLIERE_API_KEY" src/ tests/` retourne 0 résultat hors compatibilité ascendante documentée.
- [ ] `bun test` et `bunx tsc --noEmit` verts.
- [ ] Smoke CLI (`bun start --provider openai --model gpt-4o-mini --no-tui`) fonctionne (même en échec réseau attendu).
- [ ] Section « Providers » du README et entrées CHANGELOG vérifiées.

## Pièges & anti-patterns

- ❌ Lancer les tests sans `bun install` préalable — dépendances manquantes ou obsolètes.
- ❌ Faire confiance au smoke CLI sans audit `rg` — un couplage résiduel peut subsister silencieusement.
- ❌ Oublier le test `bun test tests/providers/` — les autres suites passent mais les nouveaux adaptateurs ne sont pas exécutés.
- ❌ Bloquer la PR sur des warnings ESLint non liés à la roadmap.
- ❌ Accepter un test qui dépend du réseau (zéro appel réseau autorisé — T-19 le garantit).
- ✅ Joindre le rapport VALIDATION.md au message de PR pour traceability.
- ✅ Si `tsc` ou `bun test` échoue, ne **pas** merger : rouvrir une PR ciblée.

## Références

- `AGENTS.md` §5 — checklist validation avant commit.
- `AGENTS.md` R1 — toujours `bun`, jamais `npm`/`yarn`.
- [`rg` — user guide](https://github.com/BurntSushi/ripgrep) pour les patterns avancés.
- T-17 (`ProviderError`) — typage des erreurs que le smoke CLI est censé produire.
