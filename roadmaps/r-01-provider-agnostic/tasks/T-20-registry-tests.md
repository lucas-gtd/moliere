# T-20 — Tests du registre et de la sélection de provider

> **Statut** : `TODO` · **Priorité** : `P0` · **Effort** : `M`

## But

Couvrir par tests unitaires (`bun test`) la **plomberie** de `src/llm/providers/registry.ts` : résolution du provider actif, lecture des clés, gestion des providers multi-clés (Copilot `token` + `integrationToken`), fallback automatique, détection d'erreur explicite quand la clé manque, ordre de priorité env > global > projet. Les tests doivent garantir que la fonction `resolveProvider()` est déterministe et que les slash commands `/config` et `/doctor` affichent le bon provider.

## Pré-requis

- T-01 (DONE) — `ProviderRegistry`, `resolveProvider`, table des providers.
- T-15 (DONE) — refactor `src/config.ts`, `src/commands/config.ts`, `src/commands/agents.ts`.

## Fichiers touchés

- `tests/providers/registry.test.ts` — **nouveau** : tests du registre.
- `tests/providers/resolveProvider.test.ts` — **nouveau** : tests de la fonction de résolution.
- `tests/slash-commands.test.ts` — étendu avec assertions sur `/config` et `/doctor`.

## Étapes

1. **Tester `KNOWN_PROVIDERS`** (`src/llm/providers/registry.ts`) :
   - Au moins 13 providers déclarés : `openai`, `anthropic`, `gemini`, `mistral`, `kimi`, `glm`, `copilot`, `deepseek`, `groq`, `openrouter`, `ollama`, `minimax`, `dummy`.
   - Chaque provider expose : `id`, `label`, `apiKeyEnv`, `apiKeyAliases?`, `baseUrlEnv`, `defaultBaseUrl`, `defaultModel`, `adapterFactory`.
   - Assert : `expect(KNOWN_PROVIDERS.map((p) => p.id).sort()).toEqual([...].sort())`.

2. **Tester `resolveProvider()`** avec snapshots d'environment isolés (helper `withEnv`) :

   | Cas                                                                                | Attendu                                                                                  |
   | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
   | `MOLIERE_PROVIDER=openai` + `MOLIERE_OPENAI_API_KEY=sk-x` + override `undefined`   | `{ provider: "openai", apiKey: "sk-x", baseUrl: "https://api.openai.com/v1" }`          |
   | `MOLIERE_PROVIDER=anthropic` **sans clé**                                          | jette `ProviderError{kind:"auth"}` ou message `"Clé API manquante pour le provider 'anthropic' (MOLIERE_ANTHROPIC_API_KEY)"` |
   | `MOLIERE_PROVIDER=copilot` + `MOLIERE_COPILOT_INTEGRATION_TOKEN=x` + `MOLIERE_COPILOT_TOKEN=y` | `apiKey === "x"` (integration prioritaire sur token)                            |
   | `MOLIERE_PROVIDER=openai` + aucune clé env + `~/.moliere/config.json` `{openai:{apiKey:"g"}}` | `apiKey === "g"` (fallback global)                                          |
   | `MOLIERE_PROVIDER=openai` + aucune clé env + projet `.moliere/config.json` `{openai:{apiKey:"p"}}` | `apiKey === "p"` (fallback projet)                                          |
   | `MOLIERE_PROVIDER=inconnu`                                                        | jette `Error` listant les providers valides (fallback proposé)                          |
   | `MOLIERE_PROVIDER` non définie, fallback activé sur OpenAI                         | `provider === "openai"` si clé OpenAI présente, sinon essai `anthropic`, sinon essai `gemini`, sinon `unknown` avec warning |
   | env `MOLIERE_PROVIDER=` **vide**                                                   | fallback automatique + warning stderr                                                    |
   | provider Ollama : pas de clé requise, baseUrl par défaut `http://127.0.0.1:11434/v1` | `{ apiKey: undefined, baseUrl: "http://127.0.0.1:11434/v1", provider: "ollama" }`        |

