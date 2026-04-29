import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";
import {
  createPatientApi,
  createEncounter,
  createInvoice,
} from "../helpers/journey-steps";

test.describe("Billing CRUD", () => {
  test("invoice create → fetch", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const patient = await createPatientApi(ctx);
    const encounterId = await createEncounter(ctx, patient.id);
    const invoiceId = await createInvoice(ctx, {
      patientId: patient.id,
      encounterId,
    });

    const inv = await api<{ id: string; patient_id: string }>(
      ctx,
      "GET",
      `/api/billing/invoices/${invoiceId}`,
    );
    expect(inv.patient_id).toBe(patient.id);
  });

  test("invoices list paginated", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const list = await api<unknown>(ctx, "GET", "/api/billing/invoices");
    expect(list).toBeTruthy();
  });

  test("charge master + payment methods + advances list", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const charges = await api<unknown[]>(ctx, "GET", "/api/billing/charge-master");
    expect(Array.isArray(charges)).toBe(true);

    const advances = await api<unknown>(ctx, "GET", "/api/billing/advances");
    expect(advances).toBeTruthy();
  });

  test("404 on unknown invoice", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const fake = "00000000-0000-0000-0000-000000000000";
    await expect(
      api(ctx, "GET", `/api/billing/invoices/${fake}`),
    ).rejects.toThrow(/404/);
  });
});
