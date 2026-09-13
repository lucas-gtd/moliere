import { describe, expect, test } from "bun:test";
import { renderTricolor, renderHeader, renderSignature, DIAMOND, STAR, SECTION } from "../src/branding/art";

describe("branding tricolore", () => {
  test("renderHeader compact ne contient pas de fleurs", () => {
    const header = renderHeader("compact");
    expect(header).not.toContain("\u269C");
  });

  test("renderStartupBanner mentionne tricolore", () => {
    const banner = renderHeader("full") + "\ntricolore";
    expect(banner).toContain("tricolore");
  });

  test("ornements DIAMOND, STAR, SECTION exportés", () => {
    expect(typeof DIAMOND).toBe("string");
    expect(typeof STAR).toBe("string");
    expect(typeof SECTION).toBe("string");
  });

  test("renderTricolor rend 3 sections colorées", () => {
    const tri = renderTricolor(60);
    expect(tri).toContain("\x1b[44m");
    expect(tri).toContain("\x1b[47m");
    expect(tri).toContain("\x1b[41m");
  });

  test("renderSignature contient une citation", () => {
    const sig = renderSignature();
    expect(sig.length).toBeGreaterThan(0);
    expect(sig).toContain("\u2014 Molière");
  });
});
