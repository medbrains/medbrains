/**
 * Two doors to the same lab order, and only one reaches billing.
 *
 * A test ordered directly is charged when the order is placed. The same test
 * signed from the order basket creates the order with billing switched off,
 * and nothing charges it afterwards. This pins the divergence so the fix
 * flips it deliberately.
 */

import { expect, test } from "@playwright/test";
import { api, getAuthContextFromCookies, loginAsRoleApi } from "../helpers/api";
import { createEncounter, createLabOrder, createPatientApi, findChargeFor } from "../helpers/journey-steps";
import { getFirstLabTest } from "../helpers/seed-resolvers";

test.describe("Order basket vs direct order", () => {
  test("direct order is billed; basket-signed order is not", async ({ request }) => {
    const admin = await getAuthContextFromCookies(request);
    const doctor = await loginAsRoleApi(request, "doctor");
    const patient = await createPatientApi(admin);
    const encounterId = await createEncounter(doctor, patient.id);
    const labTest = await getFirstLabTest(doctor);

    const direct = await createLabOrder(doctor, { patientId: patient.id, encounterId });
    expect(await findChargeFor(admin, patient.id, "lab", direct)).toBeDefined();

    const signed = await api<{ created: Array<{ order_type: string; order_id: string }> }>(
      doctor,
      "POST",
      "/api/orders/basket/sign",
      {
        encounter_id: encounterId,
        patient_id: patient.id,
        items: [{ kind: "lab", test_id: labTest.id, priority: "routine", indication: null, notes: null }],
        warnings_acknowledged: [],
      },
    );
    const basketOrder = signed.created.find((c) => c.order_type === "lab");
    expect(basketOrder, "the basket created the lab order").toBeDefined();

    // ponytail: pins the current divergence — basket orders are created with
    // auto_bill: false and nothing bills them later. Flip to toBeDefined when
    // the basket bills.
    expect(await findChargeFor(admin, patient.id, "lab", basketOrder?.order_id ?? "")).toBeUndefined();
  });
});
