import { test, expect } from "@playwright/test";
import { getAuthContextFromCookies, api } from "../helpers/api";

test.describe("Emergency CRUD", () => {
  test("visits + codes lists", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const visits = await api<unknown>(ctx, "GET", "/api/emergency/visits");
    expect(visits).toBeTruthy();
    const codes = await api<unknown>(ctx, "GET", "/api/emergency/codes");
    expect(codes).toBeTruthy();
  });
});
