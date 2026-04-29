import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";

const ENDPOINTS = [
  "/api/billing/reports/summary",
  "/api/billing/reports/department-revenue",
  "/api/billing/reports/collection-efficiency",
  "/api/billing/reports/aging",
  "/api/billing/reports/daily",
  "/api/billing/reports/doctor-revenue",
  "/api/billing/reports/insurance-panel",
  "/api/billing/reports/reconciliation",
  "/api/billing/reports/hsn-summary",
  "/api/billing/reports/financial-mis",
  "/api/billing/reports/profit-loss",
  "/api/billing/credit-patients/aging",
];

test.describe("Billing analytics", () => {
  for (const path of ENDPOINTS) {
    test(`GET ${path}`, async ({ request }) => {
      const ctx = await loginAsAdmin(request);
      const data = await api<unknown>(ctx, "GET", path);
      expect(data).toBeTruthy();
      // No NaN smuggled through if numeric.
      const json = JSON.stringify(data);
      expect(json).not.toContain("NaN");
      expect(json).not.toContain('"Infinity"');
    });
  }
});
