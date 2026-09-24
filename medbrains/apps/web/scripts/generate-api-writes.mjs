/**
 * Generate Layer 1b — write negatives — from every crate router.
 *
 * The smoke layer already sends every POST/PUT/PATCH/DELETE a plausible body
 * and accepts anything under 500. This adds the two refusals a write must
 * make, derived from the handler's own `Json<T>` request struct:
 *
 *   validation  a body missing the struct's required fields → 400 or 422
 *   notfound    the same write against a record that does not exist → 404
 *
 * A required field is one that is neither `Option<…>` nor `#[serde(default)]`.
 * Bodies for the not-found case are the smoke fixture when one exists, else
 * synthesised from the struct by field type; routes whose body cannot be
 * synthesised (enum-typed fields, nested structs, raw `Value`) get no
 * not-found case rather than a false one.
 *
 * Output: apps/web/e2e/writes/<module>.writes.spec.ts (gitignored) and
 * apps/web/e2e/generated/writes-manifest.json, which the coverage ledger reads
 * for the api.neg.* cells. Run: `make e2e-writes-generate`.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  moduleOf,
  parseSeedMap,
  parseSkipEndpoints,
  parseSmokeBodies,
  routeSourceFiles,
  substituteParams,
} from "./generate-api-smoke.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const CRATES_DIR = resolve(REPO_ROOT, "crates");
const OUTPUT_DIR = resolve(__dirname, "../e2e/writes");
const MANIFEST = resolve(__dirname, "../e2e/generated/writes-manifest.json");

/** Well-formed, never seeded: the id every not-found case asks for. */
const ABSENT_UUID = "00000000-0000-4000-8000-00000000dead";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const WRITE_VERBS = ["post", "put", "patch", "delete"];

// ─── Rust source index ────────────────────────────────────────────

/** Every `.rs` under the src tree of each medbrains crate, as {file, crate, text}. */
function rustSources() {
  const out = [];
  const walk = (dir, crate) => {
    for (const name of readdirSync(dir)) {
      const full = resolve(dir, name);
      if (statSync(full).isDirectory()) {
        if (name !== "target" && name !== "node_modules") walk(full, crate);
      } else if (name.endsWith(".rs")) {
        out.push({ file: full, crate, text: readFileSync(full, "utf8") });
      }
    }
  };
  for (const crate of readdirSync(CRATES_DIR)) {
    if (!crate.startsWith("medbrains-")) continue;
    const src = resolve(CRATES_DIR, crate, "src");
    if (existsSync(src)) walk(src, crate);
  }
  return out;
}

const RE_FN = /\b(?:pub(?:\([^)]*\))?\s+)?async\s+fn\s+(\w+)\s*\(/g;
const RE_STRUCT = /\b(?:pub(?:\([^)]*\))?\s+)?struct\s+(\w+)\s*\{/g;

/** name → [{src, index}] for every async fn and every struct. */
function indexSources(sources) {
  const fns = new Map();
  const structs = new Map();
  const add = (map, name, entry) => {
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(entry);
  };
  for (const src of sources) {
    for (const m of src.text.matchAll(RE_FN)) add(fns, m[1], { src, index: m.index });
    for (const m of src.text.matchAll(RE_STRUCT)) add(structs, m[1], { src, index: m.index + m[0].length });
  }
  return { fns, structs };
}

/** Same file, then same crate, then core, then a unique repo-wide match. */
function pick(candidates, from) {
  if (!candidates || candidates.length === 0) return null;
  const same = candidates.find((c) => c.src.file === from.file);
  if (same) return same;
  const crate = candidates.filter((c) => c.src.crate === from.crate);
  if (crate.length === 1) return crate[0];
  const core = candidates.filter((c) => c.src.crate === "medbrains-core");
  if (core.length === 1) return core[0];
  return candidates.length === 1 ? candidates[0] : null;
}

// ─── Routes with their handlers ───────────────────────────────────

const RE_ROUTE = /\.route\s*\(\s*"([^"]+)"\s*,\s*([\s\S]*?)\)\s*(?=[.;])/g;

