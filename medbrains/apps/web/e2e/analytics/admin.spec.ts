import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";

const ENDPOINTS = ["/api/admin/dashboards"];

test.describe("Admin analytics", () => {
  for (const path of ENDPOINTS) {
    test(`GET ${path}`, async ({ request }) => {
      const ctx = await loginAsAdmin(request);
      const data = await api<unknown>(ctx, "GET", path);
      expect(data).toBeTruthy();
      expect(JSON.stringify(data)).not.toContain("NaN");
    });
  }
});
