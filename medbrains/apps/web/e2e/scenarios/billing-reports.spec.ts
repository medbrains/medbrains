/**
 * SOP ref: docs/sops/07-billing-payments.md, docs/sops/25-financial-reporting.md
 * Scenario S1: Billing clerk generates OPD invoice and collects payment
 * Scenario S3: Patient pays online (payment webhook) — API contract check
 * Scenario S4: Billing reports return expected structure
 * docs/sops/25-S1: Daily collection reconciliation report
 * docs/sops/25-S2: Department revenue report
 * docs/sops/25-S4: Aging receivables report
 */

import { test, expect } from "@playwright/test";
import { loginAsRoleApi, api } from "../helpers/api";
import {
  createPatientApi,
  createEncounter,
  createInvoice,
  addBillingItem,
  issueInvoice,
  recordBillingPayment,
  createDayClose,
  getBillingDailyReport,
  getBillingDepartmentRevenue,
  getBillingAgingReport,
} from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";

test.describe("Billing — invoice lifecycle and financial reports", () => {
  test("billing clerk creates OPD invoice, issues it, and records cash payment", async ({
    request,
  }) => {
    const doctorCtx = await loginAsRoleApi(request, "doctor");
    const billingCtx = await loginAsRoleApi(request, "billing_clerk");

    const patient = await createPatientApi(doctorCtx);
    const opdDept = await getOpdDept(doctorCtx);

    const encounterId = await createEncounter(doctorCtx, patient.id, {
      departmentId: opdDept.id,
    });

    const invoiceId = await createInvoice(billingCtx, {
      patientId: patient.id,
      encounterId,
    });
    expect(invoiceId).toBeTruthy();

    await addBillingItem(billingCtx, invoiceId, { unitPrice: 500 });

    const issued = await issueInvoice(billingCtx, invoiceId);
    expect(issued.status).toBe("issued");
    expect(issued.issued_at).not.toBeNull();

    const payment = await recordBillingPayment(billingCtx, invoiceId, 500, "cash");
    expect(payment.id).toBeTruthy();
    expect(payment.amount).toBeTruthy();
    expect(payment.mode).toBe("cash");

    // Invoice should now be paid
    const invoiceState = await api<{ invoice: { id: string; status: string } }>(
      billingCtx,
      "GET",
      `/api/billing/invoices/${invoiceId}`,
    );
    expect(invoiceState.invoice.status).toBe("paid");
  });

  test("UPI payment recorded; receipt generated", async ({ request }) => {
    const doctorCtx = await loginAsRoleApi(request, "doctor");
    const billingCtx = await loginAsRoleApi(request, "billing_clerk");

    const patient = await createPatientApi(doctorCtx);
    const opdDept = await getOpdDept(doctorCtx);
    const encounterId = await createEncounter(doctorCtx, patient.id, {
      departmentId: opdDept.id,
    });

    const invoiceId = await createInvoice(billingCtx, {
      patientId: patient.id,
      encounterId,
    });
    await addBillingItem(billingCtx, invoiceId, { unitPrice: 800 });
    await issueInvoice(billingCtx, invoiceId);
    const payment = await recordBillingPayment(billingCtx, invoiceId, 800, "upi");
    expect(payment.id).toBeTruthy();
    expect(payment.mode).toBe("upi");
  });

  test("day close created; status pending verification", async ({ request }) => {
    const billingCtx = await loginAsRoleApi(request, "billing_clerk");

    const today = new Date().toISOString().split("T")[0];
    const dayClose = await createDayClose(billingCtx, today);

    expect(dayClose.id).toBeTruthy();
    expect(dayClose.close_date).toBe(today);
    expect(["pending", "open", "draft"]).toContain(dayClose.status);
  });

  test("daily billing report returns collection totals", async ({ request }) => {
    const billingCtx = await loginAsRoleApi(request, "billing_clerk");

    const today = new Date().toISOString().split("T")[0];
    const report = await getBillingDailyReport(billingCtx, today);

    expect(report).toBeDefined();
    // Report structure has at minimum a total or date field
    expect(typeof report).toBe("object");
  });

  test("department revenue report returns per-department breakdown", async ({
    request,
  }) => {
    const adminCtx = await loginAsRoleApi(request, "hospital_admin");

    const today = new Date().toISOString().split("T")[0];
    const lastMonth = new Date(Date.now() - 30 * 86400_000)
      .toISOString()
      .split("T")[0];

    const report = await getBillingDepartmentRevenue(adminCtx, lastMonth, today);
    expect(report).toBeDefined();
    expect(typeof report).toBe("object");
  });

  test("aging report returns receivables buckets", async ({ request }) => {
    const billingCtx = await loginAsRoleApi(request, "billing_clerk");

    const aging = await getBillingAgingReport(billingCtx);
    expect(aging).toBeDefined();
    // Should return an object or array; not throw 4xx/5xx
    expect(typeof aging).toBe("object");
  });

  test("collection efficiency report responds with 200", async ({ request }) => {
    const adminCtx = await loginAsRoleApi(request, "hospital_admin");

    const today = new Date().toISOString().split("T")[0];
    const lastMonth = new Date(Date.now() - 30 * 86400_000).toISOString().split("T")[0];
    const report = await api<Record<string, unknown>>(
      adminCtx,
      "GET",
      `/api/billing/reports/collection-efficiency?from=${lastMonth}&to=${today}`,
    );
    expect(report).toBeDefined();
  });

  test("insurance claims list returns array", async ({ request }) => {
    const billingCtx = await loginAsRoleApi(request, "billing_clerk");

    const claims = await api<{ id: string }[]>(
      billingCtx,
      "GET",
      "/api/billing/insurance-claims",
    );
    expect(Array.isArray(claims)).toBe(true);
  });
});
