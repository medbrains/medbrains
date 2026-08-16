/**
 * Surfaces must come from tokens, not from a literal colour.
 *
 * This exists because of a bug that reached a clinician's screen: the patient
 * context banner painted `background: #fff`, so in dark mode the app's own
 * text colour (`#F5F5F7`) landed on a hardcoded white card and the patient's
 * name — the one element on an encounter that says who is being treated —
 * rendered near-white on white and disappeared. Measured contrast was 1.0:1.
 *
 * The prescription suite had the same disease in a worse form: it declared a
 * private palette of ~20 hardcoded Carbon hexes and built ~100 rules on it, so
 * the whole rx sheet was a light-only island regardless of the scheme.
 *
 * A literal is only safe on a surface that genuinely does not follow the
 * scheme. Three kinds qualify and are listed below. Everything else must go
 * through `--mb-*`, which is defined for both schemes.
 *
 * Notably this is *not* a rule about dark mode being supported — it is a rule
 * about a surface and the text on it agreeing about which scheme they are in.
 * Half-following the theme is worse than not following it: an all-light app is
 * readable, an all-dark app is readable, and a light card under dark text is
 * an invisible patient name.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { glob } from "tinyglobby";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");

/**
 * Surfaces that are legitimately fixed to one colour, with the reason.
 *
 * Kept as an explicit list rather than a pattern so that adding one is a
 * decision someone writes down, not a filename that happens to match.
 */
const ALLOWED = new Map<string, string>([
  [
    "components/DocumentPreview/document-renderer.module.scss",
    "simulates paper — a printed discharge summary is white in any theme",
  ],
]);

/** A literal colour, as opposed to `var(--mb-…)`. */
const LITERAL_BACKGROUND =
  /^\s*background(-color)?:\s*(#[0-9a-fA-F]{3,8}|white|black|rgba?\([^)]*\))\s*;/;

/**
 * Colours that carry meaning rather than elevation are exempt.
 *
 * `rgba(…, 0.06)` overlays tint whatever is beneath them, so they adapt for
 * free. The emergency codes are fixed by policy — code blue is the same blue
 * on every deployment, which is the entire point of a code — and `transparent`
 * is not a surface at all.
 */
function isExempt(declaration: string): boolean {
  // A per-line opt-out, which has to state why. Better than a file-level
  // allowlist: the justification sits on the line it excuses, so a reviewer
  // sees it, and it dies with the rule instead of outliving it.
  if (/\/\/\s*scheme-fixed:\s*\S/.test(declaration)) {
    return true;
  }
  const value = declaration.split(":").slice(1).join(":").trim();
  if (value.startsWith("transparent") || value.startsWith("none")) {
    return true;
  }
  // Translucent overlays inherit the scheme from whatever is behind them.
  const alpha = value.match(/rgba\([^)]*,\s*(0?\.\d+)\s*\)/);
  return alpha !== null && Number(alpha[1]) < 0.5;
}

async function stylesheets(): Promise<string[]> {
  return glob(["**/*.module.scss"], { cwd: SRC });
}

/** Declarations inside `@media print` are print styles and never themed. */
function stripPrintBlocks(source: string): string {
  const out: string[] = [];
  let depth = 0;
  let printDepth = -1;
  for (const line of source.split("\n")) {
    if (printDepth === -1 && /@media\s+print/.test(line)) {
      printDepth = depth;
    }
    depth += (line.match(/{/g) ?? []).length - (line.match(/}/g) ?? []).length;
    if (printDepth === -1) {
      out.push(line);
    } else if (depth <= printDepth) {
      printDepth = -1;
      out.push("");
    } else {
      out.push("");
    }
  }
  return out.join("\n");
}

describe("surfaces follow the colour scheme", () => {
  it("no stylesheet pins a background to a literal colour", async () => {
    const offenders: string[] = [];

    for (const file of await stylesheets()) {
      if (ALLOWED.has(file)) {
        continue;
      }
      const source = stripPrintBlocks(readFileSync(join(SRC, file), "utf8"));
      source.split("\n").forEach((line, index) => {
        if (LITERAL_BACKGROUND.test(line) && !isExempt(line)) {
          offenders.push(`${file}:${index + 1}  ${line.trim()}`);
        }
      });
    }

    // Listed in full rather than counted: a count tells you the ratchet
    // slipped, the list tells you which patient screen broke.
    expect(offenders).toEqual([]);
  });

  it("keeps a reason on file for every surface that opts out", () => {
    for (const [file, reason] of ALLOWED) {
      expect(reason.length, `${file} needs a real reason, not a placeholder`).toBeGreaterThan(20);
    }
  });

  /**
   * The specific regression. `.detail` is the encounter header that lost the
   * patient's name; asserting on it by name means a future refactor that
   * reintroduces a literal there fails on the bug, not just on the rule.
   */
  it("the patient context banner draws its surface from a token", () => {
    const source = readFileSync(
      join(SRC, "components/Patient/PatientContextBanner.module.scss"),
      "utf8",
    );
    const surfaces = [...source.matchAll(/^\s*background:\s*(.+);/gm)].map((m) => m[1]);
    expect(surfaces.length).toBeGreaterThan(0);
    for (const surface of surfaces) {
      expect(surface).toMatch(/var\(--mb-/);
    }
  });

  /**
   * The rx suite's private palette. Every entry must resolve to a token — a
   * hardcoded hex there re-pins ~100 downstream rules at once, which is how
   * the whole prescription sheet went light-only in the first place.
   */
  it("the prescription suite's local palette resolves to tokens", () => {
    const source = readFileSync(
      join(SRC, "features/prescription/prescription.module.scss"),
      "utf8",
    );
    const block = source.slice(source.indexOf(".suite {"), source.indexOf("\n}"));
    const literals = [...block.matchAll(/^\s*(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/gm)].map(
      (m) => `${m[1]}: ${m[2]}`,
    );
    expect(literals).toEqual([]);
  });
});
