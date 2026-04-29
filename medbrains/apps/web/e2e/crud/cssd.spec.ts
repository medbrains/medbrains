import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";

test.describe("CSSD CRUD", () => {
  test("instruments + sets + sterilizers + loads + issuances lists", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const instruments = await api<unknown>(ctx, "GET", "/api/cssd/instruments");
    expect(instruments).toBeTruthy();
    const sets = await api<unknown>(ctx, "GET", "/api/cssd/sets");
    expect(sets).toBeTruthy();
    const sterilizers = await api<unknown>(ctx, "GET", "/api/cssd/sterilizers");
    expect(sterilizers).toBeTruthy();
    const loads = await api<unknown>(ctx, "GET", "/api/cssd/loads");
    expect(loads).toBeTruthy();
    const issuances = await api<unknown>(ctx, "GET", "/api/cssd/issuances");
    expect(issuances).toBeTruthy();
  });
});
