#!/usr/bin/env node
/**
 * Command line for @medbrains/react-to-slint.
 *
 *   react-to-slint <file.tsx|dir>... [--project DIR] [--out DIR] [--report FILE] [--preview]
 *                  [--strings DIR] [--icons DIR] [--tabler DIR]
 *
 * Writes one `.slint` per converted file into `--out`, copies the Tabler icons the screens use
 * into the kit (`--icons`, default the preview kit's `icons/`), and prints what mapped, what was
 * dropped and why, which kit components are needed and what moves into Rust view models.
 */
import fs from "node:fs";
import path from "node:path";
import { convertFile, indexComponents, loadMapping, loadStrings } from "../src/convert.mjs";
import { writeIcons } from "../src/icons.mjs";
import { KIT_DIR } from "../src/slint-types.mjs";

/** `.tsx` files under the inputs, without tests and stories. */
function expand(inputs) {
  const files = [];
  for (const p of inputs) {
    if (fs.statSync(p).isDirectory()) files.push(...expand(fs.readdirSync(p).map((f) => path.join(p, f))));
    else if (p.endsWith(".tsx") && !/\.(test|stories)\.tsx$/.test(p)) files.push(p);
  }
  return files;
}

/** The value after a flag, or null. */
const flag = (argv, name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);

/** The most frequent entries of a count map, as text. */
const top = (counts, n = 15) =>
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ") || "none";

const FLAGS = ["--out", "--report", "--project", "--strings", "--icons", "--tabler"];

/** Converts every file, once to learn each component's properties and once to pass them. */
function convertAll(files, known, base, options) {
  const mapping = loadMapping();
  const results = new Map();
  for (let pass = 1; pass <= 2; pass += 1) {
    for (const file of files) {
      const r = convertFile(path.resolve(file), mapping, known, base, options);
      results.set(file, r);
      if (pass === 1) {
        for (const [name, decl] of r.stats.declared) {
          const k = known.get(name);
          if (k && path.resolve(k.file) === path.resolve(file)) Object.assign(k, decl);
        }
      }
    }
  }
  return results;
}

function main(argv) {
  const out = flag(argv, "--out");
  const reportFile = flag(argv, "--report");
  const project = flag(argv, "--project");
  const inputs = argv.filter((a, i) => !a.startsWith("--") && !FLAGS.includes(argv[i - 1]));
  if (!inputs.length) {
    process.stderr.write("usage: react-to-slint <file.tsx|dir>... [--project DIR] [--out DIR] [--report FILE] [--preview]\n");
    return 2;
  }
  // Our own components anywhere in the project, so a reference to one converts instead of failing.
  const indexed = indexComponents(expand(project ? [project] : inputs));
  const known = new Map([...indexed].map(([n, k]) => [n, { file: path.resolve(k.file) }]));
  // English text for t("key"), from the web app's language files next to its source.
  const strings = loadStrings(flag(argv, "--strings") ?? path.resolve(project ?? ".", "../public/locales/en"));
  const base = path.resolve(project ?? (fs.statSync(inputs[0]).isDirectory() ? inputs[0] : path.dirname(inputs[0])));
  const files = expand(inputs);
  const results = convertAll(files, known, base, { preview: argv.includes("--preview"), strings });
  const total = { files: 0, components: 0, elements: 0, mapped: 0, strings: 0, reactive: 0, lifecycle: 0, unpassed: 0, unmapped: {}, rawHtml: {}, webOnly: {}, droppedProps: {}, rust: {}, kit: new Set(), hooks: {}, icons: new Map() };
  for (const file of files) {
    const { slint, stats, components } = results.get(file);
    if (!components) continue;
    total.files += 1;
    total.components += components;
    total.elements += stats.elements;
    total.mapped += stats.mapped;
    total.strings += stats.strings;
    total.reactive += stats.reactive;
    total.lifecycle += stats.lifecycle;
    total.unpassed += stats.unpassedProps;
    for (const key of ["unmapped", "rawHtml", "hooks", "webOnly", "droppedProps", "rust"]) {
      for (const [k, v] of Object.entries(stats[key])) total[key][k] = (total[key][k] ?? 0) + v;
    }
    for (const k of stats.kit) total.kit.add(k);
    for (const [k, v] of stats.icons) total.icons.set(k, v);
    if (out) {
      // The source tree's folders are kept, so files with the same name do not overwrite each other.
      const target = path.join(out, path.relative(base, path.resolve(file)).replace(/\.tsx$/, ".slint"));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, slint);
    }
  }
  const tabler = flag(argv, "--tabler") ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../node_modules/@tabler/icons");
  const missingIcons = fs.existsSync(tabler) ? writeIcons(total.icons, tabler, flag(argv, "--icons") ?? path.join(KIT_DIR, "icons")) : [...total.icons.keys()];
  const webOnly = Object.values(total.webOnly).reduce((a, b) => a + b, 0);
  const convertible = total.elements - webOnly;
  const pct = convertible ? ((100 * total.mapped) / convertible).toFixed(1) : "0";
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const lines = [
    `files ${total.files}, components ${total.components}, elements ${total.elements}`,
    `mapped ${total.mapped} of ${convertible} convertible (${pct}%); web-only by design: ${top(total.webOnly)}`,
    `translated strings converted to @tr(): ${total.strings}`,
    `reactive bindings (state, setters, two-way, tabs, timers): ${total.reactive}; lifecycle hooks (init, changed): ${total.lifecycle}`,
    `icons: ${total.icons.size} Tabler SVGs${missingIcons.length ? `, not found: ${missingIcons.join(", ")}` : ""}`,
    `unmapped: ${top(total.unmapped)}`,
    `props not converted (${sum(total.droppedProps)}, each with its reason in the file): ${top(total.droppedProps, 25)}`,
    `props not passed to our own components: ${total.unpassed}`,
    `moves to Rust view models (${sum(total.rust)}, marked // rust:): ${top(total.rust, 30)}`,
    `raw HTML (breaks the components rule; converted where possible): ${top(total.rawHtml)}`,
    `kit components needed: ${[...total.kit].sort().join(", ") || "none"}`,
    `hooks: ${top(total.hooks)}`,
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  if (reportFile) fs.writeFileSync(reportFile, `${lines.join("\n")}\n`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
