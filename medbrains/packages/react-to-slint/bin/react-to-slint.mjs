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
import { convertFile, loadMapping } from "../src/convert.mjs";

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
  const inputs = argv.filter((a, i) => !a.startsWith("--") && !["--out", "--report"].includes(argv[i - 1]));
  if (!inputs.length) {
    process.stderr.write("usage: react-to-slint <file.tsx|dir>... [--out DIR] [--report FILE]\n");
    return 2;
  }
  const mapping = loadMapping();
  const total = { files: 0, components: 0, elements: 0, mapped: 0, strings: 0, unmapped: {}, rawHtml: {}, kit: new Set(), hooks: {} };
  for (const file of expand(inputs)) {
    const { slint, stats, components } = convertFile(file, mapping);
    if (!components) continue;
    total.files += 1;
    total.components += components;
    total.elements += stats.elements;
    total.mapped += stats.mapped;
    total.strings += stats.strings;
    for (const key of ["unmapped", "rawHtml", "hooks"]) {
      for (const [k, v] of Object.entries(stats[key])) total[key][k] = (total[key][k] ?? 0) + v;
    }
    for (const k of stats.kit) total.kit.add(k);
    if (out) {
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(path.join(out, `${path.basename(file, ".tsx")}.slint`), slint);
    }
  }
  const pct = total.elements ? Math.round((100 * total.mapped) / total.elements) : 0;
  const lines = [
    `files ${total.files}, components ${total.components}, elements ${total.elements}`,
    `mapped ${total.mapped} (${pct}%)`,
    `translated strings converted to @tr(): ${total.strings}`,
    `unmapped: ${top(total.unmapped)}`,
    `raw HTML: ${top(total.rawHtml)}`,
    `kit components needed: ${[...total.kit].sort().join(", ") || "none"}`,
    `hooks to move into view models: ${top(total.hooks)}`,
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  if (reportFile) fs.writeFileSync(reportFile, `${lines.join("\n")}\n`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
