/**
 * Lab → billing: cancelling an order takes its charge back off the bill.
 *
 * The original line stays (an audit trail, not a deletion) and a negative
 * line reverses it, so the invoice total returns to what it was. Cancelling
 * twice is refused and leaves exactly one reversal.
 */

import { expect, test } from "@playwright/test";
import { getAuthContextFromCookies, loginAsRoleApi } from "../helpers/api";
import {
  cancelLabOrder,
  createEncounter,
  createLabOrder,
  createPatientApi,
  findChargeFor,
  getInvoiceDetail,
} from "../helpers/journey-steps";

test.describe("Cancelling a lab order reverses its charge", () => {
  test("one negative line, total restored, second cancel refused", async ({ request }) => {
    const admin = await getAuthContextFromCookies(request);
    const doctor = await loginAsRoleApi(request, "doctor");
    const patient = await createPatientApi(admin);
    const encounterId = await createEncounter(doctor, patient.id);

    const orderId = await createLabOrder(doctor, { patientId: patient.id, encounterId });
    const charge = await findChargeFor(admin, patient.id, "lab", orderId);
    expect(charge).toBeDefined();
    const invoiceId = charge?.invoiceId ?? "";
    const before = await getInvoiceDetail(admin, invoiceId);
    const lineTotal = Number(charge?.item.total_price);

    await cancelLabOrder(doctor, orderId);

    const after = await getInvoiceDetail(admin, invoiceId);
    const reversals = after.items.filter((i) => Number(i.total_price) < 0);
    expect(reversals).toHaveLength(1);
    expect(Number(reversals[0]?.total_price)).toBeCloseTo(-lineTotal, 2);
    expect(reversals[0]?.description).toMatch(/^Reversal - /);
    expect(Number(after.invoice.total_amount)).toBeCloseTo(Number(before.invoice.total_amount) - lineTotal, 2);

    // Negative: an order already cancelled cannot be cancelled again, and
    // the bill is not reversed twice.
    await cancelLabOrder(doctor, orderId, { expectStatus: 404 });
    const again = await getInvoiceDetail(admin, invoiceId);
    expect(again.items.filter((i) => Number(i.total_price) < 0)).toHaveLength(1);
  });
});
