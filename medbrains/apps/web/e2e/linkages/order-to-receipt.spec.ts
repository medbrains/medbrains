/**
 * Lab → billing: ordering a test puts a line on the patient's bill, and the
 * bill can be issued and settled.
 *
 * The charge is written when the order is placed, keyed to the order, so a
 * second order for the same test is a second line and the same order asked
 * about twice is one. The receipt e-mail and the payment link are outbox
 * rows; they are proven in crates/medbrains-server/tests/linkage_billing_test.rs.
 */

import { expect, test } from "@playwright/test";
import { getAuthContextFromCookies, loginAsRoleApi } from "../helpers/api";
import {
  createEncounter,
  createLabOrder,
  createPatientApi,
  findChargeFor,
  getInvoiceDetail,
  issueInvoice,
  recordBillingPayment,
} from "../helpers/journey-steps";

test.describe("A lab order becomes a bill the patient can settle", () => {
  test("order → draft line keyed to the order → issue → pay → paid", async ({ request }) => {
    const admin = await getAuthContextFromCookies(request);
    const doctor = await loginAsRoleApi(request, "doctor");
    const patient = await createPatientApi(admin, { email: `e2e-receipt-${Date.now()}@example.com` });
    const encounterId = await createEncounter(doctor, patient.id);

    const orderId = await createLabOrder(doctor, { patientId: patient.id, encounterId });
    const charge = await findChargeFor(admin, patient.id, "lab", orderId);
    expect(charge, "auto-billing wrote a line for the order").toBeDefined();
    expect(Number(charge?.item.total_price)).toBeGreaterThan(0);

    const invoiceId = charge?.invoiceId ?? "";
    const draft = await getInvoiceDetail(admin, invoiceId);
    expect(draft.invoice.status).toBe("draft");
    const total = Number(draft.invoice.total_amount);
    expect(total).toBeGreaterThan(0);

    await issueInvoice(admin, invoiceId);
    expect((await getInvoiceDetail(admin, invoiceId)).invoice.status).not.toBe("draft");

    await recordBillingPayment(admin, invoiceId, total);
    const settled = await getInvoiceDetail(admin, invoiceId);
    expect(settled.invoice.status).toBe("paid");
    expect(settled.payments).toHaveLength(1);
  });
});
