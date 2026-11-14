#!/usr/bin/env node
/**
 * Writes `src/mantine-defaults.json`: the default props every Mantine component starts from, so a
 * converted element without `gap` gets Mantine's `gap="md"`, not Slint's 0px.
 *
 *   mantine-defaults [--mantine node_modules/@mantine] [--theme packages/design-system/src/theme/mantine.ts]
 *
 * Two sources, in order: each component's own `defaultProps` in the installed Mantine release
 * (`esm/components/<Name>/<Name>.mjs`), then the app theme's `components.<Name>.defaultProps`,
 * which Mantine merges over them (https://mantine.dev/theming/default-props/). Only literal
 * values are kept: a default computed at runtime is not a default the converter can apply.
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "../../..");

/** A literal JavaScript value, or undefined when the expression is not a plain literal. */
function literal(node) {
  if (!node) return undefined;
  if (["StringLiteral", "NumericLiteral", "BooleanLiteral"].includes(node.type)) return node.value;
  if (node.type === "UnaryExpression" && node.operator === "-" && node.argument.type === "NumericLiteral") return -node.argument.value;
  if (node.type === "ObjectExpression") {
    const out = {};
    for (const p of node.properties) {
      const v = literal(p.value);
      if (p.key && v !== undefined) out[p.key.name ?? p.key.value] = v;
    }
    return out;
  }
  return undefined;
}

/** `const defaultProps = { ... }` of one Mantine component module, as plain values. */
function componentDefaults(file) {
  const source = fs.readFileSync(file, "utf8");
  const ast = parse(source, { sourceType: "module" });
  for (const st of ast.program.body) {
    const decl = st.type === "VariableDeclaration" ? st.declarations.find((d) => d.id.name === "defaultProps") : null;
    if (decl) return literal(decl.init) ?? {};
  }
  return null;
}

/** `components: { Card: Card.extend({ defaultProps: { ... } }) }` from the app theme. */
function themeDefaults(file) {
  const ast = parse(fs.readFileSync(file, "utf8"), { sourceType: "module", plugins: ["typescript"] });
  const out = {};
  const visit = (node) => {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "ObjectProperty" && (node.key.name ?? node.key.value) === "components" && node.value.type === "ObjectExpression") {
      for (const p of node.value.properties) {
        // Either `Card.extend({ defaultProps })` or a plain `Text: { defaultProps }`.
        const arg = p.value?.type === "CallExpression" ? p.value.arguments[0] : p.value;
        const dp = arg?.type === "ObjectExpression" ? arg.properties.find((q) => (q.key?.name ?? q.key?.value) === "defaultProps") : null;
        if (dp) out[p.key.name ?? p.key.value] = literal(dp.value) ?? {};
      }
      return;
    }
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v.type === "string") visit(v);
    }
  };
  visit(ast.program);
  return out;
}

/**
 * Defaults of the `components/ui` seam: `function Button({ tone = "neutral", size = "sm" })` and
 * `forwardRef(function Button({ ... }))`, read from the destructured parameter of each export.
 */
export function seamDefaults(dir) {
  const out = {};
  for (const f of fs.readdirSync(dir).filter((n) => /^[A-Z].*\.tsx$/.test(n) && !/\.(test|stories)\.tsx$/.test(n)).sort()) {
    const ast = parse(fs.readFileSync(path.join(dir, f), "utf8"), { sourceType: "module", plugins: ["typescript", "jsx"] });
    const take = (name, fn) => {
      const param = fn?.params?.[0];
      if (!name || !/^[A-Z]/.test(name) || param?.type !== "ObjectPattern") return;
      const d = {};
      for (const p of param.properties) {
        if (p.type !== "ObjectProperty" || p.value.type !== "AssignmentPattern") continue;
        const v = literal(p.value.right);
        if (v !== undefined) d[p.key.name] = v;
      }
      if (Object.keys(d).length) out[name] = d;
    };
    for (let st of ast.program.body) {
      if (st.type === "ExportNamedDeclaration") st = st.declaration;
      if (st?.type === "FunctionDeclaration") take(st.id?.name, st);
      for (const decl of st?.type === "VariableDeclaration" ? st.declarations : []) {
        const init = decl.init?.type === "CallExpression" ? decl.init.arguments.find((a) => /Function/.test(a.type)) : decl.init;
        if (init && /Function/.test(init.type)) take(decl.id.name, init);
      }
    }
  }
  return out;
}

export function mantineDefaults({ mantineDir, themeFile, seamDir }) {
  const packages = {};
  const version = {};
  for (const pkg of ["core", "dates", "charts"]) {
    const dir = path.join(mantineDir, pkg);
    if (!fs.existsSync(dir)) continue;
    version[pkg] = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version;
    // core and dates keep components under esm/components; charts puts them straight under esm.
    const comps = fs.existsSync(path.join(dir, "esm/components")) ? path.join(dir, "esm/components") : path.join(dir, "esm");
    for (const name of fs.readdirSync(comps).sort()) {
      const file = path.join(comps, name, `${name}.mjs`);
      if (!fs.existsSync(file)) continue;
      const d = componentDefaults(file);
      if (d && Object.keys(d).length) packages[name] = d;
    }
  }
  const theme = themeDefaults(themeFile);
  const merged = {};
  for (const name of new Set([...Object.keys(packages), ...Object.keys(theme)])) {
    merged[name] = { ...(packages[name] ?? {}), ...(theme[name] ?? {}) };
  }
  return {
    _source: `Mantine ${JSON.stringify(version)} component defaultProps, then the app theme's components.<Name>.defaultProps (${path.relative(ROOT, themeFile)}). Generated by bin/mantine-defaults.mjs.`,
    components: Object.fromEntries(Object.entries(merged).sort()),
    seam: seamDir ? seamDefaults(seamDir) : {},
  };
}

function main(argv) {
  const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
  const mantineDir = path.resolve(flag("--mantine", path.join(ROOT, "node_modules/@mantine")));
  const themeFile = path.resolve(flag("--theme", path.join(ROOT, "packages/design-system/src/theme/mantine.ts")));
  const seamDir = path.resolve(flag("--seam", path.join(ROOT, "apps/web/src/components/ui")));
  const out = flag("--out", path.join(HERE, "../src/mantine-defaults.json"));
  fs.writeFileSync(out, `${JSON.stringify(mantineDefaults({ mantineDir, themeFile, seamDir }), null, 1)}\n`);
  process.stdout.write(`wrote ${out}\n`);
  return 0;
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(new URL(import.meta.url).pathname)) {
  process.exit(main(process.argv.slice(2)));
}
