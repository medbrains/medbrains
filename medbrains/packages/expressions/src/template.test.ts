import { describe, expect, it } from "vitest";
import { renderTemplate, stripRawExpressions } from "./template";

describe("stripRawExpressions", () => {
  it("forces escaping for triple-stash, ampersand and raw-block forms", () => {
    expect(stripRawExpressions("{{{name}}}")).toBe("{{name}}");
    expect(stripRawExpressions("{{&name}}")).toBe("{{name}}");
    expect(stripRawExpressions("{{{{name}}}}")).toBe("{{name}}");
  });

  it("stays fast on a long run of braces", () => {
    const start = Date.now();
    stripRawExpressions(`${"{".repeat(50_000)}|`);
    expect(Date.now() - start).toBeLessThan(500);
  });
});

describe("renderTemplate", () => {
  it("escapes HTML from a user template that asked for raw output", () => {
    const out = renderTemplate("{{{x}}}", { x: "<script>" });
    expect(JSON.stringify(out)).not.toContain("<script>");
  });
});
