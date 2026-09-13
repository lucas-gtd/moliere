import { describe, expect, test } from "bun:test";
import path from "node:path";
import { walkFiles } from "../src/tools/walk";

const projectRoot = path.resolve(import.meta.dirname, "..");

describe("walk", () => {
  test("walkFiles ignore node_modules", async () => {
    const { files, truncated } = await walkFiles(projectRoot, {
      includeHidden: false,
      maxFiles: 100,
    });
    expect(files.every((f) => !f.includes("node_modules"))).toBe(true);
    expect(truncated).toBe(false);
  });
});
