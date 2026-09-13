import { STAR, DIAMOND, TRIANGLE, QUILL, SECTION } from "./art";

export const GREETINGS = {
  welcome: "Bienvenue chez Molière.",
  farewell: "Au plaisir de vous revoir.",
  busy: "Molière réfléchit...",
  acting: "Molière a décidé d'agir.",
  error: "Une erreur est survenue.",
  success: "Travail accompli.",
};

export const COPY = {
  projectName: "Molière",
  projectSubtitle: "Agent de codage CLI",
  tagline: "Comprendre, modifier, vérifier.",
  projectSlogan: "Simple, rapide, autonome.",
  toolCategory: {
    read: "Lecture",
    write: "Écriture",
    command: "Commande",
    web: "Réseau",
    ask: "Dialogue",
  },
  permission: {
    prompt: "Autoriser cette action ?",
    once: "Une seule fois",
    always: "Toujours pour ce projet",
    deny: "Refuser",
    allowed: "Action autorisée",
    denied: "Action refusée",
  },
  slashMenu: {
    placeholder: "Tapez une commande slash ou votre requête...",
    hint: "Entrée pour envoyer · / pour les commandes · Tab pour compléter · Flèche haut pour l'historique",
  },
  statusBar: {
    ready: "Prêt",
    thinking: "Réflexion",
    acting: "À l'ouvrage",
    tokens: "jetons",
    filesModified: "fichiers modifiés",
  },
};

export const ORNAMENTS = {
  star: STAR,
  diamond: DIAMOND,
  triangle: TRIANGLE,
  quill: QUILL,
  section: SECTION,
};

export const PERMISSION_DENIED_MESSAGE = "Action refusée par l'utilisateur.";
export const PLAN_MODE_MESSAGE = "Mode plan actif : aucune action destructive autorisée.";
export const YOLO_MODE_MESSAGE = "Mode yolo : toutes les actions sont exécutées sans confirmation.";
