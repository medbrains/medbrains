/**
 * What a Slint element accepts: its properties with their types, its callbacks, whether it takes
 * children and whether it carries an accessible role.
 *
 * Builtin elements and std-widgets come from the official reference (`slint-reference.json`);
 * kit components (`Mb*`) are read from the kit's own `.slint` source, following `inherits`, so
 * the converter writes exactly the properties a component declares, with their declared types.
 */
import fs from "node:fs";
import path from "node:path";
import { REFERENCE } from "./values.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
export const KIT_DIR = path.resolve(HERE, "../preview");

/** Builtin elements that lay out or hold children. */
const CONTAINERS = new Set(["VerticalLayout", "HorizontalLayout", "GridLayout", "FlexboxLayout", "Rectangle", "TouchArea", "FocusScope", "ScrollView", "Flickable", "Window", "PopupWindow"]);
/** Layouts are not items: they have no accessibility, opacity, or visibility properties. */
const LAYOUTS = new Set(["VerticalLayout", "HorizontalLayout", "GridLayout", "FlexboxLayout"]);
/** Common properties a layout does accept (geometry and stretch). */
const LAYOUT_COMMON = new Set(["x", "y", "width", "height", "min-width", "min-height", "max-width", "max-height", "preferred-width", "preferred-height", "horizontal-stretch", "vertical-stretch", "cross-axis-self-alignment"]);

/** Every `component Name inherits Base { ... }` of a `.slint` source, with its own declarations. */
export function parseKit(source) {
  const out = new Map();
  const re = /(?:export\s+)?component\s+(\w+)\s+inherits\s+(\w+)\s*\{/g;
  let m;
  while ((m = re.exec(source))) {
    let depth = 1;
    let i = re.lastIndex;
    const start = i;
    for (; i < source.length && depth; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") depth -= 1;
    }
    const body = source.slice(start, i - 1);
    // Only depth-1 declarations belong to the component; nested elements declare their own.
    let level = 0;
    let top = "";
    for (const ch of body) {
      if (ch === "{") level += 1;
      if (level === 0) top += ch;
      if (ch === "}") level -= 1;
    }
    const properties = {};
    for (const p of top.matchAll(/(in-out|in|out|private)?\s*property\s*<([^>]+(?:>\])?)>\s*([\w-]+)/g)) {
      if (p[1] !== "private" && p[1] !== "out" && p[1]) properties[p[3]] = { type: p[2].trim(), dir: p[1] };
      else if (!p[1]) properties[p[3]] = { type: p[2].trim(), dir: "private" };
    }
    const callbacks = {};
    for (const c of top.matchAll(/callback\s+([\w-]+)\s*(\(([^)]*)\))?/g)) callbacks[c[1]] = c[3] ?? "";
    out.set(m[1], {
      base: m[2],
      properties,
      callbacks,
      children: /@children/.test(body),
      role: /accessible-role\s*:/.test(top),
    });
  }
  return out;
}

/** Loads the type information for builtins plus every kit file in `dir`. */
export function loadTypes(dir = KIT_DIR) {
  const kit = new Map();
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".slint")).sort()) {
      for (const [k, v] of parseKit(fs.readFileSync(path.join(dir, f), "utf8"))) kit.set(k, v);
    }
  }
  const memo = new Map();
  /** `{ properties, callbacks, children, role, layout, known }` for an element name. */
  const describe = (name, trail = new Set()) => {
    if (memo.has(name)) return memo.get(name);
    let info;
    if (kit.has(name) && !trail.has(name)) {
      trail.add(name);
      const own = kit.get(name);
      const base = describe(own.base, trail);
      info = {
        properties: { ...base.properties, ...own.properties },
        callbacks: { ...base.callbacks, ...own.callbacks },
        children: own.children || (base.children && !own.children && LAYOUTS.has(own.base)),
        role: own.role || base.role,
        layout: false,
        known: true,
        kit: true,
      };
      // A component inheriting a layout or Rectangle with no @children of its own still takes
      // children: they are placed by the base.
      if (!own.children && CONTAINERS.has(own.base)) info.children = true;
    } else {
      const el = REFERENCE.elements[name];
      const layout = LAYOUTS.has(name);
      const common = Object.fromEntries(Object.entries(REFERENCE.common.properties).filter(([k]) => !layout || LAYOUT_COMMON.has(k)));
      info = {
        properties: { ...common, ...(el?.properties ?? {}) },
        callbacks: { ...(el?.callbacks ?? {}) },
        children: CONTAINERS.has(name),
        role: ["Image", "Text"].includes(name) ? false : Boolean(el) && !layout && !["Rectangle", "TouchArea", "FocusScope", "Flickable", "Window", "PopupWindow", "Path"].includes(name),
        layout,
        known: Boolean(el),
        doc: el?.doc,
      };
    }
    memo.set(name, info);
    return info;
  };
  return { describe, kit };
}
