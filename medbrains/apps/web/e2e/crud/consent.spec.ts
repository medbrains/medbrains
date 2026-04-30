import { test, expect } from "@playwright/test";
import { getAuthContextFromCookies, api } from "../helpers/api";

test.describe("Consent CRUD", () => {
  test("templates + audit lists", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const templates = await api<unknown>(ctx, "GET", "/api/consent/templates");
    expect(templates).toBeTruthy();
    const audit = await api<unknown>(ctx, "GET", "/api/consent/audit");
    expect(audit).toBeTruthy();
  });
});