3. **Helper `withEnv`** : utiliser `bun:test beforeEach/afterEach` pour cloner `process.env`, restaurer dans `afterEach`. Implanter dans `tests/providers/_helpers/env.ts` :

   ```ts
   export const withEnv = (
     overrides: Record<string, string | undefined>,
     fn: () => Promise<void> | void,
   ) => async () => {
     const snapshot = { ...process.env };
     for (const [key, value] of Object.entries(overrides)) {
       if (value === undefined) delete process.env[key];
       else process.env[key] = value;
     }
     try {
       await fn();
     } finally {
       process.env = snapshot;
     }
   };
   ```

4. **Tester la priorité env > global > projet** en stubant `fs.readFileSync` ou en écrivant des fixtures temporaires dans `os.tmpdir()` (via `Bun.write`).

5. **Couverture des slash commands** — ajouter dans `tests/slash-commands.test.ts` :

   ```ts
   test("/config affiche le provider actif et la clé masquée", async () => {
     process.env.MOLIERE_PROVIDER = "anthropic";
     process.env.MOLIERE_ANTHROPIC_API_KEY = "sk-ant-secret-1234567890";
     const out = await runSlashCommand("config", "");
     expect(out).toContain("Provider actif : anthropic");
     expect(out).toContain("sk-••••••••••••7890");
     expect(out).not.toContain("sk-ant-secret-1234567890");
   });

   test("/doctor signale l'absence de clé quand le provider exige une clé", async () => {
     process.env.MOLIERE_PROVIDER = "openai";
     delete process.env.MOLIERE_OPENAI_API_KEY;
     const out = await runSlashCommand("doctor", "");
     expect(out).toMatch(/Cl[ée] API .* : MANQUANTE/);
   });
   ```

6. **Tester qu'aucun warning n'est loggé** quand le provider est explicitement valide (utiliser `console.warn` mocké).

## Critères d'acceptation

- [ ] `bun test tests/providers/registry.test.ts` couvre au moins 8 cas (table ci-dessus).
- [ ] `bun test tests/providers/resolveProvider.test.ts` couvre tous les cas du tableau (12 cas).
- [ ] `bun test tests/slash-commands.test.ts` passe avec les 2 nouveaux tests (5 assertions totales dans le fichier).
- [ ] Aucun `process.env` non restauré entre tests (vérifier via `bun test --reporter=verbose`).
- [ ] `bunx tsc --noEmit` retourne 0.

## Pièges & anti-patterns

- ❌ Modifier le `process.env` global sans snapshot/restauration dans chaque test (fuite inter-tests).
- ❌ Couper `process.env.MOLIERE_PROVIDER` via `delete process.env[...]` puis le re-définir sans clear le cache de `loadConfig` (utiliser un `beforeEach` qui réimporte ou réinitialise le module).
- ❌ Tester le fallback Ollama avec un `baseUrl` qui n'est pas celui par défaut — Ollama n'a pas de clé obligatoire, mais `baseUrl` doit être résolu même sans clé.
- ❌ Hardcoder `https://api.minimax.io` dans un test : utiliser des URLs neutres (`http://example.com/v1`).
- ✅ Pour Copilot, tester explicitement l'ordre : `integrationToken` > `token` > erreur (les deux étant présents).
- ✅ Vérifier que le warning de fallback n'apparaît qu'**une fois** par appel (pas de doublon si l'utilisateur réinvoque).

## Références

- `AGENTS.md` R3 — typage strict ; éviter `string | undefined` sans narrowing.
- `AGENTS.md` R10 — tests `tests/*.test.ts`, fonctions pures (l'I/O sera mocké).
- `/doctor` et `/config` actuels : `src/commands/agents.ts:91` et `src/commands/config.ts:55-62`.
- `src/config.ts` — `loadConfig` à mocker via surcharge du module ou via stub de `process.env`.
