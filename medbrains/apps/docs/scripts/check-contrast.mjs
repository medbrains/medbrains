// Fails the build when a docs colour pair drops below WCAG 2.2 AA (4.5:1 for text):
// every code-block token on its background, and the text tokens in custom.css on both
// surfaces. A theme tweak that reads fine on one screen cannot quietly fail on another.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { light, dark } = require("../src/prism-themes.js");

/** Relative luminance of a #rrggbb colour (WCAG 2.2 definition). */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contrast ratio between two colours. */
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Text tokens from src/css/custom.css: [scheme, foreground, background, what].
const pages = [
  ["light", "#0b1220", "#ffffff", "ink on surface"],
  ["light", "#3c4657", "#f3f5f9", "ink-2 on raised"],
  ["light", "#5d677a", "#ffffff", "muted on surface"],
  ["light", "#0043ce", "#f3f5f9", "link on raised"],
  ["light", "#851b7f", "#ffffff", "accent text on surface"],
  ["light", "#ffffff", "#0f62fe", "white on primary"],
  ["dark", "#e6e8eb", "#111315", "ink on surface"],
  ["dark", "#a9afb7", "#1c1f23", "ink-2 on card"],
  ["dark", "#78a9ff", "#1c1f23", "link on card"],
  ["dark", "#ffabf0", "#17191c", "accent text on raised"],
];
const code = [
  ...Object.entries(light).filter(([k]) => k !== "bg").map(([k, v]) => ["light", v, light.bg, `code ${k}`]),
  ...Object.entries(dark).filter(([k]) => k !== "bg").map(([k, v]) => ["dark", v, dark.bg, `code ${k}`]),
];

const failures = [...pages, ...code]
  .map(([scheme, fg, bg, what]) => ({ scheme, what, fg, bg, r: ratio(fg, bg) }))
  .filter((p) => p.r < 4.5);
if (failures.length) {
  for (const f of failures) console.error(`${f.scheme}: ${f.what} ${f.fg} on ${f.bg} is ${f.r.toFixed(2)}:1, needs 4.5:1`);
  process.exit(1);
}
console.log(`contrast ok: ${pages.length + code.length} pairs at 4.5:1 or more`);
