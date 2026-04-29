import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";

test.describe("CSSD CRUD", () => {
  test("instruments + cycles + issues lists", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const instruments = await api<unknown>(ctx, "GET", "/api/cssd/instruments");
    expect(instruments).toBeTruthy();
    const cycles = await api<unknown>(ctx, "GET", "/api/cssd/cycles");
    expect(cycles).toBeTruthy();
  });
});
