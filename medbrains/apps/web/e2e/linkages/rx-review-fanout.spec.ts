/**
 * OPD → pharmacy → billing: a prescription fans out to the review queue,
 * a pharmacy order, and the patient's bill.
 *
 * Writing a prescription is the doctor's act; what follows is three other
 * modules' work: the pharmacist's approval raises the order, and the bill
 * line is governed by a tenant switch. With auto-charging off, the queue and
 * the order still appear and no line does.
 *
 * The appointment-confirmation SMS the encounter queues is an outbox row,
 * proven in crates/medbrains-server/tests/linkage_encounter_sms_test.rs.
 */

import { expect, test } from "@playwright/test";
import { api, getAuthContextFromCookies, loginAsRoleApi, withStepUp } from "../helpers/api";
import {
  createEncounter,
  createPatientApi,
  createPrescriptionDetailed,
  dispensePharmacyOrder,
  findChargeFor,
  setTenantSetting,
} from "../helpers/journey-steps";
import { getFirstDrug } from "../helpers/seed-resolvers";

test.describe("A prescription reaches the review queue, an order, and the bill", () => {
  test("queue + order + charged item; with auto-charge off, no item", async ({ request }) => {
    const admin = await getAuthContextFromCookies(request);
    const doctor = await withStepUp(await loginAsRoleApi(request, "doctor"));
    const pharmacist = await loginAsRoleApi(request, "pharmacist");
    const patient = await createPatientApi(admin);

    // The shared drug is resolved by the admin: a doctor prescribes from the
    // catalogue and cannot add to it.
    const drug = await getFirstDrug(admin);
    const encounterId = await createEncounter(doctor, patient.id);
    const rx = await createPrescriptionDetailed(doctor, encounterId, { drugId: drug.id, drugName: drug.name });
    expect(rx.pharmacyRxQueueId, "the pharmacist's review queue has it").toBeTruthy();
    // No order until a pharmacist has reviewed the prescription.
    expect(rx.pharmacyOrderId).toBeNull();

    // The pharmacist's approval is what raises the order.
    const approve = (queueId: string | null) =>
      api<{ pharmacy_order_id: string | null }>(pharmacist, "PUT", `/api/pharmacy/rx-queue/${queueId}/review`, {
        action: "approved",
      });
    const reviewed = await approve(rx.pharmacyRxQueueId);
    const orderId = reviewed.pharmacy_order_id ?? "";
    expect(orderId, "approval raised a pharmacy order").toBeTruthy();
    const order = await api<{ items: Array<{ id: string }> }>(admin, "GET", `/api/pharmacy/orders/${orderId}`);
    await dispensePharmacyOrder(admin, orderId);
    expect(await findChargeFor(admin, patient.id, "pharmacy", order.items[0]?.id ?? "")).toBeDefined();

    // Negative: the tenant switch governs the bill line, not the clinical fan-out.
    await setTenantSetting(admin, "billing", "auto_charge_pharmacy", false);
    try {
      const rx2 = await createPrescriptionDetailed(doctor, encounterId, { drugId: drug.id, drugName: drug.name });
      const orderId2 = (await approve(rx2.pharmacyRxQueueId)).pharmacy_order_id ?? "";
      expect(orderId2).toBeTruthy();
      const order2 = await api<{ items: Array<{ id: string }> }>(admin, "GET", `/api/pharmacy/orders/${orderId2}`);
      await dispensePharmacyOrder(admin, orderId2);
      expect(await findChargeFor(admin, patient.id, "pharmacy", order2.items[0]?.id ?? "")).toBeUndefined();
    } finally {
      await setTenantSetting(admin, "billing", "auto_charge_pharmacy", true);
    }
  });
});
