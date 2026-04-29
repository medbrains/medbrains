import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";

const ENDPOINTS = [
  "/api/indent/analytics/abc",
  "/api/indent/analytics/ved",
  "/api/indent/analytics/fsn",
  "/api/indent/analytics/dead-stock",
  "/api/indent/analytics/consumption",
  "/api/indent/analytics/valuation",
  "/api/indent/analytics/compliance",
  "/api/indent/analytics/purchase-vs-consumption",
];

test.describe("Indent analytics", () => {
  for (const path of ENDPOINTS) {
    test(`GET ${path}`, async ({ request }) => {
      const ctx = await loginAsAdmin(request);
      const data = await api<unknown>(ctx, "GET", path);
      expect(data).toBeTruthy();
      expect(JSON.stringify(data)).not.toContain("NaN");
    });
  }
});
