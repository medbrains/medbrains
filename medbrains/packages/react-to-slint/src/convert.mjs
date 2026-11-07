/**
 * Converts React + Mantine screens into Slint views, and counts what could not be mapped.
 *
 * Each JSX element is converted by the rule for its tag in `mapping.json`. Every value is written
 * with the type the Slint property declares (`slint-types.mjs`), Mantine's own default props are
 * applied first (`mantine-defaults.json`), and anything with no Slint equivalent is dropped with
 * a reason written into the file and counted in the report. Logic that has to live in Rust
 * (effects, queries, refs, browser APIs) is marked `// rust:` and counted, never left out
 * silently. The rules are documented in docs/CONVERSIONS.md.
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import { classRefs, cssBindings, moduleImports, parseModule } from "./css-modules.mjs";
import { iconFile } from "./icons.mjs";
import { loadTypes } from "./slint-types.mjs";
import { colorOf, convertStatic, isEnum, lengthOf, quote, staticValue, toneOf, weightOf } from "./values.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
export const DEFAULTS = JSON.parse(fs.readFileSync(path.join(HERE, "mantine-defaults.json"), "utf8"));

/**
 * English text for translation keys, from the web app's own language files, flattened to
 * `ns.key` and `key` so `t("rxQueue.title")` finds its sentence. Slint's @tr uses that sentence
 * as the message id, so other languages come from the same files.
 */
export function loadStrings(dir) {
  const strings = new Map();
  if (!dir || !fs.existsSync(dir)) return strings;
  const walk = (obj, prefix, ns) => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string") {
        if (!strings.has(key)) strings.set(key, v);
        strings.set(`${ns}:${key}`, v);
      } else if (v && typeof v === "object") walk(v, key, ns);
    }
  };
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    walk(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")), "", f.replace(/\.json$/, ""));
  }
  return strings;
}

/** Flattens `mapping.json` into `tag -> rule`, plus the dropped wrappers and the style props. */
export function loadMapping(file = path.join(HERE, "mapping.json")) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const rules = {};
  for (const [group, entries] of Object.entries(raw)) {
    if (group.startsWith("_") || ["dropped", "version", "html", "webOnly", "styleProps", "commonProps", "rust"].includes(group)) continue;
    Object.assign(rules, entries);
  }
  return {
    rules,
    html: raw.html ?? {},
    webOnly: new Set(raw.webOnly ?? []),
    dropped: new Set(raw.dropped),
    styleProps: raw.styleProps ?? {},
    commonProps: raw.commonProps ?? {},
    rust: raw.rust ?? {},
    version: raw.version,
    types: loadTypes(),
  };
}

/** Names a generated component inherits from its base, so a property may not take them. */
const RESERVED = new Set([
  "x", "y", "z", "width", "height", "color", "background", "border-color", "border-width",
  "border-radius", "opacity", "visible", "clip", "text", "padding", "spacing", "enabled", "alignment",
  "absolute-position", "min-width", "max-width", "min-height", "max-height", "drop-shadow-color",
  "accessible-label", "accessible-role", "accessible-description", "accessible-value", "item", "root", "self", "parent",
  "padding-left", "padding-right", "padding-top", "padding-bottom", "cross-axis-alignment", "preferred-width", "preferred-height",
  "horizontal-stretch", "vertical-stretch", "row", "col", "rowspan", "colspan", "init", "changed", "if", "for", "in", "out", "property", "callback", "states", "animate",
]);

/** Our components that wrap behaviour rather than draw: rendered as their children. */
const WRAPPER = /(Provider|Boundary|Guard|Gate|Context|Mount)$/;

/** A Slint identifier for a JavaScript expression, unique within one component. */
export function ident(text, used) {
  let base = text.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "value";
  if (/^[0-9]/.test(base) || RESERVED.has(base)) base = `v-${base}`;
  base = base.slice(0, 40).replace(/-+$/, "");
  let name = base;
  for (let i = 2; used.has(name); i += 1) name = `${base}-${i}`;
  used.add(name);
  return name;
}

/**
 * JSX text as React renders it: lines are trimmed where they meet a line break, blank lines go,
 * and the rest join with one space, so `Due {n} today` keeps its spaces and indentation does not.
 */
export function jsxText(value) {
  const lines = value.replace(/\t/g, " ").split(/\r?\n/);
  const kept = [];
  lines.forEach((line, i) => {
    let s = line;
    if (i > 0) s = s.replace(/^ +/, "");
    if (i < lines.length - 1) s = s.replace(/ +$/, "");
    if (s) kept.push(s);
  });
  return kept.join(" ");
}

const isJsx = (n) => n && (n.type === "JSXElement" || n.type === "JSXFragment");
const unwrap = (n) => (n?.type === "ParenthesizedExpression" || n?.type === "TSAsExpression" || n?.type === "TSNonNullExpression" ? unwrap(n.expression) : n);
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/** The JSX tag name as written: `Button`, `Table.Td`, `div`. */
export function tagName(name) {
  if (name.type === "JSXIdentifier") return name.name;
  if (name.type === "JSXMemberExpression") return `${tagName(name.object)}.${name.property.name}`;
  return "";
}

/** Generic walk over an AST subtree, not entering nested functions when `shallow`. */
function walk(node, fn, shallow = false, top = true) {
  if (!node || typeof node.type !== "string") return;
  if (!top && shallow && /Function/.test(node.type)) return;
  fn(node);
  for (const [k, v] of Object.entries(node)) {
    if (k === "loc" || k === "start" || k === "end") continue;
    if (Array.isArray(v)) v.forEach((x) => walk(x, fn, shallow, false));
    else if (v && typeof v.type === "string") walk(v, fn, shallow, false);
  }
}

/** JSX returned by a statement list's `return`, the block's last statement or an arrow body. */
function jsxOfReturn(st) {
  if (st?.type === "ReturnStatement") {
    const arg = unwrap(st.argument);
    if (isJsx(arg)) return arg;
    if (arg?.type === "ConditionalExpression" && (isJsx(unwrap(arg.consequent)) || isJsx(unwrap(arg.alternate)))) return arg;
    if (arg?.type === "NullLiteral") return arg;
  }
  if (st?.type === "BlockStatement") {
    const last = st.body[st.body.length - 1];
    return st.body.length === 1 || last?.type === "ReturnStatement" ? jsxOfReturn(last) : null;
  }
  return null;
}

/**
 * What a function component renders: its final top-level `return`, plus every earlier
 * `if (cond) return <X/>;` as a guarded branch. React returns the first branch whose condition
 * holds; Slint shows each branch under `if`, with every earlier condition negated, so exactly
 * one branch is visible at a time, as on the web.
 */
export function renderBranches(body) {
  const b = unwrap(body);
  if (isJsx(b) || b?.type === "ConditionalExpression") return { branches: [], main: b };
  if (b?.type !== "BlockStatement") return { branches: [], main: null };
  const branches = [];
  let main = null;
  for (const st of b.body) {
    if (st.type === "IfStatement" && !st.alternate) {
      const jsx = jsxOfReturn(st.consequent);
      if (jsx) branches.push({ test: st.test, jsx });
    }
    if (st.type === "ReturnStatement") {
      const jsx = jsxOfReturn(st);
      if (jsx) main = jsx;
    }
  }
  if (!main) {
    // No top-level return: the first JSX any return yields, outside nested functions.
    walk(b, (n) => {
      if (!main && n.type === "ReturnStatement" && isJsx(unwrap(n.argument))) main = unwrap(n.argument);
    }, true);
    return { branches: [], main };
  }
  return { branches, main };
}

/** Hook calls (`useState`, `useQuery`, ...) in a function body, counted by name. */
function hookCalls(body) {
  const hooks = {};
  walk(body, (node) => {
    if (node.type === "CallExpression" && node.callee.type === "Identifier" && /^use[A-Z]/.test(node.callee.name)) {
      hooks[node.callee.name] = (hooks[node.callee.name] ?? 0) + 1;
    }
  });
  return hooks;
}

/**
 * A component's local state: `useState` and `useDisclosure` values with their setters, so
 * handlers that set them change the Slint property directly and the screen reacts with no Rust.
 * `useDisclosure(false)` gives `opened` plus `open` (true), `close` (false) and `toggle` (not).
 */
function localState(body) {
  const states = new Map();
  if (body?.type !== "BlockStatement") return states;
  for (const st of body.body) {
    if (st.type !== "VariableDeclaration") continue;
    for (const d of st.declarations) {
      const call = d.init;
      const name = call?.type === "CallExpression" ? call.callee?.name : null;
      if (d.id?.type !== "ArrayPattern" || !name) continue;
      const [value, second] = d.id.elements;
      if (name === "useState" && value?.type === "Identifier" && second?.type === "Identifier") {
        states.set(value.name, { setter: second.name, init: call.arguments[0] });
      }
      if (name === "useDisclosure" && value?.type === "Identifier") {
        const actions = {};
        if (second?.type === "ObjectPattern") {
          for (const p of second.properties) {
            const local = p.value?.name;
            if (["open", "close", "toggle"].includes(p.key?.name) && local) actions[local] = p.key.name;
          }
        }
        states.set(value.name, { setter: null, actions, init: call.arguments[0] ?? { type: "BooleanLiteral", value: false } });
      }
    }
  }
  return states;
}

