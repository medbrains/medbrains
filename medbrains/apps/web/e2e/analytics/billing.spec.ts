import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";

const QS = "?from=2024-01-01&to=2030-12-31&date_from=2024-01-01&date_to=2030-12-31";
const TODAY = new Date().toISOString().slice(0, 10);
const PERIOD = TODAY.slice(0, 7);

const ENDPOINTS = [
  `/api/billing/reports/summary${QS}`,
  `/api/billing/reports/department-revenue${QS}`,
  `/api/billing/reports/collection-efficiency${QS}`,
  `/api/billing/reports/aging`,
  `/api/billing/reports/daily?date=${TODAY}`,
  `/api/billing/reports/doctor-revenue${QS}`,
  `/api/billing/reports/insurance-panel${QS}`,
  `/api/billing/reports/reconciliation?date=${TODAY}`,
  `/api/billing/reports/hsn-summary?period=${PERIOD}`,
  `/api/billing/reports/financial-mis${QS}`,
  `/api/billing/reports/profit-loss${QS}`,
  `/api/billing/credit-patients/aging`,
];

test.describe("Billing analytics", () => {
  for (const path of ENDPOINTS) {
    test(`GET ${path}`, async ({ request }) => {
      const ctx = await loginAsAdmin(request);
      const data = await api<unknown>(ctx, "GET", path);
      expect(data).toBeTruthy();
      const json = JSON.stringify(data);
      expect(json).not.toContain("NaN");
      expect(json).not.toContain('"Infinity"');
    });
  }
});
