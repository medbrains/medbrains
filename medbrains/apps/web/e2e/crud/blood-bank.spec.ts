import { test, expect } from "@playwright/test";
import { getAuthContextFromCookies, api } from "../helpers/api";

test.describe("Blood Bank CRUD", () => {
  test("donors + components + crossmatch + transfusions lists", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const donors = await api<unknown>(ctx, "GET", "/api/blood-bank/donors");
    expect(donors).toBeTruthy();
    const components = await api<unknown>(ctx, "GET", "/api/blood-bank/components");
    expect(components).toBeTruthy();
    const crossmatch = await api<unknown>(ctx, "GET", "/api/blood-bank/crossmatch");
    expect(crossmatch).toBeTruthy();
    const transfusions = await api<unknown>(ctx, "GET", "/api/blood-bank/transfusions");
    expect(transfusions).toBeTruthy();
  });

  test("404 on unknown donor", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const fake = "00000000-0000-0000-0000-000000000000";
    await expect(
      api(ctx, "GET", `/api/blood-bank/donors/${fake}`),
    ).rejects.toThrow(/404/);
  });
});
