import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";

test.describe("ICU CRUD", () => {
  test("admissions list + analytics smoke", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const list = await api<unknown>(ctx, "GET", "/api/icu/admissions");
    expect(list).toBeTruthy();

    const los = await api<unknown>(ctx, "GET", "/api/icu/analytics/los");
    expect(los).toBeTruthy();
  });
});
