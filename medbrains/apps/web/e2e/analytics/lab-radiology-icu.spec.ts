import { test, expect } from "@playwright/test";
import { getAuthContextFromCookies, api } from "../helpers/api";

const ENDPOINTS = [
  "/api/lab/analytics/tat",
  "/api/lab/home-collections/stats",
  "/api/lab/b2b-credit-summary",
  "/api/lab/tat-monitoring",
  "/api/radiology/analytics/tat",
  "/api/icu/analytics/los",
];

test.describe("Lab + Radiology + ICU analytics", () => {
  for (const path of ENDPOINTS) {
    test(`GET ${path}`, async ({ request }) => {
      const ctx = await getAuthContextFromCookies(request);
      const data = await api<unknown>(ctx, "GET", path);
      expect(data).toBeTruthy();
      expect(JSON.stringify(data)).not.toContain("NaN");
    });
  }
});
