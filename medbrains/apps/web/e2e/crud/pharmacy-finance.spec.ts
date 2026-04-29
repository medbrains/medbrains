import { test, expect } from "@playwright/test";
import { getAuthContextFromCookies, api } from "../helpers/api";

test.describe("Pharmacy Finance CRUD", () => {
  test("cash drawers + petty cash + supplier payments lists", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);

    const drawers = await api<unknown[]>(ctx, "GET", "/api/pharmacy/cash-drawers");
    expect(Array.isArray(drawers)).toBe(true);

    const myActive = await api<unknown>(
      ctx,
      "GET",
      "/api/pharmacy/cash-drawers/me/active",
    );
    // myActive can be null (no open drawer) or object (open drawer); both fine.
    expect(myActive === null || typeof myActive === "object").toBe(true);

    const petty = await api<unknown[]>(ctx, "GET", "/api/pharmacy/petty-cash");
    expect(Array.isArray(petty)).toBe(true);

    const free = await api<unknown[]>(ctx, "GET", "/api/pharmacy/free-dispensings");
    expect(Array.isArray(free)).toBe(true);

    const supplier = await api<unknown[]>(
      ctx,
      "GET",
      "/api/pharmacy/supplier-payments",
    );
    expect(Array.isArray(supplier)).toBe(true);

    const margins = await api<unknown[]>(
      ctx,
      "GET",
      "/api/pharmacy/drug-margins/daily",
    );
    expect(Array.isArray(margins)).toBe(true);
  });
});
