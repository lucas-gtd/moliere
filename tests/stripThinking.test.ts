import { describe, expect, test } from "bun:test";
import { stripThinking, countLines } from "../src/tui/format/stripThinking";

describe("stripThinking", () => {
  test("supprime un bloc <think>…</think> inline", () => {
    const text = "Salut <think>raison secrète</think> le monde";
    expect(stripThinking(text)).toBe("Salut  le monde");
  });

  test("supprime un bloc multi-ligne", () => {
    const text = "Avant\n<think>\nligne 1\nligne 2\nligne 3\n</think>\nAprès";
    const out = stripThinking(text);
    expect(out).toContain("Avant");
    expect(out).toContain("Après");
    expect(out).not.toContain("raison");
  });

  test("gère plusieurs blocs", () => {
    const text = "<think>a</think> milieu <think>b</think> fin";
    expect(stripThinking(text)).toContain("milieu");
    expect(stripThinking(text)).toContain("fin");
    expect(stripThinking(text)).not.toContain("a");
    expect(stripThinking(text)).not.toContain("b");
  });

  test("insensible à la casse de la balise", () => {
    expect(stripThinking("<THINK>x</THINK>reste")).toBe("reste");
  });

  test("renvoie la chaîne vide si seul un think est présent", () => {
    expect(stripThinking("<think>seulement</think>")).toBe("");
  });

  test("renvoie la chaîne d'origine si rien à filtrer", () => {
    expect(stripThinking("Pas de think ici")).toBe("Pas de think ici");
  });

  test("renvoie une chaîne vide pour une entrée vide", () => {
    expect(stripThinking("")).toBe("");
  });
});

describe("countLines", () => {
  test("0 pour vide", () => {
    expect(countLines("")).toBe(0);
  });

  test("compte les sauts de ligne", () => {
    expect(countLines("a\nb\nc")).toBe(3);
    expect(countLines("a\nb\nc\n")).toBe(4);
  });
});
