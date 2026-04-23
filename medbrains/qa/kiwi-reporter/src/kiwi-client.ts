import xmlrpc from "xmlrpc";
import type {
  KiwiConfig,
  KiwiExecutionStatus,
  KiwiProduct,
  KiwiTestCase,
  KiwiTestExecution,
  KiwiTestPlan,
  KiwiTestRun,
  KiwiVersion,
  StatusIds,
} from "./types.js";

/** Options accepted by xmlrpc.createClient / createSecureClient. */
interface XmlRpcClientOptions {
  host?: string;
  path?: string;
  port?: number;
  url?: string;
  cookies?: boolean;
  headers?: Record<string, string>;
  basic_auth?: { user: string; pass: string };
  method?: string;
  rejectUnauthorized?: boolean;
}

/**
 * XML-RPC client for Kiwi TCMS.
 *
 * Wraps the raw xmlrpc callbacks in async/await, handles authentication,
 * and caches execution status IDs so callers don't need to look them up.
 */
export class KiwiClient {
  private client: ReturnType<typeof xmlrpc.createClient>;
  private sessionId: string | null = null;
  private statusCache: StatusIds | null = null;
  private readonly config: KiwiConfig;

  constructor(config: KiwiConfig) {
    this.config = config;

    const url = new URL(config.url);
    const isSecure = url.protocol === "https:";
    const port = url.port
      ? Number(url.port)
      : isSecure
        ? 443
        : 80;

    const clientOptions: XmlRpcClientOptions = {
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
    } else {
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
  private call<T>(method: string, params: unknown[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.client.methodCall(
        method,
        params as Parameters<typeof this.client.methodCall>[1],
        (err, value) => {
          if (err) {
            const message = err instanceof Error
              ? err.message
              : typeof err === "object" && err !== null && "faultString" in err
                ? String((err as Record<string, unknown>)["faultString"])
                : String(err);
            reject(new Error(`Kiwi RPC ${method} failed: ${message}`));
            return;
          }
          resolve(value as T);
        },
      );
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
  async login(): Promise<void> {
    const sessionId = await this.call<string>("Auth.login", [
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
  async findProduct(name: string): Promise<KiwiProduct | null> {
    const results = await this.call<KiwiProduct[]>("Product.filter", [{ name }]);
    return results.length > 0 ? results[0] : null;
  }

  /** Find a version by product ID and version string. */
  async findVersion(productId: number, value: string): Promise<KiwiVersion | null> {
    const results = await this.call<KiwiVersion[]>("Version.filter", [
      { product: productId, value },
    ]);
    return results.length > 0 ? results[0] : null;
  }

  /** Find a test plan by product ID and exact plan name. */
  async findTestPlan(productId: number, name: string): Promise<KiwiTestPlan | null> {
    const results = await this.call<KiwiTestPlan[]>("TestPlan.filter", [
      { product: productId, name },
    ]);
    return results.length > 0 ? results[0] : null;
  }

  /** Find a test case within a plan by exact summary match. */
  async findTestCase(planId: number, summary: string): Promise<KiwiTestCase | null> {
    const results = await this.call<KiwiTestCase[]>("TestCase.filter", [
      { plan: planId, summary },
    ]);
    return results.length > 0 ? results[0] : null;
  }

  // ---------------------------------------------------------------------------
  // Test Run management
  // ---------------------------------------------------------------------------

  /** Create a new test run under a plan. */
  async createTestRun(
    planId: number,
    versionId: number,
    summary: string,
    managerId: number,
  ): Promise<KiwiTestRun> {
    return this.call<KiwiTestRun>("TestRun.create", [
      {
        plan: planId,
        build: versionId,
        summary,
        manager: managerId,
      },
    ]);
  }

  /** Add a test case to an existing test run. Returns the first execution. */
  async addCaseToRun(runId: number, caseId: number): Promise<KiwiTestExecution> {
    const result = await this.call<KiwiTestExecution[] | KiwiTestExecution>(
      "TestRun.add_case",
      [runId, caseId],
    );
    return Array.isArray(result) ? result[0] : result;
  }

  // ---------------------------------------------------------------------------
  // Execution management
  // ---------------------------------------------------------------------------

  /** Get all executions for a given test run. */
  async getExecutionsForRun(runId: number): Promise<KiwiTestExecution[]> {
    return this.call<KiwiTestExecution[]>("TestExecution.filter", [{ run: runId }]);
  }

  /** Update an execution's status and optionally add a comment. */
  async updateExecution(
    executionId: number,
    statusId: number,
    comment?: string,
  ): Promise<KiwiTestExecution> {
    const execution = await this.call<KiwiTestExecution>("TestExecution.update", [
      executionId,
      { status: statusId },
    ]);
    if (comment) {
      await this.call<unknown>("TestExecution.add_comment", [executionId, comment]);
    }
    return execution;
  }

  // ---------------------------------------------------------------------------
  // Status helpers
  // ---------------------------------------------------------------------------

  /** Fetch all execution statuses and cache the PASSED/FAILED/ERROR IDs. */
  async getExecutionStatuses(): Promise<StatusIds> {
    if (this.statusCache) {
      return this.statusCache;
    }

    const statuses = await this.call<KiwiExecutionStatus[]>(
      "TestExecutionStatus.filter",
      [{}],
    );

    const find = (name: string): number => {
      const match = statuses.find(
        (s) => s.name.toUpperCase() === name.toUpperCase(),
      );
      if (!match) {
        throw new Error(
          `Kiwi execution status "${name}" not found. Available: ${statuses.map((s) => s.name).join(", ")}`,
        );
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
  async resolveStatusId(
    playwrightStatus: "passed" | "failed" | "timedOut" | "interrupted" | "skipped",
  ): Promise<number> {
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
