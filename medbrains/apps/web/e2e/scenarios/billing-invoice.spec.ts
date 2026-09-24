import { expect, test } from "@playwright/test";
import { api, getAuthContextFromCookies } from "../helpers/api";
import {
  createEncounter,
  createInvoice,
  createPatientApi,
  getInvoiceDetail,
  issueInvoice,
  recordBillingPayment,
} from "../helpers/journey-steps";

test.describe("Billing invoice journey", () => {
  test("invoice → add item → issue → record payment → paid", async ({ request }) => {
    test.info().annotations.push({
      type: "tcms",
      description: "Billing::Generate invoice + line item + payment",
    });

    const ctx = await getAuthContextFromCookies(request);
    const patient = await createPatientApi(ctx);
    const encounterId = await createEncounter(ctx, patient.id);
    const invoiceId = await createInvoice(ctx, { patientId: patient.id, encounterId });

    await api(ctx, "POST", `/api/billing/invoices/${invoiceId}/items`, {
      charge_code: "CONS-001",
      description: "Consultation fee",
      source: "manual",
      quantity: 1,
      unit_price: 500,
    });

    const draft = await getInvoiceDetail(ctx, invoiceId);
    expect(draft.invoice.id).toBe(invoiceId);
    expect(draft.items.map((i) => i.description)).toContain("Consultation fee");
    expect(Number(draft.invoice.total_amount)).toBeGreaterThan(0);

    // Issue is a POST and a payment names its `mode`; this once sent PUT and
    // `method` inside a try/catch, so neither ever happened.
    await issueInvoice(ctx, invoiceId);
    await recordBillingPayment(ctx, invoiceId, Number(draft.invoice.total_amount));
    expect((await getInvoiceDetail(ctx, invoiceId)).invoice.status).toBe("paid");
  });

  test("invoices list returns paginated shape", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const list = await api<{ invoices: unknown[] }>(ctx, "GET", "/api/billing/invoices");
    expect(Array.isArray(list.invoices)).toBe(true);
  });
});
