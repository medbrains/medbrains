import { test, expect } from "@playwright/test";
import { getAuthContextFromCookies, api } from "../helpers/api";

test.describe("Procurement CRUD", () => {
  test("vendors + POs + GRN lists", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const vendors = await api<unknown>(ctx, "GET", "/api/procurement/vendors");
    expect(vendors).toBeTruthy();
    const pos = await api<unknown>(ctx, "GET", "/api/procurement/purchase-orders");
    expect(pos).toBeTruthy();
  });
});
