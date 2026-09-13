import { describe, expect, test } from "bun:test";
import { parseJsonObject, requireString, optionalString, ToolInputError, truncateText } from "../src/tools/utils";

describe("utils", () => {
  test("parseJsonObject valide", () => {
    expect(parseJsonObject('{"a": 1}')).toEqual({ a: 1 });
  });

  test("parseJsonObject refuse non-objet", () => {
    expect(() => parseJsonObject("[1,2,3]")).toThrow(ToolInputError);
  });

  test("parseJsonObject refuse JSON invalide", () => {
    expect(() => parseJsonObject("nope")).toThrow(ToolInputError);
  });

  test("requireString rejette autre que string", () => {
    expect(() => requireString({ x: 1 }, "x")).toThrow(ToolInputError);
    expect(requireString({ x: "ok" }, "x")).toBe("ok");
  });

  test("requireString rejette null bytes", () => {
    expect(() => requireString({ x: "ab\0c" }, "x")).toThrow(ToolInputError);
  });

  test("optionalString tolère undefined", () => {
    expect(optionalString({}, "x")).toBeUndefined();
    expect(optionalString({ x: "y" }, "x")).toBe("y");
  });

  test("truncateText marque l'omission", () => {
    const result = truncateText("a".repeat(100), 10);
    expect(result).toContain("caractères omis");
  });
});
