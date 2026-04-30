import { test, expect } from "@playwright/test";
import { getAuthContextFromCookies, api } from "../helpers/api";

const ENDPOINTS = [
  "/api/pharmacy/analytics/abc-ved",
  "/api/pharmacy/analytics/consumption",
  "/api/pharmacy/analytics/utilization",
  "/api/pharmacy/analytics/daily-sales",
  "/api/pharmacy/analytics/fill-rate",
  "/api/pharmacy/analytics/margins",
  "/api/pharmacy/batches/dead-stock",
  "/api/pharmacy/pos/day-summary",
];

test.describe("Pharmacy analytics", () => {
  for (const path of ENDPOINTS) {
    test(`GET ${path}`, async ({ request }) => {
      const ctx = await getAuthContextFromCookies(request);
      const data = await api<unknown>(ctx, "GET", path);
      expect(data).toBeTruthy();
      expect(JSON.stringify(data)).not.toContain("NaN");
    });
  }
});