/** Every PascalCase function component in a module, top level or exported. */
function components(program) {
  const out = [];
  const consider = (name, fn) => {
    if (!name || !/^[A-Z]/.test(name) || !fn?.body) return;
    const { branches, main } = renderBranches(fn.body);
    // Destructured prop defaults (`{ emptyTitle = "No data found" }`) start the matching properties.
    const defaults = new Map();
    const param = fn.params?.[0];
    if (param?.type === "ObjectPattern") {
      for (const p of param.properties) if (p.type === "ObjectProperty" && p.value.type === "AssignmentPattern" && p.key.name) defaults.set(p.key.name, p.value.right);
    }
    if (main && main.type !== "NullLiteral") out.push({ name, jsx: main, branches, body: fn.body, hooks: hookCalls(fn.body), states: localState(fn.body), defaults });
  };
  for (let st of program.body) {
    if (st.type === "ExportNamedDeclaration" || st.type === "ExportDefaultDeclaration") st = st.declaration ?? st;
    if (st?.type === "FunctionDeclaration") consider(st.id?.name, st);
    if (st?.type === "VariableDeclaration") {
      for (const d of st.declarations) {
        const init = d.init?.type === "CallExpression" ? d.init.arguments.find((a) => /Function/.test(a.type)) : d.init; // forwardRef(fn), memo(fn)
        if (init && /Function/.test(init.type)) consider(d.id?.name, init);
      }
    }
  }
  return out;
}

/** Where each imported name comes from: `mantine`, `seam` (components/ui) or another module. */
function importsOf(program) {
  const out = new Map();
  for (const st of program.body) {
    if (st.type !== "ImportDeclaration") continue;
    const src = st.source.value;
    const lib = src.startsWith("@mantine/") ? "mantine" : src === "@/components/ui" || /(^|\/)components\/ui(\/|$)/.test(src) ? "seam" : src.startsWith("@tabler/") ? "tabler" : "other";
    for (const s of st.specifiers) out.set(s.local.name, { lib, imported: s.imported?.name ?? s.imported?.value ?? "default", source: src });
  }
  return out;
}

/** Writes one component, collecting its properties, callbacks and the gaps it meets. */
class ComponentWriter {
  constructor(c, ctx) {
    Object.assign(this, ctx);
    this.name = c.name;
    this.states = c.states;
    this.setters = new Map();
    for (const [v, st] of c.states) {
      if (st.setter) this.setters.set(st.setter, { state: v, kind: "set" });
      for (const [local, action] of Object.entries(st.actions ?? {})) this.setters.set(local, { state: v, kind: action });
    }
    this.tabState = [];
    this.props = new Map();
    this.callbacks = new Map();
    this.used = new Set();
    this.lines = [];
    this.rustNotes = [];
    this.extra = [];
    this.cells = [];
    this.axes = [];
    this.pendingMenu = null;
    this.changed = new Map();
    this.counter = 0;
  }

  /** Source text of a node. */
  text(node) {
    return this.source.slice(node.start, node.end);
  }

  emit(line, depth) {
    this.lines.push(`${"    ".repeat(depth)}${line}`);
  }

  /** Counts a dropped prop and returns the short note written into the element. */
  drop(tag, prop, reason) {
    const key = `${tag}.${prop}`;
    this.stats.droppedProps[key] = (this.stats.droppedProps[key] ?? 0) + 1;
    return `${prop} (${reason})`;
  }

  /** Records logic that moves into the Rust view model, as a marker in the file and a count. */
  rust(kind, detail) {
    this.stats.rust[kind] = (this.stats.rust[kind] ?? 0) + 1;
    this.rustNotes.push(`// rust: ${kind}: ${detail.replace(/\s+/g, " ").slice(0, 110)}`);
  }

  /** The Slint property standing for a JavaScript expression, declared once. */
  property(exprText, type = "string") {
    const key = `${type}:${exprText}`;
    if (!this.props.has(key)) this.props.set(key, { name: ident(exprText, this.used), type, src: exprText });
    return this.props.get(key).name;
  }

  /** A callback the view model implements, declared once. */
  callback(name, args = "") {
    if (!this.callbacks.has(name)) this.callbacks.set(name, { name: ident(name, this.used), args });
    return this.callbacks.get(name).name;
  }

