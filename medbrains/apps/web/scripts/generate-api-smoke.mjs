#!/usr/bin/env node
/**
 * Generate Layer 1 API smoke specs from every crate that registers routes.
 *
 * It used to read only `crates/medbrains-server/src/routes/mod.rs`. After the
 * crate split that file holds 23 routes; the other ~2,760 live in the leaf
 * crates' `router()` fns. The generated specs on disk were dated 18 May and
 * `make e2e-full` was green against them. Sources are now walked the way
 * `scripts/check_api_contract.py::backend_route_sources` walks them.
 *
 * What this generator does:
 *   - Parses every `.route("...", ...)` declaration from the routes module.
 *   - Emits one Playwright test per (method, path) combination.
 *   - Substitutes `{name}` path params with canonical UUIDs imported
 *     from `apps/web/e2e/helpers/canonical-seed.ts` (PARAM_TO_SEED +
 *     PARENT_SEGMENT_TO_SEED disambiguation for ambiguous `{id}`).
 *   - Substitutes POST/PUT/PATCH bodies from
 *     `apps/web/e2e/smoke/fixtures.ts` SMOKE_BODIES (falls back to `{}`).
 *
 * Test contract:
 *   - GET / DELETE → status must be 2xx OR 4xx (no 5xx panic).
 *   - POST / PUT / PATCH → same; we only flag 5xx.
 *   - Latency for every call appended to `e2e/smoke/latency-report.jsonl`
 *     so the slow-endpoint report can rank them.
 *   - Endpoints in SKIP_ENDPOINTS or `_known_failures.json` are skipped.
 *
 * Output: one spec per module under `apps/web/e2e/smoke/api/`.
 *
 * Run from repo root:  node apps/web/scripts/generate-api-smoke.mjs
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const CRATES_DIR = resolve(REPO_ROOT, "crates");

/** Every `.rs` under a `crates/medbrains-<name>/src` tree that registers a route. */
export function routeSourceFiles() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = resolve(dir, name);
      if (statSync(full).isDirectory()) {
        if (name === "target" || name === "node_modules") continue;
        walk(full);
      } else if (name.endsWith(".rs") && readFileSync(full, "utf8").includes(".route(")) {
        out.push(full);
      }
    }
  };
  for (const crate of readdirSync(CRATES_DIR)) {
    if (!crate.startsWith("medbrains-")) continue;
    const src = resolve(CRATES_DIR, crate, "src");
    if (existsSync(src)) walk(src);
  }
  return out.sort();
}
const SEED_FILE = resolve(__dirname, "../e2e/helpers/canonical-seed.ts");
const FIXTURES_FILE = resolve(__dirname, "../e2e/smoke/fixtures.ts");
const OUTPUT_DIR = resolve(__dirname, "../e2e/smoke/api");
const SKIP_FILE = resolve(OUTPUT_DIR, "_skiplist.json");

// ─── Parse routes/mod.rs ──────────────────────────────────────────

export function parseRoutes(source) {
  const routes = [];
  const stripped = source.replace(/\/\/[^\n]*/g, "");
  // The handler block ends at a `)` followed by `.` or `;`. That trailing
  // character must be a LOOKAHEAD: consuming it ate the dot of the next
  // `.route(`, so every second registration in a chain was skipped.
  const re = /\.route\s*\(\s*"([^"]+)"\s*,\s*([\s\S]*?)\)\s*(?=[.;])/g;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const path = m[1];
    const handlerBlock = m[2];
    const methods = new Set();
    for (const verb of ["get", "post", "put", "patch", "delete"]) {
      if (new RegExp(`\\b${verb}\\s*\\(`, "g").test(handlerBlock)) {
        methods.add(verb.toUpperCase());
      }
    }
    if (methods.size > 0) routes.push({ path, methods: [...methods] });
  }
  return routes;
}

export function moduleOf(path) {
  const m = /^\/api\/([a-zA-Z0-9_-]+)/.exec(path);
  if (!m) return "_misc";
  return m[1].replace(/[^a-zA-Z0-9]/g, "_");
}

// ─── Parse PARAM_TO_SEED + PARENT_SEGMENT_TO_SEED from canonical-seed.ts ──

