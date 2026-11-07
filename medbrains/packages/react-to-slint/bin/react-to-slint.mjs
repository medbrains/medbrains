#!/usr/bin/env node
/**
 * Command line for @medbrains/react-to-slint.
 *
 *   react-to-slint <file.tsx|dir>... [--out DIR] [--report FILE]
 *
 * Writes one `.slint` per converted file into `--out`, and prints a summary of what mapped,
 * what did not, which kit components are needed and which hooks must move into view models.
 */
import fs from "node:fs";
import path from "node:path";
import { convertFile, indexComponents, loadMapping, loadStrings } from "../src/convert.mjs";

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
const top = (counts) =>
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ") || "none";

function main(argv) {
  const out = flag(argv, "--out");
  const reportFile = flag(argv, "--report");
  const project = flag(argv, "--project");
  const inputs = argv.filter((a, i) => !a.startsWith("--") && !["--out", "--report", "--project"].includes(argv[i - 1]));
  if (!inputs.length) {
    process.stderr.write("usage: react-to-slint <file.tsx|dir>... [--project DIR] [--out DIR] [--report FILE] [--preview]\n");
    return 2;
  }
  const mapping = loadMapping();
  // Our own components anywhere in the project, so a reference to one converts instead of failing.
  const known = indexComponents(expand(project ? [project] : inputs));
  // English text for t("key"), from the web app's language files next to its source.
  const strings = loadStrings(flag(argv, "--strings") ?? path.resolve(project ?? ".", "../public/locales/en"));
  const base = path.resolve(project ?? (fs.statSync(inputs[0]).isDirectory() ? inputs[0] : path.dirname(inputs[0])));
  const total = { files: 0, components: 0, elements: 0, mapped: 0, strings: 0, unmapped: {}, rawHtml: {}, webOnly: {}, kit: new Set(), hooks: {} };
  for (const file of expand(inputs)) {
    const { slint, stats, components } = convertFile(path.resolve(file), mapping, new Map([...known].map(([n, f]) => [n, path.resolve(f)])), base, { preview: argv.includes("--preview"), strings });
    if (!components) continue;
    total.files += 1;
    total.components += components;
    total.elements += stats.elements;
    total.mapped += stats.mapped;
    total.strings += stats.strings;
    for (const key of ["unmapped", "rawHtml", "hooks", "webOnly"]) {
      for (const [k, v] of Object.entries(stats[key])) total[key][k] = (total[key][k] ?? 0) + v;
    }
    for (const k of stats.kit) total.kit.add(k);
    if (out) {
      // The source tree's folders are kept, so files with the same name do not overwrite each other.
      const target = path.join(out, path.relative(base, path.resolve(file)).replace(/\.tsx$/, ".slint"));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, slint);
    }
  }
  const webOnly = Object.values(total.webOnly).reduce((a, b) => a + b, 0);
  const convertible = total.elements - webOnly;
  const pct = convertible ? ((100 * total.mapped) / convertible).toFixed(1) : "0";
  const lines = [
    `files ${total.files}, components ${total.components}, elements ${total.elements}`,
    `mapped ${total.mapped} of ${convertible} convertible (${pct}%); web-only by design: ${top(total.webOnly)}`,
    `translated strings converted to @tr(): ${total.strings}`,
    `unmapped: ${top(total.unmapped)}`,
    `raw HTML (breaks the components rule; converted where possible): ${top(total.rawHtml)}`,
    `kit components needed: ${[...total.kit].sort().join(", ") || "none"}`,
    `hooks to move into view models: ${top(total.hooks)}`,
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  if (reportFile) fs.writeFileSync(reportFile, `${lines.join("\n")}\n`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
