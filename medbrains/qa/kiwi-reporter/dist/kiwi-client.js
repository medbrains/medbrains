import xmlrpc from "xmlrpc";
/**
 * XML-RPC client for Kiwi TCMS.
 *
 * Wraps the raw xmlrpc callbacks in async/await, handles authentication,
 * and caches execution status IDs so callers don't need to look them up.
 */
export class KiwiClient {
    client;
    sessionId = null;
    statusCache = null;
    config;
    constructor(config) {
        this.config = config;
        const url = new URL(config.url);
        const isSecure = url.protocol === "https:";
        const port = url.port
            ? Number(url.port)
            : isSecure
                ? 443
                : 80;
        const clientOptions = {
            host: url.hostname,
            port,
            path: url.pathname,
            cookies: true,
        };
        if (isSecure) {
            // rejectUnauthorized is not in the xmlrpc ClientOptions type definition
            // but is passed through to Node's TLS layer by the library at runtime.
            // We use Object.assign to satisfy the type checker while keeping the
            // self-signed cert support needed for local Kiwi TCMS.
            const secureOptions = Object.assign({}, clientOptions, {
                rejectUnauthorized: false,
            });
            this.client = xmlrpc.createSecureClient(secureOptions);
        }
        else {
            this.client = xmlrpc.createClient(clientOptions);
        }
    }
    // ---------------------------------------------------------------------------
    // Low-level RPC helper
    // ---------------------------------------------------------------------------
    /**
     * Call a Kiwi TCMS XML-RPC method. Automatically uses the session cookie
     * once authenticated.
     */
    call(method, params) {
        return new Promise((resolve, reject) => {
            this.client.methodCall(method, params, (err, value) => {
                if (err) {
                    const message = err instanceof Error
                        ? err.message
                        : typeof err === "object" && err !== null && "faultString" in err
                            ? String(err["faultString"])
                            : String(err);
                    reject(new Error(`Kiwi RPC ${method} failed: ${message}`));
                    return;
                }
                resolve(value);
            });
        });
    }
    // ---------------------------------------------------------------------------
    // Authentication
    // ---------------------------------------------------------------------------
    /**
     * Authenticate with Kiwi TCMS. Must be called before any other method.
     * Stores the session cookie for subsequent requests via the client's
     * built-in cookie support.
     */
    async login() {
        const sessionId = await this.call("Auth.login", [
            this.config.username,
            this.config.password,
        ]);
        this.sessionId = sessionId;
        // Inject the session cookie into all subsequent requests.
        // The xmlrpc Client exposes `options.headers` for custom headers
        // and a setCookie method for cookie management.
        this.client.setCookie("sessionid", sessionId);
    }
    // ---------------------------------------------------------------------------
    // Product & Plan lookups
    // ---------------------------------------------------------------------------
    /** Find a product by exact name. Returns the first match or null. */
    async findProduct(name) {
        const results = await this.call("Product.filter", [{ name }]);
        return results.length > 0 ? results[0] : null;
    }
    /** Find a version by product ID and version string. */
    async findVersion(productId, value) {
        const results = await this.call("Version.filter", [
            { product: productId, value },
        ]);
        return results.length > 0 ? results[0] : null;
    }
    /** Find a test plan by product ID and exact plan name. */
    async findTestPlan(productId, name) {
        const results = await this.call("TestPlan.filter", [
            { product: productId, name },
        ]);
        return results.length > 0 ? results[0] : null;
    }
    /** Find a test case within a plan by exact summary match. */
    async findTestCase(planId, summary) {
        const results = await this.call("TestCase.filter", [
            { plan: planId, summary },
        ]);
        return results.length > 0 ? results[0] : null;
    }
    // ---------------------------------------------------------------------------
    // Test Run management
    // ---------------------------------------------------------------------------
    /** Create a new test run under a plan. */
    async createTestRun(planId, versionId, summary, managerId) {
        return this.call("TestRun.create", [
            {
                plan: planId,
                build: versionId,
                summary,
                manager: managerId,
            },
        ]);
    }
    /** Add a test case to an existing test run. Returns the first execution. */
    async addCaseToRun(runId, caseId) {
        const result = await this.call("TestRun.add_case", [runId, caseId]);
        return Array.isArray(result) ? result[0] : result;
    }
    // ---------------------------------------------------------------------------
    // Execution management
    // ---------------------------------------------------------------------------
    /** Get all executions for a given test run. */
    async getExecutionsForRun(runId) {
        return this.call("TestExecution.filter", [{ run: runId }]);
    }
    /** Update an execution's status and optionally add a comment. */
    async updateExecution(executionId, statusId, comment) {
        const execution = await this.call("TestExecution.update", [
            executionId,
            { status: statusId },
        ]);
        if (comment) {
            await this.call("TestExecution.add_comment", [executionId, comment]);
        }
        return execution;
    }
    // ---------------------------------------------------------------------------
    // Status helpers
    // ---------------------------------------------------------------------------
    /** Fetch all execution statuses and cache the PASSED/FAILED/ERROR IDs. */
    async getExecutionStatuses() {
        if (this.statusCache) {
            return this.statusCache;
        }
        const statuses = await this.call("TestExecutionStatus.filter", [{}]);
        const find = (name) => {
            const match = statuses.find((s) => s.name.toUpperCase() === name.toUpperCase());
            if (!match) {
                throw new Error(`Kiwi execution status "${name}" not found. Available: ${statuses.map((s) => s.name).join(", ")}`);
            }
            return match.id;
        };
        this.statusCache = {
            passed: find("PASSED"),
            failed: find("FAILED"),
            error: find("ERROR"),
        };
        return this.statusCache;
    }
    /** Map a Playwright test status string to a Kiwi status ID. */
    async resolveStatusId(playwrightStatus) {
        const ids = await this.getExecutionStatuses();
        switch (playwrightStatus) {
            case "passed":
                return ids.passed;
            case "failed":
                return ids.failed;
            case "timedOut":
            case "interrupted":
                return ids.error;
            case "skipped":
                // Kiwi has no universal "skipped" — leave as-is (don't update)
                return -1;
        }
    }
}
//# sourceMappingURL=kiwi-client.js.map