/**
 * Value conversion, directed by the Slint type of the property being written.
 *
 * Every function here takes a JavaScript AST value and the Slint type the target property
 * declares (from `slint-reference.json` or the kit's own declarations) and returns either
 * `{ code }`, a Slint expression of exactly that type, or `{ drop }`, the reason no equivalent
 * exists. Nothing is guessed from a property's name. The rules are documented row by row in
 * docs/CONVERSIONS.md.
 */
import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const CSS_VARS = JSON.parse(fs.readFileSync(path.join(HERE, "css-vars.json"), "utf8")).vars;
export const REFERENCE = JSON.parse(fs.readFileSync(path.join(HERE, "slint-reference.json"), "utf8"));

/** Theme size keys Mantine resolves through `theme.spacing` / `theme.fontSizes` (tokens.ts). */
export const SIZE_KEYS = new Set(["3xs", "2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl"]);
/** Mantine breakpoints, in the order a responsive object is resolved (mobile first). */
export const BREAKPOINTS = ["xs", "sm", "md", "lg", "xl"];
/** Mantine's rem() divides by 16: a number or `Nrem` is that many 16 px units at the default root size. */
const REM = 16;

/** Which theme scale a length property reads when given a size key. */
const LENGTH_SCALE = {
  "font-size": "font",
  "letter-spacing": null,
};

/** A Slint string literal. */
export const quote = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;

/**
 * A CSS length as a Slint length. Numbers are px (Mantine converts them with rem(n/16), which is
 * n px at the 16 px root); `Npx`, `Nrem`, `Nem` (relative to 16 px) and `N%` keep their meaning;
 * a theme key (`md`) reads the theme scale for that property (spacing for gaps and padding,
 * font sizes for `font-size`). `auto`, `calc()`, viewport units and CSS variables have no
 * Slint length and are dropped with the reason.
 */
export function lengthOf(value, target) {
  if (typeof value === "number") return { code: `${value}px` };
  const v = String(value).trim();
  if (SIZE_KEYS.has(v)) {
    const scale = target in LENGTH_SCALE ? LENGTH_SCALE[target] : "space";
    return scale ? { code: `Tokens.${scale}-${v}` } : { drop: `theme key "${v}" has no ${target} scale` };
  }
  let m = v.match(/^(-?\d*\.?\d+)px$/);
  if (m) return { code: `${Number(m[1])}px` };
  m = v.match(/^(-?\d*\.?\d+)r?em$/);
  if (m) return { code: `${Number(m[1]) * REM}px` };
  m = v.match(/^(\d*\.?\d+)%$/);
  if (m && ["width", "height", "min-width", "min-height", "max-width", "max-height"].includes(target)) return { code: `${Number(m[1])}%` };
  if (/^-?\d*\.?\d+$/.test(v)) return { code: `${Number(v)}px` };
  return { drop: `CSS length "${v}" has no Slint length (auto, calc(), vh/vw and var() are web-only)` };
}

/**
 * A colour as a Tokens brush. Mantine resolves `c="red"` to `var(--mantine-color-red-text)`,
 * `color="red"` on filled parts to `-filled`, `red.6` to `--mantine-color-red-6`, and `dimmed`
 * to `--mantine-color-dimmed`; each variable maps to the semantic token with the same light
 * and dark value (css-vars.json, measured from the built web app). A colour with no such token
 * is dropped, never approximated.
 */
