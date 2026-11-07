#!/usr/bin/env node
/**
 * Counts the interactive kit elements in a converted tree and whether each has a name a screen
 * reader can announce: its text, label, placeholder or accessible-label binding.
 *
 *   a11y-audit <converted dir>
 *
 * Every interactive kit component sets an accessible role itself (test: "every interactive kit
 * component declares an accessible role"), so the open question per element is its label.
 */
import fs from "node:fs";
import path from "node:path";

/** The bindings that name each interactive kit element, in order of preference. */
const NAMED_BY = {
  MbButton: ["text", "accessible-label"],
  MbIconButton: ["accessible-label"],
  MbTextInput: ["label", "placeholder-text", "accessible-label"],
  MbNumberInput: ["label", "accessible-label"],
  MbTextArea: ["label", "placeholder-text"],
  MbSelect: ["label", "placeholder-text"],
  MbMultiSelect: ["label", "placeholder-text"],
  MbDateInput: ["label", "placeholder-text"],
  MbCheckbox: ["text", "accessible-label"],
  MbSwitch: ["text", "accessible-label"],
  MbRadio: ["text"],
  MbChip: ["text"],
  MbTab: ["text"],
  MbLink: ["text"],
  MbSegmented: ["model"],
  MbFileInput: ["label", "placeholder-text"],
  MbPressable: ["accessible-label"],
};

/** `.slint` files under a directory. */
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith(".slint") ? [path.join(dir, e.name)] : []));
}

/** The body of the element opened at `start` (just after its `{`). */
function body(text, start) {
  let depth = 1;
  let i = start;
  for (; i < text.length && depth; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") depth -= 1;
  }
  return text.slice(start, i - 1);
}

export function audit(dir) {
  const counts = {};
  const unnamed = {};
  for (const f of files(dir)) {
    const text = fs.readFileSync(f, "utf8");
    for (const m of text.matchAll(/\b(Mb[A-Za-z]+) \{/g)) {
      const props = NAMED_BY[m[1]];
      if (!props) continue;
      const own = body(text, m.index + m[0].length).replace(/\{[^{}]*\}/g, "");
      const named = props.some((p) => new RegExp(`(^|\\s)${p}\\s*(:|<=>)`).test(own));
      const c = (counts[m[1]] ??= { total: 0, named: 0 });
      c.total += 1;
      if (named) c.named += 1;
      else (unnamed[m[1]] ??= []).push(path.relative(dir, f));
    }
  }
  return { counts, unnamed };
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(new URL(import.meta.url).pathname)) {
  const { counts, unnamed } = audit(process.argv[2] ?? ".");
  let total = 0;
  let named = 0;
  for (const [k, c] of Object.entries(counts).sort((a, b) => b[1].total - a[1].total)) {
    total += c.total;
    named += c.named;
    process.stdout.write(`${k}\t${c.total}\tnamed ${c.named}\tunnamed ${c.total - c.named}${unnamed[k] ? `\te.g. ${unnamed[k].slice(0, 2).join(", ")}` : ""}\n`);
  }
  process.stdout.write(`interactive ${total}, with role ${total}, with a name ${named}, without a name ${total - named}\n`);
}
