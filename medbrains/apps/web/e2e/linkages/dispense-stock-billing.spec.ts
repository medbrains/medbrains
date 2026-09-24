/**
 * Pharmacy → stock → pharmacists → billing: one dispense, three effects.
 *
 * Dispensing takes the quantity off the catalogue stock. Crossing the reorder
 * level tells every pharmacist once — the alert is edge-triggered, so a
 * second dispense while already low says nothing more, and a nurse is never
 * on that list. The dispensed item is charged to the patient, keyed to the
 * order item.
 */

import { expect, test } from "@playwright/test";
import { api, expectAbsent, getAuthContextFromCookies, loginAsRoleApi, pollUntil } from "../helpers/api";
import {
  createPatientApi,
  createPharmacyOrder,
  dispensePharmacyOrder,
  findChargeFor,
  listNotifications,
} from "../helpers/journey-steps";
import { createSafeE2eDrug } from "../helpers/seed-resolvers";

const REORDER_LEVEL = 5;
const isLowStockFor = (drugId: string) => (n: { title: string; entity_id?: string | null }) =>
  n.title.startsWith("Low stock:") && n.entity_id === drugId;

test.describe("A dispense moves stock, alerts pharmacists once, and bills the patient", () => {
  test("stock down; one low-stock alert on crossing; none on the next; nurse never; item charged", async ({
    request,
  }) => {
    const admin = await getAuthContextFromCookies(request);
    const pharmacist = await loginAsRoleApi(request, "pharmacist");
    const nurse = await loginAsRoleApi(request, "nurse");
    const patient = await createPatientApi(admin);

    // A drug of our own: one batch of eight, reorder at five.
    const drug = await createSafeE2eDrug(admin, { reorderLevel: REORDER_LEVEL, batchQuantities: [8] });

    const first = await createPharmacyOrder(admin, { patientId: patient.id, drugId: drug.id, quantity: 4 });
    await dispensePharmacyOrder(admin, first.id);
    const stock = async () => {
      const rows = await api<Array<{ id: string; current_stock: number }>>(admin, "GET", "/api/pharmacy/catalog");
      return Number(rows.find((r) => r.id === drug.id)?.current_stock);
    };
    expect(await stock()).toBe(4);

    const alerts = await pollUntil(
      () => listNotifications(pharmacist, { unread: true }),
      (rows) => rows.some(isLowStockFor(drug.id)),
      { label: "pharmacist low-stock alert" },
    );
    expect(alerts.filter(isLowStockFor(drug.id))).toHaveLength(1);
    expect(alerts.find(isLowStockFor(drug.id))?.body).toContain(`reorder at ${REORDER_LEVEL}`);

    const charge = await findChargeFor(admin, patient.id, "pharmacy", first.itemId);
    expect(charge, "the dispensed item is on the patient's bill").toBeDefined();

    // Negative: already below the line, the next dispense does not page again.
    const second = await createPharmacyOrder(admin, { patientId: patient.id, drugId: drug.id, quantity: 1 });
    await dispensePharmacyOrder(admin, second.id);
    expect(await stock()).toBe(3);
    await expectAbsent(
      () => listNotifications(pharmacist),
      (rows) => rows.filter(isLowStockFor(drug.id)).length > 1,
    );
    // Negative: stock is the pharmacy's business, never the ward's.
    await expectAbsent(() => listNotifications(nurse), (rows) => rows.some(isLowStockFor(drug.id)));
  });
});