  /**
   * A Slint value for an expression when one exists without a property: translated text
   * (`t("ns.key")` becomes `@tr("English sentence")`), string and number literals, plain
   * templates. Returns null when the value has to come from the view model.
   */
  literal(expr) {
    expr = unwrap(expr);
    if (!expr) return null;
    if (expr.type === "StringLiteral") return quote(expr.value);
    if (expr.type === "NumericLiteral") return String(expr.value);
    if (expr.type === "BooleanLiteral") return String(expr.value);
    if (expr.type === "TemplateLiteral" && expr.expressions.length === 0) return quote(expr.quasis[0].value.cooked);
    if (expr.type === "CallExpression" && expr.callee.type === "Identifier" && expr.callee.name === "t") {
      const [key, args] = expr.arguments;
      if (key?.type !== "StringLiteral") return null;
      this.stats.strings += 1;
      const english = this.strings?.get(key.value);
      if (!english) this.stats.missingStrings += 1;
      // i18next's {{name}} placeholders become Slint's {} positional ones, in order.
      const names = english ? [...english.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]) : [];
      // Slint @tr reads {} as a placeholder and {{ }} as literal braces.
      const escaped = (english ?? key.value).replace(/[{}]/g, (b) => b + b);
      const hasArgs = args?.type === "ObjectExpression" && names.length;
      const msg = hasArgs ? escaped.replace(/\{\{\{\{\s*\w+\s*\}\}\}\}/g, "{}") : escaped;
      if (!args || args.type !== "ObjectExpression" || !names.length) return `@tr(${quote(msg)})`;
      const byName = new Map(args.properties.filter((p) => p.key).map((p) => [p.key.name ?? p.key.value, p.value ?? p.key]));
      const values = names.map((n) => {
        const v = byName.get(n);
        return v ? (this.literal(v) ?? `root.${this.property(this.text(v))}`) : '""';
      });
      return `@tr(${quote(msg)}${values.map((v) => `, ${v}`).join("")})`;
    }
    return null;
  }

  /**
   * A string expression: a literal or translation as is, `cond ? a : b` as a Slint conditional
   * with the condition as a bool property, anything else as a string property.
   */
  stringExpr(e) {
    e = unwrap(e);
    const lit = this.literal(e);
    if (lit) return lit;
    if (e?.type === "ConditionalExpression" && !isJsx(unwrap(e.consequent)) && !isJsx(unwrap(e.alternate))) {
      return `(root.${this.property(this.text(e.test), "bool")} ? ${this.stringExpr(e.consequent)} : ${this.stringExpr(e.alternate)})`;
    }
    if (e?.type === "TemplateLiteral") {
      const parts = [];
      e.quasis.forEach((q, i) => {
        if (q.value.cooked) parts.push(quote(q.value.cooked));
        if (e.expressions[i]) parts.push(this.stringExpr(e.expressions[i]));
      });
      return parts.length ? parts.join(" + ") : '""';
    }
    return `root.${this.property(this.text(e))}`;
  }

  /** The Slint type of a local state value, from its starting value. */
  stateType(stateName) {
    const init = unwrap(this.states.get(stateName)?.init);
    if (init?.type === "BooleanLiteral") return "bool";
    if (init?.type === "NumericLiteral") return Number.isInteger(init.value) ? "int" : "float";
    return "string";
  }

  /**
   * `onClick={() => setOpen(true)}`, `onClick={() => setOpen(!open)}`, `onClick={open}` (from
   * `useDisclosure`) as a Slint handler that changes the state property itself, or null when the
   * handler does more than set one state.
   */
  setterAssignment(expr, slintCallback) {
    expr = unwrap(expr);
    let setterName = null;
    let arg = null;
    if (expr.type === "Identifier") setterName = expr.name;
    else if (/Function/.test(expr.type)) {
      const call = unwrap(expr.body?.type === "BlockStatement" && expr.body.body.length === 1 ? expr.body.body[0].expression : expr.body);
      if (call?.type === "CallExpression" && call.callee.type === "Identifier") {
        setterName = call.callee.name;
        arg = call.arguments[0];
      }
    }
    const setter = setterName ? this.setters.get(setterName) : null;
    if (!setter) return null;
    const prop = this.property(setter.state, this.stateType(setter.state));
    let value = null;
    if (setter.kind === "open") value = "true";
    else if (setter.kind === "close") value = "false";
    else if (setter.kind === "toggle") value = `!root.${prop}`;
    else if (expr.type !== "Identifier") {
      value = this.literal(arg);
      if (!value && unwrap(arg)?.type === "UnaryExpression" && unwrap(arg).operator === "!" && unwrap(arg).argument.name === setter.state) value = `!root.${prop}`;
      if (!value && /Function/.test(arg?.type ?? "") && unwrap(arg.body)?.type === "UnaryExpression" && unwrap(arg.body).operator === "!") value = `!root.${prop}`;
    }
    if (!value) return null;
    const type = this.stateType(setter.state);
    const fits = value.startsWith("!root.") ? type === "bool"
      : /^(true|false)$/.test(value) ? type === "bool"
      : /^-?\d+(\.\d+)?$/.test(value) ? type === "int" || type === "float"
      : type === "string";
    if (!fits) return null;
    this.stats.reactive += 1;
    return `${slintCallback} => { root.${prop} = ${value}; }`;
  }

  /** A JSX `<IconX size={16} stroke={1.5} />` as the Slint image literal of its Tabler SVG. */
  iconImage(node) {
    const n = unwrap(node);
    if (n?.type !== "JSXElement") return null;
    const tag = tagName(n.openingElement.name);
    const from = this.imports.get(tag.split(".")[0]);
    if (!/^Icon[A-Z0-9]/.test(tag) || (from && from.lib !== "tabler")) return null;
    const attr = (name) => staticValue(n.openingElement.attributes.find((a) => a.name?.name === name)?.value);
    const icon = iconFile(tag, attr("stroke"));
    if (!icon) return null;
    // An icon the installed Tabler release does not have would fail to load at run time.
    if (this.tablerDir && !fs.existsSync(path.join(this.tablerDir, "icons", icon.style, `${icon.base}.svg`))) {
      this.stats.missingIcons.add(tag);
      return null;
    }
    this.stats.icons.set(icon.file, icon);
    return { image: `@image-url("@medbrains-gui-kit/icons/${icon.file}")`, size: attr("size") };
  }

  /**
   * A JSX attribute value as a Slint expression of `type`, or `{ drop }`. Static values convert
   * by type; translated text becomes @tr; an icon element becomes its image; anything else
   * becomes a typed `in` property for the view model.
   */
  valueFor(type, attrValue, target) {
    const expr = attrValue?.type === "JSXExpressionContainer" ? attrValue.expression : attrValue;
    if (!expr) return type === "bool" ? { code: "true" } : { drop: "no value" };
    const value = staticValue(expr);
    if (value !== undefined && !(type === "string" && typeof value === "object")) return convertStatic(type, value, target);
    const e = unwrap(expr);
    if (type === "image") {
      const icon = this.iconImage(e);
      if (icon) return { code: icon.image, iconSize: icon.size };
    }
    if (isJsx(e)) return { drop: "an element in a property needs a slot in the kit" };
    if (type === "string" || type === "styled") return { code: this.stringExpr(e) };
    if (e.type === "NullLiteral" || (e.type === "Identifier" && e.name === "undefined")) return { drop: "unset" };
    const declared = type === "physical-length" ? "length" : type === "styled" ? "string" : type;
    return { code: `root.${this.property(this.text(e), declared)}` };
  }

  /**
   * Mantine's defaults for a tag, then the seam wrapper's, so a prop the source leaves out
   * still converts with the value the web renders.
   */
  defaultsFor(tag, from) {
    const name = from?.imported ?? tag;
    const mantine = DEFAULTS.components[name.split(".")[0] === name ? name : name.replace(".", "")] ?? {};
    const seam = from?.lib === "seam" ? DEFAULTS.seam[name] ?? {} : {};
    return { ...(from?.lib === "seam" ? DEFAULTS.components[name] ?? {} : mantine), ...seam };
  }

  /**
   * One element: resolves the rule, writes wrappers (margins, responsive visibility), the
   * element with its bindings, then its children.
   */
  element(node, depth) {
    const tag = tagName(node.openingElement.name);
    const { rules, dropped } = this.mapping;
    this.stats.elements += 1;
    if (dropped.has(tag) || tag === "") return this.children(node.children, depth);
    const from = this.imports.get(tag.split(".")[0]);
    if (/^[a-z]/.test(tag)) {
      // Raw HTML breaks the components-only rule, so it is always reported, and converted when it can be.
      this.stats.rawHtml[tag] = (this.stats.rawHtml[tag] ?? 0) + 1;
      const html = this.mapping.html[tag];
      if (!html) {
        this.emit(`// raw <${tag}> in the source: use a layout component`, depth);
        return this.children(node.children, depth);
      }
      if (html.slint === "_passthrough") {
        this.stats.mapped += 1;
        return this.children(node.children, depth);
      }
      return this.mapped(node, html, tag, null, depth);
    }
    if (this.mapping.webOnly.has(tag)) {
      // Diagram editors and similar: built for a mouse in a browser, kept web-only on purpose.
      this.stats.webOnly[tag] = (this.stats.webOnly[tag] ?? 0) + 1;
      this.emit(`// web-only: <${tag}>`, depth);
      return;
    }
    const icon = this.iconImage(node);
    if (icon) {
      this.stats.mapped += 1;
      this.stats.kit.add("MbIcon");
      const size = icon.size !== undefined ? ` size: ${lengthOf(icon.size, "size").code ?? "24px"};` : "";
      return this.emit(`MbIcon { source: ${icon.image};${size} }`, depth);
    }
    // An aliased import (`Badge as SBadge`) converts by the name it was exported under.
    const canonical = from && from.lib !== "other" && from.imported !== "default" ? [from.imported, ...tag.split(".").slice(1)].join(".") : tag;
    const rule = rules[`${from?.lib}:${canonical}`] ?? rules[canonical] ?? rules[tag] ?? (tag.includes(".") ? rules[tag.split(".")[0]] && { slint: "_passthrough", props: {} } : null);
    if (canonical === "Menu" && from?.lib === "mantine") return this.menu(node, depth);
    const own = from?.lib === "other" && this.known.has(tag) && !rule?.own;
    const known = rule && !own ? null : this.known.get(tag);
    if (known && WRAPPER.test(tag)) {
      // Providers, boundaries and guards add behaviour, not layout: their children are the screen.
      this.stats.mapped += 1;
      return this.children(node.children, depth);
    }
    if (known && tag === this.name) {
      this.stats.recursive += 1;
      this.emit(`// recursive <${tag}>: a Slint component cannot contain itself; the view model flattens the tree`, depth);
      return;
    }
    if (known) return this.reference(node, tag, known, depth);
    if (tag === "Controller") {
      // react-hook-form: the screen shows whatever `render` returns; the form state moves to the view model.
      const render = node.openingElement.attributes.find((a) => a.name?.name === "render");
      const fn = render?.value?.expression;
      this.stats.mapped += 1;
      this.rust("form", `Controller ${this.text(node.openingElement).slice(0, 60)}`);
      if (fn && /Function/.test(fn.type)) this.branch(renderBranches(fn.body).main ?? fn.body, depth);
      return;
    }
    if ((tag === "Tabs.Panel" || tag === "Tabs.Tab") && this.tabState.length) return this.tab(node, tag, depth);
    if (tag === "Tabs") {
      const val = node.openingElement.attributes.find((a) => a.name?.name === "value" || a.name?.name === "defaultValue");
      const expr = val?.value?.expression;
      const stateName = expr?.type === "Identifier" && this.states.has(expr.name) ? expr.name : null;
      const fixed = val?.value?.type === "StringLiteral" ? val.value.value : null;
      if (stateName || fixed) {
        // Uncontrolled tabs (defaultValue="x") keep their own selection, as Mantine does.
        const prop = stateName ? this.property(stateName, "string") : this.property(`tab-${this.counter++}`, "string");
        if (fixed) this.props.get(`string:tab-${this.counter - 1}`).init = quote(fixed);
        this.tabState.push(prop);
        this.stats.mapped += 1;
        this.emit("VerticalLayout {", depth);
        this.emit("alignment: LayoutAlignment.start;", depth + 1);
        this.children(node.children, depth + 1);
        this.emit("}", depth);
        this.tabState.pop();
        return;
      }
    }
    if (!rule) {
      this.stats.unmapped[tag] = (this.stats.unmapped[tag] ?? 0) + 1;
      this.emit(`// unmapped: <${tag}>`, depth);
      return this.children(node.children, depth);
    }
    if (rule.slint === "_passthrough") {
      this.stats.mapped += 1;
      if (rule.rust) this.rust(rule.rust, `<${tag}>`);
      return this.children(node.children, depth);
    }
    this.mapped(node, rule, tag, from, depth);
  }

  /**
   * Mantine Menu as Slint's ContextMenuArea: Menu.Item becomes MenuItem (title, icon, enabled,
   * activated), Menu.Divider a MenuSeparator, Menu.Label a disabled MenuItem. Slint draws the
   * popup and handles arrows, Enter, Escape and skipping disabled items. The target opens it on
   * click, on Enter or Space, and on the Menu key.
   */
  menu(node, depth) {
    this.stats.mapped += 1;
    this.stats.menus += 1;
    const id = `menu-${this.counter++}`;
    const kids = (n) => n.children.filter((c) => c.type === "JSXElement");
    const target = kids(node).find((c) => tagName(c.openingElement.name).endsWith(".Target"));
    const dropdown = kids(node).find((c) => tagName(c.openingElement.name).endsWith(".Dropdown"));
    this.emit(`${id} := ContextMenuArea {`, depth);
    this.emit("Menu {", depth + 1);
    const item = (c, d, prefix = "") => {
      if (c.type === "JSXExpressionContainer") {
        const e = unwrap(c.expression);
        if (e?.type === "LogicalExpression" && e.operator === "&&" && isJsx(unwrap(e.right))) return item(unwrap(e.right), d, `if root.${this.property(this.text(e.left), "bool")} : `);
        if (e?.type === "CallExpression" && e.callee?.property?.name === "map") {
          const body = renderBranches(e.arguments[0]?.body).main;
          if (body) return item(body, d, `for item in root.${this.property(this.text(e.callee.object), "[string]")} : `);
        }
        return;
      }
      if (c.type !== "JSXElement") return;
      const t = tagName(c.openingElement.name);
      this.stats.elements += 1;
      this.stats.mapped += 1;
      if (t.endsWith(".Divider")) return this.emit(`${prefix}MenuSeparator { }`, d);
      const title = this.textParts(c.children).join(" + ") || '""';
      if (t.endsWith(".Label")) return this.emit(`${prefix}MenuItem { title: ${title}; enabled: false; }`, d);
      if (!t.endsWith(".Item")) return;
      const attrs = Object.fromEntries(c.openingElement.attributes.filter((a) => a.type === "JSXAttribute").map((a) => [a.name.name, a]));
      const parts = [`title: ${title};`];
      if (attrs.disabled) parts.push(`enabled: ${attrs.disabled.value ? this.condition(attrs.disabled.value) === "true" ? "false" : `!${this.condition(attrs.disabled.value)}` : "false"};`);
      const icon = attrs.leftSection ? this.iconImage(attrs.leftSection.value?.expression) : null;
      if (icon) parts.push(`icon: ${icon.image};`);
      const click = attrs.onClick?.value?.expression;
      if (click) parts.push(this.setterAssignment(click, "activated") ?? `activated => { root.${this.callback(`menu-${this.text(c).slice(0, 0)}item-${this.counter++}`)}(); }`);
      this.emit(`${prefix}MenuItem { ${parts.join(" ")} }`, d);
    };
    for (const c of dropdown?.children ?? []) item(c, depth + 2);
    this.emit("}", depth + 1);
    this.emit("VerticalLayout {", depth + 1);
    this.emit("alignment: LayoutAlignment.start;", depth + 1);
    // A button target opens the menu from its own clicked (mouse, Enter, Space): one tab stop.
    this.pendingMenu = `${id}.show({ x: 0px, y: self.height });`;
    if (target) this.children(target.children, depth + 2);
    const viaButton = this.pendingMenu === null;
    this.pendingMenu = null;
    this.emit("}", depth + 1);
    if (!viaButton) {
      // Any other target: a click area and a key handler open the menu below it.
      this.emit(`TouchArea { clicked => { ${id}.show({ x: 0px, y: self.height }); } }`, depth + 1);
      this.emit(`FocusScope { key-pressed(event) => { if (event.text == " " || event.text == "\\n" || event.text == Key.DownArrow) { ${id}.show({ x: 0px, y: 24px }); return accept; } return reject; } }`, depth + 1);
    }
    this.emit("}", depth);
  }

  /** A tab label or panel under `Tabs` bound to a state value: selection is a Slint property. */
  tab(node, tag, depth) {
    const state = this.tabState[this.tabState.length - 1];
    const val = node.openingElement.attributes.find((a) => a.name?.name === "value");
    const v = val ? this.literal(val.value?.type === "StringLiteral" ? val.value : val.value?.expression) : null;
    if (!v) return this.children(node.children, depth);
    this.stats.mapped += 1;
    this.stats.reactive += 1;
    if (tag === "Tabs.Panel") {
      this.emit(`if root.${state} == ${v} : VerticalLayout {`, depth);
      this.emit("alignment: LayoutAlignment.start;", depth + 1);
      this.styleWrappersInner(node, depth + 1);
      this.children(node.children, depth + 1);
      return this.emit("}", depth);
    }
    const label = node.children.filter((c) => c.type === "JSXText").map((c) => c.value.trim()).join(" ").trim();
    const expr = node.children.find((c) => c.type === "JSXExpressionContainer" && c.expression.type !== "JSXEmptyExpression");
    const text = label ? quote(label) : expr ? this.literal(expr.expression) ?? `root.${this.property(this.text(expr.expression))}` : v;
    const left = node.openingElement.attributes.find((a) => a.name?.name === "leftSection");
    const icon = left ? this.iconImage(left.value?.expression) : null;
    this.stats.kit.add("MbTab");
    return this.emit(`MbTab { text: ${text};${icon ? ` icon: ${icon.image};` : ""} selected: root.${state} == ${v}; clicked => { root.${state} = ${v}; } }`, depth);
  }

  /** Tabs.Panel's `pt`: padding inside the panel's own layout. */
  styleWrappersInner(node, depth) {
    for (const a of node.openingElement.attributes) {
      const side = { pt: "padding-top", pb: "padding-bottom", p: "padding" }[a.name?.name];
      const v = side ? staticValue(a.value) : undefined;
      if (v !== undefined) {
        const r = lengthOf(v, side);
        if (r.code) this.emit(`${side}: ${r.code};`, depth);
      }
    }
  }

  /**
   * One of our own components: a reference to its converted file, passing each attribute the
   * component declares as a property (pass 1 recorded which), with the type it declares.
   */
  reference(node, tag, known, depth) {
    this.stats.mapped += 1;
    this.stats.references.set(tag, known.file);
    const lines = [];
    const notes = [];
    for (const attr of node.openingElement.attributes) {
      if (attr.type !== "JSXAttribute") continue;
      const name = attr.name.name;
      const decl = known.props?.get(name);
      if (decl) {
        const r = this.valueFor(decl.type, attr.value, decl.name);
        if (r.code && !/^on[A-Z]/.test(name)) lines.push(`${decl.name}: ${r.code};`);
        continue;
      }
      const cb = known.callbacks?.get(kebab(name.replace(/^on/, "")).replace(/^-/, ""));
      if (cb && /^on[A-Z]/.test(name)) {
        const assign = this.setterAssignment(attr.value?.expression ?? attr.value, cb);
        lines.push(assign ?? `${cb} => { root.${this.callback(name.slice(2))}(); }`);
        continue;
      }
      if (!["key", "className", "style"].includes(name)) notes.push(name);
    }
    const inner = node.children.some((c) => c.type !== "JSXText" || c.value.trim());
    if (notes.length) this.stats.unpassedProps += notes.length;
    if (!inner && !lines.length) return this.emit(`${tag} { }`, depth);
    this.emit(`${tag} {`, depth);
    for (const l of lines) this.emit(l, depth + 1);
    this.children(node.children, depth + 1);
    this.emit("}", depth);
  }

  /**
   * The bindings of one element: Mantine defaults first, then the source's attributes, each
   * written with the type the Slint element declares. Returns `{ lines, notes, wrap }`.
   */
  bindings(node, rule, tag, from, info) {
    const lines = [];
    const notes = [];
    const wrap = { margin: {}, visible: null, background: null };
    const attrs = node.openingElement.attributes.filter((a) => a.type === "JSXAttribute");
    const given = new Set(attrs.map((a) => a.name.name));
    const spreads = node.openingElement.attributes.filter((a) => a.type === "JSXSpreadAttribute");
    const defaults = this.defaultsFor(tag, from);
    const synthetic = Object.entries(defaults)
      .filter(([k]) => !given.has(k) && (rule.props?.[k] || this.mapping.styleProps[k]) && !(rule.ignoreDefaults ?? []).includes(k))
      .map(([k, v]) => ({ type: "JSXAttribute", name: { name: k }, value: typeof v === "string" ? { type: "StringLiteral", value: v } : { type: "JSXExpressionContainer", expression: { type: typeof v === "number" ? "NumericLiteral" : "BooleanLiteral", value: v } }, synthetic: true }));
    const written = new Set();
    // value + onChange bound two ways: the onChange is then the binding, not a callback.
    let twoWayDone = false;
    const put = (target, code) => {
      if (written.has(target)) return;
      const axis = /^(min|max)-(width|height)$/.exec(target)?.[2];
      if (axis && info.bound?.has(axis)) {
        notes.push(this.drop(tag, target, `the kit fixes this control's ${axis}`));
        return;
      }
      written.add(target);
      lines.push(`${target}: ${code};`);
    };
    for (const [k, v] of Object.entries(rule.fixed ?? {})) put(k, v);
    for (const attr of [...attrs, ...synthetic]) {
      const name = attr.name.name;
      if (name === "className" && this.cssClasses(attr, info, { put, notes, wrap, tag })) continue;
      if (rule.handled?.[name]) continue;
      if (rule.gaps?.[name]) {
        if (!attr.synthetic) notes.push(this.drop(tag, name, rule.gaps[name]));
        continue;
      }
      if (this.twoWay(node, rule, attr, info, lines)) {
        twoWayDone = true;
        continue;
      }
      if (/^on[A-Z]/.test(name) && twoWayDone && this.twoWayPartner(node, attr)) continue;
      const target = rule.props?.[name] ?? this.mapping.styleProps[name] ?? this.mapping.commonProps[name];
      if (!target) {
        if (!attr.synthetic) notes.push(this.drop(tag, name, this.mapping.commonProps[`_${name}`] ?? "no Slint equivalent"));
        continue;
      }
      if (Array.isArray(target)) {
        // px, py: one value to two sides.
        for (const side of target) {
          const r = info.properties[side] ? this.valueFor(info.properties[side].type, attr.value, side) : { drop: `${rule.slint} has no ${side}` };
          if (r.code) put(side, r.code);
          else if (!attr.synthetic) notes.push(this.drop(tag, name, r.drop));
        }
        continue;
      }
      if (typeof target === "object") {
        this.special(target, attr, { lines, notes, wrap, put, info, tag });
        continue;
      }
      if (target.startsWith("_")) continue;
      const negate = target.endsWith("!");
      const prop = negate ? target.slice(0, -1) : target;
      // Values listed in the rule (Title order 3 -> heading size) win over generic conversion.
      const listed = rule.values?.[name];
      const raw = staticValue(attr.value);
      if (listed && raw !== undefined && typeof raw !== "object" && listed[String(raw)] !== undefined) {
        put(prop, listed[String(raw)]);
        continue;
      }
      if (info.callbacks[prop] !== undefined) {
        if (attr.synthetic) continue;
        const expr = attr.value?.type === "JSXExpressionContainer" ? attr.value.expression : null;
        if (!expr) continue;
        const assign = this.setterAssignment(expr, prop);
        lines.push(assign ?? `${prop} => { root.${this.callback(name.slice(2) || name)}(); }`);
        continue;
      }
      const decl = info.properties[prop];
      if (!decl || decl.dir === "private" || decl.dir === "out") {
        if (!attr.synthetic) notes.push(this.drop(tag, name, `${rule.slint} has no ${prop}`));
        continue;
      }
      if (prop === "accessible-label" && !info.role) {
        if (!attr.synthetic) notes.push(this.drop(tag, name, "the element has no accessible role"));
        continue;
      }
      if (negate) {
        const v = staticValue(attr.value);
        if (v !== undefined || !attr.value) put(prop, String(!(v ?? true)));
        else put(prop, `!root.${this.property(this.text(attr.value.expression), "bool")}`);
        continue;
      }
      const toneValue = prop === "tone" && name === "color" ? staticValue(attr.value) : undefined;
      const r = typeof toneValue === "string" ? toneOf(toneValue) : this.valueFor(decl.type, attr.value, prop);
      if (r.drop) {
        if (!attr.synthetic) notes.push(this.drop(tag, name, r.drop));
        continue;
      }
      put(prop, r.code);
      if (r.iconSize !== undefined && info.properties["icon-size"]) put("icon-size", lengthOf(r.iconSize, "icon-size").code);
    }
    for (const s of spreads) this.spread(s, rule, info, lines, notes, tag);
    if (rule.headingWeight) {
      // A Title's weight follows its order (theme.headings.sizes.hN.fontWeight) unless fw is given.
      const order = staticValue(attrs.find((a) => a.name.name === "order")?.value) ?? defaults.order ?? 1;
      put("font-weight", `Tokens.heading-${order}-weight`);
    }
    if (rule.iconChild && info.properties[rule.iconChild]) {
      const child = node.children.find((c) => this.iconImage(c.type === "JSXExpressionContainer" ? c.expression : c));
      const icon = child && this.iconImage(child.type === "JSXExpressionContainer" ? child.expression : child);
      if (icon) put(rule.iconChild, icon.image);
    }
    for (const [k, v] of Object.entries(rule.default ?? {})) put(k, v);
    if (this.pendingMenu && info.callbacks.clicked !== undefined) {
      const i = lines.findIndex((l) => l.startsWith("clicked =>"));
      if (i >= 0) lines.splice(i, 1);
      lines.push(`clicked => { ${this.pendingMenu} }`);
      this.pendingMenu = null;
    }
    return { lines, notes, wrap };
  }

  /**
   * `className={classes.bar}`: the declarations of that CSS module class with a Slint
   * equivalent (css-modules.mjs), each other declaration noted. False when no class resolves.
   */
  cssClasses(attr, info, { put, notes, wrap, tag }) {
    const expr = attr.value?.type === "JSXExpressionContainer" ? attr.value.expression : null;
    const refs = expr ? classRefs(expr).filter((r) => this.cssModules.has(r.module)) : [];
    if (!refs.length) return false;
    for (const ref of refs) {
      const decls = parseModule(this.cssModules.get(ref.module)).get(ref.cls);
      if (!decls) continue;
      const r = cssBindings(decls, info, this.axes[this.axes.length - 1] ?? "column");
      for (const [p, code] of r.set) put(p, code);
      if (r.wrap.background && !wrap.background) wrap.background = r.wrap.background;
      if (r.wrap.transform) wrap.transform = r.wrap.transform;
      for (const n of r.notes) notes.push(this.drop(tag, `.${ref.cls}`, n));
      this.stats.cssClasses += 1;
    }
    return true;
  }

  /** `{...form.register("name")}`: a two-way binding to the form field's view-model property. */
  spread(attr, rule, info, lines, notes, tag) {
    const call = unwrap(attr.argument);
    const callee = call?.type === "CallExpression" ? (call.callee.property?.name ?? call.callee.name) : null;
    const field = call?.arguments?.[0];
    const target = rule.props?.value;
    if (callee === "register" && field?.type === "StringLiteral" && target && info.properties[target]) {
      const prop = this.property(`form.${field.value}`, info.properties[target].type);
      this.formFields.add(prop);
      // register() supplies value and onChange: it replaces a one-way value binding.
      const i = lines.findIndex((l) => l.startsWith(`${target}:`) || l.startsWith(`${target} <=>`));
      if (i >= 0) lines.splice(i, 1);
      lines.push(`${target} <=> root.${prop};`);
      this.stats.reactive += 1;
      return;
    }
    notes.push(this.drop(tag, "{...}", "spread props are only known at run time"));
  }

  /**
   * Style props with a rule of their own: margins become a wrapping layout's padding, responsive
   * visibility becomes `if`, a background on a layout becomes a wrapping Rectangle, `tt`
   * transforms the text, and `lineClamp`/`truncate` set Text's wrap, max-lines and overflow.
   */
  special(target, attr, ctx) {
    const { lines, notes, wrap, put, info, tag } = ctx;
    const name = attr.name.name;
    const value = staticValue(attr.value);
    const dropIt = (why) => {
      if (!attr.synthetic) notes.push(this.drop(tag, name, why));
    };
    if (target.margin) {
      if (value === undefined) return dropIt("margins must be static");
      for (const side of target.margin) {
        const r = typeof value === "object" ? { drop: "responsive margins" } : String(value).startsWith("-") || value === "auto" ? { drop: `margin "${value}" (negative and auto margins have no layout padding)` } : lengthOf(value, "padding");
        if (r.drop) return dropIt(r.drop);
        wrap.margin[side] = r.code;
      }
      return;
    }
    if (target.visibleFrom || target.hiddenFrom) {
      if (typeof value !== "string") return dropIt("breakpoint must be static");
      wrap.visible = target.visibleFrom ? `Tokens.viewport-width >= Tokens.breakpoint-${value}` : `Tokens.viewport-width < Tokens.breakpoint-${value}`;
      return;
    }
    if (target.background) {
      const r = value === undefined ? { drop: "background must be static" } : colorOf(value, "filled");
      if (r.drop) return dropIt(r.drop);
      if (info.properties.background) put("background", r.code);
      else wrap.background = r.code;
      return;
    }
    if (target.to && target.kind) {
      const decl = info.properties[target.to];
      if (!decl) return dropIt(`${tag} has no ${target.to}`);
      const r = target.kind === "weight" ? (value === undefined ? { code: `root.${this.property(this.text(attr.value.expression), "int")}` } : weightOf(value))
        : target.kind === "color" ? (value === undefined ? this.valueFor("brush", attr.value, target.to) : colorOf(value, "text"))
        : target.kind === "font" ? (value === "monospace" || /mono/i.test(String(value)) ? { code: "Metrics.mono" } : value === undefined ? { drop: "font family must be static" } : { code: "Metrics.font" })
        : target.kind === "italic" ? (value === "italic" ? { code: "true" } : { drop: `font style "${value}"` })
        : target.kind === "line-height" ? (typeof value === "number" ? { code: String(Math.round((value / Metrics_NATURAL_LINE_HEIGHT) * 1000) / 1000) } : { drop: "line height must be a number" })
        : { drop: "unknown" };
      if (r.drop) return dropIt(r.drop);
      if (target.kind === "font") this.stats.kit.add("Metrics");
      return put(target.to, r.code);
    }
    if (target.transform) {
      if (value === "uppercase" || value === "lowercase") {
        wrap.transform = value === "uppercase" ? "to-uppercase" : "to-lowercase";
        return;
      }
      return dropIt(`text-transform "${value}" (Slint strings have to-uppercase and to-lowercase only)`);
    }
    if (target.clamp) {
      if (!info.properties["max-lines"]) return dropIt(`${tag} has no max-lines`);
      if (name === "truncate") {
        if (value === false) return;
        put("wrap", "no-wrap");
        put("overflow", "elide");
        return;
      }
      const r = value === undefined ? { code: `root.${this.property(this.text(attr.value.expression), "int")}` } : convertStatic("int", value);
      if (r.drop) return dropIt(r.drop);
      put("wrap", "word-wrap");
      put("max-lines", r.code);
      put("overflow", "elide");
    }
  }

  /** Emits a mapped element: wrappers, the element with its bindings, then children or a label. */
  mapped(node, rule, tag, from, depth) {
    this.stats.mapped += 1;
    const slint = this.layoutTarget(node, rule, tag, from);
    const info = this.mapping.types.describe(slint);
    if (slint.startsWith("Mb")) this.stats.kit.add(slint);
    else if (STD_WIDGETS.has(slint)) this.stats.std.add(slint);
    if (rule.rust) this.rust(rule.rust, `<${tag}>`);
    const { lines, notes, wrap } = this.bindings(node, { ...rule, slint }, tag, from, info);
    // Wrappers, outermost first: visibility (an `if`, so a hidden element takes no space, as
    // display: none), margin (a layout's padding), background (a Rectangle behind a layout).
    let d = depth;
    const opened = [];
    // A Modal mounts its content only while open (Mantine keepMounted=false): an `if`, not a hidden element.
    const mountAttr = rule.mountWhen ? node.openingElement.attributes.find((a) => a.name?.name === rule.mountWhen) : null;
    const mount = mountAttr ? this.condition(mountAttr.value) : null;
    const conds = [wrap.visible, mount].filter(Boolean);
    const cond = conds.length ? `if ${conds.join(" && ")} : ` : "";
    const margins = Object.entries(wrap.margin);
    if (margins.length) {
      this.emit(`${cond}VerticalLayout {`, d);
      for (const [side, v] of margins) this.emit(`${side}: ${v};`, d + 1);
      opened.push(d);
      d += 1;
    } else if (cond) {
      this.emit(`${cond}VerticalLayout {`, d);
      opened.push(d);
      d += 1;
    }
    if (wrap.background) {
      this.emit("Rectangle {", d);
      this.emit(`background: ${wrap.background};`, d + 1);
      opened.push(d);
      d += 1;
    }
    for (const n of notes) this.emit(`// not converted: ${n}`, d);
    if (rule.grid && this.gridLayout(node, rule, lines, d)) {
      for (const o of opened.reverse()) this.emit("}", o);
      return;
    }
    if (rule.grid) {
      const grid = this.gridCell(node, rule, lines);
      this.emit("VerticalLayout {", d);
      this.emit(`spacing: ${grid.vgap};`, d + 1);
      this.emit("alignment: LayoutAlignment.start;", d + 1);
      this.cells.push({ depth: d + 1, ...grid });
      this.children(node.children, d + 1);
      this.cells.pop();
      this.emit("}", d);
      for (const o of opened.reverse()) this.emit("}", o);
      return;
    }
    this.emit(`${slint} {`, d);
    for (const l of lines) this.emit(l, d + 1);
    if (slint === "StandardTableView") this.tableColumns(node, d + 1);
    if (rule.text) {
      // A label is its text and any values or translations inside it, joined like a Text.
      const parts = this.textParts(node.children);
      const already = lines.some((l) => l.startsWith(`${rule.text}:`));
      if (parts.length && !already) this.emit(`${rule.text}: ${this.transform(parts.join(" + "), wrap)};`, d + 1);
      if (parts.length && rule.text === "accessible-description" && info.children) this.children(node.children, d + 1);
    } else if (slint === "Text") {
      this.textChildren(node.children, d + 1, wrap);
    } else if (!info.children) {
      // Rows, cells or adornments written as JSX children: the widget takes them as properties.
      if (node.children.some((c) => c.type !== "JSXText" || c.value.trim())) this.stats.leafChildren += 1;
    } else {
      this.axes.push(slint === "HorizontalLayout" || (slint === "FlexboxLayout" && !lines.some((l) => l.includes("flex-direction") && l.includes("column"))) ? "row" : "column");
      this.children(node.children, d + 1);
      this.axes.pop();
    }
    this.emit("}", d);
    for (const o of opened.reverse()) this.emit("}", o);
  }

  /**
   * Group and Flex wrap by default (`flex-wrap: wrap`), so they become a FlexboxLayout; with
   * `wrap="nowrap"` they become a HorizontalLayout. SimpleGrid and Grid are written by
   * `gridLayout` and `gridCell`.
   */
  layoutTarget(node, rule, tag, from) {
    if (!rule.wrapping) return rule.slint;
    const attr = node.openingElement.attributes.find((a) => a.name?.name === "wrap");
    const value = attr ? staticValue(attr.value) : this.defaultsFor(tag, from).wrap ?? rule.wrapping;
    return value === "nowrap" ? "HorizontalLayout" : "FlexboxLayout";
  }

  /** A JSX attribute as a Slint bool expression: a literal, a state or a view-model property. */
  condition(value) {
    const v = staticValue(value);
    if (typeof v === "boolean") return String(v);
    const e = value?.type === "JSXExpressionContainer" ? unwrap(value.expression) : null;
    if (!e) return "true";
    const type = e.type === "Identifier" && this.states.has(e.name) ? this.stateType(e.name) : "bool";
    return type === "bool" ? `root.${this.property(this.text(e), "bool")}` : "true";
  }

  /** Applies a `tt` text transform to a string expression. */
  transform(code, wrap) {
    return wrap?.transform ? `(${code}).${wrap.transform}()` : code;
  }

  /** The text and values among children, as Slint string expressions. */
  textParts(list) {
    const parts = [];
    for (const c of list) {
      if (c.type === "JSXText") {
        const s = jsxText(c.value);
        if (s.trim()) parts.push(quote(s));
      } else if (c.type === "JSXExpressionContainer" && c.expression.type !== "JSXEmptyExpression") {
        const e = unwrap(c.expression);
        if (isJsx(e) || e.type === "LogicalExpression" || (e.type === "ConditionalExpression" && (isJsx(unwrap(e.consequent)) || isJsx(unwrap(e.alternate))))) {
          this.stats.inlineInText += 1;
          parts.push(`root.${this.property(this.text(e))}`);
        } else parts.push(this.stringExpr(e));
      } else if (c.type === "JSXElement") {
        this.stats.inlineInText += 1;
        parts.push(`root.${this.property(this.text(c))}`);
      }
    }
    return parts;
  }

  /**
   * A Slint `Text` holds one string, not children: text and values become one `text` binding
   * joined with `+`; element children (an inline badge, a link) are counted as needing a layout.
   */
  textChildren(list, depth, wrap) {
    const parts = this.textParts(list);
    if (parts.length) this.emit(`text: ${this.transform(parts.join(" + "), wrap)};`, depth);
  }

  /**
   * The column count and gaps of a SimpleGrid or Grid whose children include a list
   * (`rows.map(...)`): the list becomes rows of `cols` equal cells, so cell widths come from
   * layout stretch, never from the grid's own width (which would be a binding loop).
   */
  gridCell(node, rule, lines) {
    const get = (prefix) => lines.find((l) => l.startsWith(prefix))?.replace(/^[\w-]+:\s*|;$/g, "");
    const gap = get("spacing-horizontal:") ?? get("spacing:") ?? "0px";
    const vgap = get("spacing-vertical:") ?? gap;
    if (rule.grid === "span") return { cols: "1", gap, vgap };
    const colsAttr = node.openingElement.attributes.find((a) => a.name?.name === "cols");
    const value = colsAttr ? staticValue(colsAttr.value) : 1;
    const cols = value === undefined ? `root.${this.property(this.text(colsAttr.value.expression), "int")}` : convertStatic("int", value).code ?? "1";
    return { cols, gap, vgap };
  }

  /**
   * SimpleGrid and Grid with children written out (no `.map`) as a Slint GridLayout: each child
   * is a cell at a compile-time row and column, all columns stretch equally (zero-height
   * placeholders on row 0 fix the column count), and Grid.Col `span` is the cell's colspan of 12.
   * A responsive `cols` or `span` becomes one GridLayout per breakpoint range under `if`, so the
   * arrangement switches at the same window widths as Mantine's media queries. Returns false
   * when a child is a list, which keeps the FlexboxLayout cells of `gridCell`.
   */
  gridLayout(node, rule, lines, depth) {
    const kids = node.children.filter((c) => !(c.type === "JSXText" && !c.value.trim()) && !(c.type === "JSXExpressionContainer" && c.expression.type === "JSXEmptyExpression"));
    const isList = (c) => c.type === "JSXExpressionContainer" && unwrap(c.expression)?.type === "CallExpression" && unwrap(c.expression).callee?.property?.name === "map";
    if (!kids.length || kids.some(isList)) return false;
    const span = rule.grid === "span";
    const columnsAttr = staticValue(node.openingElement.attributes.find((a) => a.name?.name === (span ? "columns" : "cols"))?.value);
    if (!span && columnsAttr === undefined && node.openingElement.attributes.some((a) => a.name?.name === "cols")) return false;
    const spanOf = (c) => (c.type === "JSXElement" ? staticValue(c.openingElement.attributes.find((a) => a.name?.name === "span")?.value) : undefined);
    const values = span ? kids.map(spanOf) : [columnsAttr ?? 1];
    if (values.some((v) => v !== undefined && typeof v !== "number" && !(v && typeof v === "object"))) return false;
    // Breakpoint ranges where the arrangement can change, mobile first.
    const order = ["base", "xs", "sm", "md", "lg", "xl"];
    const keys = new Set(["base"]);
    for (const v of values) if (v && typeof v === "object") for (const k of Object.keys(v.responsive)) keys.add(k);
    const steps = order.filter((k) => keys.has(k));
    const at = (v, step, fallback) => {
      if (v === undefined) return fallback;
      if (typeof v === "number") return v;
      let out = fallback;
      for (const k of order.slice(0, order.indexOf(step) + 1)) if (k in v.responsive) out = v.responsive[k];
      return typeof out === "number" ? out : fallback;
    };
    const gapLine = lines.find((l) => l.startsWith("spacing-horizontal:"));
    const extra = gapLine && !lines.some((l) => l.startsWith("spacing-vertical:")) ? [`spacing-vertical: ${gapLine.replace(/^[\w-]+:\s*|;$/g, "")};`] : [];
    const columns = span ? (typeof columnsAttr === "number" ? columnsAttr : 12) : null;
    steps.forEach((step, i) => {
      const next = steps[i + 1];
      const conds = [step !== "base" && `Tokens.viewport-width >= Tokens.breakpoint-${step}`, next && `Tokens.viewport-width < Tokens.breakpoint-${next}`].filter(Boolean);
      const cols = span ? columns : at(values[0], step, 1);
      this.emit(`${conds.length ? `if ${conds.join(" && ")} : ` : ""}GridLayout {`, depth);
      const gridProps = this.mapping.types.describe("GridLayout").properties;
      for (const l of [...lines, ...extra]) if (gridProps[l.split(":")[0]]) this.emit(l, depth + 1);
      for (let c = 0; c < cols; c += 1) this.emit(`Rectangle { row: 0; col: ${c}; height: 0px; min-width: 0px; preferred-width: 0px; horizontal-stretch: 1; }`, depth + 1);
      let row = 0;
      let col = 0;
      for (const kid of kids) {
        const width = span ? Math.min(cols, at(spanOf(kid), step, cols)) : 1;
        if (col + width > cols) {
          row += 1;
          col = 0;
        }
        this.emit("VerticalLayout {", depth + 1);
        this.emit(`row: ${row}; col: ${col};${width > 1 ? ` colspan: ${width};` : ""}`, depth + 2);
        this.emit("min-width: 0px; preferred-width: 0px; horizontal-stretch: 1; alignment: LayoutAlignment.start;", depth + 2);
        if (span && kid.type === "JSXElement" && tagName(kid.openingElement.name).endsWith(".Col")) this.children(kid.children, depth + 2);
        else this.child(kid, depth + 2);
        this.emit("}", depth + 1);
        col += width;
        if (col >= cols) {
          row += 1;
          col = 0;
        }
      }
      this.emit("}", depth);
    });
    return true;
  }

  children(list, depth) {
    const cell = this.cells[this.cells.length - 1];
    if (!cell || cell.depth !== depth) {
      for (const child of list) this.child(child, depth);
      return;
    }
    // Inside a list grid: a list becomes rows of equal cells; anything else takes a full row.
    this.cells.push({ depth: -1 });
    for (const child of list) {
      const e = child.type === "JSXExpressionContainer" ? unwrap(child.expression) : null;
      if (e?.type !== "CallExpression" || e.callee?.property?.name !== "map") {
        this.child(child, depth);
        continue;
      }
      const listProp = this.property(this.text(e.callee.object), "[string]");
      const fn = e.arguments[0];
      const n = `root.${listProp}.length`;
      this.emit(`for grid-row in ceil(${n} / ${cell.cols}) : HorizontalLayout {`, depth);
      this.emit(`spacing: ${cell.gap};`, depth + 1);
      this.emit(`for grid-col in ${cell.cols} : VerticalLayout {`, depth + 1);
      this.emit("min-width: 0px; preferred-width: 0px; horizontal-stretch: 1; alignment: LayoutAlignment.start;", depth + 2);
      this.emit(`if grid-row * ${cell.cols} + grid-col < ${n} : VerticalLayout {`, depth + 2);
      if (fn && /Function/.test(fn.type)) this.branch(renderBranches(fn.body).main ?? fn.body, depth + 3);
      this.emit("}", depth + 2);
      this.emit("}", depth + 1);
      this.emit("}", depth);
    }
    this.cells.pop();
  }

  /** `value={tab} onChange={setTab}` (or checked/onChange): a two-way binding to the state property. */
  twoWay(node, rule, attr, info, lines) {
    const target = rule.props?.[attr.name.name];
    if (typeof target !== "string" || target.startsWith("_") || !["value", "checked", "opened", "active"].includes(attr.name.name)) return false;
    const expr = attr.value?.expression;
    if (expr?.type !== "Identifier" || !this.states.has(expr.name) || !this.twoWayPartner(node, attr)) return false;
    const decl = info.properties[target];
    if (!decl || decl.dir !== "in-out") return false;
    const prop = this.property(expr.name, decl.type);
    lines.push(`${target} <=> root.${prop};`);
    this.stats.reactive += 1;
    return true;
  }

  /** The onChange that sets the same state as a value attribute, if both are on the element. */
  twoWayPartner(node, attr) {
    const attrs = node.openingElement.attributes.filter((a) => a.type === "JSXAttribute");
    const valueAttr = attrs.find((a) => ["value", "checked", "opened", "active"].includes(a.name.name));
    const changeAttr = attrs.find((a) => a.name.name === "onChange" || a.name.name === "onClose");
    const state = valueAttr?.value?.expression?.name;
    const setter = changeAttr?.value?.expression?.name;
    const s = this.setters.get(setter);
    return Boolean(state && s && s.state === state);
  }

  /** A table's column titles, taken from its header cells (`Table.Th` or `th`) as the web shows them. */
  tableColumns(node, depth) {
    const titles = [];
    walk(node, (n) => {
      if (n.type === "JSXElement" && ["Table.Th", "th"].includes(tagName(n.openingElement.name))) {
        const t = n.children.map((c) => (c.type === "JSXText" ? c.value : c.type === "JSXExpressionContainer" ? this.literal(c.expression) ?? "" : "")).join(" ").replace(/\s+/g, " ").trim();
        titles.push(t.startsWith("@tr(") || t.startsWith('"') ? t : quote(t));
      }
    });
    if (titles.length) this.emit(`columns: [${titles.map((t) => `{ title: ${t} }`).join(", ")}];`, depth);
  }

  child(node, depth) {
    if (!node) return;
    if (node.type === "JSXText") {
      const t = jsxText(node.value).trim();
      if (t) this.emit(`Text { text: ${quote(t)}; wrap: word-wrap; }`, depth);
    } else if (node.type === "JSXElement") {
      this.element(node, depth);
    } else if (node.type === "JSXFragment") {
      this.children(node.children, depth);
    } else if (node.type === "JSXExpressionContainer" && node.expression.type !== "JSXEmptyExpression") {
      this.expression(node.expression, depth);
    }
  }

  /** `{a && <X/>}`, `{a ? <X/> : <Y/>}`, `{list.map(...)}` and plain values. */
  expression(expr, depth) {
    expr = unwrap(expr);
    const open = (head) => this.emit(head, depth);
    if (expr.type === "LogicalExpression" && expr.operator === "&&") {
      open(`if root.${this.property(this.text(expr.left), "bool")} : VerticalLayout {`);
      this.branch(expr.right, depth + 1);
      return this.emit("}", depth);
    }
    if (expr.type === "ConditionalExpression") {
      const cond = this.property(this.text(expr.test), "bool");
      open(`if root.${cond} : VerticalLayout {`);
      this.branch(expr.consequent, depth + 1);
      this.emit("}", depth);
      open(`if !root.${cond} : VerticalLayout {`);
      this.branch(expr.alternate, depth + 1);
      return this.emit("}", depth);
    }
    if (expr.type === "CallExpression" && expr.callee.type === "MemberExpression" && expr.callee.property.name === "map") {
      // React's `key` identifies list items for its own diffing; Slint's `for` tracks model rows itself.
      const list = this.property(this.text(expr.callee.object), "[string]");
      const fn = expr.arguments[0];
      open(`for item in root.${list} : VerticalLayout {`);
      if (fn && /Function/.test(fn.type)) this.branch(renderBranches(fn.body).main ?? fn.body, depth + 1);
      return this.emit("}", depth);
    }
    if (isJsx(expr)) return this.child(expr, depth);
    if (expr.type === "Identifier" && expr.name === "children") return; // the component's @children
    if (expr.type === "MemberExpression" && expr.property?.name === "children") return;
    if (expr.type === "NullLiteral") return;
    const lit = this.literal(expr);
    this.emit(`Text { text: ${lit ?? `root.${this.property(this.text(expr))}`}; wrap: word-wrap; }`, depth);
  }

  /** A branch of a condition or loop: JSX, or a value shown as text, or `null`. */
  branch(node, depth) {
    node = unwrap(node);
    if (!node || node.type === "NullLiteral") return;
    if (isJsx(node)) return this.child(node, depth);
    this.expression(node, depth);
  }

  /**
   * Preview builds only, matching the web reference (a signed-in super admin, every list empty,
   * nothing loading, no errors): permission checks start true; loading, error and open states
   * false; empty checks true; data presence false. Product builds get every value from the view
   * model.
   */
  previewDefault(p) {
    if (!this.preview || p.type !== "bool") return "";
    return previewBool(p.src, this.previewDeny) ? ": true" : ": false";
  }

  /** Effects, timers, refs, queries and browser APIs: Slint hooks where one exists, markers otherwise. */
  lifecycle(body) {
    const effectsDone = new Set();
    if (body?.type === "BlockStatement") {
      for (const st of body.body) {
        const call = st.type === "ExpressionStatement" ? unwrap(st.expression) : null;
        if (call?.type !== "CallExpression" || !["useEffect", "useLayoutEffect"].includes(call.callee.name)) continue;
        effectsDone.add(call);
        this.effect(call);
      }
    }
    walk(body, (n) => {
      if (n.type === "CallExpression") {
        const callee = this.text(n.callee);
        for (const [pattern, kind] of Object.entries(this.mapping.rust)) {
          if (new RegExp(`^(${pattern})$`).test(callee)) this.rust(kind, `${callee}(...)`);
        }
      }
      if (n.type === "NewExpression" && ["WebSocket", "EventSource", "Notification", "Audio", "BroadcastChannel"].includes(n.callee.name)) this.rust(n.callee.name === "Notification" || n.callee.name === "Audio" ? "notification" : "socket", `new ${n.callee.name}(...)`);
      if (n.type === "AssignmentExpression" && this.text(n.left) === "document.title") this.rust("title", "document.title = ...; the window title comes from the view model");
    });
  }

  /**
   * `useEffect(fn, [])` runs once on mount: Slint's `init` callback. With dependencies that are
   * this component's state, `changed <prop> =>` runs it again when one changes. A returned
   * cleanup, other dependencies, or no dependency list are view-model work, marked.
   * `setInterval(fn, ms)` / `setTimeout(fn, ms)` inside become a `Timer`.
   */
  effect(call) {
    const [fn, deps] = call.arguments;
    const id = this.callback(`effect-${this.counter++}`);
    let cleanup = false;
    walk(fn?.body, (n) => {
      if (n.type === "ReturnStatement" && n.argument) cleanup = true;
      if (n.type === "CallExpression" && ["setInterval", "setTimeout"].includes(n.callee.name)) {
        const ms = staticValue(n.arguments[1]);
        const repeat = n.callee.name === "setInterval";
        if (typeof ms === "number") {
          const tick = this.callback(`${repeat ? "tick" : "timeout"}-${this.counter++}`);
          this.extra.push(`    Timer { interval: ${ms}ms; running: true; triggered => { ${repeat ? "" : "self.running = false; "}root.${tick}(); } }`);
          this.stats.reactive += 1;
        } else this.rust("timer", `${n.callee.name} with a computed delay`);
      }
    }, true);
    if (deps?.type === "ArrayExpression" && deps.elements.length === 0) {
      this.extra.push(`    init => { root.${id}(); }`);
      this.stats.lifecycle += 1;
    } else if (deps?.type === "ArrayExpression") {
      const stateDeps = deps.elements.filter((e) => e?.type === "Identifier" && this.states.has(e.name));
      for (const dep of stateDeps) {
        const prop = this.property(dep.name, this.stateType(dep.name));
        // One `changed` handler per property: effects sharing a dependency run in order.
        const handlers = this.changed.get(prop) ?? [];
        handlers.push(id);
        this.changed.set(prop, handlers);
        this.stats.lifecycle += 1;
      }
      if (stateDeps.length < deps.elements.length) this.rust("effect", `${id} depends on ${deps.elements.map((e) => (e ? this.text(e) : "")).join(", ")}: the view model reruns it`);
    } else this.rust("effect", `${id} has no dependency list: it runs after every render on the web`);
    if (cleanup) this.rust("cleanup", `${id} returns a cleanup: release in the view model's teardown`);
  }

  render(c, preamble) {
    this.lifecycle(c.body);
    // Early returns (`if (loading) return <Loader/>;`) are branches; the main view shows when none applies.
    const guards = [];
    for (const b of c.branches) {
      const cond = this.property(this.text(b.test), "bool");
      const prior = guards.map((g) => ` && !root.${g}`).join("");
      this.emit(`if root.${cond}${prior} : VerticalLayout {`, 1);
      this.branch(b.jsx, 2);
      this.emit("}", 1);
      guards.push(cond);
    }
    if (guards.length) {
      this.emit(`if ${guards.map((g) => `!root.${g}`).join(" && ")} : VerticalLayout {`, 1);
      this.child(c.jsx.type === "ConditionalExpression" ? { type: "JSXExpressionContainer", expression: c.jsx } : c.jsx, 2);
      this.emit("}", 1);
    } else this.child(c.jsx.type === "ConditionalExpression" ? { type: "JSXExpressionContainer", expression: c.jsx } : c.jsx, 1);
    const head = [`export component ${this.name} inherits VerticalLayout {`, "    alignment: LayoutAlignment.start;"];
    for (const note of this.rustNotes) head.push(`    ${note}`);
    for (const p of this.props.values()) {
      const state = this.states.get(p.src.trim());
      const given = c.defaults.get(p.src.trim());
      const init = p.init ?? (state ? this.literal(state.init) : given ? this.literal(given) : null);
      const fits = init && ((p.type === "bool" && /^(true|false)$/.test(init)) || ((p.type === "int" || p.type === "float") && /^-?\d+(\.\d+)?$/.test(init))
        || (p.type === "string" && (init.startsWith('"') || init.startsWith("@tr"))));
      const value = fits ? `: ${init}` : this.previewDefault(p);
      const inout = state || p.init || this.formFields.has(p.name);
      head.push(`    // from: ${p.src.replace(/\s+/g, " ").slice(0, 100)}`, `    ${inout ? "in-out" : "in"} property <${p.type}> ${p.name}${value};`);
    }
    for (const cb of this.callbacks.values()) head.push(`    callback ${cb.name}(${cb.args});`);
    for (const [prop, ids] of this.changed) this.extra.push(`    changed ${prop} => { ${ids.map((i) => `root.${i}();`).join(" ")} }`);
    return [...preamble, ...head, ...this.extra, ...this.lines, "    @children", "}"].join("\n");
  }
}

