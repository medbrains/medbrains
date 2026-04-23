import { join } from "node:path";
import { KiwiClient } from "./kiwi-client.js";
import type { KiwiConfig, TcmsAnnotation, YamlCase } from "./types.js";
import { caseKey, loadAllCases } from "./yaml-loader.js";

// ---------------------------------------------------------------------------
// Playwright types — imported at the type level only so this module doesn't
// hard-depend on @playwright/test at runtime (it's a peer dependency).
// ---------------------------------------------------------------------------
interface PlaywrightTestCase {
  annotations: Array<{ type: string; description?: string }>;
  title: string;
  titlePath(): string[];
}

interface PlaywrightTestResult {
  status: "passed" | "failed" | "timedOut" | "interrupted" | "skipped";
  duration: number;
  errors: Array<{ message?: string; stack?: string }>;
}

interface PlaywrightFullConfig {
  rootDir: string;
}

interface PlaywrightSuite {
  allTests(): PlaywrightTestCase[];
}

interface PlaywrightFullResult {
  status: "passed" | "failed" | "timedout" | "interrupted";
}

// ---------------------------------------------------------------------------
// Reporter options (passed via playwright.config.ts)
// ---------------------------------------------------------------------------

export interface KiwiReporterOptions {
  /** Absolute path to the directory containing YAML test-case definitions. */
  testCasesDir?: string;
  /** Override Kiwi config instead of reading from env vars. */
  kiwiConfig?: Partial<KiwiConfig>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isEnabled(): boolean {
  return process.env["KIWI_REPORT"] === "1";
}

function configFromEnv(overrides?: Partial<KiwiConfig>): KiwiConfig {
  return {
    url: overrides?.url ?? process.env["KIWI_URL"] ?? "https://localhost:8443/xml-rpc/",
    username: overrides?.username ?? process.env["KIWI_USERNAME"] ?? "admin",
    password: overrides?.password ?? process.env["KIWI_PASSWORD"] ?? "admin",
    productName: overrides?.productName ?? process.env["KIWI_PRODUCT"] ?? "Alagappa ERP",
    productVersion: overrides?.productVersion ?? process.env["KIWI_VERSION"] ?? "1.0",
  };
}

/**
 * Parse a `tcms` annotation description string into module + summary.
 * Expected format: `"module::Summary text here"`
 */
function parseTcmsAnnotation(description: string): TcmsAnnotation | null {
  const separatorIndex = description.indexOf("::");
  if (separatorIndex === -1) {
    return null;
  }
  const module = description.slice(0, separatorIndex).trim();
  const summary = description.slice(separatorIndex + 2).trim();
  if (!module || !summary) {
    return null;
  }
  return { module, summary };
}

// ---------------------------------------------------------------------------
// KiwiTcmsReporter — implements Playwright Reporter interface
// ---------------------------------------------------------------------------

/**
 * Playwright custom reporter that pushes test results to Kiwi TCMS.
 *
 * Activated by setting `KIWI_REPORT=1` in the environment.
 *
 * Usage in playwright.config.ts:
 * ```ts
 * reporter: [
 *   ['list'],
 *   ['@qa/kiwi-reporter/playwright', { testCasesDir: '../qa/test-cases' }],
 * ],
 * ```
 *
 * Tests opt in by adding a `tcms` annotation:
 * ```ts
 * test('Login with valid credentials', async ({ page }) => {
 *   test.info().annotations.push({
 *     type: 'tcms',
 *     description: 'auth::Login with valid credentials',
 *   });
 *   // ... test body
 * });
 * ```
 */
export default class KiwiTcmsReporter {
  private client: KiwiClient | null = null;
  private caseMap: Map<string, YamlCase> = new Map();
  private runId: number | null = null;
  private active = false;
  private options: KiwiReporterOptions;

