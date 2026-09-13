export type ThemeName = "default" | "soir" | "parchemin";

export interface Palette {
  primary: string;
  secondary: string;
  accent: string;
  ivory: string;
  ink: string;
  bordeaux: string;
  or: string;
  grass: string;
  sky: string;
  rose: string;
  plum: string;
  grey: string;
  mist: string;
}

export interface Theme {
  name: ThemeName;
  label: string;
  palette: Palette;
}

const TRICOLORE_PALETTE: Palette = {
  primary: "#0055A4",
  secondary: "#3B7DD8",
  accent: "#C9A227",
  ivory: "#FFFFFF",
  ink: "#1A1F2C",
  bordeaux: "#C8102E",
  or: "#C9A227",
  grass: "#3C8C44",
  sky: "#87B6D9",
  rose: "#E89BA8",
  plum: "#6B3F73",
  grey: "#8B8680",
  mist: "#E6E8EE",
};

const SOIR_PALETTE: Palette = {
  primary: "#6FA8DC",
  secondary: "#A2C4E8",
  accent: "#E8C547",
  ivory: "#E8E4D8",
  ink: "#0E1117",
  bordeaux: "#FF6B7A",
  or: "#E8C547",
  grass: "#9DC88D",
  sky: "#7FB7DB",
  rose: "#E8A1B0",
  plum: "#B89BC4",
  grey: "#7F8C8D",
  mist: "#3A4048",
};

const PARCHEMIN_PALETTE: Palette = {
  primary: "#0055A4",
  secondary: "#7A4A2E",
  accent: "#C8102E",
  ivory: "#FFFFFF",
  ink: "#1A1F2C",
  bordeaux: "#C8102E",
  or: "#C9A227",
  grass: "#3C8C44",
  sky: "#87B6D9",
  rose: "#E89BA8",
  plum: "#6B3F73",
  grey: "#8B7B5E",
  mist: "#F4ECD8",
};

export const THEMES: Record<ThemeName, Theme> = {
  default: { name: "default", label: "Tricolore", palette: TRICOLORE_PALETTE },
  soir: { name: "soir", label: "Soir tricolore", palette: SOIR_PALETTE },
  parchemin: { name: "parchemin", label: "Parchemin tricolore", palette: PARCHEMIN_PALETTE },
};

export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];

let currentThemeName: ThemeName = "default";

export const setActiveTheme = (name: ThemeName) => {
  if (THEMES[name]) currentThemeName = name;
};

export const setActiveThemeName = setActiveTheme;

export const getActiveTheme = (): Theme => THEMES[currentThemeName];

export const getActivePalette = (): Palette => THEMES[currentThemeName].palette;

export const getActiveThemeName = (): ThemeName => currentThemeName;

export const colorize = (palette: Palette) => ({
  primary: (text: string) => `\x1b[38;5;75m${text}\x1b[0m`,
  or: (text: string) => `\x1b[38;5;179m${text}\x1b[0m`,
  bordeaux: (text: string) => `\x1b[38;5;160m${text}\x1b[0m`,
  grass: (text: string) => `\x1b[38;5;71m${text}\x1b[0m`,
  rose: (text: string) => `\x1b[38;5;174m${text}\x1b[0m`,
  grey: (text: string) => `\x1b[38;5;246m${text}\x1b[0m`,
  sky: (text: string) => `\x1b[38;5;110m${text}\x1b[0m`,
  mist: (text: string) => `\x1b[38;5;252m${text}\x1b[0m`,
  ivory: (text: string) => `\x1b[38;5;231m${text}\x1b[0m`,
  ink: (text: string) => `\x1b[38;5;236m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`,
  italic: (text: string) => `\x1b[3m${text}\x1b[0m`,
  underline: (text: string) => `\x1b[4m${text}\x1b[0m`,
  inverse: (text: string) => `\x1b[7m${text}\x1b[0m`,
  success: (text: string) => `\x1b[38;5;71m${text}\x1b[0m`,
  error: (text: string) => `\x1b[38;5;160m${text}\x1b[0m`,
  warning: (text: string) => `\x1b[38;5;179m${text}\x1b[0m`,
  info: (text: string) => `\x1b[38;5;75m${text}\x1b[0m`,
  muted: (text: string) => `\x1b[38;5;246m${text}\x1b[0m`,
  accent: (text: string) => `\x1b[38;5;179m${text}\x1b[0m`,
});
