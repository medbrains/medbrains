/**
 * Converts React + Mantine screens into Slint view skeletons, and counts what could not be mapped.
 *
 * Views only: hooks, queries and handlers become declared properties and callbacks, and the
 * report lists the hooks as the logic that moves into a Rust view model
 * (docs/architecture/OS-NATIVE-GUI.md, transition layer).
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

const HERE = path.dirname(new URL(import.meta.url).pathname);

/** Slint standard widgets, imported from `std-widgets.slint`. */
const STD_WIDGETS = new Set([
  "Button", "LineEdit", "ComboBox", "CheckBox", "Switch", "SpinBox", "Slider", "TextEdit",
  "StandardTableView", "TabWidget", "ScrollView", "Spinner", "ProgressIndicator",
]);

/** Mantine size and colour names, and the design token each becomes in the kit's `Tokens` global. */
const SIZE_TOKENS = new Set(["xs", "sm", "md", "lg", "xl"]);
const TOKEN_PROPS = { spacing: "space", padding: "space", "font-size": "font", color: "color" };
const COLOR_ALIASES = { dimmed: "text-muted", red: "danger", green: "success", orange: "warning", yellow: "warning", blue: "primary", gray: "text-muted" };
/** Slint properties that take numbers rather than text. */
const NUMBER_PROPS = new Set(["value", "minimum", "maximum", "progress", "current-index", "total", "page"]);

/** A string literal for a token property as its `Tokens` value, or null when it is not a token. */
function tokenValue(target, value) {
  const kind = TOKEN_PROPS[target];
  if (!kind) return null;
  if (kind === "color") return `Tokens.color-${COLOR_ALIASES[value] ?? value.replace(/\./g, "-")}`;
  if (SIZE_TOKENS.has(value)) return `Tokens.${kind}-${value}`;
  if (/^\d+$/.test(value)) return `${value}px`;
  return null;
}

/** Flattens `mapping.json` into `tag -> rule`, plus the wrappers that are dropped. */
export function loadMapping(file = path.join(HERE, "mapping.json")) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const rules = {};
  for (const [group, entries] of Object.entries(raw)) {
    if (group.startsWith("_") || group === "dropped" || group === "version" || group === "html" || group === "webOnly") continue;
    Object.assign(rules, entries);
  }
  return { rules, html: raw.html ?? {}, webOnly: new Set(raw.webOnly ?? []), dropped: new Set(raw.dropped), version: raw.version };
}

/** A Slint identifier for a JavaScript expression, unique within one component. */
function ident(text, used) {
  let base = text.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "value";
  if (/^[0-9]/.test(base)) base = `v-${base}`;
  base = base.slice(0, 40).replace(/-+$/, "");
  let name = base;
  for (let i = 2; used.has(name); i += 1) name = `${base}-${i}`;
  used.add(name);
  return name;
}

/** A Slint string literal. */
const quote = (s) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const isJsx = (n) => n && (n.type === "JSXElement" || n.type === "JSXFragment");

/** The JSX tag name as written: `Button`, `Table.Td`, `div`. */
function tagName(name) {
  if (name.type === "JSXIdentifier") return name.name;
  if (name.type === "JSXMemberExpression") return `${tagName(name.object)}.${name.property.name}`;
  return "";
}

/** The first JSX value a function body returns, without entering nested functions. */
function returnedJsx(body) {
  if (isJsx(body)) return body;
  if (body?.type !== "BlockStatement") return null;
  let found = null;
  const visit = (node) => {
    if (found || !node || typeof node.type !== "string") return;
    if (node.type === "ReturnStatement" && isJsx(node.argument)) {
      found = node.argument;
      return;
    }
    if (/Function/.test(node.type)) return;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value.type === "string") visit(value);
    }
  };
  body.body.forEach(visit);
  return found;
}

/** Hook calls (`useState`, `useQuery`, ...) in a function body, counted by name. */
function hookCalls(body) {
  const hooks = {};
  const visit = (node) => {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "CallExpression" && node.callee.type === "Identifier" && /^use[A-Z]/.test(node.callee.name)) {
      hooks[node.callee.name] = (hooks[node.callee.name] ?? 0) + 1;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value.type === "string") visit(value);
    }
  };
  visit(body);
  return hooks;
}

