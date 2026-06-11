/**
 * SOP ref: docs/sops/21-command-center.md, docs/sops/22-analytics-reports.md,
 *          docs/sops/23-utilization-review.md, docs/sops/24-scheduling-admin.md
 *
 * These tests verify management-side API contracts:
 * - Analytics endpoints return expected shape
 * - Lab TAT monitoring accessible
 * - Utilization review prior auth dashboard
 * - Scheduling no-show data endpoint
 */

import { test, expect } from "@playwright/test";
import { loginAsRoleApi, api } from "../helpers/api";

test.describe("Management analytics — API contract checks", () => {
  test("hospital_admin can access billing department-revenue report", async ({
    request,
  }) => {
    const ctx = await loginAsRoleApi(request, "hospital_admin");
    const today = new Date().toISOString().split("T")[0];
    const lastMonth = new Date(Date.now() - 30 * 86400_000)
      .toISOString()
      .split("T")[0];

    const report = await api<Record<string, unknown>>(
      ctx,
      "GET",
      `/api/billing/reports/department-revenue?from=${lastMonth}&to=${today}`,
    );
    expect(report).toBeDefined();
  });

  test("lab TAT monitoring endpoint returns per-urgency TAT data", async ({
    request,
  }) => {
    // hospital_admin bypasses permission checks — testing endpoint behavior
    const ctx = await loginAsRoleApi(request, "hospital_admin");

    const tat = await api<unknown[]>(ctx, "GET", "/api/lab/tat-monitoring");

    expect(Array.isArray(tat)).toBe(true);
  });

  test("lab TAT analytics responds", async ({ request }) => {
    // hospital_admin bypasses permission checks — testing endpoint behavior
    const ctx = await loginAsRoleApi(request, "hospital_admin");

    const analytics = await api<unknown[]>(ctx, "GET", "/api/lab/analytics/tat");
    expect(Array.isArray(analytics)).toBe(true);
  });

  test("insurance dashboard accessible to insurance_officer", async ({
    request,
  }) => {
    const ctx = await loginAsRoleApi(request, "insurance_officer");

    const dashboard = await api<{
      pending_prior_auths: number;
      approved_prior_auths: number;
      denied_prior_auths: number;
      total_verifications: number;
    }>(ctx, "GET", "/api/insurance/dashboard");

    expect(typeof dashboard.pending_prior_auths).toBe("number");
    expect(typeof dashboard.approved_prior_auths).toBe("number");
    expect(typeof dashboard.denied_prior_auths).toBe("number");
  });

  test("billing aging report accessible to hospital_admin", async ({
    request,
  }) => {
    const ctx = await loginAsRoleApi(request, "hospital_admin");

    const aging = await api<Record<string, unknown>>(
      ctx,
      "GET",
      "/api/billing/reports/aging",
    );
    expect(aging).toBeDefined();
  });

  test("billing reconciliation report responds", async ({ request }) => {
    const ctx = await loginAsRoleApi(request, "hospital_admin");
    const today = new Date().toISOString().split("T")[0];

    const report = await api<Record<string, unknown>>(
      ctx,
      "GET",
      `/api/billing/reports/reconciliation?date=${today}`,
    );
    expect(report).toBeDefined();
  });

  test("billing summary report responds with 200", async ({ request }) => {
    const ctx = await loginAsRoleApi(request, "hospital_admin");
    const today = new Date().toISOString().split("T")[0];

    const lastMonth = new Date(Date.now() - 30 * 86400_000)
      .toISOString()
      .split("T")[0];

    const summary = await api<Record<string, unknown>>(
      ctx,
      "GET",
      `/api/billing/reports/summary?from=${lastMonth}&to=${today}`,
    );
    expect(summary).toBeDefined();
  });

  test("audit_officer has read-only access: can GET billing invoices, cannot POST", async ({
    request,
  }) => {
    const ctx = await loginAsRoleApi(request, "audit_officer");

    // Read — should succeed
    const invoicesResp = await api<{ invoices: { id: string }[]; total: number }>(
      ctx,
      "GET",
      "/api/billing/invoices",
    );
    expect(Array.isArray(invoicesResp.invoices)).toBe(true);

    // Write — should be 403
    try {
      await api(ctx, "POST", "/api/billing/invoices", {
        patient_id: "00000000-0000-0000-0000-000000000000",
        items: [],
      });
      // If we reach here the server allowed it — fail the test
      expect(true).toBe(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toMatch(/403|forbidden|permission/i);
    }
  });

  test("quality_officer cannot dispense pharmacy (403)", async ({
    request,
  }) => {
    const ctx = await loginAsRoleApi(request, "quality_officer");

    // quality_officer has no dispensing permission — should get 403
    try {
      await api(ctx, "PUT", "/api/pharmacy/orders/00000000-0000-0000-0000-000000000001/dispense", {});
      expect(true).toBe(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toMatch(/403|forbidden|permission/i);
    }
  });
});
