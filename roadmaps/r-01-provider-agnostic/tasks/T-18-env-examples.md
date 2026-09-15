# T-18 — Mettre à jour `.env.example` et `MOLIERE.md.example`

> **Statut** : `TODO` · **Priorité** : `P1` · **Effort** : `S`

## But

Réécrire `.env.example` pour qu'il liste **toutes** les variables d'environnement utilisées par le nouveau `ProviderRegistry`, regroupées par provider avec un commentaire neutre. Mettre à jour `MOLIERE.md.example` afin qu'il ne présuppose plus MiniMax et décrive comment activer chaque provider (avec un exemple de section « Provider par défaut »). Aucune référence « minimax.io », « MiniMax-M3 » ou « MOLIERE_API_KEY » ne doit subsister.

## Pré-requis

- T-01 (DONE) — Registre des providers et table des variables d'environnement attendues.
- T-17 (DONE) — `ProviderError` typé.

## Fichiers touchés

- `.env.example` — réécriture complète (contenu fourni ci-dessous).
- `MOLIERE.md.example` — ajout de la section « Provider par défaut », remplacement des mentions MiniMax.
- `README.md` — la sous-section `.env.example` (T-21) référencera le nouveau contenu.

## Étapes

1. Remplacer entièrement `.env.example` par le contenu ci-dessous (sections « Provider actif », « Clés par provider » avec toutes les variables, modifiable via commentaire).
2. Vérifier que `process.env.*` référencés dans `src/llm/providers/registry.ts` ont **tous** une entrée dans `.env.example`.
3. Remplacer dans `MOLIERE.md.example` toute occurrence « MiniMax » par un placeholder neutre et insérer la section « Provider par défaut » après « Conventions de code ».
4. Documenter en commentaire l'ordre de priorité (env > global > projet) et le fallback.
5. Lancer `bun start --help` pour vérifier que rien ne référence `MOLIERE_API_KEY`.

## Nouveau contenu complet de `.env.example`

```bash
# === Configuration Molière ===
#
# Le provider actif se choisit via la variable MOLIERE_PROVIDER, ou via le
# flag CLI --provider. Si aucun provider n'est sélectionné, Molière tente
# successivement : openai, anthropic, gemini, ollama (premier qui possède
# une clé définie dans l'environnement).
#
# Ordre de priorité pour la résolution :
#   1. Variable d'environnement (MOLIERE_PROVIDER / MOLIERE_<PROVIDER>_API_KEY)
#   2. ~/.moliere/config.json (config globale)
#   3. .moliere/config.json (config projet)
#
# Chaque provider nécessite au minimum sa clé d'API. Tous les champs
# spécifiques au provider (baseUrl, organization, extra headers, ...) sont
# documentés ci-dessous et restent optionnels.

# --- Provider actif ---
# Identifiant du provider : openai | anthropic | gemini | mistral | kimi | glm
#                       | copilot | deepseek | groq | openrouter | ollama | minimax
# MOLIERE_PROVIDER=openai

# --- Modèle par défaut (parmi la liste du provider sélectionné) ---
# MOLIERE_DEFAULT_MODEL=gpt-4o-mini

# --- Thème visuel (default | soir | parchemin) ---
# MOLIERE_THEME=default

# --- Mode de permissions (default | accept-edits | plan | yolo) ---
# MOLIERE_PERMISSIONS=default

# ==============================================================
#                Clés et paramètres par provider
# ==============================================================

# --- OpenAI (officiel) ---
# Obtention : https://platform.openai.com/api-keys
# MOLIERE_OPENAI_API_KEY=sk-...
# MOLIERE_OPENAI_BASE_URL=https://api.openai.com/v1
# MOLIERE_OPENAI_ORGANIZATION=org-...

# --- Anthropic ---
# Obtention : https://console.anthropic.com/settings/keys
# MOLIERE_ANTHROPIC_API_KEY=sk-ant-...
# MOLIERE_ANTHROPIC_BASE_URL=https://api.anthropic.com
# MOLIERE_ANTHROPIC_VERSION=2023-06-01

# --- Google Gemini ---
# Obtention : https://aistudio.google.com/apikey
# MOLIERE_GEMINI_API_KEY=...
# MOLIERE_GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta

# --- Mistral ---
# Obtention : https://console.mistral.ai/api-keys
# MOLIERE_MISTRAL_API_KEY=...
# MOLIERE_MISTRAL_BASE_URL=https://api.mistral.ai/v1

# --- Moonshot Kimi ---
# Obtention : https://platform.moonshot.ai/console/api-keys
# MOLIERE_KIMI_API_KEY=sk-...
# MOLIERE_KIMI_BASE_URL=https://api.moonshot.ai/v1

# --- Zhipu GLM ---
# Obtention : https://bigmodel.cn/usercenter/apikeys
# MOLIERE_GLM_API_KEY=...
# MOLIERE_GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4

# --- GitHub Copilot ---
# Le provider Copilot accepte deux modes : jeton OAuth ou intégration
# MOLIERE_COPILOT_TOKEN=ghu_...
# MOLIERE_COPILOT_INTEGRATION_TOKEN=ghu_...
# MOLIERE_COPILOT_BASE_URL=https://api.githubcopilot.com

# --- DeepSeek ---
# Obtention : https://platform.deepseek.com/api_keys
# MOLIERE_DEEPSEEK_API_KEY=sk-...
# MOLIERE_DEEPSEEK_BASE_URL=https://api.deepseek.com/v1

# --- Groq ---
# Obtention : https://console.groq.com/keys
# MOLIERE_GROQ_API_KEY=gsk-...
# MOLIERE_GROQ_BASE_URL=https://api.groq.com/openai/v1

# --- OpenRouter ---
# Obtention : https://openrouter.ai/keys
# MOLIERE_OPENROUTER_API_KEY=sk-or-...
# MOLIERE_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
# Optionnel : préfixer le nom du modèle (ex: "anthropic/claude-3-haiku")
# MOLIERE_OPENROUTER_DEFAULT_MODEL=openai/gpt-4o-mini

# --- Ollama (local) ---
# Aucune clé requise, mais l'API doit être accessible.
# MOLIERE_OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
# MOLIERE_OLLAMA_DEFAULT_MODEL=llama3.1

# --- MiniMax (compatibilité ascendante) ---
# Conserve le nom historique pour les déploiements existants.
# MOLIERE_MINIMAX_API_KEY=...
# MOLIERE_MINIMAX_BASE_URL=https://api.minimax.io/v1
# MOLIERE_MINIMAX_DEFAULT_MODEL=MiniMax-M3
```