  /** Plan name -> Kiwi plan ID cache to avoid repeated lookups. */
  private planCache = new Map<string, number>();
  /** Case key -> Kiwi case ID cache. */
  private caseIdCache = new Map<string, number>();
  /** Case ID -> execution ID in the current run. */
  private executionCache = new Map<number, number>();

  constructor(options?: KiwiReporterOptions) {
    this.options = options ?? {};
  }

  // -------------------------------------------------------------------------
  // Playwright Reporter lifecycle
  // -------------------------------------------------------------------------

  async onBegin(config: PlaywrightFullConfig, suite: PlaywrightSuite): Promise<void> {
    if (!isEnabled()) {
      return;
    }

    const kiwiConfig = configFromEnv(this.options.kiwiConfig);
    this.client = new KiwiClient(kiwiConfig);

    // Load YAML case definitions
    const testCasesDir =
      this.options.testCasesDir ?? join(config.rootDir, "..", "qa", "test-cases");
    this.caseMap = loadAllCases(testCasesDir);

    try {
      await this.client.login();
      await this.client.getExecutionStatuses();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[kiwi-reporter] Could not connect to Kiwi TCMS: ${message}`);
      console.warn("[kiwi-reporter] Reporting disabled for this run.");
      this.client = null;
      return;
    }

    // Find product and version
    const product = await this.client.findProduct(kiwiConfig.productName);
    if (!product) {
      console.warn(
        `[kiwi-reporter] Product "${kiwiConfig.productName}" not found in Kiwi. Reporting disabled.`,
      );
      this.client = null;
      return;
    }

    const version = await this.client.findVersion(product.id, kiwiConfig.productVersion);
    if (!version) {
      console.warn(
        `[kiwi-reporter] Version "${kiwiConfig.productVersion}" not found for product "${kiwiConfig.productName}". Reporting disabled.`,
      );
      this.client = null;
      return;
    }

    // Count how many tests carry a tcms annotation so the run summary is informative
    const allTests = suite.allTests();
    const tcmsCount = allTests.filter((t) =>
      t.annotations.some((a) => a.type === "tcms"),
    ).length;

    // Create a test run. We use the first plan we find; executions for cases
    // across different plans are added individually later.
    const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
    const runSummary = `Playwright run ${timestamp} (${tcmsCount} TCMS-linked tests)`;

    // We need at least one plan to create a run. Pick the first plan
    // referenced by a YAML case, or fall back to a default.
    const firstCase = this.caseMap.values().next();
    const firstPlanName = firstCase.done ? kiwiConfig.productName : firstCase.value.plan;

    let plan = await this.client.findTestPlan(product.id, firstPlanName);
    if (!plan) {
      // Fall back: look for any plan under this product
      console.warn(
        `[kiwi-reporter] Test plan "${firstPlanName}" not found. Attempting fallback.`,
      );
      this.client = null;
      return;
    }

    this.planCache.set(firstPlanName, plan.id);

    try {
      const run = await this.client.createTestRun(
        plan.id,
        version.id,
        runSummary,
        1, // manager ID — typically the admin user
      );
      this.runId = run.id;
      this.active = true;
      console.log(`[kiwi-reporter] Created test run #${run.id}: ${runSummary}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[kiwi-reporter] Failed to create test run: ${message}`);
      this.client = null;
    }
  }

