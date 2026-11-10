#!/usr/bin/env node
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type CheckResult, runAgainstMock, runConformance } from "./conformance.js";
import { type Manifest, validateManifest } from "./manifest.js";

const MANIFEST = "medbrains.manifest.json";
const out = (line: string) => process.stdout.write(`${line}\n`);
const err = (line: string) => process.stderr.write(`${line}\n`);
const USAGE = `medbrains ext <command>

  init [dir]        create an extension from the template (default: ./my-extension)
  validate [file]   check a manifest the way the hospital will (default: ./${MANIFEST})
  test [--url URL]  run the protocol conformance suite against the local mock,
                    or a sandbox hospital with MEDBRAINS_CLIENT_ID / MEDBRAINS_CLIENT_SECRET
                    (and MEDBRAINS_PATIENT_ID for a real read)
  publish           not yet: the public registry is phase E2
`;

function readManifest(file: string): Manifest {
  return JSON.parse(readFileSync(file, "utf8")) as Manifest;
}

function init(dir: string): number {
  const target = resolve(dir);
  if (existsSync(target)) {
    err(`${target} already exists — pick another directory.`);
    return 1;
  }
  const template = join(dirname(fileURLToPath(import.meta.url)), "..", "template");
  cpSync(template, target, { recursive: true });
  const name = target.split(/[\\/]/).pop() ?? "my-extension";
  for (const file of [MANIFEST, "package.json"]) {
    const path = join(target, file);
    writeFileSync(path, readFileSync(path, "utf8").replaceAll("__NAME__", name));
  }
  out(`Created ${target}\nNext: cd ${dir} && npx medbrains ext validate && npx medbrains ext test`);
  return 0;
}

function validate(file: string): number {
  const errors = validateManifest(readManifest(file));
  if (errors.length) {
    err(`✗ ${file}\n${errors.map((e) => `  - ${e}`).join("\n")}`);
    return 1;
  }
  out(`✓ ${file} is a valid manifest`);
  return 0;
}

function report(results: CheckResult[]): number {
  for (const r of results) out(`${r.ok ? "✓" : "✗"} ${r.name} — ${r.detail}`);
  const failed = results.filter((r) => !r.ok).length;
  out(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks passed`);
  return failed ? 1 : 0;
}

async function test(args: string[]): Promise<number> {
  const manifest = readManifest(MANIFEST);
  const at = args.indexOf("--url");
  const url = at >= 0 ? args[at + 1] : undefined;
  if (!url) return report(await runAgainstMock(manifest));
  const clientId = process.env.MEDBRAINS_CLIENT_ID;
  const clientSecret = process.env.MEDBRAINS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    err("Set MEDBRAINS_CLIENT_ID and MEDBRAINS_CLIENT_SECRET from Admin → Connected apps.");
    return 1;
  }
  return report(
    await runConformance(manifest, {
      baseUrl: url,
      clientId,
      clientSecret,
      patientId: process.env.MEDBRAINS_PATIENT_ID,
    }),
  );
}

async function main(argv: string[]): Promise<number> {
  const [group, command, ...rest] = argv;
  if (group !== "ext") {
    out(USAGE);
    return group ? 1 : 0;
  }
  switch (command) {
    case "init":
      return init(rest[0] ?? "my-extension");
    case "validate":
      return validate(rest[0] ?? MANIFEST);
    case "test":
      return test(rest);
    case "publish":
      // Honest stub: there is no registry to publish to yet.
      err(
        "There is no public registry yet — it is phase E2 of RFC-HOSPITAL-OS §8g.\n" +
          "Until then, send your manifest to the hospital; an admin registers it in Admin → Connected apps.",
      );
      return 2;
    default:
      out(USAGE);
      return 1;
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: unknown) => {
    err(e instanceof Error ? e.message : String(e));
    process.exit(1);
  },
);