/** Every PascalCase function component in a module, top level or exported. */
function components(program) {
  const out = [];
  const consider = (name, fn) => {
    if (!name || !/^[A-Z]/.test(name) || !fn?.body) return;
    const jsx = returnedJsx(fn.body);
    if (jsx) out.push({ name, jsx, hooks: hookCalls(fn.body) });
  };
  for (let st of program.body) {
    if (st.type === "ExportNamedDeclaration" || st.type === "ExportDefaultDeclaration") st = st.declaration ?? st;
    if (st?.type === "FunctionDeclaration") consider(st.id?.name, st);
    if (st?.type === "VariableDeclaration") {
      for (const d of st.declarations) {
        const init = d.init?.type === "CallExpression" ? d.init.arguments[0] : d.init; // forwardRef(fn), memo(fn)
        if (init && /Function/.test(init.type)) consider(d.id?.name, init);
      }
    }
  }
  return out;
}

/** Writes one component, collecting its properties, callbacks and the gaps it meets. */
class ComponentWriter {
  constructor(name, mapping, source, stats, known) {
    Object.assign(this, { name, mapping, source, stats, known });
    this.props = new Map();
    this.callbacks = new Set();
    this.used = new Set();
    this.lines = [];
  }

  /** Source text of a node. */
  text(node) {
    return this.source.slice(node.start, node.end);
  }

  /**
   * A Slint value for an expression when one exists without a property: translated text
   * (`t("ns.key")` becomes `@tr("ns.key")`), string and number literals, and plain templates.
   * Returns null when the value has to come from the view model.
   */
  literal(expr) {
    if (!expr) return null;
    if (expr.type === "StringLiteral") return quote(expr.value);
    if (expr.type === "NumericLiteral") return String(expr.value);
    if (expr.type === "BooleanLiteral") return String(expr.value);
    if (expr.type === "TemplateLiteral" && expr.expressions.length === 0) return quote(expr.quasis[0].value.cooked);
    if (expr.type === "CallExpression" && expr.callee.type === "Identifier" && expr.callee.name === "t") {
      const [key, args] = expr.arguments;
      if (key?.type !== "StringLiteral") return null;
      this.stats.strings += 1;
      if (!args) return `@tr(${quote(key.value)})`;
      // `t("key", { count: n })`: Slint's @tr takes positional values; each becomes a property.
      if (args.type === "ObjectExpression") {
        const values = args.properties.map((p) => `root.${this.property(this.text(p.value ?? p))}`);
        return `@tr(${quote(key.value)}${values.map((v) => `, ${v}`).join("")})`;
      }
    }
    return null;
  }

  /** The Slint property standing for a JavaScript expression, declared once. */
  property(exprText, type = "string") {
    const key = `${type}:${exprText}`;
    if (!this.props.has(key)) this.props.set(key, { name: ident(exprText, this.used), type, src: exprText });
    return this.props.get(key).name;
  }

  emit(line, depth) {
    this.lines.push(`${"    ".repeat(depth)}${line}`);
  }

  /** One JSX attribute as a Slint binding. */
  binding(target, attr, depth) {
    if (target.startsWith("_")) return;
    const negate = target.endsWith("!");
    const name = negate ? target.slice(0, -1) : target;
    const attrName = attr.name.name;
    const value = attr.value;
    if (!value) return this.emit(`${name}: ${negate ? "false" : "true"};`, depth);
    if (value.type === "StringLiteral") {
      return this.emit(`${name}: ${tokenValue(name, value.value) ?? quote(value.value)};`, depth);
    }
    const expr = value.type === "JSXExpressionContainer" ? value.expression : value;
    if (/^on[A-Z]/.test(attrName)) {
      const cb = ident(attrName.slice(2), this.used);
      this.callbacks.add(cb);
      return this.emit(`${name} => { root.${cb}(); }`, depth);
    }
    const lit = negate ? null : this.literal(expr);
    if (lit) {
      const token = expr.type === "StringLiteral" ? tokenValue(name, expr.value) : null;
      return this.emit(`${name}: ${token ?? lit};`, depth);
    }
    const type = ["checked", "enabled", "busy"].includes(name) ? "bool" : NUMBER_PROPS.has(name) ? "int" : "string";
    this.emit(`${name}: ${negate ? "!" : ""}root.${this.property(this.text(expr), type)};`, depth);
  }

