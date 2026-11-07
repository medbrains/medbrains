#!/usr/bin/env node
/**
 * Generates the Slint `Tokens` global from the design system's single colour source, so the
 * native UI and the web app draw from the same file and no colour is written by hand.
 *
 *   tokens-to-slint [figma-varspec.json] [--out kit/tokens.slint]
 *
 * Each semantic token (`surface/surface`, `content/onSurfaceVariant`, ...) becomes
 * `color-<group>-<name>` with its light and dark values chosen by `Tokens.dark`. Spacing follows
 * Carbon's 8 px mini-unit and type sizes the 14 px clinical body, as the web theme does.
 */
import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const DEFAULT_SPEC = path.resolve(HERE, "../../design-system/src/theme/figma-varspec.json");

/** Short names the converter emits for Mantine colours, pointing at semantic tokens. */
const ALIASES = {
  "text-muted": "content/onSurfaceVariant",
  text: "content/onSurface",
  primary: "primary/primary",
  danger: "error/error",
  success: "success/success",
  warning: "warning/warning",
  border: "outline/outlineVariant",
  surface: "surface/surface",
  card: "surface/surfaceContainer",
  "surface-lowest": "surface/surfaceContainerLowest",
  accent: "tertiary/tertiaryBrand",
};
const SPACE = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const FONT = { xs: 12, sm: 14, md: 16, lg: 18, xl: 20 };

/** `content/onSurfaceVariant` as a Slint name: `content-on-surface-variant`. */
const slintName = (token) =>
  token.replace(/\//g, "-").replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/** Resolves a palette reference (`Site/paper2`) to its hex value; fixed hexes pass through. */
function resolve(palette, ref) {
  if (typeof ref !== "string") return null;
  if (ref.startsWith("#")) return ref;
  return palette.get(ref) ?? null;
}

export function tokensToSlint(spec) {
  const palette = new Map(spec.P);
  const lines = [
    "// GENERATED from packages/design-system/src/theme/figma-varspec.json by",
    "// @medbrains/react-to-slint tokens-to-slint. Do not edit: change the spec and regenerate.",
    "export global Tokens {",
    "    in-out property <bool> dark: false;",
  ];
  const known = new Set();
  for (const [token, light, dark] of spec.S) {
    const l = resolve(palette, light);
    const d = resolve(palette, dark) ?? l;
    if (!l) continue;
    known.add(token);
    lines.push(`    out property <color> color-${slintName(token)}: root.dark ? ${d} : ${l};`);
  }
  for (const [alias, token] of Object.entries(ALIASES)) {
    if (known.has(token)) lines.push(`    out property <color> color-${alias}: root.color-${slintName(token)};`);
  }
  for (const [k, v] of Object.entries(SPACE)) lines.push(`    out property <length> space-${k}: ${v}px;`);
  for (const [k, v] of Object.entries(FONT)) lines.push(`    out property <length> font-${k}: ${v}px;`);
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

function main(argv) {
  const spec = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--out") ?? DEFAULT_SPEC;
  const out = argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : null;
  const text = tokensToSlint(JSON.parse(fs.readFileSync(spec, "utf8")));
  if (out) fs.writeFileSync(out, text);
  else process.stdout.write(text);
  return 0;
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(new URL(import.meta.url).pathname)) {
  process.exit(main(process.argv.slice(2)));
}
