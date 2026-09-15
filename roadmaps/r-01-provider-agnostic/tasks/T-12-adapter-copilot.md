# T-12 — Implémenter l'adaptateur GitHub Copilot

> **Statut** : `TODO` · **Priorité** : `P1` · **Effort** : `M`

## But

Implémenter `src/llm/providers/copilot.ts` qui parle à l'API GitHub Copilot
Chat (`https://api.githubcopilot.com/chat/completions`, format OpenAI-compatible
avec headers spécifiques et allow-list de modèles). L'adaptateur gère le
header `Authorization: Bearer <oauth_token>`, l'en-tête `Editor-Version`, le
`Copilot-Integration-Token`, et la vérification du modèle contre l'allow-list
renvoyée par `GET /models`. Résultat : `provider=copilot` permet à Molière de
piloter `gpt-4o`, `claude-3.5-sonnet`, etc., via un abonnement Copilot.

## Pré-requis

- T-02 (TODO) — contrat `ProviderAdapter`.
- T-03 (TODO) — IR canonique publié.
- T-04 (TODO) — `MoliereConfig.providers.copilot` typé
  `{oauthToken, integrationToken?, editorVersion?, baseUrl?}`.
- T-05 (TODO) — `MOLIERE_COPILOT_OAUTH_TOKEN` (ou `MOLIERE_COPILOT_TOKEN`)
  chargé ; `MOLIERE_COPILOT_INTEGRATION_TOKEN` optionnel.
- T-06 (TODO) — `copilot` enregistré dans `FACTORIES`.
- T-08 (TODO) — `buildOpenAICompatAdapter` opérationnel comme sous-couche
  (Copilot réutilise le format OpenAI).

## Fichiers touchés

- `src/llm/providers/copilot.ts` — **création**.
- `src/llm/providers/registry.ts` — ajout factory `copilot`.
- `src/llm/providers/openai-compat.ts` — pas de modification (réutilisé
  pour le transport).
- `tests/llm-providers-copilot.test.ts` — **création** : tests headers,
  refresh sur 401, allow-list.

## Étapes

1. Définir `COPILOT_DEFAULTS` :

   ```ts
   export const COPILOT_DEFAULTS = {
     providerId: "copilot" as ProviderId,
     baseUrl: "https://api.githubcopilot.com",
     defaultModel: "gpt-4o",
     editorVersion: "vscode/1.85.1",
     integrationToken: "vscode-moliere",  // valeur fixe par client
   };
   ```

   Catalogue initial pour `listModels()` :

   ```ts
   [
     { id: "gpt-4o",              label: "GPT-4o (Copilot)",      contextWindow: 128_000 },
     { id: "gpt-4o-mini",         label: "GPT-4o mini (Copilot)", contextWindow: 128_000 },
     { id: "claude-3.5-sonnet",   label: "Claude 3.5 Sonnet",      contextWindow: 200_000 },
     { id: "claude-3.7-sonnet",   label: "Claude 3.7 Sonnet",      contextWindow: 200_000 },
     { id: "o1-preview",          label: "o1-preview",             contextWindow: 128_000 },
     { id: "o1-mini",             label: "o1-mini",                contextWindow: 128_000 },
     { id: "gemini-2.0-flash",    label: "Gemini 2.0 Flash",       contextWindow: 1_000_000 },
   ]
   ```

2. **Construction de l'adaptateur** : GitHub Copilot est OpenAI-compatible
   pour le format body/réponse ; on **réutilise**
   `buildOpenAICompatAdapter` en surchargeant les headers :

   ```ts
   export const buildCopilotAdapter = (cfg: CopilotConfig): ProviderAdapter => {
     const merged: OpenAICompatConfig = {
       baseUrl: cfg.baseUrl ?? COPILOT_DEFAULTS.baseUrl,
       apiKey: cfg.oauthToken,
       defaultModel: cfg.defaultModel ?? COPILOT_DEFAULTS.defaultModel,
       providerId: "copilot",
     };
     const base = buildOpenAICompatAdapter(merged);

     const wrap =
       (fn: (req: any, handlers: any) => Promise<any>) =>
       async (req: any, handlers: any = {}) => {
         return fn(req, {
           ...handlers,
           extraHeaders: {
             "Editor-Version": cfg.editorVersion ?? COPILOT_DEFAULTS.editorVersion,
             "Copilot-Integration-Token": cfg.integrationToken ?? COPILOT_DEFAULTS.integrationToken,
             "OpenAI-Intent": "conversation-edits",
             "User-Agent": "moliere-cli/0.1",
           },
         });
       };

     return {
       ...base,
       streamChat: wrap(base.streamChat),
       chat: wrap(base.chat),
       listModels: () => fetchAllowedModels(cfg),
     };
   };
   ```

   Le wrapping suppose une extension du type `StreamHandlers` de
   `openai-compat.ts` pour accepter `extraHeaders?: Record<string,string>`
   (modification minimale dans T-08, sinon dupliquer le transport).

3. **Endpoint** :

   ```ts
   const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
   ```

   Identique à OpenAI en URL ; la spécificité est dans les **headers**.

4. **Headers requis** (tous obligatoires) :

   ```ts
   {
     "Content-Type": "application/json",
     "Authorization": `Bearer ${config.oauthToken}`,
     "Editor-Version": "vscode/1.85.1",
     "Copilot-Integration-Token": "<integration_token>",
     "OpenAI-Intent": "conversation-edits",
     "User-Agent": "moliere-cli/0.1",
   }
   ```

