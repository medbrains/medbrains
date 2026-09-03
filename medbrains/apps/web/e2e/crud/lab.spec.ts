import { test, expect } from "@playwright/test";
import { getAuthContextFromCookies, api } from "../helpers/api";
import {
  createPatientApi,
  createEncounter,
  createLabOrder,
  cancelLabOrder,
} from "../helpers/journey-steps";

test.describe("Lab CRUD", () => {
  test("order → cancel lifecycle", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const patient = await createPatientApi(ctx);
    const encounterId = await createEncounter(ctx, patient.id);
    const orderId = await createLabOrder(ctx, {
      patientId: patient.id,
      encounterId,
    });

    // GET returns { order, results }
    const detail = await api<{ order: { id: string; status: string } }>(
      ctx,
      "GET",
      `/api/lab/orders/${orderId}`,
    );
    expect(detail.order.id).toBe(orderId);

    await cancelLabOrder(ctx, orderId, "spec test");
    const after = await api<{ order: { status: string } }>(
      ctx,
      "GET",
      `/api/lab/orders/${orderId}`,
    );
    expect(["cancelled", "canceled"]).toContain(after.order.status);
  });

  test("catalog list returns at least one test", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const catalog = await api<unknown[]>(ctx, "GET", "/api/lab/catalog");
    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog.length).toBeGreaterThan(0);
  });

  test("orders list works", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const list = await api<unknown>(ctx, "GET", "/api/lab/orders");
    // Endpoint may return array or paginated object — accept either
    expect(list).toBeTruthy();
  });

  test("404 on unknown lab order", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const fake = "00000000-0000-0000-0000-000000000000";
    await expect(
      api(ctx, "GET", `/api/lab/orders/${fake}`),
    ).rejects.toThrow(/404/);
  });
});

test.describe("lab STAT monitoring — what the breach alert can see", () => {
  test("a finished urgent order is not counted among the outstanding ones", async ({
    request,
  }) => {
    // /lab/stat-orders feeds a screen that renders "{n} open" and alerts on
    // orders past their turnaround. It used to select every urgent order that
    // was not cancelled — completed and verified included — so finished work
    // was counted as still waiting, and the alert's denominator was wrong.
    const ctx = await getAuthContextFromCookies(request);
    const patient = await createPatientApi(ctx);
    const encounterId = await createEncounter(ctx, patient.id);

    const open = await createLabOrder(ctx, { patientId: patient.id, encounterId, priority: "stat" });
    const finished = await createLabOrder(ctx, {
      patientId: patient.id,
      encounterId,
      priority: "stat",
    });

    // Walk the finished one all the way through: collected -> processing -> complete.
    // Positive patient ID at the draw — the order will not advance without it.
    await api(ctx, "PUT", `/api/lab/orders/${finished}/collect`, {
      patient_identifier: patient.uhid,
    });
    await api(ctx, "PUT", `/api/lab/orders/${finished}/process`, {});
    await api(ctx, "PUT", `/api/lab/orders/${finished}/complete`, {});

    const rows = await api<Array<{ order_id: string }>>(ctx, "GET", "/api/lab/stat-orders");
    const ids = rows.map((r) => r.order_id);
    expect(ids).toContain(open);
    expect(ids).not.toContain(finished);
  });

  test("the outstanding list is ordered oldest first, so the cap drops the newest", async ({
    request,
  }) => {
    // The list is capped at 100. An order breaches by waiting, so ordering
    // newest-first spent that cap on the orders least likely to have breached
    // and dropped the ones the alert exists to raise. Oldest-first inverts it:
    // whatever falls off the end is the least overdue.
    const ctx = await getAuthContextFromCookies(request);
    const rows = await api<Array<{ ordered_at: string }>>(ctx, "GET", "/api/lab/stat-orders");
    const times = rows.map((r) => new Date(r.ordered_at).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});
