# T-21 — Documentation utilisateur (README + CHANGELOG)

> **Statut** : `TODO` · **Priorité** : `P1` · **Effort** : `S`

## But

Réécrire la section pertinente du `README.md` pour présenter le **système provider-agnostique** (tableau des providers, exemples de configuration, troubleshooting), et compléter `CHANGELOG.md` sous `## [Unreleased]` avec une entrée `### Ajouté` + `### Modifié`. Le ton reste neutre, sans mention de MiniMax comme provider par défaut (MiniMax figure dans la liste en compatibilité ascendante, point).

## Pré-requis

- T-01 (DONE) — `KNOWN_PROVIDERS` stabilisé.
- T-18 (DONE) — `.env.example` réécrit.
- T-15 (DONE) — slash commands refactorées.

## Fichiers touchés

- `README.md` — sections « Installation », « Lancement », « Commandes slash » et **nouvelle section « Providers »**.
- `CHANGELOG.md` — ajout sous `## [Unreleased]`.

## Étapes

1. Mettre à jour la section « Installation » : remplacer l'exemple `MOLIERE_API_KEY=sk-xxxxxxxx` par un bloc listant chaque provider.
2. Mettre à jour le tableau d'options CLI dans « Lancement » : ajouter `--provider <id>`.
3. Ajouter la nouvelle section « Providers » (contenu ci-dessous) entre « Lancement » et « Commandes slash ».
4. Dans « Commandes slash », modifier la ligne `/config` pour préciser qu'elle affiche le provider actif.
5. Compléter `CHANGELOG.md` sous `## [Unreleased]` (entrée ci-dessous).
6. Vérifier qu'aucune mention « https://api.minimax.io » ou `MiniMax-M3` ne reste dans le `README.md`, sauf dans la ligne historique de Crédits si elle est conservée.

## Structure de la section « Providers » à insérer dans le README

Insérer entre « Lancement » (ligne 53) et « Commandes slash » (ligne 66) :

```markdown
## Providers

Molière fonctionne avec plusieurs fournisseurs de modèles. Le provider actif se
sélectionne via `MOLIERE_PROVIDER` ou le flag `--provider <id>`. Si aucune valeur
n'est définie, Molière active le premier provider dont la clé d'API est présente
dans l'environnement (ordre : OpenAI, Anthropic, Gemini, Mistral, Ollama).

### Tableau des providers

| Identifiant  | Auth                              | Endpoint par défaut                 | Modèles usuels                      |
| ------------ | --------------------------------- | ----------------------------------- | ----------------------------------- |
| `openai`     | `MOLIERE_OPENAI_API_KEY`          | `https://api.openai.com/v1`         | `gpt-4o`, `gpt-4o-mini`, `o1`       |
| `anthropic`  | `MOLIERE_ANTHROPIC_API_KEY`       | `https://api.anthropic.com`         | `claude-3-5-sonnet`, `claude-3-haiku` |
| `gemini`     | `MOLIERE_GEMINI_API_KEY`          | `https://generativelanguage.googleapis.com/v1beta` | `gemini-1.5-pro`, `gemini-1.5-flash` |
| `mistral`    | `MOLIERE_MISTRAL_API_KEY`         | `https://api.mistral.ai/v1`         | `mistral-large`, `mistral-small`    |
| `kimi`       | `MOLIERE_KIMI_API_KEY`            | `https://api.moonshot.ai/v1`        | `moonshot-v1-128k`                  |
| `glm`        | `MOLIERE_GLM_API_KEY`             | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-plus`                       |
| `copilot`    | `MOLIERE_COPILOT_TOKEN` ou `MOLIERE_COPILOT_INTEGRATION_TOKEN` | `https://api.githubcopilot.com` | `gpt-4o` (via GitHub)               |
| `deepseek`   | `MOLIERE_DEEPSEEK_API_KEY`        | `https://api.deepseek.com/v1`       | `deepseek-chat`, `deepseek-coder`   |
| `groq`       | `MOLIERE_GROQ_API_KEY`            | `https://api.groq.com/openai/v1`    | `llama-3.1-70b`                     |
| `openrouter` | `MOLIERE_OPENROUTER_API_KEY`      | `https://openrouter.ai/api/v1`      | (préfixés : `anthropic/...`, etc.) |
| `ollama`     | aucune clé, baseUrl requise      | `http://127.0.0.1:11434/v1`        | `llama3.1`, `qwen2.5`               |
| `minimax`    | `MOLIERE_MINIMAX_API_KEY`         | `https://api.minimax.io/v1`         | `MiniMax-M3` (compat ascendante)    |

### Exemples de configuration

```bash
# OpenAI
MOLIERE_PROVIDER=openai
MOLIERE_OPENAI_API_KEY=sk-proj-...

# Anthropic avec un endpoint privé
MOLIERE_PROVIDER=anthropic
MOLIERE_ANTHROPIC_API_KEY=sk-ant-...
MOLIERE_ANTHROPIC_BASE_URL=https://proxy.internal/anthropic

# Ollama local, sans clé
MOLIERE_PROVIDER=ollama
MOLIERE_OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
MOLIERE_OLLAMA_DEFAULT_MODEL=llama3.1:8b
```

