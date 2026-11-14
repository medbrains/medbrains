/**
 * `className={classes.x}` from a CSS module, as Slint properties.
 *
 * The web styles many layouts through `*.module.scss`. Only declarations with a Slint layout or
 * token equivalent convert: sizes, flex grow, gaps, padding, alignment, token colours, font size
 * and weight, text transform, and a left accent rule on cards. Everything else (shadows,
 * transitions, positioning, selectors other than a plain `.class`, media queries) is reported,
 * declaration by declaration. Rules are documented in docs/CONVERSIONS.md.
 */
import fs from "node:fs";
import path from "node:path";
import { colorOf, lengthOf } from "./values.mjs";

const cache = new Map();

/** Top-level `.class { prop: value; }` rules of an SCSS file, `class -> { prop: value }`. */
export function parseModule(file) {
  if (cache.has(file)) return cache.get(file);
  const out = new Map();
  if (!fs.existsSync(file)) return out;
  const src = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf("{", i);
    if (open < 0) break;
    const selector = src.slice(i, open).trim().split(";").pop().trim();
    let depth = 1;
    let j = open + 1;
    for (; j < src.length && depth; j += 1) {
      if (src[j] === "{") depth += 1;
      else if (src[j] === "}") depth -= 1;
    }
    const body = src.slice(open + 1, j - 1);
    // Declarations of this rule only: nested blocks (&:hover, children, media) are left out.
    let level = 0;
    let top = "";
    for (const c of body) {
      if (c === "{") level += 1;
      if (level === 0 && c !== "}") top += c;
      if (c === "}") level -= 1;
    }
    const decls = {};
    for (const d of top.split(";")) {
      const m = d.match(/^\s*([a-z-]+)\s*:\s*([^;{}]+?)\s*$/s);
      if (m) decls[m[1]] = m[2].replace(/\s+/g, " ");
    }
    for (const sel of selector.split(",").map((s) => s.trim())) {
      const cls = sel.match(/^\.([A-Za-z_][\w-]*)$/);
      if (cls) out.set(cls[1], { ...(out.get(cls[1]) ?? {}), ...decls });
    }
    i = j;
  }
  cache.set(file, out);
  return out;
}

/** The CSS module files a source imports: `local name -> absolute path`. */
export function moduleImports(program, absFile) {
  const out = new Map();
  if (!absFile) return out;
  for (const st of program.body) {
    if (st.type !== "ImportDeclaration" || !/\.module\.s?css$/.test(st.source.value)) continue;
    const spec = st.specifiers.find((s) => s.type === "ImportDefaultSpecifier" || s.type === "ImportNamespaceSpecifier");
    if (spec) out.set(spec.local.name, path.resolve(path.dirname(absFile), st.source.value));
  }
  return out;
}

/** The `{ module, class }` names a className expression refers to, statically. */
export function classRefs(expr) {
  const refs = [];
  const visit = (n) => {
    if (!n) return;
    if (n.type === "MemberExpression" && n.object.type === "Identifier" && !n.computed) refs.push({ module: n.object.name, cls: n.property.name });
    else if (n.type === "MemberExpression" && n.computed && n.property.type === "StringLiteral") refs.push({ module: n.object.name, cls: n.property.value });
    else if (n.type === "TemplateLiteral") n.expressions.forEach(visit);
    else if (n.type === "CallExpression") n.arguments.forEach(visit);
    else if (n.type === "ConditionalExpression") visit(n.consequent);
    else if (n.type === "LogicalExpression") visit(n.right);
  };
  visit(expr);
  return refs;
}

/** A CSS value with Mantine/theme variables resolved to Slint tokens, or null. */
function cssLength(value, target) {
  const v = value.trim();
  const sp = v.match(/^var\(--mantine-spacing-([a-z0-9]+)\)$/);
  if (sp) return { code: `Tokens.space-${sp[1]}` };
  const fz = v.match(/^var\(--mantine-font-size-([a-z0-9]+)\)$/);
  if (fz) return { code: `Tokens.font-${fz[1]}` };
  return lengthOf(v, target);
}

/** `light-dark(a, b)` resolves to its light value: the dark one must map to the same token. */
const lightOf = (v) => v.replace(/^light-dark\(\s*([^,]+),[\s\S]*\)$/, "$1").trim();

const ALIGN = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "space-between", "space-around": "space-around", "space-evenly": "space-evenly", stretch: "stretch" };

