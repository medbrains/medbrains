#!/usr/bin/env node
/**
 * Generates the Slint `Tokens` global from the design system's sources, so the native UI and the
 * web app draw from the same files and no colour or size is written by hand.
 *
 *   tokens-to-slint [--spec figma-varspec.json] [--tokens tokens.ts] [--theme mantine.ts] [--out kit/tokens.slint]
 *
 * - Colours: each semantic token of `figma-varspec.json` (`surface/surface`, ...) becomes
 *   `color-<group>-<name>`, light or dark chosen by `Tokens.dark`.
 * - Scale: `space`, `fontSize`, `fontWeight`, `radius` and `letterSpacing` from `tokens.ts`, the
 *   values the Mantine theme is built from (`theme.spacing.md` is `space.md`).
 * - Headings, control heights and breakpoints from `mantine.ts`: `headings.sizes.h1..h6`, the
 *   Input and Button `--*-height` vars, and Mantine's default breakpoints (the theme keeps them).
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const THEME_DIR = path.resolve(HERE, "../../design-system/src/theme");

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

/**
 * Mantine's default breakpoints (https://mantine.dev/theming/responsive/), in px at the 16 px root
 * size. The app theme does not override `breakpoints`, so these are the ones the web uses.
 */
const BREAKPOINTS = { xs: 576, sm: 768, md: 992, lg: 1200, xl: 1408 };

/**
 * Field and button heights per size. The theme sets sm/md/lg for inputs and xs..xl for buttons
 * (`mantine.ts`, Input and Button `vars`); input xs and xl keep Mantine's own 30 px and 60 px.
 */
const MANTINE_INPUT_HEIGHTS = { xs: 30, xl: 60 };

/** `content/onSurfaceVariant` as a Slint name: `content-on-surface-variant`. */
const slintName = (token) =>
  token.replace(/\//g, "-").replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/** Resolves a palette reference (`Site/paper2`) to its hex value; fixed hexes pass through. */
function resolve(palette, ref) {
  if (typeof ref !== "string") return null;
  if (ref.startsWith("#")) return ref;
  return palette.get(ref) ?? null;
}

/** Exported `const name = { key: "value" }` objects of a TS module, as plain string maps. */
function constObjects(source) {
  const ast = parse(source, { sourceType: "module", plugins: ["typescript"] });
  const out = {};
  for (const st of ast.program.body) {
    const decl = (st.type === "ExportNamedDeclaration" ? st.declaration : st)?.declarations?.[0];
    let init = decl?.init;
    while (init && (init.type === "TSAsExpression" || init.type === "TSSatisfiesExpression")) init = init.expression;
    if (init?.type !== "ObjectExpression") continue;
    const obj = {};
    for (const p of init.properties) {
      if (p.value?.type === "StringLiteral") obj[p.key.name ?? p.key.value] = p.value.value;
    }
    out[decl.id.name] = obj;
  }
  return out;
}

/** `rem(fontSize["4xl"])` or `fontWeight.bold` as `["fontSize", "4xl"]`. */
function memberRef(node) {
  if (node?.type === "CallExpression") return memberRef(node.arguments[0]);
  if (node?.type !== "MemberExpression") return null;
  const key = node.property.type === "StringLiteral" ? node.property.value : node.property.name;
  return [node.object.name, key];
}

/** Heading sizes and weights, and the Input/Button heights, from the Mantine theme source. */
function themeScale(source) {
  const ast = parse(source, { sourceType: "module", plugins: ["typescript"] });
  const headings = {};
  const heights = { input: {}, button: {} };
  const visit = (node, owner) => {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "ObjectProperty") {
      const key = node.key.name ?? node.key.value;
      if (/^h[1-6]$/.test(key) && node.value.type === "ObjectExpression") {
        const h = {};
        for (const p of node.value.properties) h[p.key.name] = memberRef(p.value);
        headings[key] = h;
      }
      if (key === "Input" || key === "Button") owner = key.toLowerCase();
      if (key === "heights" && owner) return;
    }
    if (node.type === "VariableDeclarator" && node.id.name === "heights" && owner && node.init?.type === "ObjectExpression") {
      for (const p of node.init.properties) heights[owner][p.key.name ?? p.key.value] = Number.parseFloat(p.value.value);
    }
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach((x) => visit(x, owner));
      else if (v && typeof v.type === "string") visit(v, owner);
    }
  };
  visit(ast.program, null);
  return { headings, heights };
}