5. **Allow-list dynamique** (`fetchAllowedModels`) : interroger
   `GET https://api.githubcopilot.com/models` avec le même
   `Authorization: Bearer <oauth_token>` ; la réponse contient
   `{data: Array<{id: string, capabilities: {...}}>}`. Filtrer ceux qui ont
   `{capabilities.supports: {tool_calls: true}}`. **Cache TTL 1 heure** pour
   éviter de spammer l'API au démarrage.

   ```ts
   const cache = new Map<string, { expiresAt: number; models: ModelInfo[] }>();
   async function fetchAllowedModels(cfg: CopilotConfig): Promise<ModelInfo[]> {
     const key = `${cfg.oauthToken.slice(0, 8)}_${cfg.baseUrl}`;
     const hit = cache.get(key);
     if (hit && hit.expiresAt > Date.now()) return hit.models;

     const res = await fetch(`${cfg.baseUrl}/models`, {
       headers: { Authorization: `Bearer ${cfg.oauthToken}` },
     });
     if (!res.ok) return COPILOT_DEFAULTS_MODELS; // fallback catalogue statique
     const data = await res.json() as { data: Array<{ id: string }> };
     const models = data.data
       .filter((m) => COPILOT_KNOWN_MODELS.includes(m.id))
       .map((m) => knownModelInfo(m.id));
     cache.set(key, { expiresAt: Date.now() + 3600_000, models });
     return models;
   }
   ```

6. **Refresh sur 401** : si `streamChat`/`chat` jette une erreur avec status
   401, déclencher le **OAuth device flow** pour rafraîchir le token. Module
   dédié `src/llm/providers/copilot-oauth.ts` :

   ```ts
   async function refreshCopilotToken(clientId: string): Promise<string> {
     const deviceRes = await fetch("https://github.com/login/device/code", {
       method: "POST",
       headers: { "Accept": "application/json" },
       body: new URLSearchParams({ client_id: clientId, scope: "read:user" }),
     });
     const { device_code, user_code, verification_uri, interval } = await deviceRes.json();
     console.log(`Visitez ${verification_uri} et saisissez : ${user_code}`);
     // poll https://github.com/login/oauth/access_token jusqu'à succès
   }
   ```

   Sauvegarder le nouveau token via `saveGlobalConfig` (T-04 a ajouté la
   fonction). Rejouer la requête une seule fois après refresh.

7. **Brancher dans `registry.ts`** :

   ```ts
   copilot: (c) => buildCopilotAdapter(mergeConfig("copilot", c)),
   ```

8. Tests `tests/llm-providers-copilot.test.ts` :
   - mock `globalThis.fetch` ; vérifier que les **5 headers requis** sont
     présents sur la requête ;
   - tester fallback catalogue statique si `GET /models` échoue ;
   - tester refresh sur 401 (mock du device flow + replay) ;
   - tester propagation `AbortSignal` ;
   - tester cache `fetchAllowedModels` (TTL respecté).

## Critères d'acceptation

- [ ] `src/llm/providers/copilot.ts` exporte `buildCopilotAdapter` et
      `COPILOT_DEFAULTS`.
- [ ] Les 5 headers Copilot (`Authorization`, `Editor-Version`,
      `Copilot-Integration-Token`, `OpenAI-Intent`, `User-Agent`) sont
      systématiquement présents.
- [ ] `listModels()` consulte `/models` au premier appel, cache 1 h,
      fallback catalogue statique en cas d'erreur.
- [ ] Un 401 déclenche le device flow + replay.
- [ ] `bun test tests/llm-providers-copilot.test.ts` passe.
- [ ] `bunx tsc --noEmit` retourne 0.

## Pièges & anti-patterns

- ❌ Réutiliser `buildOpenAICompatAdapter` **sans** wrapper les headers :
  Copilot renvoie 401 car il exige `Editor-Version` + intégration.
- ❌ Oublir `OpenAI-Intent: conversation-edits` : Copilot downgrade ou
  rejette certaines requêtes selon l'intent déclaré.
- ❌ Logger le `oauth_token` en clair : utiliser `maskApiKey` (cf.
  `src/config.ts:121-125`).
- ❌ Boucle de refresh sans backoff : respecter le `interval` du device
  flow (GitHub renvoie `slow_down` si on poll trop vite).
- ❌ Désactiver le tool calling sur les modèles qui ne le supportent pas
  (`gemini-2.0-flash` Copilot : ok, mais `o1-mini` : pas de tool calls) —
  vérifier `capabilities.supports.tool_calls` avant d'envoyer `tools`.
- ❌ Coder en dur `integrationToken: "vscode-moliere"` sans prévoir une
  variable d'env : doit être surchargeable via
  `MOLIERE_COPILOT_INTEGRATION_TOKEN`.
- ✅ Documenter dans `MOLIERE.md.example` la procédure d'obtention du
  token OAuth (cf. T-18).
- ✅ Prévoir un mode « token expiré » qui sort proprement avec un message
  d'erreur clair plutôt que de boucler indéfiniment.

## Références

- `AGENTS.md` — règles R3 (TS strict), R9 (préfixe `Erreur :`), R10 (tests).
- https://docs.github.com/en/copilot/using-github-copilot/using-github-copilot-in-your-ide — usage général Copilot.
- https://api.githubcopilot.com/docs — référence endpoints (non officielle
  mais documentée par la communauté).
- https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#device-flow — device flow spec.
- `src/llm/providers/openai-compat.ts` — sous-couche de transport
  réutilisée.
- `src/config.ts:121-125` — `maskApiKey` pour ne jamais logger le token.
