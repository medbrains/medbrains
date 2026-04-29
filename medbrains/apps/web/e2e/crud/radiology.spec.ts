import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";
import { createPatientApi, createEncounter } from "../helpers/journey-steps";

interface RadiologyTest {
  id: string;
  name: string;
  code?: string;
}

test.describe("Radiology CRUD", () => {
  test("order create → fetch", async ({ request }) => {
    const ctx = await loginAsAdmin(request);

    const catalog = await api<RadiologyTest[]>(ctx, "GET", "/api/radiology/catalog");
    if (catalog.length === 0) {
      test.skip(true, "radiology catalog not seeded");
    }

    const patient = await createPatientApi(ctx);
    const encounterId = await createEncounter(ctx, patient.id);
    const order = await api<{ id: string }>(ctx, "POST", "/api/radiology/orders", {
      patient_id: patient.id,
      encounter_id: encounterId,
      test_id: catalog[0].id,
    });
    const fetched = await api<{ id: string }>(
      ctx,
      "GET",
      `/api/radiology/orders/${order.id}`,
    );
    expect(fetched.id).toBe(order.id);
  });

  test("orders + catalog list", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const orders = await api<unknown>(ctx, "GET", "/api/radiology/orders");
    expect(orders).toBeTruthy();

    const catalog = await api<unknown[]>(ctx, "GET", "/api/radiology/catalog");
    expect(Array.isArray(catalog)).toBe(true);
  });
});
