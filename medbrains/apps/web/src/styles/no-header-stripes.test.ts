import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "..");

/** Every `.module.scss` under `dir`, recursively. */
function scssModules(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return scssModules(full);
    return name.endsWith(".module.scss") ? [full] : [];
  });
}

describe("page command bars", () => {
  it("carry no per-page coloured side stripe in raw Mantine colours", () => {
    // Colour is information, never decoration, and only from --mb-* tokens;
    // a teal, orange or red bar per module is a module rainbow.
    const stripe = /border-left:\s*\d+px solid light-dark\(var\(--mantine-color-/;
    const offenders = scssModules(SRC)
      .filter((file) => stripe.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });
});
