/**
 * Tiny readline-based prompt helpers. Avoids inquirer/prompts/etc so
 * the generator runs with zero `pnpm install` cost — node ships
 * readline. Hostile-input handling isn't needed: this is a dev tool
 * the engineer running the scaffold drives interactively.
 */

import { createInterface } from "node:readline/promises";

const rl = () => createInterface({ input: process.stdin, output: process.stdout });

export async function ask(question, defaultValue) {
  const r = rl();
  try {
    const hint = defaultValue !== undefined ? ` (${defaultValue})` : "";
    const ans = (await r.question(`${question}${hint}: `)).trim();
    return ans || defaultValue || "";
  } finally {
    r.close();
  }
}

export async function askChoice(question, choices, defaultIndex = 0) {
  console.log(`\n${question}`);
  choices.forEach((c, i) => {
    const marker = i === defaultIndex ? "*" : " ";
    console.log(`  ${marker} ${i + 1}) ${c.label}`);
  });
  const r = rl();
  try {
    const raw = (await r.question(`Choice [${defaultIndex + 1}]: `)).trim();
    const idx = raw === "" ? defaultIndex : Number.parseInt(raw, 10) - 1;
    if (Number.isNaN(idx) || idx < 0 || idx >= choices.length) {
      throw new Error(`invalid choice: ${raw}`);
    }
    return choices[idx].value;
  } finally {
    r.close();
  }
}

export async function askYesNo(question, defaultYes = false) {
  const r = rl();
  try {
    const hint = defaultYes ? "Y/n" : "y/N";
    const raw = (await r.question(`${question} (${hint}): `)).trim().toLowerCase();
    if (raw === "") return defaultYes;
    return raw === "y" || raw === "yes";
  } finally {
    r.close();
  }
}

export async function askMulti(question, choices) {
  console.log(`\n${question}`);
  choices.forEach((c, i) => {
    console.log(`  ${i + 1}) ${c.label}`);
  });
  console.log("  (comma-separated indexes; blank = all)");
  const r = rl();
  try {
    const raw = (await r.question("Selection: ")).trim();
    if (raw === "") {
      return choices.map((c) => c.value);
    }
    const indexes = raw
      .split(",")
      .map((s) => Number.parseInt(s.trim(), 10) - 1)
      .filter((i) => !Number.isNaN(i) && i >= 0 && i < choices.length);
    return indexes.map((i) => choices[i].value);
  } finally {
    r.close();
  }
}