/** [{path, method, handler}] for every write registration in one source. */
function parseWriteRoutes(src) {
  const stripped = src.text.replace(/\/\/[^\n]*/g, "");
  const out = [];
  for (const m of stripped.matchAll(RE_ROUTE)) {
    for (const verb of WRITE_VERBS) {
      const h = new RegExp(`\\b(?:axum::routing::)?${verb}\\s*\\(\\s*([\\w:]+)`).exec(m[2]);
      if (h) out.push({ path: m[1], method: verb.toUpperCase(), handler: h[1].split("::").pop() });
    }
  }
  return out;
}

// ─── Request struct ───────────────────────────────────────────────

/** The `Json<T>` type a handler takes, or null (path-only), or "Value". */
function jsonBodyType(fnEntry) {
  const { text } = fnEntry.src;
  const end = text.indexOf("{", fnEntry.index);
  const sig = text.slice(fnEntry.index, end === -1 ? undefined : end);
  const m = /Json\(\s*\w+\s*\)\s*:\s*Json<([\w:<>]+)>/.exec(sig);
  if (!m) return null;
  const ty = m[1];
  if (ty.includes("<")) return "Value";
  const name = ty.split("::").pop();
  return name === "Value" ? "Value" : name;
}

/** Fields of a struct body: [{name, ty, required}], or null when unparseable. */
function structFields(structEntry) {
  const { text } = structEntry.src;
  let depth = 1;
  let i = structEntry.index;
  while (i < text.length && depth > 0) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") depth -= 1;
    i += 1;
  }
  const body = text.slice(structEntry.index, i - 1);
  const fields = [];
  let defaulted = false;
  let rename = null;
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("//")) continue;
    if (line.startsWith("#[")) {
      if (/serde\([^)]*\bflatten\b/.test(line)) return null;
      if (/serde\([^)]*\bdefault\b/.test(line)) defaulted = true;
      const r = /rename\s*=\s*"([^"]+)"/.exec(line);
      if (r) rename = r[1];
      continue;
    }
    const f = /^(?:pub(?:\([^)]*\))?\s+)?(?:r#)?(\w+)\s*:\s*(.+?),?$/.exec(line);
    if (!f) continue;
    const ty = f[2].replace(/\s+/g, "");
    fields.push({ name: rename ?? f[1], ty, required: !/^Option</.test(ty) && !defaulted });
    defaulted = false;
    rename = null;
  }
  return fields;
}

// ─── Values by type ───────────────────────────────────────────────

const NUMERIC = /^(i8|i16|i32|i64|u8|u16|u32|u64|usize|f32|f64|Decimal)$/;

/** A plausible value for a required field, or undefined when the type needs a fixture. */
function valueFor(field, seedData) {
  const { seed, paramMap } = seedData;
  const ty = field.ty;
  if (/^Vec</.test(ty)) return [];
  const last = ty.split("::").pop();
  if (last === "Uuid") return seed[paramMap[field.name]] ?? seed.generic;
  if (last === "String") {
    if (/email/.test(field.name)) return "e2e@example.com";
    if (/phone|mobile/.test(field.name)) return "9990000000";
    if (/_date$|^date$/.test(field.name)) return "2026-01-01";
    if (/_time$|^time$/.test(field.name)) return "09:00:00";
    if (/url/.test(field.name)) return "https://example.com";
    return "E2E";
  }
  if (NUMERIC.test(last)) return 1;
  if (last === "bool") return true;
  if (last === "NaiveDate") return "2026-01-01";
  if (last === "NaiveTime") return "09:00:00";
  if (/^DateTime</.test(last)) return "2026-01-01T09:00:00Z";
  if (last === "Value") return {};
  return undefined;
}

/**
 * A String the handler will check before it looks the record up: a value
 * from a fixed set (status, decision, …) or a key it resolves (barcode,
 * code, …). A made-up value there answers 400 for the body, never 404 for
 * the record, so such a route gets no not-found case.
 */