/** IBM Plex Sans' natural line height (hhea ascent + descent + gap over units per em). */
const Metrics_NATURAL_LINE_HEIGHT = 1.3;

/** Slint standard widgets, imported from `std-widgets.slint`. */
const STD_WIDGETS = new Set([
  "Button", "LineEdit", "ComboBox", "CheckBox", "Switch", "SpinBox", "Slider", "TextEdit",
  "StandardTableView", "TabWidget", "ScrollView", "Spinner", "ProgressIndicator", "StandardListView",
]);

/** The preview's starting value for a condition, as on the mocked web reference. */
export function previewBool(src, deny = new Set()) {
  const s = src.trim().replace(/\s+/g, " ");
  if (s.startsWith("!") && !s.startsWith("!=")) return !previewBool(s.slice(1).replace(/^\((.*)\)$/, "$1"), deny);
  if (/&&/.test(s)) return s.split("&&").every((x) => previewBool(x, deny));
  if (/\|\|/.test(s)) return s.split("||").some((x) => previewBool(x, deny));
  // Permission and feature checks: allowed, like the super admin of the web reference, unless
  // the preview is asked to deny them (--preview-deny). The runtime gate is untouched.
  if (/^(can|allow|has[A-Z]\w*(Permission|Access|Feature)|is\w*(Enabled|Allowed))[A-Z_]?\w*$/.test(s)) return !deny.has(s);
  if (/column|step|page|index|tab|width|height|level|depth/i.test(s) && /(===?|<=?|>)\s*\d/.test(s)) return false;
  if (/(===?|<=?)\s*0\b|\bempty\b|isEmpty|==\s*null|===\s*undefined|\bno[A-Z]\w*/i.test(s) && !/!==?\s*(null|undefined)/.test(s)) return true;
  if (/loading|pending|fetching|error|fail|denied|outage|unavailable|offline|open|modal|drawer|confirm|editing|selected|expanded|dirty|submitting|saving|busy|>\s*0|\.length\b|!==?\s*(null|undefined)/i.test(s)) return false;
  return /^(can|has|is|show|allow|visible|enabled)[A-Z_]|\b(can|has|show|allow)[A-Z]/.test(s);
}

