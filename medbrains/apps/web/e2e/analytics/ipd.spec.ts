import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";

const QS = "?from=2024-01-01&to=2030-12-31";

const ENDPOINTS = [
  "/api/ipd/bed-dashboard",
  "/api/ipd/bed-dashboard/beds",
  `/api/ipd/reports/census${QS}`,
  `/api/ipd/reports/occupancy${QS}`,
  `/api/ipd/reports/alos${QS}`,
  `/api/ipd/reports/discharge-stats${QS}`,
];

test.describe("IPD analytics", () => {
  for (const path of ENDPOINTS) {
    test(`GET ${path}`, async ({ request }) => {
      const ctx = await loginAsAdmin(request);
      const data = await api<unknown>(ctx, "GET", path);
      expect(data).toBeTruthy();
      expect(JSON.stringify(data)).not.toContain("NaN");
    });
  }
});
