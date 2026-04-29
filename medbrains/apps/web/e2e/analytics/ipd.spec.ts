import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";

const ENDPOINTS = [
  "/api/ipd/bed-dashboard",
  "/api/ipd/bed-dashboard/beds",
  "/api/ipd/reports/census",
  "/api/ipd/reports/occupancy",
  "/api/ipd/reports/alos",
  "/api/ipd/reports/discharge-stats",
];

test.describe("IPD analytics", () => {
  for (const path of ENDPOINTS) {
    test(`GET ${path}`, async ({ request }) => {
      const ctx = await loginAsAdmin(request);
      const data = await api<unknown>(ctx, "GET", path);
      expect(data).toBeTruthy();
      const json = JSON.stringify(data);
      expect(json).not.toContain("NaN");
    });
  }
});
