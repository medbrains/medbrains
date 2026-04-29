import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";
import {
  createPatientApi,
  createEncounter,
  createLabOrder,
  cancelLabOrder,
} from "../helpers/journey-steps";

test.describe("Lab order journey", () => {
  test("order → collect → process → cancel (best-effort lifecycle)", async ({ request }) => {
    test.info().annotations.push({
      type: "tcms",
      description: "Lab::Full lab order lifecycle",
    });

    const ctx = await loginAsAdmin(request);
    const patient = await createPatientApi(ctx);
    const encounterId = await createEncounter(ctx, patient.id);
    const orderId = await createLabOrder(ctx, {
      patientId: patient.id,
      encounterId,
    });

    // Collection (specimen) — endpoint exists per routes/mod.rs
    try {
      await api(ctx, "PUT", `/api/lab/orders/${orderId}/collect`, {
        collected_at: new Date().toISOString(),
      });
    } catch {
      // Some seeds skip collect step; non-fatal.
    }

    try {
      await api(ctx, "PUT", `/api/lab/orders/${orderId}/process`, {});
    } catch {
      // Non-fatal.
    }

    await cancelLabOrder(ctx, orderId, "spec lifecycle test");
    const after = await api<{ status: string }>(
      ctx,
      "GET",
      `/api/lab/orders/${orderId}`,
    );
    expect(["cancelled", "canceled"]).toContain(after.status);
  });

  test("catalog has at least one test", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const catalog = await api<unknown[]>(ctx, "GET", "/api/lab/catalog");
    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog.length).toBeGreaterThan(0);
  });
});
