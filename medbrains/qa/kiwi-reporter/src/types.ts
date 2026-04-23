/**
 * Annotation attached to a Playwright test via `test.info().annotations`.
 * Format: `{ type: "tcms", description: "auth::Login with valid credentials" }`
 */
export interface TcmsAnnotation {
  /** YAML filename stem, e.g. "auth", "fee-payments" */
  module: string;
  /** Exact match to YAML case summary */
  summary: string;
}

/** A single test case parsed from a YAML definition file. */
export interface YamlCase {
  /** Module name from the YAML top-level `module` field */
  module: string;
  /** Test plan name from the YAML top-level `plan` field */
  plan: string;
  /** Category name from the YAML top-level `category` field */
  category: string;
  /** Individual case summary text */
  summary: string;
  /** Priority level (e.g. "High", "Medium", "Low") */
  priority: string;
}

/** Configuration needed to connect to a Kiwi TCMS instance. */
export interface KiwiConfig {
  /** XML-RPC endpoint, e.g. "https://localhost:8443/xml-rpc/" */
  url: string;
  /** Kiwi TCMS username */
  username: string;
  /** Kiwi TCMS password */
  password: string;
  /** Product name in Kiwi, e.g. "Alagappa ERP" */
  productName: string;
  /** Product version string, e.g. "1.0" */
  productVersion: string;
}

/** Shape of a Kiwi TCMS product object returned from Product.filter. */
export interface KiwiProduct {
  id: number;
  name: string;
}

/** Shape of a Kiwi TCMS version object returned from Version.filter. */
export interface KiwiVersion {
  id: number;
  value: string;
  product: number;
}

/** Shape of a Kiwi TCMS test plan object returned from TestPlan.filter. */
export interface KiwiTestPlan {
  id: number;
  name: string;
  product: number;
}

/** Shape of a Kiwi TCMS test case object returned from TestCase.filter. */
export interface KiwiTestCase {
  id: number;
  summary: string;
  plan: number[];
}

/** Shape of a Kiwi TCMS test run object returned from TestRun.create. */
export interface KiwiTestRun {
  id: number;
  summary: string;
  plan: number;
}

/** Shape of a Kiwi TCMS test execution object. */
export interface KiwiTestExecution {
  id: number;
  run: number;
  case: number;
  status: number;
}

/** Shape of a Kiwi TCMS execution status object. */
export interface KiwiExecutionStatus {
  id: number;
  name: string;
  weight: number;
  color: string;
}

/** Cached status IDs for the three statuses we care about. */
export interface StatusIds {
  passed: number;
  failed: number;
  error: number;
}