export function colorOf(value, role = "text") {
  const v = String(value).trim();
  if (/^(inherit|currentColor|transparent)$/.test(v)) return { drop: `"${v}" keeps the kit's own colour` };
  const varMatch = v.match(/^var\((--[a-z0-9-]+)\)$/);
  const candidates = [];
  if (varMatch) candidates.push(varMatch[1]);
  else if (/^#|^rgb/.test(v)) return { drop: `raw colour ${v}: colours come only from Tokens` };
  else {
    const [name, shade] = v.split(".");
    if (name === "dimmed") candidates.push("--mantine-color-dimmed");
    if (shade) candidates.push(`--mantine-color-${name}-${shade}`);
    candidates.push(`--mantine-color-${name}-${role}`, `--mantine-color-${name}-text`, `--mantine-color-${name}-filled`);
  }
  for (const c of candidates) if (CSS_VARS[c]) return { code: `Tokens.${CSS_VARS[c]}` };
  return { drop: `colour "${v}" has no token with the same light and dark value` };
}

/** CSS values to Slint enum values, per Slint enum (builtin-enums reference). */
const ENUM_FROM_CSS = {
  LayoutAlignment: { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "space-between", "space-around": "space-around", "space-evenly": "space-evenly", stretch: "stretch" },
  CrossAxisAlignment: { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", stretch: "stretch" },
  TextHorizontalAlignment: { left: "left", center: "center", right: "right", start: "start", end: "end" },
  TextVerticalAlignment: { top: "top", center: "center", bottom: "bottom" },
  ImageFit: { fill: "fill", contain: "contain", cover: "cover", none: "preserve" },
  InputType: { text: "text", password: "password", number: "number", search: "search", email: "text", tel: "text", url: "text" },
  Orientation: { horizontal: "horizontal", vertical: "vertical" },
  TextWrap: { wrap: "word-wrap", nowrap: "no-wrap" },
};

/** A CSS keyword as the Slint enum value of `type`, checked against the reference. */
export function enumOf(type, value) {
  const v = String(value);
  const mapped = ENUM_FROM_CSS[type]?.[v] ?? v;
  // Qualified, so a component property with the same name (`start`) cannot shadow the value.
  if (REFERENCE.enums[type]?.includes(mapped)) return { code: `${type}.${mapped}` };
  return { drop: `"${v}" is not a ${type} value (${(REFERENCE.enums[type] ?? []).join(", ")})` };
}

/** A font weight: a number, or a CSS keyword. */
export function weightOf(value) {
  const named = { normal: 400, bold: 700, lighter: 300, bolder: 700 };
  const n = typeof value === "number" ? value : named[value] ?? Number(value);
  return Number.isFinite(n) ? { code: String(n) } : { drop: `font weight "${value}"` };
}

/** True for Slint types that are one of the builtin enums. */
export const isEnum = (type) => Boolean(REFERENCE.enums[type]);

/**
 * A literal JavaScript value (string, number, boolean, or a responsive object of them) from an
 * AST node, or undefined when the value is only known at run time.
 */
export function staticValue(node) {
  if (!node) return undefined;
  if (node.type === "StringLiteral" || node.type === "NumericLiteral" || node.type === "BooleanLiteral") return node.value;
  if (node.type === "UnaryExpression" && node.operator === "-" && node.argument.type === "NumericLiteral") return -node.argument.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked;
  if (node.type === "JSXExpressionContainer") return staticValue(node.expression);
  if (node.type === "TSAsExpression") return staticValue(node.expression);
  if (node.type === "ObjectExpression" && node.properties.every((p) => p.type === "ObjectProperty" && BREAKPOINTS.concat("base").includes(p.key.name ?? p.key.value))) {
    const out = {};
    for (const p of node.properties) {
      const v = staticValue(p.value);
      if (v === undefined) return undefined;
      out[p.key.name ?? p.key.value] = v;
    }
    return { responsive: out };
  }
  return undefined;
}

/**
 * A responsive value (`{ base: 1, sm: 2 }`) as one Slint expression on the window width: the
 * largest breakpoint the width reaches wins, as Mantine's min-width media queries do.
 */
export function responsive(obj, convert) {
  const steps = [];
  for (const bp of BREAKPOINTS) if (bp in obj.responsive) steps.push([bp, convert(obj.responsive[bp])]);
  const base = "base" in obj.responsive ? convert(obj.responsive.base) : null;
  const failed = [base, ...steps.map((s) => s[1])].find((r) => r?.drop);
  if (failed) return failed;
  let code = base?.code ?? steps[0]?.[1].code;
  for (const [bp, r] of steps) code = `(Tokens.viewport-width >= Tokens.breakpoint-${bp} ? ${r.code} : ${code})`;
  return { code };
}

/** A static value converted to a Slint expression of `type`. */
export function convertStatic(type, value, target) {
  if (value && typeof value === "object" && value.responsive) return responsive(value, (v) => convertStatic(type, v, target));
  if (type === "length" || type === "physical-length") return lengthOf(value, target);
  if (type === "int") return Number.isInteger(Number(value)) && value !== "" ? { code: String(Math.trunc(Number(value))) } : { drop: `"${value}" is not an int` };
  if (type === "float") return Number.isFinite(Number(value)) && value !== "" ? { code: String(Number(value)) } : { drop: `"${value}" is not a number` };
  if (type === "bool") return typeof value === "boolean" ? { code: String(value) } : { drop: `"${value}" is not a bool` };
  if (type === "string") return { code: quote(value) };
  if (type === "brush" || type === "color") return colorOf(value);
  if (type === "duration") return Number.isFinite(Number(value)) ? { code: `${Number(value)}ms` } : { drop: `duration "${value}"` };
  if (isEnum(type)) return enumOf(type, value);
  return { drop: `a literal cannot be a ${type}` };
}
