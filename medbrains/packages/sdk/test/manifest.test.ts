import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateManifest } from "../src/manifest.js";

const FIXTURES = join(__dirname, "../../../docs/extensions/fixtures");
const load = (dir: string) =>
  readdirSync(join(FIXTURES, dir))
    .filter((f) => f.endsWith(".json"))
    .map((f) => [f, JSON.parse(readFileSync(join(FIXTURES, dir, f), "utf8"))] as const);

describe("manifest validation agrees with the server (shared fixtures)", () => {
  it.each(load("valid"))("%s is valid", (_, raw) => {
    expect(validateManifest(raw)).toEqual([]);
  });

  it.each(load("invalid"))("%s is refused for its stated reason", (_, raw) => {
    const { $expect, $serverOnly, ...manifest } = raw as Record<string, unknown>;
    if ($serverOnly) return; // event names are checked by the server, not offline
    expect(validateManifest(manifest).some((e) => e.includes(String($expect)))).toBe(true);
  });

  it("the CLI template is a valid manifest", () => {
    const raw = JSON.parse(readFileSync(join(__dirname, "../template/medbrains.manifest.json"), "utf8"));
    expect(validateManifest(raw)).toEqual([]);
  });
});