export function parseSeedMap() {
  const src = readFileSync(SEED_FILE, "utf8");

  // Extract SEED keys + values
  const seed = {};
  const seedBlock = src.match(/export const SEED\s*=\s*\{([\s\S]*?)\}\s*as const/);
  if (seedBlock) {
    const entries = seedBlock[1].matchAll(/(\w+):\s*u\("([0-9a-f]{12})"\)/g);
    for (const [, key, suffix] of entries) {
      seed[key] = `10000000-0000-4000-8000-${suffix}`;
    }
  }

  // Extract PARAM_TO_SEED
  const paramMap = {};
  const paramBlock = src.match(/PARAM_TO_SEED[\s\S]*?\{([\s\S]*?)\};/);
  if (paramBlock) {
    const entries = paramBlock[1].matchAll(/(\w+):\s*"(\w+)"/g);
    for (const [, param, key] of entries) {
      paramMap[param] = key;
    }
  }

  // Extract PARENT_SEGMENT_TO_SEED
  const parentRules = [];
  const parentBlock = src.match(/PARENT_SEGMENT_TO_SEED[\s\S]*?=\s*\[([\s\S]*?)\];/);
  if (parentBlock) {
    const entries = parentBlock[1].matchAll(/\[\s*\/((?:\\\/|[^/])+?)\/,\s*"(\w+)"\s*\]/g);
    for (const [, pattern, key] of entries) {
      parentRules.push({ regex: new RegExp(pattern), key });
    }
  }

  return { seed, paramMap, parentRules };
}

export function substituteParams(path, seedData) {
  const { seed, paramMap, parentRules } = seedData;

  return path.replace(/\{(\w+)\}/g, (match, name) => {
    // 1. Direct param match
    if (paramMap[name] && paramMap[name] !== "generic" && seed[paramMap[name]]) {
      return seed[paramMap[name]];
    }

    // 2. Generic id — use parent segment
    if (name === "id" || /^[a-z]?id$/.test(name)) {
      for (const { regex, key } of parentRules) {
        if (regex.test(path) && seed[key]) {
          return seed[key];
        }
      }
    }

    // 3. Numeric placeholders
    if (/^(year|month|day|period|n|version|quarter|revision_number)$/.test(name)) {
      return "0";
    }

    // 4. Named-string placeholders
    if (/^(slug|code|module|modality|location|date|shift|event_type|ward_type|seq_type|station_number|token|adapter_code|entity_type|source_table)$/.test(name)) {
      return "smoke";
    }

    // 5. Fallback — generic UUID
    return seed.generic ?? "10000000-0000-4000-8000-000000000ffe";
  });
}

// ─── Parse SMOKE_BODIES ───────────────────────────────────────────

export function parseSmokeBodies() {
  // Lazy parse: just scan for keys; we don't need full evaluation.
  // The generated test imports SMOKE_BODIES at runtime.
  const src = readFileSync(FIXTURES_FILE, "utf8");
  const keys = new Set();
  const re = /"((?:GET|POST|PUT|PATCH|DELETE) [^"]+)":/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    keys.add(m[1]);
  }
  return keys;
}

export function parseSkipEndpoints() {
  const src = readFileSync(FIXTURES_FILE, "utf8");
  const m = src.match(/SKIP_ENDPOINTS[\s\S]*?=\s*\[([\s\S]*?)\]/);
  if (!m) return new Set();
  const entries = m[1].matchAll(/"([^"]+)"/g);
  return new Set([...entries].map(([, v]) => v));
}

// ─── Spec emitter ────────────────────────────────────────────────

