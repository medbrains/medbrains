#!/usr/bin/env node
/**
 * Counts which Mantine and `components/ui` seam components the web app renders, and with which
 * props, so the conversion table in docs/CONVERSIONS.md covers what the source really uses.
 *
 *   usage <apps/web/src> [--json FILE]
 *
 * A tag counts when its root name is imported from `@mantine/*` or from the seam
 * (`@/components/ui`, or a relative path into `components/ui`). `Table.Td` counts under
 * `Table.Td`. Props are counted per tag; spread props count as `{...}`.
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

/** `.tsx` files under a directory, without tests and stories. */
function tsxFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(p));
    else if (p.endsWith(".tsx") && !/\.(test|stories)\.tsx$/.test(p)) out.push(p);
  }
  return out;
}

/** Where an import comes from, as a short library name, or null when it is not counted. */
function library(source) {
  if (source.startsWith("@mantine/")) return source;
  if (source === "@/components/ui" || /(^|\/)components\/ui(\/|$)/.test(source)) return "seam";
  return null;
}

/** The JSX tag name as written: `Button`, `Table.Td`. */
function tagName(name) {
  if (name.type === "JSXIdentifier") return name.name;
  if (name.type === "JSXMemberExpression") return `${tagName(name.object)}.${name.property.name}`;
  return "";
}

/** `{ "<lib> <Tag>": { count, files, props: { name: count } } }` over every file. */
export function countUsage(files) {
  const usage = {};
  for (const file of files) {
    const ast = parse(fs.readFileSync(file, "utf8"), { sourceType: "module", plugins: ["jsx", "typescript"], errorRecovery: true });
    const imported = new Map();
    for (const st of ast.program.body) {
      if (st.type !== "ImportDeclaration") continue;
      const lib = library(st.source.value);
      if (!lib) continue;
      for (const s of st.specifiers) if (s.type === "ImportSpecifier") imported.set(s.local.name, { lib, name: s.imported.name ?? s.imported.value });
    }
    if (!imported.size) continue;
    const seen = new Set();
    const visit = (node) => {
      if (!node || typeof node.type !== "string") return;
      if (node.type === "JSXOpeningElement") {
        const tag = tagName(node.name);
        const [root, ...rest] = tag.split(".");
        const from = imported.get(root);
        if (from) {
          const key = `${from.lib} ${[from.name, ...rest].join(".")}`;
          const entry = (usage[key] ??= { count: 0, files: 0, props: {} });
          entry.count += 1;
          if (!seen.has(key)) entry.files += 1;
          seen.add(key);
          for (const a of node.attributes) {
            const prop = a.type === "JSXSpreadAttribute" ? "{...}" : a.name.name;
            entry.props[prop] = (entry.props[prop] ?? 0) + 1;
          }
        }
      }
      for (const v of Object.values(node)) {
        if (Array.isArray(v)) v.forEach(visit);
        else if (v && typeof v.type === "string") visit(v);
      }
    };
    visit(ast.program);
  }
  return usage;
}

function main(argv) {
  const dir = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--json") ?? "apps/web/src";
  const json = argv.includes("--json") ? argv[argv.indexOf("--json") + 1] : null;
  const usage = countUsage(tsxFiles(dir));
  const rows = Object.entries(usage).sort((a, b) => b[1].count - a[1].count);
  if (json) fs.writeFileSync(json, `${JSON.stringify(Object.fromEntries(rows), null, 1)}\n`);
  for (const [key, e] of rows) {
    const props = Object.entries(e.props).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${n}`).join(", ");
    process.stdout.write(`${key}\t${e.count}\t${e.files} files\t${props}\n`);
  }
  return 0;
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(new URL(import.meta.url).pathname)) {
  process.exit(main(process.argv.slice(2)));
}
