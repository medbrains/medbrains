import type { KiwiConfig, KiwiProduct, KiwiTestCase, KiwiTestExecution, KiwiTestPlan, KiwiTestRun, KiwiVersion, StatusIds } from "./types.js";
/**
 * XML-RPC client for Kiwi TCMS.
 *
 * Wraps the raw xmlrpc callbacks in async/await, handles authentication,
 * and caches execution status IDs so callers don't need to look them up.
 */
export declare class KiwiClient {
    private client;
    private sessionId;
    private statusCache;
    private readonly config;
    constructor(config: KiwiConfig);
    /**
     * Call a Kiwi TCMS XML-RPC method. Automatically uses the session cookie
     * once authenticated.
     */
    private call;
    /**
     * Authenticate with Kiwi TCMS. Must be called before any other method.
     * Stores the session cookie for subsequent requests via the client's
     * built-in cookie support.
     */
    login(): Promise<void>;
    /** Find a product by exact name. Returns the first match or null. */
    findProduct(name: string): Promise<KiwiProduct | null>;
    /** Find a version by product ID and version string. */
    findVersion(productId: number, value: string): Promise<KiwiVersion | null>;
    /** Find a test plan by product ID and exact plan name. */
    findTestPlan(productId: number, name: string): Promise<KiwiTestPlan | null>;
    /** Find a test case within a plan by exact summary match. */
    findTestCase(planId: number, summary: string): Promise<KiwiTestCase | null>;
    /** Create a new test run under a plan. */
    createTestRun(planId: number, versionId: number, summary: string, managerId: number): Promise<KiwiTestRun>;
    /** Add a test case to an existing test run. Returns the first execution. */
    addCaseToRun(runId: number, caseId: number): Promise<KiwiTestExecution>;
    /** Get all executions for a given test run. */
    getExecutionsForRun(runId: number): Promise<KiwiTestExecution[]>;
    /** Update an execution's status and optionally add a comment. */
    updateExecution(executionId: number, statusId: number, comment?: string): Promise<KiwiTestExecution>;
    /** Fetch all execution statuses and cache the PASSED/FAILED/ERROR IDs. */
    getExecutionStatuses(): Promise<StatusIds>;
    /** Map a Playwright test status string to a Kiwi status ID. */
    resolveStatusId(playwrightStatus: "passed" | "failed" | "timedOut" | "interrupted" | "skipped"): Promise<number>;
}
//# sourceMappingURL=kiwi-client.d.ts.map