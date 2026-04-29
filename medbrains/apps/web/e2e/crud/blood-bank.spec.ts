import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";

test.describe("Blood Bank CRUD", () => {
  test("stock + donations + crossmatch lists", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const stock = await api<unknown>(ctx, "GET", "/api/blood-bank/stock");
    expect(stock).toBeTruthy();
    const donations = await api<unknown>(ctx, "GET", "/api/blood-bank/donations");
    expect(donations).toBeTruthy();
    const issues = await api<unknown>(ctx, "GET", "/api/blood-bank/issues");
    expect(issues).toBeTruthy();
  });

  test("404 on unknown donor", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const fake = "00000000-0000-0000-0000-000000000000";
    await expect(
      api(ctx, "GET", `/api/blood-bank/donors/${fake}`),
    ).rejects.toThrow(/404/);
  });
});