/** Converts one module's source: the Slint text and its statistics. */
export function convertSource(source, fileName = "input.tsx", mapping = loadMapping(), known = new Map(), options = {}) {
  const ast = parse(source, { sourceType: "module", plugins: ["jsx", "typescript"], errorRecovery: true });
  const stats = { elements: 0, mapped: 0, strings: 0, unmapped: {}, rawHtml: {}, kit: new Set(), std: new Set(), hooks: {}, references: new Map(), webOnly: {}, inlineInText: 0, leafChildren: 0, missingStrings: 0, reactive: 0, droppedProps: {}, rust: {}, lifecycle: 0, icons: new Map(), unpassedProps: 0, recursive: 0, cssClasses: 0, menus: 0, missingIcons: new Set(), declared: new Map() };
  const own = new Set();
  const found = components(ast.program);
  for (const c of found) own.add(c.name);
  // Components of this same file are referenced in place; others come from their own file.
  const visible = new Map([...known].filter(([name]) => !own.has(name)));
  // A same-named component elsewhere must not lend this one its properties.
  for (const name of own) visible.set(name, { ...(known.get(name)?.file === fileName ? known.get(name) : {}), file: fileName });
  const imports = importsOf(ast.program);
  const cssModules = moduleImports(ast.program, options.absFile);
  const rendered = new Map();
  for (const c of found) {
    const writer = new ComponentWriter(c, { mapping, source, stats, known: visible, imports, cssModules, tablerDir: options.tablerDir, preview: Boolean(options.preview), previewDeny: new Set(options.previewDeny ?? []), strings: options.strings, formFields: new Set() });
    rendered.set(c.name, writer.render(c, []));
    stats.declared.set(c.name, {
      // The first declaration of a source name wins: it is the one a caller passes.
      props: new Map([...writer.props.values()].reverse().map((p) => [p.src, { name: p.name, type: p.type }])),
      callbacks: new Map([...writer.callbacks.values()].map((cb) => [cb.name, cb.name])),
    });
    for (const [h, n] of Object.entries(c.hooks)) stats.hooks[h] = (stats.hooks[h] ?? 0) + n;
  }
  const parts = [];
  const placed = new Set();
  const place = (name, trail = new Set()) => {
    if (placed.has(name) || trail.has(name)) return;
    trail.add(name);
    for (const other of rendered.keys()) {
      if (other !== name && new RegExp(`^\\s*${other} \\{`, "m").test(rendered.get(name))) place(other, trail);
    }
    placed.add(name);
    parts.push(rendered.get(name));
  };
  for (const name of rendered.keys()) place(name);
  const body = parts.join("\n");
  for (const g of ["Metrics", "Tone", "Shell"]) if (new RegExp(`\\b${g}\\.`).test(body)) stats.kit.add(g);
  const out = [];
  if (stats.std.size) out.push(`import { ${[...stats.std].sort().join(", ")} } from "std-widgets.slint";`);
  out.push(`import { ${[...new Set([...stats.kit, "Tokens"])].sort().join(", ")} } from "@medbrains-gui-kit/kit.slint";`);
  const byFile = new Map();
  for (const [name, file] of stats.references) {
    if (own.has(name)) continue;
    const target = file.replace(/\.tsx$/, ".slint");
    let slintFile = path.relative(path.dirname(fileName), target);
    if (!slintFile.startsWith(".")) slintFile = `./${slintFile}`;
    byFile.set(slintFile, [...(byFile.get(slintFile) ?? []), name]);
  }
  for (const [file, names] of byFile) out.push(`import { ${names.sort().join(", ")} } from "${file}";`);
  const header = [
    `// GENERATED from ${fileName} by @medbrains/react-to-slint (mapping version ${mapping.version}).`,
    "// View only: lines marked `rust:` are logic for the Rust view model (docs/architecture/OS-NATIVE-GUI.md).",
  ];
  return { slint: `${[...header, ...out, "", ...parts].join("\n")}\n`, stats, components: parts.length };
}

/**
 * Converts one file from disk. `known` maps our component names to `{ file, props, callbacks }`;
 * `base` is the project root, so output and imports keep the source tree's folders.
 */
export function convertFile(file, mapping = loadMapping(), known = new Map(), base = path.dirname(file), options = {}) {
  const rel = (f) => path.relative(base, f);
  const relKnown = new Map([...known].map(([n, k]) => [n, { ...k, file: rel(k.file) }]));
  return convertSource(fs.readFileSync(file, "utf8"), rel(file), mapping, relKnown, { ...options, absFile: path.resolve(file) });
}

/** Every component defined in a source tree, `name -> { file }`, so references across files convert. */
export function indexComponents(files) {
  const known = new Map();
  for (const file of files) {
    const ast = parse(fs.readFileSync(file, "utf8"), { sourceType: "module", plugins: ["jsx", "typescript"], errorRecovery: true });
    for (const c of components(ast.program)) if (!known.has(c.name)) known.set(c.name, { file });
  }
  return known;
}
