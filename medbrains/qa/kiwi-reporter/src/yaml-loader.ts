import { readFileSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { YamlCase } from "./types.js";

/** Raw shape of a YAML test-case file (top-level fields + cases array). */
interface YamlFile {
  module: string;
  plan: string;
  category: string;
  cases: Array<{
    summary: string;
    priority: string;
  }>;
}

/**
 * Build a composite lookup key for a YAML case.
 * Format: `${module}::${summary}` where module is the lowercased filename stem.
 *
 * This matches the annotation format used in Playwright tests:
 *   `test.info().annotations.push({ type: "tcms", description: "auth::Login with valid credentials" })`
 */
export function caseKey(module: string, summary: string): string {
  return `${module.toLowerCase()}::${summary}`;
}

/**
 * Parse a single YAML test-case file and return an array of YamlCase objects.
 * The module key used for lookups is the filename stem (e.g. "auth" from "auth.yml").
 */
function parseFile(filePath: string): YamlCase[] {
  const raw = readFileSync(filePath, "utf-8");
  const data = parseYaml(raw) as YamlFile | null;

  if (!data || !Array.isArray(data.cases)) {
    return [];
  }

  const fileStem = basename(filePath, extname(filePath)).toLowerCase();

  return data.cases.map((c) => ({
    module: fileStem,
    plan: data.plan ?? data.module ?? fileStem,
    category: data.category ?? data.module ?? fileStem,
    summary: c.summary,
    priority: c.priority ?? "Medium",
  }));
}

/**
 * Load all YAML test-case definitions from a directory.
 *
 * @param testCasesDir - Absolute or relative path to the directory containing .yml files
 * @returns Map keyed by `${module}::${summary}` for O(1) lookup during test execution
 */
export function loadAllCases(testCasesDir: string): Map<string, YamlCase> {
  const map = new Map<string, YamlCase>();

  let entries: string[];
  try {
    entries = readdirSync(testCasesDir);
  } catch {
    console.warn(`[kiwi-reporter] Could not read test-cases directory: ${testCasesDir}`);
    return map;
  }

  const ymlFiles = entries.filter(
    (f) => f.endsWith(".yml") || f.endsWith(".yaml"),
  );

  for (const fileName of ymlFiles) {
    const filePath = join(testCasesDir, fileName);
    try {
      const cases = parseFile(filePath);
      for (const c of cases) {
        const key = caseKey(c.module, c.summary);
        map.set(key, c);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[kiwi-reporter] Failed to parse ${fileName}: ${message}`);
    }
  }

  return map;
}
