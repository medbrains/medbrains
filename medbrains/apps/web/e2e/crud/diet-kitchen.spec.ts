import { test, expect } from "@playwright/test";
import { getAuthContextFromCookies, api } from "../helpers/api";

test.describe("Diet & Kitchen CRUD", () => {
  test("diet templates + orders + meals lists", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const templates = await api<unknown>(ctx, "GET", "/api/diet/templates");
    expect(templates).toBeTruthy();
    const orders = await api<unknown>(ctx, "GET", "/api/diet/orders");
    expect(orders).toBeTruthy();
  });
});
