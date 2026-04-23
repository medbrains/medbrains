import type { YamlCase } from "./types.js";
/**
 * Build a composite lookup key for a YAML case.
 * Format: `${module}::${summary}` where module is the lowercased filename stem.
 *
 * This matches the annotation format used in Playwright tests:
 *   `test.info().annotations.push({ type: "tcms", description: "auth::Login with valid credentials" })`
 */
export declare function caseKey(module: string, summary: string): string;
/**
 * Load all YAML test-case definitions from a directory.
 *
 * @param testCasesDir - Absolute or relative path to the directory containing .yml files
 * @returns Map keyed by `${module}::${summary}` for O(1) lookup during test execution
 */
export declare function loadAllCases(testCasesDir: string): Map<string, YamlCase>;
//# sourceMappingURL=yaml-loader.d.ts.map