  async onTestEnd(test: PlaywrightTestCase, result: PlaywrightTestResult): Promise<void> {
    if (!this.active || !this.client || this.runId === null) {
      return;
    }

    // Find the tcms annotation on this test
    const tcmsAnnotation = test.annotations.find((a) => a.type === "tcms");
    if (!tcmsAnnotation?.description) {
      return; // Test not linked to Kiwi
    }

    const parsed = parseTcmsAnnotation(tcmsAnnotation.description);
    if (!parsed) {
      console.warn(
        `[kiwi-reporter] Invalid tcms annotation format: "${tcmsAnnotation.description}". Expected "module::summary".`,
      );
      return;
    }

    const key = caseKey(parsed.module, parsed.summary);
    const yamlCase = this.caseMap.get(key);
    if (!yamlCase) {
      console.warn(
        `[kiwi-reporter] No YAML case found for key "${key}". Skipping.`,
      );
      return;
    }

    try {
      // Resolve the Kiwi case ID
      const caseId = await this.resolveCaseId(yamlCase);
      if (caseId === null) {
        console.warn(
          `[kiwi-reporter] Could not find Kiwi case for "${yamlCase.summary}" in plan "${yamlCase.plan}". Skipping.`,
        );
        return;
      }

      // Ensure the case is in the run and get the execution ID
      const executionId = await this.ensureExecution(caseId);
      if (executionId === null) {
        return;
      }

      // Resolve the Playwright status to a Kiwi status ID
      const statusId = await this.client.resolveStatusId(result.status);
      if (statusId === -1) {
        // Skipped tests — don't update Kiwi
        return;
      }

      // Build a comment with failure details when relevant
      let comment: string | undefined;
      if (result.status !== "passed" && result.errors.length > 0) {
        const errorMessages = result.errors
          .map((e) => e.message ?? e.stack ?? "Unknown error")
          .join("\n---\n");
        comment = `Playwright ${result.status} (${result.duration}ms):\n${errorMessages}`;
      }

      await this.client.updateExecution(executionId, statusId, comment);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[kiwi-reporter] Failed to report result for "${parsed.summary}": ${message}`,
      );
    }
  }

  async onEnd(_result: PlaywrightFullResult): Promise<void> {
    if (!this.active || this.runId === null) {
      return;
    }
    console.log(`[kiwi-reporter] Test run #${this.runId} complete.`);
  }

  printsToStdio(): boolean {
    return false;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Resolve a YAML case to its Kiwi TCMS case ID, using the plan cache
   * so we only look up each plan once.
   */
  private async resolveCaseId(yamlCase: YamlCase): Promise<number | null> {
    const key = caseKey(yamlCase.module, yamlCase.summary);

    const cached = this.caseIdCache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    if (!this.client) {
      return null;
    }

    // Resolve plan ID
    let planId = this.planCache.get(yamlCase.plan);
    if (planId === undefined) {
      const product = await this.client.findProduct(
        configFromEnv(this.options.kiwiConfig).productName,
      );
      if (!product) {
        return null;
      }
      const plan = await this.client.findTestPlan(product.id, yamlCase.plan);
      if (!plan) {
        return null;
      }
      planId = plan.id;
      this.planCache.set(yamlCase.plan, planId);
    }

    const kiwiCase = await this.client.findTestCase(planId, yamlCase.summary);
    if (!kiwiCase) {
      return null;
    }

    this.caseIdCache.set(key, kiwiCase.id);
    return kiwiCase.id;
  }

  /**
   * Ensure a test case has an execution entry in the current run.
   * Adds it if missing, then caches the execution ID.
   */
  private async ensureExecution(caseId: number): Promise<number | null> {
    if (!this.client || this.runId === null) {
      return null;
    }

    const cached = this.executionCache.get(caseId);
    if (cached !== undefined) {
      return cached;
    }

    try {
      // Add the case to the run — Kiwi creates an execution object
      const execution = await this.client.addCaseToRun(this.runId, caseId);
      this.executionCache.set(caseId, execution.id);
      return execution.id;
    } catch {
      // Case might already be in the run — fetch executions and find it
      try {
        const executions = await this.client.getExecutionsForRun(this.runId);
        const match = executions.find((e) => e.case === caseId);
        if (match) {
          this.executionCache.set(caseId, match.id);
          return match.id;
        }
      } catch (innerErr) {
        const message = innerErr instanceof Error ? innerErr.message : String(innerErr);
        console.warn(`[kiwi-reporter] Failed to resolve execution for case ${caseId}: ${message}`);
      }
      return null;
    }
  }
}
