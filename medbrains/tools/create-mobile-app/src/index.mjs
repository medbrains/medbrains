#!/usr/bin/env node
/**
 * `medbrains-create-mobile-app` — interactive Expo Prebuild app
 * generator. Composes a base template + variant template into a new
 * `apps/<id>/` workspace, wires it to `@medbrains/mobile-shell`,
 * `@medbrains/ui-mobile`, and `@medbrains/uniffi-rn-plugin`.
 *
 * Usage from the workspace root:
 *   node medbrains/tools/create-mobile-app/src/index.mjs
 *
 * Or after `pnpm install` (when the package is added to the
 * pnpm-workspace) just `pnpm exec medbrains-create-mobile-app`.
 *
 * Phase D of the mobile/TV/edge roadmap.
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ask, askChoice, askMulti, askYesNo } from "./prompts.mjs";
import { renderTree } from "./render.mjs";
import { VARIANTS } from "./variants.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(HERE, "..", "templates");

function parseArgs(argv) {
  const flags = {};
  for (const arg of argv) {
    const m = arg.match(/^--([\w-]+)(?:=(.*))?$/u);
    if (!m) continue;
    flags[m[1]] = m[2] ?? "true";
  }
  return flags;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const interactive = flags.yes !== "true" && flags.id == null;

  if (interactive) {
    console.log("\nMedBrains — create mobile/TV app\n");
  }

  const id = flags.id ?? (await ask("App id (lowercase, kebab-case)", "mobile-staff"));
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) {
    throw new Error(`invalid app id: ${id}`);
  }

  const variantKey = flags.variant ??
    (await askChoice(
      "Variant?",
      Object.entries(VARIANTS).map(([value, v]) => ({ value, label: v.label })),
      0,
    ));
  const variant = VARIANTS[variantKey];
  if (!variant) {
    throw new Error(`unknown variant: ${variantKey}`);
  }

  const displayName = flags["display-name"] ??
    (await ask("Display name", `MedBrains ${capitalize(variantKey)}`));
  const bundleId = flags["bundle-id"] ??
    (await ask(
      "iOS bundle id / Android package",
      `com.medbrains.${id.replace(/-/gu, "")}`,
    ));
  const modules = flags.modules
    ? flags.modules.split(",").map((m) => m.trim()).filter(Boolean)
    : await askMulti(
        `Which modules to scaffold? (variant: ${variantKey})`,
        variant.moduleCatalog,
      );

  let abdm = variant.abdmDefault;
  if (flags.abdm != null) {
    abdm = flags.abdm === "true";
  } else if (variantKey === "patient" && interactive) {
    abdm = await askYesNo("Enable ABDM ABHA login?", variant.abdmDefault);
  }

  const offlineFirst = flags["offline-first"] != null
    ? flags["offline-first"] === "true"
    : !interactive
      ? variantKey !== "patient"
      : await askYesNo("Offline-first (use AuthzCache + Loro CRDT)?", variantKey !== "patient");

  const repoRoot = process.cwd();
  const appsDir = flags["apps-dir"] ??
    (interactive
      ? await ask("Apps directory", join(repoRoot, "medbrains", "apps"))
      : join(repoRoot, "medbrains", "apps"));
  const destDir = join(appsDir, id);
  if (existsSync(destDir)) {
    throw new Error(`destination already exists: ${destDir}`);
  }
  mkdirSync(destDir, { recursive: true });

  const moduleEntries = modules.map((m) => ({
    id: m,
    symbol: kebabToCamel(m),
    displayName: variant.moduleCatalog.find((c) => c.value === m)?.label ?? m,
  }));

  const ctx = {
    id,
    variant: variantKey,
    distribution: variant.distribution,
    biometricPolicy: variant.biometricPolicy,
    displayName,
    bundleId,
    bundleIdEscaped: bundleId.replace(/\./gu, "\\."),
    modules,
    moduleEntries,
    hasModules: modules.length > 0,
    abdm,
    offlineFirst,
    isStaff: variantKey === "staff",
    isPatient: variantKey === "patient",
    isTv: variantKey === "tv",
    isVendor: variantKey === "vendor",
  };

  console.log(`\nGenerating ${destDir} ...`);
  const baseSrc = join(TEMPLATES_DIR, "base");
  const variantSrc = join(TEMPLATES_DIR, variantKey);
  const moduleSrc = join(TEMPLATES_DIR, "_module");
  const written = [];
  if (existsSync(baseSrc)) {
    written.push(...renderTree(baseSrc, destDir, ctx));
  }
  if (existsSync(variantSrc)) {
    written.push(...renderTree(variantSrc, destDir, ctx));
  }
  for (const entry of moduleEntries) {
    const moduleCtx = {
      ...ctx,
      moduleId: entry.id,
      moduleSymbol: entry.symbol,
      moduleDisplayName: entry.displayName,
    };
    written.push(
      ...renderTree(moduleSrc, join(destDir, "src", "modules"), moduleCtx),
    );
  }

  console.log(`Wrote ${written.length} files.`);
  console.log("\nNext steps:");
  console.log("  1. cd into the workspace root");
  console.log("  2. pnpm install");
  console.log(`  3. pnpm --filter @medbrains/${id} typecheck`);
  console.log(`  4. pnpm --filter @medbrains/${id} start`);
  console.log("\nPair the device or sign in via the LoginScreen the template wires.\n");
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function kebabToCamel(s) {
  return s.replace(/-([a-z0-9])/gu, (_m, c) => c.toUpperCase());
}

main().catch((err) => {
  console.error(`\nfailed: ${err.message}\n`);
  process.exit(1);
});
