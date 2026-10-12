/**
 * No print route answers 500.
 *
 * 48 print handlers once read tables no migration created, so every call was a
 * 500 — and because only one screen could reach them, nobody saw it. Asked for
 * a record that does not exist, a working handler gets through its permission
 * and record checks and its first query, then says 404; a period it does not
 * hold is 404 or an empty register. A 500 means a query the database refuses.
 *
 * The routes are read from the Rust source, so a new handler is swept the day
 * it is written.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { E2E_BACKEND_URL } from "../helpers/api";
import { expect, test } from "./support/world";

const SRC = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../crates/medbrains-print-data/src",
);

function samplePath(route: string): string {
  return route
    .replace("{period}", "2026-09")
    .replace("{month}", "2026-09")
    .replace("{quarter}", "2026-Q3")
    .replace("{year}", "2026")
    .replace("{date}", "2026-09-17")
    .replace(/\{\w+\}/g, () => crypto.randomUUID());
}

function printRoutes(): string[] {
  const routes = new Set<string>();
  for (const file of readdirSync(SRC).filter((f) => f.endsWith(".rs"))) {
    const text = readFileSync(join(SRC, file), "utf8");
    for (const m of text.matchAll(/"(\/api\/print-data\/[^"]+)"/g)) routes.add(m[1] as string);
  }
  return [...routes].sort();
}

test("every print route answers without a server error", async ({ hospital }) => {
  const routes = printRoutes();
  expect(routes.length).toBeGreaterThan(100);
  const failures: string[] = [];
  for (const route of routes) {
    const path = samplePath(route);
    const resp = await hospital.admin.request.get(`${E2E_BACKEND_URL}${path}`, {
      headers: { cookie: hospital.admin.cookieHeader, "x-csrf-token": hospital.admin.csrfToken },
    });
    // 501 is a document the product cannot fill yet (the medical-college
    // forms) — said honestly. Anything else 5xx is a query that broke.
    if (resp.status() >= 500 && resp.status() !== 501) {
      failures.push(`${resp.status()} ${route}: ${(await resp.text()).slice(0, 200)}`);
    }
  }
  expect(failures, failures.join("\n")).toEqual([]);
});
