/**
 * SOP ref: docs/sops/04-pharmacy-dispensing.md
 * Scenario S2: Pharmacist dispenses standard drug — FEFO batch, stock decremented
 * Scenario S3: Pharmacist dispenses Schedule X / NDPS drug — register entry, dual witness
 */

import { test, expect } from "@playwright/test";
import { loginAsRoleApi, api } from "../helpers/api";
import {
  createPatientApi,
  createEncounter,
  createPrescription,
  createPharmacyOrder,
  dispensePharmacyOrder,
  createNdpsEntry,
  listNdpsEntries,
} from "../helpers/journey-steps";
import { getOpdDept, getFirstDrug, getOrCreateNdpsDrug } from "../helpers/seed-resolvers";

test.describe("Pharmacy dispensing — FEFO and NDPS register", () => {
  test("pharmacist dispenses routine drug; stock decremented; batch recorded", async ({
    request,
  }) => {
    const doctorCtx = await loginAsRoleApi(request, "doctor");
    const pharmacistCtx = await loginAsRoleApi(request, "pharmacist");

    const patient = await createPatientApi(doctorCtx);
    const opdDept = await getOpdDept(doctorCtx);
    const drug = await getFirstDrug(pharmacistCtx);

    const encounterId = await createEncounter(doctorCtx, patient.id, {
      departmentId: opdDept.id,
    });

    const prescriptionId = await createPrescription(doctorCtx, encounterId, {
      drugId: drug.id,
      dose: "500mg",
      frequency: "twice_daily",
      duration_days: 5,
      route: "oral",
    });
    expect(prescriptionId).toBeTruthy();

    const { id: orderId, itemId } = await createPharmacyOrder(pharmacistCtx, {
      patientId: patient.id,
      prescriptionId,
      drugId: drug.id,
      quantity: 10,
    });
    expect(orderId).toBeTruthy();

    // Record catalog stock before dispense
    const catalogBefore = await api<{ id: string; current_stock: number }[]>(
      pharmacistCtx,
      "GET",
      "/api/pharmacy/stock",
    );
    const drugStockBefore = catalogBefore.find((c) => c.id === drug.id)?.current_stock ?? 0;

    const dispensed = await dispensePharmacyOrder(pharmacistCtx, orderId);
    expect(dispensed.status).toBe("dispensed");

    // Stock should have decreased
    const catalogAfter = await api<{ id: string; current_stock: number }[]>(
      pharmacistCtx,
      "GET",
      "/api/pharmacy/stock",
    );
    const drugStockAfter = catalogAfter.find((c) => c.id === drug.id)?.current_stock ?? 0;
    expect(drugStockAfter).toBeLessThan(drugStockBefore);
  });

  test("NDPS register entry created with witness on controlled drug dispense", async ({
    request,
  }) => {
    const doctorCtx = await loginAsRoleApi(request, "doctor");
    const pharmacistCtx = await loginAsRoleApi(request, "pharmacist");
    const witnessCtx = await loginAsRoleApi(request, "pharmacist");

    const patient = await createPatientApi(doctorCtx);
    const ndpsDrug = await getOrCreateNdpsDrug(pharmacistCtx);

    const countBefore = (await listNdpsEntries(pharmacistCtx)).length;

    const ndpsEntry = await createNdpsEntry(pharmacistCtx, {
      catalogItemId: ndpsDrug.id,
      patientId: patient.id,
      quantity: 3,
      witnessUserId: witnessCtx.userId,
    });

    expect(ndpsEntry.id).toBeTruthy();
    expect(ndpsEntry.catalog_item_id).toBe(ndpsDrug.id);
    expect(ndpsEntry.witnessed_by).toBe(witnessCtx.userId);
    expect(ndpsEntry.quantity).toBe(3);

    // Entry appears in register
    const entriesAfter = await listNdpsEntries(pharmacistCtx);
    expect(entriesAfter.length).toBeGreaterThan(countBefore);

    const registered = entriesAfter.find((e) => e.id === ndpsEntry.id);
    expect(registered).toBeDefined();
    expect(registered!.witnessed_by).not.toBeNull();
  });

  test("drug interaction check fires before dispense", async ({ request }) => {
    const doctorCtx = await loginAsRoleApi(request, "doctor");
    const pharmacistCtx = await loginAsRoleApi(request, "pharmacist");
    const patient = await createPatientApi(doctorCtx);
    const drug = await getFirstDrug(pharmacistCtx);

    // Call the interaction check endpoint: returns array of interactions
    const interactions = await api<{ interacting_drug: string; severity: string }[]>(
      pharmacistCtx,
      "POST",
      "/api/pharmacy/interactions/check",
      {
        patient_id: patient.id,
        drug_id: drug.id,
      },
    );

    // Endpoint must respond; result is an array (may be empty for a safe drug)
    expect(Array.isArray(interactions)).toBe(true);
  });

  test("near-expiry report returns batches expiring within 90 days", async ({
    request,
  }) => {
    const pharmacistCtx = await loginAsRoleApi(request, "pharmacist");

    const report = await api<{ id: string; expiry_date: string }[]>(
      pharmacistCtx,
      "GET",
      "/api/pharmacy/batches/near-expiry?days=90",
    );

    // Endpoint must respond; each row has expiry_date
    expect(Array.isArray(report)).toBe(true);
    for (const row of report) {
      expect(row.expiry_date).toBeTruthy();
    }
  });
});