function specForModule(moduleName, cases) {
  const items = cases
    .map(
      (c) =>
        `    { method: "${c.method}", path: "${c.path}", pattern: "${c.pattern}", desc: "${c.method} ${c.pattern}" },`,
    )
    .join("\n");

  return `// AUTO-GENERATED by apps/web/scripts/generate-api-smoke.mjs — DO NOT EDIT.
// Regenerate with: node apps/web/scripts/generate-api-smoke.mjs
//
// Smoke check for every endpoint in this module:
//   - All methods → status must be < 500 (no panic / SQL crash).
//   - Path params substituted with seeded UUIDs from canonical-seed.ts.
//   - POST/PUT/PATCH bodies pulled from SMOKE_BODIES; missing keys
//     fall back to {} (which the backend should reject with 422,
//     not 500 — that's the contract being verified).

import { appendFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test, expect } from "@playwright/test";
import { E2E_BACKEND_URL, loginAsAdmin } from "../../helpers/api";
import type { AuthContext } from "../../helpers/types";
import { SMOKE_BODIES } from "../fixtures";

const __dirname = dirname(fileURLToPath(import.meta.url));
const knownFailures: Record<string, string> = (() => {
  try {
    const raw = readFileSync(resolve(__dirname, "../_known_failures.json"), "utf8");
    return JSON.parse(raw).endpoints ?? {};
  } catch {
    return {};
  }
})();

interface SmokeCase {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  pattern: string;
  desc: string;
}

const cases: SmokeCase[] = [
${items}
];

test.describe("smoke ${moduleName}", () => {
  let ctx: AuthContext;

  test.beforeAll(async ({ playwright }) => {
    const request = await playwright.request.newContext({ ignoreHTTPSErrors: true });
    ctx = await loginAsAdmin(request);
  });

  test.afterAll(async () => {
    await ctx?.request.dispose();
  });

  for (const { method, path, pattern, desc } of cases) {
    test(desc, async () => {
      const knownReason =
        knownFailures[\`\${method} \${pattern}\`] ?? knownFailures[pattern];
      if (knownReason) {
        test.skip(true, \`known failure: \${knownReason}\`);
      }

      const init: { method: string; headers: Record<string, string>; data?: string } = {
        method,
        headers: { cookie: ctx.cookieHeader, "x-csrf-token": ctx.csrfToken },
      };
      if (method !== "GET" && method !== "DELETE") {
        const body = SMOKE_BODIES[\`\${method} \${pattern}\`] ?? {};
        init.headers["content-type"] = "application/json";
        init.data = JSON.stringify(body);
      }

      const startedAt = Date.now();
      const resp = await ctx.request.fetch(\`\${E2E_BACKEND_URL}\${path}\`, init);
      const durationMs = Date.now() - startedAt;
      const status = resp.status();

      try {
        const reportPath = resolve(__dirname, "../latency-report.jsonl");
        appendFileSync(
          reportPath,
          JSON.stringify({ method, path, pattern, status, durationMs, ts: new Date().toISOString() }) +
            "\\n",
        );
      } catch {
        // non-fatal
      }

      if (durationMs > 1000) {
        test
          .info()
          .annotations.push({
            type: "slow",
            description: \`\${method} \${path} took \${durationMs}ms\`,
          });
      }

      expect(status, \`authenticated smoke must not be unauthorized for \${method} \${path}\`).not.toBe(401);
      expect(status, \`authenticated smoke must not be forbidden for \${method} \${path}\`).not.toBe(403);
      expect.soft(status, \`status for \${method} \${path}\`).toBeGreaterThanOrEqual(200);
      expect.soft(status, \`status for \${method} \${path}\`).toBeLessThan(500);

      if (resp.headers()["content-type"]?.includes("application/json")) {
        const text = await resp.text();
        try {
          JSON.parse(text);
        } catch {
          throw new Error(\`\${method} \${path} returned non-JSON body of length \${text.length}\`);
        }
      }
    });
  }
});
`;
}

// ─── Main ────────────────────────────────────────────────────────

function main() {
  // One route may be registered in more than one file (mod.rs and a leaf
  // crate during a split); dedupe by path so a spec is generated once.
  const byPath = new Map();
  const sources = routeSourceFiles();
  for (const file of sources) {
    for (const r of parseRoutes(readFileSync(file, "utf8"))) {
      const seen = byPath.get(r.path) ?? new Set();
      for (const m of r.methods) seen.add(m);
      byPath.set(r.path, seen);
    }
  }
  const routes = [...byPath].map(([path, methods]) => ({ path, methods: [...methods] }));
  console.log(`routes: ${routes.length} across ${sources.length} source files`);
  if (routes.length === 0) {
    console.error("no routes parsed — aborting");
    process.exit(1);
  }

  const seedData = parseSeedMap();
  parseSmokeBodies(); // sanity check; the spec imports SMOKE_BODIES at runtime
  const skipSet = parseSkipEndpoints();

  const moduleSpecs = new Map(); // module → cases[]
  const skipped = [];

  for (const r of routes) {
    if (!r.path.startsWith("/api/")) continue;

    for (const method of r.methods) {
      const key = `${method} ${r.path}`;
      if (skipSet.has(key)) {
        skipped.push({ method, path: r.path, reason: "skiplist" });
        continue;
      }

      const concretePath = substituteParams(r.path, seedData);
      const mod = moduleOf(r.path);
      if (!moduleSpecs.has(mod)) moduleSpecs.set(mod, []);
      moduleSpecs.get(mod).push({
        method,
        path: concretePath,
        pattern: r.path,
      });
    }
  }

  if (existsSync(OUTPUT_DIR)) rmSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const [mod, cases] of moduleSpecs) {
    cases.sort((a, b) => `${a.method} ${a.pattern}`.localeCompare(`${b.method} ${b.pattern}`));
    const file = resolve(OUTPUT_DIR, `${mod}.smoke.spec.ts`);
    writeFileSync(file, specForModule(mod, cases));
  }
  writeFileSync(SKIP_FILE, JSON.stringify(skipped, null, 2));

  const totalCases = [...moduleSpecs.values()].reduce((a, c) => a + c.length, 0);
  console.log(
    `generated ${moduleSpecs.size} smoke specs (${totalCases} test cases) + ${skipped.length} skipped → ${OUTPUT_DIR}`,
  );
}

// Run only as a script; generate-api-writes.mjs imports the parsers above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