## Patch pour `MOLIERE.md.example`

Insérer la nouvelle section après « Conventions de code » et **avant** « Commandes utiles » :

```diff
 ## Conventions de code

 - TypeScript strict
 - Imports relatifs au projet
 - Commentaires en français
 - Pas de magic strings, privilégier les enums

+## Provider par défaut
+
+Le provider LLM se choisit dans `.env` via `MOLIERE_PROVIDER` ou via le flag
+CLI `--provider <id>`. Providers officiellement supportés :
+
+| Identifiant  | Cas d'usage                                |
+| ------------ | ------------------------------------------ |
+| `openai`     | OpenAI officiel ou tout endpoint OpenAI-compat |
+| `anthropic`  | Claude (Anthropic)                         |
+| `gemini`     | Google Gemini                              |
+| `mistral`    | Mistral                                    |
+| `kimi`       | Moonshot Kimi                              |
+| `glm`        | Zhipu GLM                                  |
+| `copilot`    | GitHub Copilot (`token` ou `integrationToken`) |
+| `deepseek`   | DeepSeek                                   |
+| `groq`       | Groq                                       |
+| `openrouter` | OpenRouter (plusieurs modèles via une clé) |
+| `ollama`     | Ollama local                               |
+| `minimax`    | MiniMax (compat ascendante)                |
+
+Pour ce projet, on utilise **<COLLER ICI LE PROVIDER CHOISI>** avec le modèle
+`<MODÈLE>`. La clé d'API est lue depuis `MOLIERE_<PROVIDER>_API_KEY`.
+
 ## Commandes utiles

 - Tests : `bun test`
 - Build : `bun run build`
```

Remplacer aussi `MiniMax-M3` partout dans le fichier (aucune occurrence ne doit subsister). Si le projet utilise historiquement MiniMax, conserver `minimax` comme provider par défaut dans la config projet et expliquer pourquoi dans la section « Ce que Molière doit savoir ».

## Critères d'acceptation

- [ ] `grep -E "MOLIERE_API_KEY|minimax" .env.example` retourne 0 résultat, ou retourne uniquement la ligne `MOLIERE_MINIMAX_API_KEY=...` (compatibilité).
- [ ] `grep -E "MOLIERE_API_KEY|https://api.minimax.io" MOLIERE.md.example` retourne 0 résultat.
- [ ] `.env.example` contient au moins une section par provider livré par T-04 à T-13.
- [ ] `bun start --help` fonctionne toujours (aucune variable requise pour l'aide).
- [ ] `bunx tsc --noEmit` retourne 0.
- [ ] `bun test` passe.

## Pièges & anti-patterns

- ❌ Mettre les noms réels de clés API en clair dans l'exemple — laisser les valeurs vides.
- ❌ Oublier de documenter `MOLIERE_PROVIDER` (variable pivot du nouveau système).
- ❌ Présumer que `MOLIERE_API_KEY` existe encore (couper le pont explicitement, ou le faire pointer vers le provider par défaut).
- ❌ Documenter Copilot avec une seule variable alors qu'il accepte `token` et `integrationToken`.
- ✅ Regrouper les providers OpenAI-compat (openai, mistral, kimi, deepseek, groq, openrouter, ollama, glm, minimax) en fin de section avec un commentaire « API OpenAI-compatible ».

## Références

- `AGENTS.md` R7 — ne pas toucher `~/.moliere/`, mais bien au projet (`.env.example`).
- Liste des providers cibles : `src/llm/providers/registry.ts` (livré T-01).
- Spéc des endpoints officiels par provider (vérifier en T-04 à T-13).
