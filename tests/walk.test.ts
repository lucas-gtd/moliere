import { describe, expect, test } from "bun:test";
import { walkFiles } from "../src/tools/walk";

describe("walk", () => {
  test("walkFiles ignore node_modules", async () => {
    const { files, truncated } = await walkFiles("/home/lucas/dev/moliere", {
      includeHidden: false,
      maxFiles: 100,
    });
    expect(files.every((f) => !f.includes("node_modules"))).toBe(true);
    expect(truncated).toBe(false);
  });
});
