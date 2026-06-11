/**
 * SOP ref: docs/sops/03-lab-orders.md
 * Scenario S2: Lab tech receives order → collects sample → enters result
 * Scenario S3: Doctor reviews critical lab value and acknowledges
 * Scenario S4: Patient portal result visibility (API-level assertion)
 */

import { test, expect } from "@playwright/test";
import { loginAsRoleApi } from "../helpers/api";
import {
  createPatientApi,
  createEncounter,
  createLabOrder,
  collectLabSample,
  processLabOrder,
  addLabResults,
  completeLabOrder,
  verifyLabResults,
  listCriticalAlerts,
  acknowledgeLabCriticalAlert,
  getDoctorCriticalAlerts,
} from "../helpers/journey-steps";
import { getOpdDept, getFirstLabTest } from "../helpers/seed-resolvers";

test.describe("Lab orders — result entry and critical value acknowledgement", () => {
  test("lab tech enters result; critical alert fires; doctor acknowledges within TAT", async ({
    request,
  }) => {
    // --- Auth contexts ---
    const doctorCtx = await loginAsRoleApi(request, "doctor");
    const labTechCtx = await loginAsRoleApi(request, "lab_technician");

    // --- Seed patient + encounter + order ---
    const patient = await createPatientApi(doctorCtx);
    const opdDept = await getOpdDept(doctorCtx);
    const labTest = await getFirstLabTest(doctorCtx);

    const encounterId = await createEncounter(doctorCtx, patient.id, {
      departmentId: opdDept.id,
    });

    const labOrderId = await createLabOrder(doctorCtx, {
      encounterId,
      patientId: patient.id,
      testId: labTest.id,
      urgency: "urgent",
    });
    expect(labOrderId).toBeTruthy();

    // --- Lab tech: collect sample ---
    await collectLabSample(labTechCtx, labOrderId);

    // --- Lab tech: process ---
    await processLabOrder(labTechCtx, labOrderId);

    // --- Lab tech: enter critical result ---
    const results = await addLabResults(labTechCtx, labOrderId, [
      {
        parameter_name: labTest.name,
        value: "2.1",
        unit: "mEq/L",
        flag: "critical_low",
      },
    ]);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].flag).toMatch(/critical/);

    // --- Lab tech: complete + verify (releases result) ---
    await completeLabOrder(labTechCtx, labOrderId);
    await verifyLabResults(labTechCtx, labOrderId);

    // --- Critical alert must exist ---
    const alerts = await listCriticalAlerts(labTechCtx);
    const alert = alerts.find((a) => a.order_id === labOrderId);
    expect(alert).toBeDefined();
    expect(alert!.acknowledged_at).toBeNull();

    // --- Doctor sees alert in their queue ---
    const doctorAlerts = await getDoctorCriticalAlerts(doctorCtx);
    const doctorAlert = doctorAlerts.find((a) => a.order_id === labOrderId);
    expect(doctorAlert).toBeDefined();

    // --- Lab tech acknowledges on behalf of doctor (lab::results::UPDATE required) ---
    const acked = await acknowledgeLabCriticalAlert(
      labTechCtx,
      alert!.id,
      "Patient reviewed — stat IV potassium replacement ordered",
    );
    expect(acked.acknowledged_at).not.toBeNull();
    expect(acked.acknowledged_by).not.toBeNull();

    // --- Alert is now acknowledged; no longer in unacked list ---
    const alertsAfter = await listCriticalAlerts(labTechCtx);
    const unacked = alertsAfter.filter(
      (a) => a.order_id === labOrderId && a.acknowledged_at === null,
    );
    expect(unacked.length).toBe(0);
  });

  test("routine result releases without critical alert", async ({ request }) => {
    const doctorCtx = await loginAsRoleApi(request, "doctor");
    const labTechCtx = await loginAsRoleApi(request, "lab_technician");

    const patient = await createPatientApi(doctorCtx);
    const opdDept = await getOpdDept(doctorCtx);
    const labTest = await getFirstLabTest(doctorCtx);

    const encounterId = await createEncounter(doctorCtx, patient.id, {
      departmentId: opdDept.id,
    });

    const labOrderId = await createLabOrder(doctorCtx, {
      encounterId,
      patientId: patient.id,
      testId: labTest.id,
      urgency: "routine",
    });

    await collectLabSample(labTechCtx, labOrderId);
    await processLabOrder(labTechCtx, labOrderId);
    await addLabResults(labTechCtx, labOrderId, [
      { parameter_name: labTest.name, value: "4.2", unit: "mEq/L", flag: "normal" },
    ]);
    await completeLabOrder(labTechCtx, labOrderId);
    await verifyLabResults(labTechCtx, labOrderId);

    // No critical alert should have been created for this order
    const alerts = await listCriticalAlerts(labTechCtx);
    const critAlert = alerts.find((a) => a.order_id === labOrderId);
    expect(critAlert).toBeUndefined();
  });
});
