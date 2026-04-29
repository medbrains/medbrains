import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";
import {
  createPatientApi,
  createEncounter,
  createLabOrder,
  cancelLabOrder,
} from "../helpers/journey-steps";

test.describe("Lab CRUD", () => {
  test("order → cancel lifecycle", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const patient = await createPatientApi(ctx);
    const encounterId = await createEncounter(ctx, patient.id);
    const orderId = await createLabOrder(ctx, {
      patientId: patient.id,
      encounterId,
    });

    const order = await api<{ id: string; status: string }>(
      ctx,
      "GET",
      `/api/lab/orders/${orderId}`,
    );
    expect(order.id).toBe(orderId);

    await cancelLabOrder(ctx, orderId, "spec test");
    const after = await api<{ status: string }>(
      ctx,
      "GET",
      `/api/lab/orders/${orderId}`,
    );
    expect(["cancelled", "canceled"]).toContain(after.status);
  });

  test("catalog list returns at least one test", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const catalog = await api<unknown[]>(ctx, "GET", "/api/lab/catalog");
    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog.length).toBeGreaterThan(0);
  });

  test("orders list works", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const list = await api<unknown>(ctx, "GET", "/api/lab/orders");
    // Endpoint may return array or paginated object — accept either
    expect(list).toBeTruthy();
  });

  test("404 on unknown lab order", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const fake = "00000000-0000-0000-0000-000000000000";
    await expect(
      api(ctx, "GET", `/api/lab/orders/${fake}`),
    ).rejects.toThrow(/404/);
  });
});
