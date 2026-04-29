import { test, expect } from "@playwright/test";
import { getAuthContextFromCookies, api } from "../helpers/api";

test.describe("ICU CRUD", () => {
  test("analytics smoke (los + device-infections)", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    // ICU on this branch only exposes nested admissions/{id}/* paths,
    // no top-level admissions list. Analytics is the canonical surface.
    const los = await api<unknown>(ctx, "GET", "/api/icu/analytics/los");
    expect(los).toBeTruthy();
    const di = await api<unknown>(
      ctx,
      "GET",
      "/api/icu/analytics/device-infections",
    );
    expect(di).toBeTruthy();
  });
});