/**
 * The Slint bindings for one class's declarations on an element described by `info`, with the
 * layout axis of its parent (`row` or `column`). Returns `{ set: [[prop, code]], wrap, notes }`.
 */
export function cssBindings(decls, info, axis) {
  const set = [];
  const notes = [];
  const wrap = {};
  const has = (p) => Boolean(info.properties[p]);
  const add = (p, r, css) => {
    if (r?.code && has(p)) set.push([p, r.code]);
    else notes.push(`${css} (${r?.drop ?? `no ${p} here`})`);
  };
  for (const [prop, raw] of Object.entries(decls)) {
    const value = raw.replace(/\s*!important$/, "");
    const css = `${prop}: ${value}`;
    if (["width", "height", "min-width", "max-width", "min-height", "max-height"].includes(prop)) {
      const capped = value.match(/^min\(\s*([\d.]+(?:px|rem))\s*,\s*100%\s*\)$/);
      if (capped && prop === "width") {
        add("max-width", lengthOf(capped[1], "max-width"), css);
        if (axis === "row") set.push(["horizontal-stretch", "1"]);
        continue;
      }
      if (value === "100%" && prop === "width") {
        if (axis === "row") set.push(["horizontal-stretch", "1"]);
        continue;
      }
      add(prop, cssLength(value, prop), css);
      continue;
    }
    if (prop === "flex" || prop === "flex-grow") {
      const grow = Number.parseFloat(value);
      if (Number.isFinite(grow)) set.push([axis === "row" ? "horizontal-stretch" : "vertical-stretch", String(grow)]);
      else notes.push(`${css} (flex value)`);
      continue;
    }
    if (prop === "gap" || prop === "row-gap" || prop === "column-gap") {
      add(prop === "gap" ? "spacing" : prop === "row-gap" ? "spacing-vertical" : "spacing-horizontal", cssLength(value, "spacing"), css);
      continue;
    }
    if (prop === "padding") {
      const parts = value.split(/\s+/).map((p) => cssLength(p, "padding"));
      if (parts.some((p) => p.drop) || !has("padding")) {
        notes.push(`${css} (${parts.find((p) => p.drop)?.drop ?? "no padding here"})`);
        continue;
      }
      const [t, r = t, b = t, l = r] = parts.map((p) => p.code);
      set.push(["padding-top", t], ["padding-right", r], ["padding-bottom", b], ["padding-left", l]);
      continue;
    }
    if (/^padding-(top|right|bottom|left)$/.test(prop)) {
      add(prop, cssLength(value, prop), css);
      continue;
    }
    if (prop === "justify-content") {
      add("alignment", ALIGN[value] ? { code: `LayoutAlignment.${ALIGN[value]}` } : { drop: "no LayoutAlignment value" }, css);
      continue;
    }
    if (prop === "align-items") {
      add("cross-axis-alignment", ALIGN[value] && value !== "space-between" ? { code: `CrossAxisAlignment.${ALIGN[value]}` } : { drop: "no CrossAxisAlignment value" }, css);
      continue;
    }
    if (prop === "background" || prop === "background-color") {
      const r = colorOf(lightOf(value), "filled");
      if (r.code && !has("background")) wrap.background = r.code;
      else add("background", r, css);
      continue;
    }
    if (prop === "color") {
      add("color", colorOf(lightOf(value)), css);
      continue;
    }
    if (prop === "font-size") {
      add("font-size", cssLength(value, "font-size"), css);
      continue;
    }
    if (prop === "font-weight") {
      add("font-weight", /^\d+$/.test(value) ? { code: value } : value === "bold" ? { code: "700" } : { drop: "weight" }, css);
      continue;
    }
    if (prop === "text-transform") {
      if (value === "uppercase" || value === "lowercase") wrap.transform = `to-${value}`;
      else notes.push(`${css} (only upper and lower case)`);
      continue;
    }
    if (prop === "border-left") {
      const m = value.match(/^([\d.]+px)\s+solid\s+(.+)$/);
      const color = m ? colorOf(lightOf(m[2])) : { drop: "border shorthand" };
      if (m && has("accent-width") && color.code) set.push(["accent-width", m[1]], ["accent-color", color.code]);
      else notes.push(`${css} (${color.drop ?? "no accent rule here"})`);
      continue;
    }
    if (prop === "display" && value === "none") {
      wrap.hidden = true;
      continue;
    }
    notes.push(`${css} (no Slint equivalent)`);
  }
  return { set, wrap, notes };
}
