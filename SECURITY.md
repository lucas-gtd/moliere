# Politique de sécurité

Merci de prendre le temps de signaler les vulnérabilités de Molière de manière responsable.

## Versions supportées

| Version | Supportée |
|---|---|
| `0.2.x` (courante) | ✓ |
| `0.1.x` | ✗ |

Seule la dernière ligne de version reçoit des correctifs de sécurité. Les utilisateurs sur des versions non supportées doivent mettre à jour.

## Signalement

**Ne signalez pas les failles de sécurité via une issue GitHub publique.**

Utilisez le canal de contact privé indiqué sur la page du dépôt (par exemple l'adresse e-mail des mainteneurs, une `Security Advisory` GitHub, ou tout autre canal affiché publiquement à côté du bouton *Report a vulnerability*).

Incluez dans votre rapport :

- Une description claire de la vulnérabilité et de son impact
- Les étapes de reproduction, idéalement avec un extrait de code
- La version de Molière concernée (`bun start` puis `/status`)
- La version de Bun et l'OS
- Votre avis sur la sévérité et la divulgation coordonnée

## Engagement

- **Accusé de réception** sous 3 jours ouvrés
- **Évaluation initiale** sous 7 jours ouvrés
- **Correctif ou plan de mitigation** dans les 30 jours pour les vulnérabilités de sévérité haute ou critique

Vous serez tenu informé·e de l'avancement. Si le rapport est validé, une mention dans le `CHANGELOG.md` et dans les notes de version sera proposée (avec votre accord).

## Bonnes pratiques pour les contributeurs

- Ne commitez jamais de clé API, de mot de passe ou de secret dans le code ou les logs
- Suivez les règles de `src/tools/path-safety.ts` (résolution `realpath`, blocage hors-projet)
- Pour les commandes utilisateur, continuez à utiliser `execFile` sans shell — ne réintroduisez pas d'évaluation inline
- Les hooks exécutent des commandes arbitraires ; documentez clairement leur surface d'attaque

Merci de contribuer à la sécurité du projet.