const px = (v) => `${Number.parseFloat(v)}px`;
const key = (k) => k.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

export function tokensToSlint(spec, tokensSource = "", themeSource = "") {
  const palette = new Map(spec.P);
  const lines = [
    "// GENERATED by @medbrains/react-to-slint tokens-to-slint from packages/design-system/src/theme",
    "// (figma-varspec.json, tokens.ts, mantine.ts). Do not edit: change the sources and regenerate.",
    "export global Tokens {",
    "    in-out property <bool> dark: false;",
    "    /** Window width, set by the app; responsive props (`hiddenFrom`, `cols={{ base, sm }}`) read it. */",
    "    in-out property <length> viewport-width: 1280px;",
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
  const t = constObjects(tokensSource);
  for (const [k, v] of Object.entries(t.space ?? {})) lines.push(`    out property <length> space-${key(k)}: ${px(v)};`);
  for (const [k, v] of Object.entries(t.fontSize ?? {})) lines.push(`    out property <length> font-${key(k)}: ${px(v)};`);
  for (const [k, v] of Object.entries(t.fontWeight ?? {})) lines.push(`    out property <int> weight-${key(k)}: ${Number.parseInt(v, 10)};`);
  for (const [k, v] of Object.entries(t.radius ?? {})) lines.push(`    out property <length> radius-${key(k)}: ${px(v)};`);
  // Letter spacing is in em in the source; Slint's letter-spacing is a length, so the factor is
  // kept and multiplied by the font size where it is used.
  for (const [k, v] of Object.entries(t.letterSpacing ?? {})) lines.push(`    out property <float> tracking-${key(k)}: ${Number.parseFloat(v)};`);
  const { headings, heights } = themeScale(themeSource);
  for (const [h, def] of Object.entries(headings)) {
    const size = def.fontSize && t[def.fontSize[0]]?.[def.fontSize[1]];
    const weight = def.fontWeight && t[def.fontWeight[0]]?.[def.fontWeight[1]];
    if (size) lines.push(`    out property <length> heading-${h.slice(1)}-size: ${px(size)};`);
    if (weight) lines.push(`    out property <int> heading-${h.slice(1)}-weight: ${Number.parseInt(weight, 10)};`);
  }
  for (const [s, v] of Object.entries({ ...MANTINE_INPUT_HEIGHTS, ...heights.input })) lines.push(`    out property <length> input-height-${s}: ${v}px;`);
  for (const [s, v] of Object.entries(heights.button)) lines.push(`    out property <length> button-height-${s}: ${v}px;`);
  for (const [s, v] of Object.entries(BREAKPOINTS)) lines.push(`    out property <length> breakpoint-${s}: ${v}px;`);
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

function main(argv) {
  const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
  const spec = flag("--spec", path.join(THEME_DIR, "figma-varspec.json"));
  const tokens = flag("--tokens", path.join(THEME_DIR, "tokens.ts"));
  const theme = flag("--theme", path.join(THEME_DIR, "mantine.ts"));
  const out = flag("--out", null);
  const text = tokensToSlint(JSON.parse(fs.readFileSync(spec, "utf8")), fs.readFileSync(tokens, "utf8"), fs.readFileSync(theme, "utf8"));
  if (out) fs.writeFileSync(out, text);
  else process.stdout.write(text);
  return 0;
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(new URL(import.meta.url).pathname)) {
  process.exit(main(process.argv.slice(2)));
}
