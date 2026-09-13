# Contribuer à Molière

Merci de votre intérêt pour Molière. Ce guide couvre tout ce dont vous avez besoin pour proposer une contribution : installation, conventions, processus de revue.

## Prérequis

- **Bun** ≥ 1.3.14 (pinned dans `package.json`)
- **Git**
- Une clé API MiniMax pour les tests d'intégration manuels (non requise pour `bun test`)

## Mise en place

```bash
git clone https://github.com/lucas-gtd/moliere.git
cd moliere
bun install
cp .env.example .env
```

Renseignez `MOLIERE_API_KEY` dans `.env` si vous souhaitez lancer l'agent localement. Pour exécuter la suite de tests :

```bash
bun test
```

Aucun build n'est nécessaire ; Bun exécute TypeScript nativement.

## Conventions de code

- **TypeScript strict** — Aucun `any` implicite, aucun `// @ts-ignore`. Si un type vous bloque, discutez-le dans la PR.
- **Commentaires en français** — Le projet suit cette convention. Restez concis et expliquez le *pourquoi*, pas le *quoi*.
- **Pas de magic strings** — Les constantes partagées vivent dans `src/branding/copy.ts` ou dans un module dédié.
- **Une fonction, un fichier** quand un module dépasse 150 lignes ; splitter `loop.ts` ou `app.tsx` est explicitement encouragé.
- **Aucune dépendance exotique** — Avant d'ajouter une dépendance, vérifiez qu'elle est activement maintenue et qu'elle n'existe pas déjà dans `src/utils` ou `src/tui/format`.

## Structure des branches

- `master` — branche stable ; seules les merges PR y sont autorisées.
- `feat/<slug>` — nouvelle fonctionnalité
- `fix/<slug>` — correction de bug
- `refactor/<slug>` — refactoring sans changement de comportement
- `docs/<slug>` — documentation uniquement

`<slug>` est en kebab-case, sans préfixe de ticket.

## Messages de commit

Nous utilisons [Conventional Commits](https://www.conventionalcommits.org/) :

```
feat: ajout du sous-agent security-review
fix: corriger le crash de searchInFiles sur les liens symboliques
refactor(tools): extraire la validation de chemin dans path-safety.ts
docs: clarifier la section Modes de permissions
test(branding): couvrir renderCartouche avec un titre long
chore: pin @types/bun à 1.3.14
```

La portée (`scope`) est optionnelle mais recommandée pour les changements localisés.

## Pull requests

1. Forkez, créez une branche depuis `master`, commitez par sujet logique.
2. **Tests** — `bun test` doit passer. Ajoutez des tests pour toute nouvelle fonction publique ou correction de bug. Les tests vivent dans `tests/` et tournent sur des fonctions pures.
3. **Type-check** — `bun run start --no-tui` doit démarrer sans erreur TypeScript. Bun ne fait pas de build séparé ; lancez l'app pour vérifier.
4. **Description de PR** — Utilisez le modèle `.github/PULL_REQUEST_TEMPLATE.md`. Indiquez le *pourquoi*, le *comment*, et toute breaking change.
5. Une PR = un sujet. Les refactorings et les fonctionnalités vivent dans des PRs distinctes.
6. Attendez la revue d'au moins un mainteneur avant de merger.

## Tests

Les tests sont des fonctions pures sous `tests/*.test.ts`. Pour les ajouter :

```ts
import { describe, expect, test } from "bun:test";
import { myFunction } from "../src/utils/my-function";

describe("myFunction", () => {
  test("cas nominal", () => {
    expect(myFunction("input")).toBe("expected");
  });
});
```

N'ajoutez pas de tests qui dépendent de l'horloge, du réseau, ou de l'état global.

## Signalement de bugs

Utilisez le modèle `.github/ISSUE_TEMPLATE/bug_report.md`. Joignez :

- Version de Bun (`bun --version`) et OS
- Commande exacte exécutée
- Comportement attendu vs observé
- Logs ou extrait de la session (jamais la clé API)

## Propositions de fonctionnalités

Utilisez `.github/ISSUE_TEMPLATE/feature_request.md`. Décrivez la motivation et le comportement souhaité. Les grandes fonctionnalités (changement d'API, nouveau modèle de stockage) méritent un RFC court avant tout code.

## Sécurité

Ne signalez **pas** les failles de sécurité dans les issues publiques. Voir [`SECURITY.md`](./SECURITY.md) pour le canal privé.

## Code de conduite

En participant, vous acceptez les termes de [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

## Questions ?

Ouvrez une issue avec le label `question` ou contactez les mainteneurs via le canal indiqué sur la page du projet.