  element(node, depth) {
    const tag = tagName(node.openingElement.name);
    const { rules, dropped } = this.mapping;
    this.stats.elements += 1;
    if (dropped.has(tag) || tag === "") return this.children(node.children, depth);
    if (/^[a-z]/.test(tag)) {
      // Raw HTML breaks the components-only rule, so it is always reported, and converted when it can be.
      this.stats.rawHtml[tag] = (this.stats.rawHtml[tag] ?? 0) + 1;
      if (!this.mapping.html[tag]) {
        this.emit(`// raw <${tag}> in the source: use a layout component`, depth);
        return this.children(node.children, depth);
      }
      const html = this.mapping.html[tag];
      if (html.slint === "_passthrough") {
        this.stats.mapped += 1;
        return this.children(node.children, depth);
      }
      return this.mapped(node, html, depth);
    }
    if (this.mapping.webOnly.has(tag)) {
      // Diagram editors and similar: built for a mouse in a browser, kept web-only on purpose.
      this.stats.webOnly[tag] = (this.stats.webOnly[tag] ?? 0) + 1;
      this.emit(`// web-only: <${tag}>`, depth);
      return;
    }
    const known = rules[tag] || rules[tag.split(".")[0]] ? null : this.known.get(tag);
    if (known) {
      // One of our own components: a reference to its own converted file.
      this.stats.mapped += 1;
      this.stats.references.set(tag, known);
      this.emit(`${tag} { }`, depth);
      return;
    }
    if (tag === "Controller") {
      // react-hook-form: the screen shows whatever `render` returns; the form state moves to the view model.
      const render = node.openingElement.attributes.find((a) => a.name?.name === "render");
      const fn = render?.value?.expression;
      this.stats.mapped += 1;
      if (fn && /Function/.test(fn.type)) this.branch(returnedJsx(fn.body) ?? fn.body, depth);
      return;
    }
    if (/^Icon[A-Z]/.test(tag)) {
      this.stats.mapped += 1;
      this.stats.kit.add("MbIcon");
      const name = tag.slice(4).replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
      return this.emit(`MbIcon { name: ${quote(name)}; }`, depth);
    }
    const rule = rules[tag] ?? rules[tag.split(".")[0]];
    if (!rule) {
      this.stats.unmapped[tag] = (this.stats.unmapped[tag] ?? 0) + 1;
      this.emit(`// unmapped: <${tag}>`, depth);
      return this.children(node.children, depth);
    }
    if (rule.slint === "_passthrough" || tag.includes(".")) {
      this.stats.mapped += 1;
      return this.children(node.children, depth);
    }
    this.mapped(node, rule, depth);
  }

  /** Emits a mapped element: fixed properties, attribute bindings, then children or a label. */
  mapped(node, rule, depth) {
    this.stats.mapped += 1;
    if (rule.slint.startsWith("Mb")) this.stats.kit.add(rule.slint);
    else if (STD_WIDGETS.has(rule.slint)) this.stats.std.add(rule.slint);
    this.emit(`${rule.slint} {`, depth);
    for (const [k, v] of Object.entries(rule.fixed ?? {})) this.emit(`${k}: ${v};`, depth + 1);
    for (const attr of node.openingElement.attributes) {
      if (attr.type !== "JSXAttribute") continue;
      const target = rule.props[attr.name.name];
      if (target) this.binding(target, attr, depth + 1);
    }
    if (rule.props.children) {
      const label = node.children.filter((c) => c.type === "JSXText").map((c) => c.value.trim()).join(" ").trim();
      if (label) this.emit(`${rule.props.children}: ${quote(label)};`, depth + 1);
    } else if (rule.slint === "Text") {
      this.textChildren(node.children, depth + 1);
    } else {
      this.children(node.children, depth + 1);
    }
    this.emit("}", depth);
  }

  /**
   * A Slint `Text` holds one string, not children: text and values become one `text` binding
   * joined with `+`; element children (an inline badge, a link) are reported as needing a layout.
   */
  textChildren(list, depth) {
    const parts = [];
    for (const c of list) {
      if (c.type === "JSXText") {
        const s = c.value.replace(/\s+/g, " ");
        if (s.trim()) parts.push(quote(s.trim()));
      } else if (c.type === "JSXExpressionContainer" && c.expression.type !== "JSXEmptyExpression") {
        if (isJsx(c.expression) || c.expression.type === "LogicalExpression" || c.expression.type === "ConditionalExpression") {
          this.stats.inlineInText += 1;
          parts.push(`root.${this.property(this.text(c.expression))}`);
        } else {
          parts.push(this.literal(c.expression) ?? `root.${this.property(this.text(c.expression))}`);
        }
      } else if (c.type === "JSXElement") {
        this.stats.inlineInText += 1;
        parts.push(`root.${this.property(this.text(c))}`);
      }
    }
    if (parts.length) this.emit(`text: ${parts.join(" + ")};`, depth);
  }

  children(list, depth) {
    for (const child of list) this.child(child, depth);
  }

