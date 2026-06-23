<div align="center">

# Moliere

**Un agent de codage CLI simple, rapide et autonome.**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)
![OpenRouter](https://img.shields.io/badge/OpenRouter-7C3AED?style=for-the-badge&logo=openai&logoColor=white)
![Status](https://img.shields.io/badge/status-active-22C55E?style=for-the-badge)

<br />

Moliere aide a explorer, modifier, tester et versionner un projet local depuis un terminal.

</div>

---

## Installation

```bash
bun install
cp .env.example .env
```

Ajoute ensuite ta cle API dans `.env`:

```env
MOLIERE_API_KEY=...
```

## Lancement

```bash
bun src/index.ts
```

## Outils inclus

| Categorie | Outils |
| --- | --- |
| Exploration | `tree`, `listDirectory`, `findFiles`, `searchInFiles` |
| Fichiers | `readFile`, `writeFile`, `editFile` |
| Git | `gitStatus`, `gitDiff`, `gitLog` |
| Execution | `runCommand` |

## Securite

Moliere reste limite au projet courant:

- chemins bloques hors du projet;
- sorties plafonnees pour rester rapide;
- recherche sans interpolation shell;
- commandes lancees sans shell, avec timeout;
- modifications et executions serialisees pour eviter les courses.

<div align="center">

---

**Moliere est concu pour aller droit au but: comprendre, modifier, verifier.**

</div>
