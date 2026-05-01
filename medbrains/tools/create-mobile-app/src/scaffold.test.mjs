/**
 * Non-interactive smoke for the generator. Renders each variant
 * into a temp dir + asserts the expected anchor files exist with
 * the right shape (workspace dep declared, app.json plugins wired,
 * modules registry referencing each scaffolded module).
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderTree } from "./render.mjs";
import { VARIANTS } from "./variants.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(HERE, "..", "templates");

const tempRoots = [];
after(() => {
  for (const t of tempRoots) {
    rmSync(t, { recursive: true, force: true });
  }
});

function scaffold(variantKey, opts = {}) {
  const variant = VARIANTS[variantKey];
  const id = opts.id ?? `mobile-${variantKey}`;
  const modules = opts.modules ?? variant.defaultModules;
  const moduleEntries = modules.map((m) => ({
    id: m,
    symbol: m.replace(/-([a-z0-9])/gu, (_x, c) => c.toUpperCase()),
    displayName: variant.moduleCatalog.find((c) => c.value === m)?.label ?? m,
  }));
  const ctx = {
    id,
    variant: variantKey,
    distribution: variant.distribution,
    biometricPolicy: variant.biometricPolicy,
    displayName: opts.displayName ?? `MedBrains ${variantKey}`,
    bundleId: `com.medbrains.${id.replace(/-/gu, "")}`,
    modules,
    moduleEntries,
    hasModules: modules.length > 0,
    abdm: opts.abdm ?? variant.abdmDefault,
    offlineFirst: opts.offlineFirst ?? variantKey !== "patient",
    isStaff: variantKey === "staff",
    isPatient: variantKey === "patient",
    isTv: variantKey === "tv",
    isVendor: variantKey === "vendor",
  };
  const dest = mkdtempSync(join(tmpdir(), `medbrains-scaffold-${variantKey}-`));
  tempRoots.push(dest);
  renderTree(join(TEMPLATES_DIR, "base"), dest, ctx);
  const variantSrc = join(TEMPLATES_DIR, variantKey);
  if (existsSync(variantSrc)) {
    renderTree(variantSrc, dest, ctx);
  }
  for (const entry of moduleEntries) {
    renderTree(join(TEMPLATES_DIR, "_module"), join(dest, "src", "modules"), {
      ...ctx,
      moduleId: entry.id,
      moduleSymbol: entry.symbol,
      moduleDisplayName: entry.displayName,
    });
  }
  return { dest, ctx, moduleEntries };
}

describe("scaffold staff app", () => {
  it("emits package.json with workspace deps", () => {
    const { dest } = scaffold("staff");
    const pkg = JSON.parse(readFileSync(join(dest, "package.json"), "utf-8"));
    assert.equal(pkg.name, "@medbrains/mobile-staff");
    assert.equal(pkg.dependencies["@medbrains/mobile-shell"], "workspace:*");
    assert.equal(pkg.dependencies["@medbrains/ui-mobile"], "workspace:*");
    assert.equal(pkg.dependencies["@medbrains/uniffi-rn-plugin"], "workspace:*");
    assert.ok(pkg.dependencies.expo);
    assert.ok(pkg.dependencies["expo-secure-store"]);
    assert.ok(pkg.dependencies["expo-local-authentication"]);
  });

  it("emits app.json with uniffi-rn-plugin entry", () => {
    const { dest } = scaffold("staff");
    const appJson = JSON.parse(readFileSync(join(dest, "app.json"), "utf-8"));
    assert.equal(appJson.expo.name, "MedBrains staff");
    const plugins = appJson.expo.plugins;
    assert.ok(plugins.includes("expo-secure-store"));
    assert.ok(plugins.some((p) => Array.isArray(p) && p[0] === "expo-camera"));
    assert.ok(
      plugins.some((p) => Array.isArray(p) && p[0] === "@medbrains/uniffi-rn-plugin"),
    );
  });

  it("module registry imports every scaffolded module", () => {
    const { dest, moduleEntries } = scaffold("staff", { modules: ["doctor", "nurse"] });
    const idx = readFileSync(join(dest, "src", "modules", "index.ts"), "utf-8");
    for (const e of moduleEntries) {
      assert.match(idx, new RegExp(`from "\\./${e.id}"`));
      assert.match(idx, new RegExp(`${e.symbol}Module`));
      assert.ok(existsSync(join(dest, "src", "modules", `${e.id}.tsx`)));
    }
  });
});

describe("scaffold patient app", () => {
  it("emits ABHA stub when abdm=true", () => {
    const { dest } = scaffold("patient", { abdm: true, modules: ["appointments"] });
    const abha = readFileSync(
      join(dest, "src", "auth", "abha-login.ts"),
      "utf-8",
    );
    assert.match(abha, /TenantIdentity/);
    assert.doesNotMatch(abha, /disabled at scaffold time/);
  });

  it("notes ABHA disabled when abdm=false", () => {
    const { dest } = scaffold("patient", { abdm: false, modules: ["appointments"] });
    const abha = readFileSync(
      join(dest, "src", "auth", "abha-login.ts"),
      "utf-8",
    );
    assert.match(abha, /disabled at scaffold time/);
  });

  it("eas.json uses store distribution for production", () => {
    const { dest } = scaffold("patient");
    const eas = JSON.parse(readFileSync(join(dest, "eas.json"), "utf-8"));
    assert.equal(eas.build.production.distribution, "store");
  });
});

describe("scaffold tv app", () => {
  it("app.json has TV plugin and landscape orientation", () => {
    const { dest } = scaffold("tv");
    const appJson = JSON.parse(readFileSync(join(dest, "app.json"), "utf-8"));
    assert.equal(appJson.expo.orientation, "landscape");
    const plugins = appJson.expo.plugins;
    assert.ok(
      plugins.some(
        (p) => Array.isArray(p) && p[0] === "@react-native-tvos/config-tv",
      ),
    );
  });
});

describe("scaffold vendor app", () => {
  it("README marks the app as draft", () => {
    const { dest } = scaffold("vendor");
    const readme = readFileSync(join(dest, "README.md"), "utf-8");
    assert.match(readme, /DRAFT/);
    assert.match(readme, /skeleton/);
  });
});

describe("App.tsx wiring", () => {
  it("references the variant in Shell props", () => {
    const { dest, ctx } = scaffold("staff");
    const app = readFileSync(join(dest, "App.tsx"), "utf-8");
    assert.match(app, new RegExp(`variant="${ctx.variant}"`));
    assert.match(app, /ExpoSecureStoreAdapter/);
    assert.match(app, /Shell/);
  });
});
