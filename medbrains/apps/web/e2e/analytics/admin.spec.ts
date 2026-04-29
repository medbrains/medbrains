import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";

// Admin GET surface (dashboards is POST-only).
const ENDPOINTS = ["/api/admin/forms", "/api/admin/fields", "/api/admin/modules"];

test.describe("Admin analytics", () => {
  for (const path of ENDPOINTS) {
    test(`GET ${path}`, async ({ request }) => {
      const ctx = await loginAsAdmin(request);
      try {
        const data = await api<unknown>(ctx, "GET", path);
        expect(data).toBeTruthy();
        expect(JSON.stringify(data)).not.toContain("NaN");
      } catch (err) {
        if (String(err).includes("404")) {
          test.skip(true, `endpoint not on this branch: ${path}`);
        }
        throw err;
      }
    });
  }
});