const ENUM_LIKE =
  /^(status|type|decision|action|outcome|category|kind|mode|reason|priority|severity|method|channel|level|role|stage|state|result|disposition|verdict|scope|source|target|format|unit|frequency|route)$|_(type|status|mode|kind|category|action|level|method|channel|code|number|reason|source|scope)$|^(code|barcode|number|uhid|token|slug|key|identifier|field|section|entity)$/;

/**
 * Body with every required field filled, or null when the route cannot be
 * given a body that reaches the record lookup: a field needs a fixture, a
 * required String is enum-like, a required list must be non-empty, or the
 * struct is all-optional (an empty update is refused as empty, not absent).
 */
function synthesiseBody(fields, seedData) {
  const required = fields.filter((x) => x.required);
  if (required.length === 0) return null;
  const body = {};
  for (const f of required) {
    if (/^Vec</.test(f.ty)) return null;
    if (f.ty.split("::").pop() === "String" && ENUM_LIKE.test(f.name)) return null;
    const v = valueFor(f, seedData);
    if (v === undefined) return null;
    body[f.name] = v;
  }
  return body;
}

// ─── Cases ────────────────────────────────────────────────────────

/** The last `{param}` of a pattern when the seed map treats it as an id. */
function lastIdParam(pattern, seedData) {
  const params = [...pattern.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  if (params.length === 0) return null;
  const name = params[params.length - 1];
  return UUID_RE.test(substituteParams(`/x/{${name}}`, seedData).slice(3)) ? name : null;
}

function absentPath(pattern, name, seedData) {
  const idx = pattern.lastIndexOf(`{${name}}`);
  const head = substituteParams(pattern.slice(0, idx), seedData);
  return `${head}${ABSENT_UUID}${pattern.slice(idx + name.length + 2)}`;
}

function casesFor(route, index, seedData, smokeKeys) {
  const { path: pattern, method } = route;
  const cases = [];
  const fn = pick(index.fns.get(route.handler), route.src);
  const bodyType = fn ? jsonBodyType(fn) : undefined; // undefined: handler not found
  let fields = null;
  if (bodyType && bodyType !== "Value") {
    const st = pick(index.structs.get(bodyType), fn.src);
    fields = st ? structFields(st) : null;
  }
  const required = fields ? fields.filter((f) => f.required) : [];

  if (required.length > 0) {
    cases.push({
      kind: "validation",
      method,
      pattern,
      path: substituteParams(pattern, seedData),
      body: {},
      expect: [400, 422],
    });
  }

  const idParam = lastIdParam(pattern, seedData);
  if (idParam) {
    let body = null;
    if (smokeKeys.has(`${method} ${pattern}`)) body = "smoke";
    else if (bodyType === null) body = {};
    else if (fields) body = synthesiseBody(fields, seedData);
    if (body !== null) {
      cases.push({
        kind: "notfound",
        method,
        pattern,
        path: absentPath(pattern, idParam, seedData),
        body,
        expect: [404],
      });
    }
  }
  return cases;
}

// ─── Spec emitter ─────────────────────────────────────────────────

function specForModule(moduleName, cases) {
  const items = cases
    .map((c) => `    ${JSON.stringify({ kind: c.kind, method: c.method, path: c.path, pattern: c.pattern, body: c.body, expect: c.expect })},`)
    .join("\n");
  return `// AUTO-GENERATED by apps/web/scripts/generate-api-writes.mjs — DO NOT EDIT.
// Regenerate with \`make e2e-writes-generate\`.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { E2E_BACKEND_URL, loginAsAdmin } from "../helpers/api";
import type { AuthContext } from "../helpers/types";
import { SMOKE_BODIES } from "../smoke/fixtures";

interface WriteCase {
  kind: "validation" | "notfound";
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  pattern: string;
  /** "smoke" = the smoke fixture body for this route. */
  body: Record<string, unknown> | "smoke";
  expect: number[];
}

const cases: WriteCase[] = [
${items}
];

// Keyed "KIND METHOD /api/pattern" so a known positive failure never hides a negative.
const knownFailures: Record<string, string> =
  JSON.parse(readFileSync(new URL("../smoke/_known_failures.json", import.meta.url), "utf8")).endpoints ?? {};

test.describe("writes ${moduleName}", () => {
  let ctx: AuthContext;

  test.beforeAll(async ({ playwright }) => {
    const request = await playwright.request.newContext({ ignoreHTTPSErrors: true });
    ctx = await loginAsAdmin(request);
  });

  test.afterAll(async () => {
    await ctx?.request.dispose();
  });

  for (const c of cases) {
    test(\`\${c.kind}: \${c.method} \${c.pattern}\`, async () => {
      const reason = knownFailures[\`\${c.kind.toUpperCase()} \${c.method} \${c.pattern}\`];
      test.skip(!!reason, \`known failure: \${reason}\`);

      const body = c.body === "smoke" ? (SMOKE_BODIES[\`\${c.method} \${c.pattern}\`] ?? {}) : c.body;
      const resp = await ctx.request.fetch(\`\${E2E_BACKEND_URL}\${c.path}\`, {
        method: c.method,
        headers: {
          cookie: ctx.cookieHeader,
          "x-csrf-token": ctx.csrfToken,
          "content-type": "application/json",
        },
        data: JSON.stringify(body),
      });
      const status = resp.status();
      expect(status, \`authenticated write must not be unauthorized for \${c.method} \${c.path}\`).not.toBe(401);
      expect(status, \`authenticated write must not be forbidden for \${c.method} \${c.path}\`).not.toBe(403);
      expect(c.expect, \`\${c.kind} \${c.method} \${c.path} answered \${status}\`).toContain(status);
    });
  }
});
`;
}

// ─── Main ─────────────────────────────────────────────────────────

function main() {
  const sources = rustSources();
  const index = indexSources(sources);
  const byFile = new Map(sources.map((s) => [s.file, s]));
  const seedData = parseSeedMap();
  const smokeKeys = parseSmokeBodies();
  const skipSet = parseSkipEndpoints();

  const seen = new Set();
  const routes = [];
  for (const file of routeSourceFiles()) {
    const src = byFile.get(file);
    for (const r of parseWriteRoutes(src)) {
      const key = `${r.method} ${r.path}`;
      if (!r.path.startsWith("/api/") || skipSet.has(key) || seen.has(key)) continue;
      seen.add(key);
      routes.push({ ...r, src });
    }
  }
  if (routes.length === 0) {
    console.error("no write routes parsed — aborting");
    process.exit(1);
  }

  const moduleSpecs = new Map();
  const manifest = { validation: [], notfound: [] };
  for (const route of routes) {
    for (const c of casesFor(route, index, seedData, smokeKeys)) {
      const mod = moduleOf(route.path);
      if (!moduleSpecs.has(mod)) moduleSpecs.set(mod, []);
      moduleSpecs.get(mod).push(c);
      manifest[c.kind].push(`${c.method} ${c.pattern}`);
    }
  }

  if (existsSync(OUTPUT_DIR)) rmSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const [mod, cases] of moduleSpecs) {
    cases.sort((a, b) => `${a.kind} ${a.method} ${a.pattern}`.localeCompare(`${b.kind} ${b.method} ${b.pattern}`));
    writeFileSync(resolve(OUTPUT_DIR, `${mod}.writes.spec.ts`), specForModule(mod, cases));
  }
  mkdirSync(dirname(MANIFEST), { recursive: true });
  manifest.validation.sort();
  manifest.notfound.sort();
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 1)}\n`);

  console.log(
    `write routes: ${routes.length} → ${manifest.validation.length} validation + ${manifest.notfound.length} not-found cases in ${moduleSpecs.size} specs → ${OUTPUT_DIR}`,
  );
}

main();
