/**
 * Kiwi TCMS Playwright Reporter
 *
 * Maps test annotations to Kiwi test cases and reports PASS/FAIL results.
 *
 * Usage in test:
 *   test("login with valid credentials", { annotation: { type: "tcms", description: "auth::Login with valid credentials" } }, async () => { ... })
 *
 * Enable:
 *   KIWI_REPORT=1 pnpm exec playwright test
 *
 * Config env vars:
 *   KIWI_API_URL (default: https://localhost:8443/xml-rpc/)
 *   KIWI_USERNAME (default: admin)
 *   KIWI_PASSWORD (default: admin)
 */

import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import { readFileSync } from "fs";
import { join } from "path";
import { globSync } from "glob";
import { parse } from "yaml";

interface KiwiConfig {
  apiUrl: string;
  username: string;
  password: string;
  productName: string;
}

interface YamlTestCase {
  id: string;
  summary: string;
  layer: string;
  priority: string;
  automated: boolean;
  test_file?: string;
}

interface YamlModule {
  module: string;
  tests: YamlTestCase[];
}

interface TestResultEntry {
  tcmsKey: string; // "module::summary"
  status: "PASSED" | "FAILED" | "ERROR" | "WAIVED";
  duration: number;
  error?: string;
}

class KiwiReporter implements Reporter {
  private config: KiwiConfig;
  private results: TestResultEntry[] = [];
  private enabled: boolean;
  private caseMap: Map<string, string> = new Map(); // "module::summary" → case ID

  constructor() {
    this.enabled = process.env.KIWI_REPORT === "1";
    this.config = {
      apiUrl: process.env.KIWI_API_URL ?? "https://localhost:8443/xml-rpc/",
      username: process.env.KIWI_USERNAME ?? "admin",
      password: process.env.KIWI_PASSWORD ?? "admin",
      productName: "MedBrains",
    };
  }

  onBegin(_config: FullConfig, _suite: Suite): void {
    if (!this.enabled) return;

    // Load YAML test cases to build the mapping
    const qaDir = join(__dirname, "..", "test-cases");
    try {
      const files = globSync(join(qaDir, "*.yml"));
      for (const file of files) {
        const content = readFileSync(file, "utf-8");
        const data = parse(content) as YamlModule;
        if (data?.tests) {
          for (const test of data.tests) {
            const key = `${data.module}::${test.summary}`;
            this.caseMap.set(key, test.id);
          }
        }
      }
      console.log(
        `[Kiwi Reporter] Loaded ${this.caseMap.size} test case mappings`,
      );
    } catch (e) {
      console.warn(`[Kiwi Reporter] Could not load YAML test cases: ${e}`);
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (!this.enabled) return;

    // Find tcms annotation
    const tcmsAnnotation = test.annotations.find((a) => a.type === "tcms");
    if (!tcmsAnnotation?.description) return;

    const tcmsKey = tcmsAnnotation.description;
    const status =
      result.status === "passed"
        ? "PASSED"
        : result.status === "failed"
          ? "FAILED"
          : result.status === "timedOut"
            ? "ERROR"
            : "WAIVED";

    this.results.push({
      tcmsKey,
      status,
      duration: result.duration,
      error:
        result.status === "failed"
          ? result.errors.map((e) => e.message).join("\n")
          : undefined,
    });
  }

  async onEnd(_result: FullResult): Promise<void> {
    if (!this.enabled || this.results.length === 0) return;

    console.log(
      `\n[Kiwi Reporter] Reporting ${this.results.length} result(s) to Kiwi TCMS...`,
    );

    // Report results summary (actual XML-RPC reporting would go here)
    // For now, output a JSON summary that can be piped to the sync script
    const summary = {
      timestamp: new Date().toISOString(),
      total: this.results.length,
      passed: this.results.filter((r) => r.status === "PASSED").length,
      failed: this.results.filter((r) => r.status === "FAILED").length,
      results: this.results.map((r) => ({
        tcms_key: r.tcmsKey,
        case_id: this.caseMap.get(r.tcmsKey) ?? "UNMAPPED",
        status: r.status,
        duration_ms: r.duration,
        error: r.error?.substring(0, 500),
      })),
    };

    console.log(`[Kiwi Reporter] Results:`);
    console.log(
      `  Passed: ${summary.passed}, Failed: ${summary.failed}, Total: ${summary.total}`,
    );

    for (const r of summary.results) {
      const icon = r.status === "PASSED" ? "✓" : "✗";
      const caseRef = r.case_id !== "UNMAPPED" ? `[${r.case_id}]` : "[?]";
      console.log(`  ${icon} ${caseRef} ${r.tcms_key}`);
    }

    // Write results JSON for the sync script to pick up
    const { writeFileSync, mkdirSync } = await import("fs");
    const outDir = join(__dirname, "..", "kiwi-results");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, `run-${Date.now()}.json`),
      JSON.stringify(summary, null, 2),
    );
    console.log(`[Kiwi Reporter] Results saved to qa/kiwi-results/`);
  }
}

export default KiwiReporter;
