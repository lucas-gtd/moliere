import { describe, expect, test } from "bun:test";
import { renderMarkdown } from "../src/tui/markdown/render";
import { renderInlineDiff } from "../src/tui/markdown/diff";
import { renderSeparator, renderStartupBanner } from "../src/branding/art";

describe("markdown render", () => {
  test("rend les titres", () => {
    const out = renderMarkdown("# Titre\n## Sous-titre");
    expect(out).toContain("Titre");
    expect(out).toContain("Sous-titre");
  });

  test("rend les listes", () => {
    const out = renderMarkdown("- un\n- deux");
    expect(out).toContain("un");
    expect(out).toContain("deux");
  });

  test("rend le code inline", () => {
    const out = renderMarkdown("Utilisez `readFile`.");
    expect(out).toContain("readFile");
  });
});

describe("diff render", () => {
  test("diff inline colore", () => {
    const out = renderInlineDiff("a\nb\nc", "a\nB\nc");
    expect(out).toContain("+");
    expect(out).toContain("-");
  });
});

describe("art", () => {
  test("renderSeparator non-vide", () => {
    expect(renderSeparator(20).length).toBeGreaterThan(0);
  });

  test("renderStartupBanner contient le nom", () => {
    const banner = renderStartupBanner("MiniMax-M3", "0.2");
    expect(banner).toContain("M  O  L  I");
    expect(banner).toContain("agent de codage CLI");
    expect(banner).toContain("Session active");
  });
});
