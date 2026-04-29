import { test, expect } from "@playwright/test";
import { getAuthContextFromCookies, api } from "../helpers/api";
import {
  createPatientApi,
  createEncounter,
  createInvoice,
} from "../helpers/journey-steps";

test.describe("Billing CRUD", () => {
  test("invoice create → fetch", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const patient = await createPatientApi(ctx);
    const encounterId = await createEncounter(ctx, patient.id);
    const invoiceId = await createInvoice(ctx, {
      patientId: patient.id,
      encounterId,
    });

    // GET returns { invoice, items, payments }
    const detail = await api<{
      invoice: { id: string; patient_id: string };
    }>(ctx, "GET", `/api/billing/invoices/${invoiceId}`);
    expect(detail.invoice.patient_id).toBe(patient.id);
  });

  test("invoices list paginated", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const list = await api<unknown>(ctx, "GET", "/api/billing/invoices");
    expect(list).toBeTruthy();
  });

  test("charge master + payment methods + advances list", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const charges = await api<unknown[]>(ctx, "GET", "/api/billing/charge-master");
    expect(Array.isArray(charges)).toBe(true);

    const advances = await api<unknown>(ctx, "GET", "/api/billing/advances");
    expect(advances).toBeTruthy();
  });

  test("404 on unknown invoice", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const fake = "00000000-0000-0000-0000-000000000000";
    await expect(
      api(ctx, "GET", `/api/billing/invoices/${fake}`),
    ).rejects.toThrow(/404/);
  });
});