### Ordre de priorité

1. Variable d'environnement (`MOLIERE_PROVIDER`).
2. Flag CLI `--provider <id>` (plus prioritaire que la config persistante).
3. `~/.moliere/config.json`.
4. `.moliere/config.json` (projet).
5. Auto-détection selon la première clé présente.

### Troubleshooting par code d'erreur

| Erreur                                       | Provider    | Action                                                |
| -------------------------------------------- | ----------- | ----------------------------------------------------- |
| `auth`                                       | tous        | Vérifier la variable `MOLIERE_<PROVIDER>_API_KEY`     |
| `rate_limit`                                 | tous        | Patienter ou réduire la fréquence d'appels            |
| `context_length`                             | tous        | Utiliser `/compact` ou réduire la taille des fichiers |
| `content_filter`                             | anthropic, gemini, glm | Reformuler la requête ou désactiver les filtres |
| `upstream`                                   | tous        | Réessayer, le souci vient du fournisseur              |
| `network`                                    | tous (sauf ollama) | Vérifier la connexion réseau / proxy / VPN     |

Affichez les erreurs avec `/doctor` (variables détectées) et `/config` (provider
actif et clé masquée).
```

## Entrée CHANGELOG à ajouter

Sous `## [Unreleased]` dans `CHANGELOG.md`, **ajouter** (ne pas dupliquer ce qui existe) :

```markdown
### Ajouté

- Système provider-agnostique : Molière fonctionne désormais avec plusieurs
  fournisseurs (OpenAI, Anthropic, Gemini, Mistral, Kimi, GLM, GitHub Copilot,
  DeepSeek, Groq, OpenRouter, Ollama, MiniMax) sélectionnés via
  `MOLIERE_PROVIDER` ou le flag `--provider <id>`. Chaque provider dispose de
  son propre adaptateur sous `src/llm/providers/<id>.ts`.
- Type `ProviderError` unifié (`auth`, `rate_limit`, `context_length`,
  `content_filter`, `upstream`, `network`, `unknown`) avec helpers
  `asProviderError` et `providerErrorFromResponse` pour normaliser les
  erreurs cross-provider.
- Registre centralisé `src/llm/providers/registry.ts` exposant `KNOWN_PROVIDERS`,
  `resolveProvider()`, et l'ordre de priorité env > global > projet.

### Modifié

- `src/config.ts` : les champs `apiKey` et `baseUrl` ont été remplacés par
  `providerId` + lookup dynamique via le registre.
- `src/index.tsx` : ajout du flag CLI `--provider <id>` et message d'erreur
  neutre vis-à-vis du provider actif.
- `src/llm/client.ts` : `streamChat`, `chat`, `summarize` délèguent à
  l'adaptateur sélectionné au lieu d'appeler directement l'API OpenAI.
- `.env.example` réécrit pour exposer toutes les variables par provider (les
  variables historiques `MOLIERE_API_KEY` et `MOLIERE_BASE_URL` sont conservées
  en alias pour le provider MiniMax).
```

## Critères d'acceptation

- [ ] `README.md` contient la section « Providers » complète (tableau + exemples + troubleshooting).
- [ ] `CHANGELOG.md` contient l'entrée `## [Unreleased]` avec `### Ajouté` et `### Modifié` non vides.
- [ ] Aucun lien « https://api.minimax.io » dans le `README.md` hors de la section « Crédits » (si conservée).
- [ ] Tableau d'options CLI mentionne `--provider`.
- [ ] `bunx tsc --noEmit` retourne 0 (les exemples markdown ne sont pas parsés).
- [ ] `bun test` passe.

## Pièges & anti-patterns

- ❌ Promouvoir MiniMax comme provider par défaut dans le tableau — laisser la colonne « modèles usuels » factuelle.
- ❌ Oublier de lister Ollama (pas de clé) dans le tableau — sinon les utilisateurs sont perdus.
- ❌ Citer des prix ou des quotas susceptibles de changer.
- ❌ Mélanger la syntaxe française (« fournisseur ») et anglaise (« provider ») dans le README — trancher pour « provider » dans la doc (cohérent avec le code) et utiliser « fournisseur » uniquement en description longue.
- ✅ Section « Troubleshooting » alignée avec les codes du nouveau `ProviderError` (T-17).
- ✅ Renommer l'ancienne section « Crédits » si elle contient « api.minimax.io » pour pointer vers « providers officiels » sans favoritisme.

## Références

- `AGENTS.md` §1 — référence au README utilisateur (vs `AGENTS.md` destiné aux agents de code).
- [Keep a Changelog 1.1](https://keepachangelog.com/fr/1.1.0/) pour le format exact.
- Spéc des providers déjà implémentés (T-04 à T-13).
