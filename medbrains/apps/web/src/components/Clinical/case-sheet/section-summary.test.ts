import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { summariseSection } from "./section-summary";

// The server prints the same lines (medbrains-clinical-notes `summary.rs`):
// both read this fixture, so the screen and the paper cannot disagree.
const FIXTURE = join(
  __dirname,
  "../../../../../../crates/medbrains-clinical-notes/fixtures/section-summary.json",
);
const cases: Array<{ name: string; code: string; data: unknown; lines: string[] }> = JSON.parse(
  readFileSync(FIXTURE, "utf8"),
);

describe("summariseSection", () => {
  for (const c of cases) {
    it(c.name, () => {
      expect(summariseSection(c.code, c.data)).toEqual(c.lines);
    });
  }
});
