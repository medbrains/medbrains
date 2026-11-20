/** The `/qa` API area. Moved from `client.ts`; one module per first path segment. */
import type { TestCaseResult, TestCycle, TestResultValue } from "@medbrains/types";
import { request } from "../client.js";

export const qaApi = {
  /** The open test cycle, if any (#4804). */
  getOpenTestCycle: () => request<TestCycle | null>("/qa/cycle"),
  listTestCycles: () => request<TestCycle[]>("/qa/cycles"),
  openTestCycle: (name: string) =>
    request<TestCycle>("/qa/cycles", { method: "POST", body: JSON.stringify({ name }) }),
  closeTestCycle: (id: string) => request<TestCycle>(`/qa/cycles/${id}/close`, { method: "PUT" }),
  /** A tester's own role's results, or everyone's for whoever runs the cycles. */
  listTestResults: (cycleId: string) =>
    request<TestCaseResult[]>(`/qa/results?cycle_id=${encodeURIComponent(cycleId)}`),
  recordTestResult: (data: {
    case_id: string;
    result: TestResultValue;
    note?: string | null;
    tester_name?: string | null;
    screen_path?: string | null;
  }) => request<TestCaseResult>("/qa/results", { method: "PUT", body: JSON.stringify(data) }),
};
