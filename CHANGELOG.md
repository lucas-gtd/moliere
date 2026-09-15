# Changelog

Toutes les modifications notables de Molière sont documentées ici. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

- `AGENTS.md` à la racine : règles non négociables, patterns d'ajout (outil, slash command, sous-agent, hook, thème), anti-patterns et glossaire des ancres, destiné aux assistants de codage automatisés
- Infrastructure open source : `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
- Templates GitHub : bug report, feature request, pull request
- Workflow CI GitHub Actions (`bun install` + `bun test`)
- Dependabot pour les mises à jour hebdomadaires `npm` et `github-actions`
- Champ `packageManager` et épinglage explicite de Bun 1.3.14

### Modifié

- Nettoyage du ton marketing français du README et des bannières
- Renommage des labels de thème : `Tricolore` → `Classique`, `Soir tricolore` → `Soir`, `Parchemin tricolore` → `Parchemin`

## [0.2.1] - 2026-09-13

### Ajouté

- Historique scrollable dans la TUI
- Sortie d'outil et d'assistant plus lisible (cartes colorées)

## [0.2.0] - 2026-09-12

### Ajouté

- Parité fonctionnelle avec Claude Code côté TUI
- Sous-agents, hooks, plan mode, persistance des sessions
- Catalogue de 14 outils (lecture, écriture, commande, dialogue, réseau)

## [0.1.0] - 2026-09-01

### Ajouté

- Première version publique interne
- Interface TUI Ink minimale
- Boucle agent avec streaming et tool calls

---

[Unreleased]: https://github.com/lucas-gtd/moliere/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/lucas-gtd/moliere/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/lucas-gtd/moliere/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/lucas-gtd/moliere/releases/tag/v0.1.0
