// Reports words STYLE.md bans and Title Case headings in the docs pages.
// Report-only: it prints findings and exits 0, so pages written before the
// style guide do not block a build. `--strict` exits 1 on any finding; switch
// CI to it once the existing pages are clean.
// ponytail: regex word list, not Vale. Move to Vale if the rules need
// per-word exceptions, suggestions or scoping that a list cannot express.
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const DOCS = fileURLToPath(new URL("../docs/", import.meta.url));
const GENERATED = new Set(["developer/reference/api.md", "developer/reference/env-vars.md"]);

// Each rule: a pattern and what to write instead (STYLE.md, "Words to avoid").
const RULES = [
  [/\b(simply|just|easy|easily|obviously|of course|basically|straightforward)\b/i, "cut it, or say what makes the step short"],
  [/\b(for free|free of charge|completely free|totally free)\b/i, "say what it costs: no licence fee, open source"],
  [/\b(seamless(ly)?|effortless(ly)?|world-class|best-in-class|cutting-edge|state-of-the-art|revolutionary|game-chang\w*|blazing(ly)?|next-gen\w*|unparalleled|powerful|amazing|awesome)\b/i, "marketing word: say what it does, with a number if there is one"],
  [/\b(guarantee[sd]?|100% (secure|safe|accurate|uptime)|fully compliant|unhackable|bulletproof)\b/i, "overclaim: state what is checked and how"],
  [/\b(click here|read more|this link)\b/i, "link text must name its target"],
  [/\b(please|in order to|utili[sz]e)\b/i, "filler: cut it, or use 'to' / 'use'"],
];
const COMING_SOON = /coming soon/i;
const DATE = /\b\d{4}-\d{2}(-\d{2})?\b|\b\d+\.\d+\.\d+\b/;
// Words that stay capitalised inside a sentence-case heading.
const SMALL = /^(a|an|the|and|or|of|to|in|on|for|with|by|at|from|vs)$/i;
// Proper nouns keep their capitals; so do acronyms and brands with inner capitals (OS, MedBrains).
const PROPER = /^(Amazon|Web|Services|Microsoft|Azure|Google|Apple|Android|Windows|Linux|Debian|Ubuntu|Docker|Proxmox|Raspberry|Pi|GitHub|PostgreSQL|India)$|^[A-Z][a-z]*[A-Z]/;

/** Every markdown page under docs/, so new folders are checked without a list. */
function pages(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) pages(p, acc);
    else if (/\.mdx?$/.test(name)) acc.push(p);
  }
  return acc;
}

/** True when a heading is Title Case: three or more words, every non-small word capitalised. */
function isTitleCase(heading) {
  const words = heading.replace(/`[^`]*`/g, "").split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
  const checked = words.slice(1).filter((w) => !SMALL.test(w) && !PROPER.test(w));
  return words.length >= 3 && checked.length >= 2 && checked.every((w) => /^[A-Z]/.test(w));
}

/** Findings for one page, skipping front matter, code fences and inline code. */
function checkPage(src) {
  const found = [];
  let inFence = false;
  const body = src.replace(/^---\n[\s\S]*?\n---\n/, (fm) => "\n".repeat(fm.split("\n").length - 1));
  body.split("\n").forEach((raw, i) => {
    if (/^\s*(```|~~~)/.test(raw)) inFence = !inFence;
    if (inFence) return;
    const line = raw.replace(/`[^`]*`/g, "").replace(/\]\([^)]*\)/g, "]");
    for (const [re, fix] of RULES) {
      const m = line.match(re);
      if (m) found.push([i + 1, `"${m[0]}": ${fix}`]);
    }
    if (COMING_SOON.test(line) && !DATE.test(line)) found.push([i + 1, '"coming soon" needs a date or release']);
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h && isTitleCase(h[1])) found.push([i + 1, `heading "${h[1]}" is Title Case; use sentence case`]);
  });
  return found;
}

/** Self-test, so a broken pattern fails loudly instead of reporting nothing. */
function selfTest() {
  const hits = checkPage("# Install The Main Box\nJust run it.\n```\njust code\n```\nComing soon.\nComing in 3.34.0, coming soon.\n").map(([n]) => n);
  if (hits.join() !== "1,2,6") throw new Error(`check-prose self-test failed: ${hits.join()}`);
}

selfTest();
let total = 0;
for (const file of pages(DOCS)) {
  const rel = relative(DOCS, file).split(sep).join("/");
  if (GENERATED.has(rel)) continue;
  for (const [line, msg] of checkPage(readFileSync(file, "utf8").replace(/\r\n/g, "\n"))) {
    console.log(`${rel}:${line}: ${msg}`);
    total += 1;
  }
}
console.log(`prose: ${total} finding(s) (see apps/docs/STYLE.md)`);
if (total && process.argv.includes("--strict")) process.exit(1);
