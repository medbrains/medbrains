import { test, expect } from "@playwright/test";
import { getAuthContextFromCookies, api } from "../helpers/api";

test.describe("Indent CRUD", () => {
  test("requisitions + catalog + analytics smoke", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);

    const reqs = await api<unknown>(ctx, "GET", "/api/indent/requisitions");
    expect(reqs).toBeTruthy();

    const catalog = await api<unknown>(ctx, "GET", "/api/indent/catalog");
    expect(catalog).toBeTruthy();

    // Analytics smoke
    const abc = await api<unknown>(ctx, "GET", "/api/indent/analytics/abc");
    expect(abc).toBeTruthy();
    const ved = await api<unknown>(ctx, "GET", "/api/indent/analytics/ved");
    expect(ved).toBeTruthy();
  });
});
