/**
 * Tiny readline-based prompt helpers (zero deps). Mirrors the
 * pattern used by tools/create-mobile-app, but with a single shared
 * readline instance so piped stdin works correctly.
 *
 * Call `closePrompts()` at the end of `main()` to release the
 * underlying stream.
 */

import { createInterface } from "node:readline/promises";

let rl = null;

function getRl() {
  if (rl == null) {
    rl = createInterface({ input: process.stdin, output: process.stdout });
  }
  return rl;
}

export async function ask(question, defaultValue) {
  const hint = defaultValue !== undefined && defaultValue !== "" ? ` (${defaultValue})` : "";
  const ans = (await getRl().question(`${question}${hint}: `)).trim();
  return ans || defaultValue || "";
}

export async function askSecret(question) {
  const ans = (await getRl().question(`${question}: `)).trim();
  return ans;
}

export async function askChoice(question, choices, defaultIndex = 0) {
  console.log(`\n${question}`);
  choices.forEach((c, i) => {
    const marker = i === defaultIndex ? "*" : " ";
    console.log(`  ${marker} ${i + 1}) ${c.label}`);
  });
  const raw = (await getRl().question(`Choice [${defaultIndex + 1}]: `)).trim();
  const idx = raw === "" ? defaultIndex : Number.parseInt(raw, 10) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx >= choices.length) {
    throw new Error(`invalid choice: ${raw}`);
  }
  return choices[idx].value;
}

export async function askYesNo(question, defaultYes = false) {
  const hint = defaultYes ? "Y/n" : "y/N";
  const raw = (await getRl().question(`${question} (${hint}): `)).trim().toLowerCase();
  if (raw === "") return defaultYes;
  return raw === "y" || raw === "yes";
}

export function closePrompts() {
  if (rl != null) {
    rl.close();
    rl = null;
  }
}
