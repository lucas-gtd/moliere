export const STAR = "\u2741";
export const DIAMOND = "\u25C6";
export const TRIANGLE = "\u25B6";
export const CHECK = "\u2713";
export const CROSS = "\u2717";
export const ELLIPSIS = "\u2026";
export const HORIZONTAL = "\u2500";
export const DOUBLE_HORIZONTAL = "\u2550";
export const DOUBLE_VERTICAL = "\u2551";
export const T_LIGHT_DOWN = "\u2564";
export const T_LIGHT_UP = "\u2567";
export const T_HEAVY_DOWN = "\u2568";
export const T_HEAVY_UP = "\u2569";

export const TRICOLOR_BAR = `${HORIZONTAL}${HORIZONTAL}${HORIZONTAL}`;
export const QUILL = "\u270E";
export const BULLET = "\u2022";
export const ARROW = "\u2192";
export const SECTION = "\u00A7";

export const MOLIERE_QUOTES = [
  "Castigat ridendo mores.",
  "Je suis ce que je suis, et cela vaut mieux que d'\u00EAtre ce que je ne suis pas.",
  "L'esprit est le sublime de l'homme, et le bon sens en est la perfection.",
  "Il faut rire avant que d'\u00EAtre heureux, de peur de mourir sans avoir ri.",
  "La critique est ais\u00E9e, mais l'art est difficile.",
  "Le vrai m\u00E9rite est de bien faire, sans esp\u00E9rer qu'on en parle.",
  "Une sottise \u00E0 la mode est une sottise en titre.",
];

const HEADER_LINES = [
  "\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E",
  "\u2502   M  O  L  I  \u00C8  R  E   \u2502                                         ",
  "\u2502       l'agent de codage tricolore                       \u2502",
  "\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2568",
];

const COMPACT_HEADER_LINES = [
  "\u2756 M O L I \u00C8 R E \u2756",
];

const TRICOLOR_STRIP = "\x1b[34m\u2588\x1b[0m\x1b[37m\u2588\x1b[0m\x1b[31m\u2588\x1b[0m";

export const renderHeader = (variant: "full" | "compact" = "full"): string => {
  if (variant === "compact") return COMPACT_HEADER_LINES.join("\n");
  return HEADER_LINES.join("\n");
};

export const renderSeparator = (width = 78, ornament = "\u00B7"): string => {
  const side = `${ornament} `;
  const inner = width - side.length * 2;
  if (inner <= 0) return side + side;
  return side + HORIZONTAL.repeat(inner) + side;
};

export const renderDoubleSeparator = (width = 78): string => {
  const inner = width - 2;
  if (inner <= 0) return "";
  return ` ${DOUBLE_HORIZONTAL.repeat(inner)} `;
};

export const renderTricolor = (width = 60): string => {
  const third = Math.max(1, Math.floor(width / 3));
  const blue = "\x1b[44m\x1b[37m" + " ".repeat(third) + "\x1b[0m";
  const white = "\x1b[47m\x1b[30m" + " ".repeat(third) + "\x1b[0m";
  const red = "\x1b[41m\x1b[37m" + " ".repeat(third) + "\x1b[0m";
  return blue + white + red;
};

export const renderCartouche = (title: string, width = 78): string => {
  const inner = width - 4;
  const padded = ` ${title} `;
  const pad = Math.max(0, Math.floor((inner - padded.length) / 2));
  const left = DOUBLE_HORIZONTAL.repeat(pad);
  const right = DOUBLE_HORIZONTAL.repeat(inner - padded.length - pad);
  return `\u2552${left}${padded}${right}\u2552`;
};

export const renderBox = (content: string[], width = 78): string => {
  const border = DOUBLE_HORIZONTAL.repeat(width - 2);
  const lines = [
    `\u2553${border}\u2556`,
    ...content.map((line) => `\u2551 ${line.padEnd(width - 4, " ")} \u2551`),
    `\u255A${border}\u255D`,
  ];
  return lines.join("\n");
};

export const renderSignature = (): string => {
  const quote = MOLIERE_QUOTES[Math.floor(Math.random() * MOLIERE_QUOTES.length)];
  return `\u2756  \u201C${quote}\u201D\n   \u2014 Molière, à votre service.`;
};

export const renderStartupBanner = (model: string, version: string): string => {
  return [
    renderHeader("full"),
    "",
    `   Édition ${version}  ·  Modèle ${model}  ·  Atelier numérique tricolore`,
    "",
  ].join("\n");
};