  child(node, depth) {
    if (!node) return;
    if (node.type === "JSXText") {
      const t = node.value.trim().replace(/\s+/g, " ");
      if (t) this.emit(`Text { text: ${quote(t)}; }`, depth);
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
    if (expr.type === "LogicalExpression" && expr.operator === "&&") {
      this.emit(`if root.${this.property(this.text(expr.left), "bool")} : VerticalLayout {`, depth);
      this.branch(expr.right, depth + 1);
      return this.emit("}", depth);
    }
    if (expr.type === "ConditionalExpression") {
      const cond = this.property(this.text(expr.test), "bool");
      this.emit(`if root.${cond} : VerticalLayout {`, depth);
      this.branch(expr.consequent, depth + 1);
      this.emit("}", depth);
      this.emit(`if !root.${cond} : VerticalLayout {`, depth);
      this.branch(expr.alternate, depth + 1);
      return this.emit("}", depth);
    }
    if (expr.type === "CallExpression" && expr.callee.type === "MemberExpression" && expr.callee.property.name === "map") {
      const list = this.property(this.text(expr.callee.object), "[string]");
      const fn = expr.arguments[0];
      this.emit(`for item in root.${list} : VerticalLayout {`, depth);
      if (fn && /Function/.test(fn.type)) this.branch(returnedJsx(fn.body) ?? fn.body, depth + 1);
      return this.emit("}", depth);
    }
    if (isJsx(expr)) return this.child(expr, depth);
    const lit = this.literal(expr);
    this.emit(`Text { text: ${lit ?? `root.${this.property(this.text(expr))}`}; }`, depth);
  }

  /** A branch of a condition or loop: JSX, or a value shown as text, or `null`. */
  branch(node, depth) {
    if (!node || node.type === "NullLiteral") return;
    if (isJsx(node)) return this.child(node, depth);
    this.expression(node, depth);
  }

  render(jsx) {
    this.child(jsx, 1);
    const head = [`export component ${this.name} inherits Rectangle {`];
    for (const p of this.props.values()) {
      head.push(`    // from: ${p.src.replace(/\s+/g, " ").slice(0, 100)}`, `    in property <${p.type}> ${p.name};`);
    }
    for (const cb of this.callbacks) head.push(`    callback ${cb}();`);
    return [...head, ...this.lines, "}"].join("\n");
  }
}

/** Converts one module's source: the Slint text and its statistics. */
export function convertSource(source, fileName = "input.tsx", mapping = loadMapping(), known = new Map()) {
  const ast = parse(source, { sourceType: "module", plugins: ["jsx", "typescript"], errorRecovery: true });
  const stats = { elements: 0, mapped: 0, strings: 0, unmapped: {}, rawHtml: {}, kit: new Set(), std: new Set(), hooks: {}, references: new Map(), webOnly: {}, inlineInText: 0 };
  const own = new Set();
  const parts = [];
  const found = components(ast.program);
  for (const c of found) own.add(c.name);
  // Components of this same file are referenced in place; others come from their own file.
  const visible = new Map([...known].filter(([name]) => !own.has(name)));
  for (const name of own) visible.set(name, null);
  for (const c of found) {
    const writer = new ComponentWriter(c.name, mapping, source, stats, new Map([...visible].map(([n, f]) => [n, f ?? fileName])));
    parts.push(writer.render(c.jsx));
    for (const [h, n] of Object.entries(c.hooks)) stats.hooks[h] = (stats.hooks[h] ?? 0) + n;
  }
  const imports = [];
  if (stats.std.size) imports.push(`import { ${[...stats.std].sort().join(", ")} } from "std-widgets.slint";`);
  const kit = [...stats.kit, "Tokens"].sort();
  imports.push(`import { ${kit.join(", ")} } from "@medbrains-gui-kit/kit.slint";`);
  const byFile = new Map();
  for (const [name, file] of stats.references) {
    if (own.has(name)) continue;
    const slintFile = `./${path.basename(file).replace(/\.tsx$/, ".slint")}`;
    byFile.set(slintFile, [...(byFile.get(slintFile) ?? []), name]);
  }
  for (const [file, names] of byFile) imports.push(`import { ${names.sort().join(", ")} } from "${file}";`);
  const header = [
    `// GENERATED from ${fileName} by @medbrains/react-to-slint (mapping version ${mapping.version}).`,
    "// View skeleton only: logic moves to a Rust view model (docs/architecture/OS-NATIVE-GUI.md).",
  ];
  return { slint: `${[...header, ...imports, "", ...parts].join("\n")}\n`, stats, components: parts.length };
}

/** Converts one file from disk; `known` maps our component names to the file defining them. */
export function convertFile(file, mapping = loadMapping(), known = new Map()) {
  return convertSource(fs.readFileSync(file, "utf8"), path.basename(file), mapping, known);
}

/** Every component defined in a source tree, `name -> file`, so references across files convert. */
export function indexComponents(files) {
  const known = new Map();
  for (const file of files) {
    const ast = parse(fs.readFileSync(file, "utf8"), { sourceType: "module", plugins: ["jsx", "typescript"], errorRecovery: true });
    for (const c of components(ast.program)) if (!known.has(c.name)) known.set(c.name, file);
  }
  return known;
}
