# T-16 — Flags CLI `--provider` et erreurs neutres dans `src/index.tsx`

> **Statut** : `TODO` · **Priorité** : `P0` · **Effort** : `S`

## But

Exposer un flag CLI `--provider <id>` permettant de surcharger le provider LLM pour la session courante, et remplacer les messages d'erreur hardcodés « Definissez MOLIERE_API_KEY » par des messages **neutres vis-à-vis du provider actif**. Le résultat observable : `bun start --provider openai --model gpt-4o-mini` démarre une session configurée pour OpenAI, et toute erreur mentionne le nom du provider concerné sans présupposer qu'il s'agit de MiniMax.

## Pré-requis

- T-01 (DONE) — Création du `ProviderRegistry` et du type `ProviderId`.
- T-02 (DONE) — La fonction `resolveProvider({ providerOverride })` retourne `{ provider, apiKey, baseUrl }` ou jette une erreur typée.

## Fichiers touchés

- `src/index.tsx` — ajout de l'option `--provider`, appel au resolver, message d'erreur reformulé.
- `src/llm/provider.ts` — export du type `ProviderId` (si déjà créé en T-01, sinon juste ré-exporter depuis `src/llm/providers/registry.ts`).
- `tests/index-cli.test.ts` — nouveau fichier de tests arg parsing + erreur neutre.

## Étapes

1. Importer `resolveProvider`, `ProviderId`, `KNOWN_PROVIDERS` depuis le module provider (T-02).
2. Ajouter l'option commander : `.option("--provider <id>", "Provider LLM (openai, anthropic, gemini, ...)")`.
3. Si `opts.provider` est défini, valider qu'il appartient à `KNOWN_PROVIDERS`. Si non, lister les providers valides et `process.exit(1)` avec un message « Provider inconnu : "<x>". Providers disponibles : openai, anthropic, gemini, mistral, kimi, glm, copilot, deepseek, groq, openrouter ».
4. Remplacer les lignes 47-52 de `src/index.tsx` par :

   ```ts
   const resolved = resolveProvider({ providerOverride: opts.provider as ProviderId | undefined });
   if (!resolved.apiKey) {
     console.error(`Erreur : aucune clé API pour le provider "${resolved.provider}".`);
     console.error(`Définissez la variable d'environnement attendue dans .env (cf. .env.example) ou dans ~/.moliere/config.json.`);
     process.exit(1);
   }
   ```

5. Stocker `resolved.provider` dans la `MoliereConfig` (champ `providerId` ajouté en T-01) avant `loadConfig()` ou via `updateGlobalConfig`.
6. Conserver le flag `--no-tui` et vérifier que l'option `--plan` reste prioritaire.
7. Ajouter un test `bun test tests/index-cli.test.ts` qui stub `process.argv` et vérifie qu'un provider invalide déclenche `process.exit(1)` avec le bon message ; tester aussi qu'un provider valide est persisté.

## Critères d'acceptation

- [ ] `bun start --help` liste `--provider <id>` dans la sortie d'aide.
- [ ] `bun start --provider inconnu` quitte avec un code 1 et un message listant les providers valides.
- [ ] `bun start --provider openai` sans clé produit : `Erreur : aucune clé API pour le provider "openai".` (et **non** `Definissez MOLIERE_API_KEY`).
- [ ] Aucune chaîne « MiniMax » ou « MOLIERE_API_KEY » ne subsiste dans `src/index.tsx` (vérifier via `rg "MOLIERE_API_KEY|MiniMax" src/index.tsx` → 0 résultat).
- [ ] `bun test` passe (nouveau test inclus).
- [ ] `bunx tsc --noEmit` retourne 0.

## Détails d'implémentation

- Déclaration commander placée **avant** `program.parse(process.argv)` et **après** l'option `--model` pour respecter l'ordre logique des surcharges CLI.
- Variable typée : `const providerOverride = typeof opts.provider === "string" ? (opts.provider as ProviderId) : undefined`.
- Validation via `if (providerOverride && !KNOWN_PROVIDERS.includes(providerOverride))` qui liste les IDs valides depuis le registre (pas de liste codée en dur).
- Si `--provider` est fourni mais que le provider **n'a pas de clé requise** (ex. Ollama), `resolveProvider` doit quand même retourner une configuration valide (T-02 a déjà prévu ce cas).
- Si le resolver jette `ProviderError{kind:"auth"}`, propager le **message** du `ProviderError` dans `console.error` (préfixe `Erreur :`) plutôt que de réécrire un message générique.
- Persistance : ne **pas** stocker `providerId` dans `~/.moliere/config.json` quand il vient d'un flag CLI (`opts.provider`) — l'utilisateur peut vouloir `--provider` ponctuel. Ajouter plutôt un champ `lastCliProvider` non documenté, ou ne rien persister du tout. Décision : ne rien persister (le flag reste éphémère).
- Tests `tests/index-cli.test.ts` (nouveau) :
  - `case 1` — stub `process.argv = ["bun", "start", "--provider", "anthropic"]`, stub `process.env.MOLIERE_ANTHROPIC_API_KEY = "sk-ant-..."`, assert que `loadConfig()` est appelé **une fois** et que le provider résolu est `anthropic`.
  - `case 2` — `--provider`, valeur inconnue `foo`, assert `process.exit` appelé avec `1` et que stderr contient `"foo"`.
  - `case 3` — pas de `--provider`, `MOLIERE_PROVIDER=openai`, `MOLIERE_OPENAI_API_KEY=sk-...`, assert que le provider résolu est `openai` (override env > auto-détection).
  - `case 4` — `--provider openai` sans clé, assert message `"Erreur : aucune clé API pour le provider \"openai\""`.
- Pour les tests, mocker `process.exit` en remplaçant par `throw` pour capturer la sortie dans `expect(...).toThrow()`.
- Si `process.argv` est modifié dans `tests/index-cli.test.ts`, restaurer dans `afterEach` pour ne pas polluer les autres suites.
- Documentation inline : ajouter un commentaire `// Couplage toléré : index.tsx connaît les IDs pour l'aide, mais ne valide pas les secrets.` au-dessus de `KNOWN_PROVIDERS.includes()` pour signaler qu'on ne duplique pas la logique métier.

## Pièges & anti-patterns

- ❌ Hardcoder un mapping `id → envVar` dans `src/index.tsx` : ce mapping doit vivre dans `src/llm/providers/registry.ts`.
- ❌ Référencer `process.env.MOLIERE_API_KEY` directement dans le message d'erreur : utiliser le nom dynamique renvoyé par `resolveProvider`.
- ❌ Modifier `src/index.tsx` sans préserver le flag `--no-tui` (anti-pattern documenté en AGENTS.md §4).
- ❌ Utiliser `any` pour typer `opts.provider` (`src/index.tsx:31`).
- ✅ Typer `opts.provider` via `as ProviderId | undefined` après validation par `KNOWN_PROVIDERS`.
- ✅ Le resolver doit être appelé **après** les `updateGlobalConfig` pour que les flags persistent correctement en session.

## Références

- `AGENTS.md` §4 — anti-pattern « Modifier `src/index.tsx` pour shunter la TUI sans mettre à jour `--no-tui` ».
- `AGENTS.md` §3.1 — pattern validation des entrées utilisateur.
- [`commander` — options](https://github.com/tj/commander.js#options) pour la syntaxe exacte.
- `src/commands/config.ts:50-69` — référence pour le nouveau rendu multi-provider de `/config` (T-15).
- T-02 (`resolveProvider`) — pour le contrat de retour `{ provider, apiKey, baseUrl }` consommé par `src/index.tsx`.
