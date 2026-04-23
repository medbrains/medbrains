import type { KiwiConfig } from "./types.js";
interface PlaywrightTestCase {
    annotations: Array<{
        type: string;
        description?: string;
    }>;
    title: string;
    titlePath(): string[];
}
interface PlaywrightTestResult {
    status: "passed" | "failed" | "timedOut" | "interrupted" | "skipped";
    duration: number;
    errors: Array<{
        message?: string;
        stack?: string;
    }>;
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
export interface KiwiReporterOptions {
    /** Absolute path to the directory containing YAML test-case definitions. */
    testCasesDir?: string;
    /** Override Kiwi config instead of reading from env vars. */
    kiwiConfig?: Partial<KiwiConfig>;
}
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
    private client;
    private caseMap;
    private runId;
    private active;
    private options;
    /** Plan name -> Kiwi plan ID cache to avoid repeated lookups. */
    private planCache;
    /** Case key -> Kiwi case ID cache. */
    private caseIdCache;
    /** Case ID -> execution ID in the current run. */
    private executionCache;
    constructor(options?: KiwiReporterOptions);
    onBegin(config: PlaywrightFullConfig, suite: PlaywrightSuite): Promise<void>;
    onTestEnd(test: PlaywrightTestCase, result: PlaywrightTestResult): Promise<void>;
    onEnd(_result: PlaywrightFullResult): Promise<void>;
    printsToStdio(): boolean;
    /**
     * Resolve a YAML case to its Kiwi TCMS case ID, using the plan cache
     * so we only look up each plan once.
     */
    private resolveCaseId;
    /**
     * Ensure a test case has an execution entry in the current run.
     * Adds it if missing, then caches the execution ID.
     */
    private ensureExecution;
}
export {};
//# sourceMappingURL=playwright-reporter.d.ts.map