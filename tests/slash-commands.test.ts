import { describe, expect, test } from "bun:test";
import { visibleCommands } from "../src/commands/registry";

describe("slash commands", () => {
  test("toutes les commandes principales existent", () => {
    const names = visibleCommands().map((c) => c.name);
    for (const expected of [
      "help",
      "clear",
      "exit",
      "status",
      "config",
      "model",
      "theme",
      "permissions",
      "plan",
      "unplan",
      "compact",
      "init",
      "doctor",
      "sessions",
      "agents",
      "save",
    ]) {
      expect(names).toContain(expected);
    }
  });

  test("filtre par préfixe", () => {
    const filtered = visibleCommands().filter((c) => c.name.startsWith("mod"));
    expect(filtered.some((c) => c.name === "model")).toBe(true);
  });

  test("Tab complète au premier match", () => {
    const query = "mo";
    const matches = visibleCommands().filter((c) => c.name.startsWith(query));
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.name).toBe("model");
  });
});
