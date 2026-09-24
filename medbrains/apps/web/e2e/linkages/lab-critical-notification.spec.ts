/**
 * Lab → doctor: a critical value reaches the person who ordered the test.
 *
 * The technologist posts a result; the ordering doctor gets an in-app
 * "Critical lab value" notification pointing at the order, and the alert
 * sits unacknowledged on the critical list until the doctor reads the value
 * back. A nurse who had nothing to do with the order hears nothing, and a
 * routine result raises no alert at all.
 *
 * The SMS half (an outbox row to the doctor's phone, delivered once) is
 * in crates/medbrains-server/tests/linkage_lab_critical_test.rs.
 */

import { expect, test } from "@playwright/test";
import { expectAbsent, getAuthContextFromCookies, loginAsRoleApi, pollUntil } from "../helpers/api";
import {
  acknowledgeLabCriticalAlert,
  addLabResults,
  collectLabSample,
  createEncounter,
  createLabOrder,
  createPatientApi,
  getDoctorCriticalAlerts,
  listCriticalAlerts,
  listNotifications,
  processLabOrder,
} from "../helpers/journey-steps";

const isCriticalFor = (orderId: string) => (n: { title: string; entity_id?: string | null }) =>
  n.title === "Critical lab value" && n.entity_id === orderId;

test.describe("A critical lab value reaches the ordering doctor", () => {
  test("doctor notified and alert listed; nurse silent; routine value raises nothing", async ({ request }) => {
    const admin = await getAuthContextFromCookies(request);
    const doctor = await loginAsRoleApi(request, "doctor");
    const nurse = await loginAsRoleApi(request, "nurse");
    const tech = await loginAsRoleApi(request, "lab_technician");
    const patient = await createPatientApi(admin);
    const encounterId = await createEncounter(doctor, patient.id);

    const orderId = await createLabOrder(doctor, { patientId: patient.id, encounterId });
    await collectLabSample(tech, orderId, patient.uhid);
    await processLabOrder(tech, orderId);
    const [result] = await addLabResults(tech, orderId, [
      { parameter_name: "E2E critical analyte", value: "2.1", unit: "mmol/L", flag: "critical_low" },
    ]);
    expect(result?.flag).toBe("critical_low");

    const notifications = await pollUntil(
      () => listNotifications(doctor, { unread: true }),
      (rows) => rows.some(isCriticalFor(orderId)),
      { label: "doctor's critical-value notification" },
    );
    expect(notifications.filter(isCriticalFor(orderId))).toHaveLength(1);

    const alert = (await listCriticalAlerts(tech)).find((a) => a.order_id === orderId);
    expect(alert).toBeDefined();
    expect(alert?.acknowledged_at).toBeNull();
    expect((await getDoctorCriticalAlerts(doctor)).map((a) => a.order_id)).toContain(orderId);

    // Negative: a nurse with no part in the order is not paged.
    await expectAbsent(() => listNotifications(nurse), (rows) => rows.some(isCriticalFor(orderId)));

    // Closing the loop needs the value read back exactly; a wrong read-back is refused.
    await acknowledgeLabCriticalAlert(doctor, alert?.id ?? "", "2.7", { expectStatus: 400 });
    const acked = await acknowledgeLabCriticalAlert(doctor, alert?.id ?? "", "2.1");
    expect(acked.acknowledged_at).not.toBeNull();
    // ... and only once.
    await acknowledgeLabCriticalAlert(doctor, alert?.id ?? "", "2.1", { expectStatus: 404 });

    // Negative: a routine result raises no alert.
    const routineId = await createLabOrder(doctor, { patientId: patient.id, encounterId });
    await collectLabSample(tech, routineId, patient.uhid);
    await processLabOrder(tech, routineId);
    await addLabResults(tech, routineId, [{ parameter_name: "E2E routine analyte", value: "4.2", unit: "mmol/L" }]);
    await expectAbsent(
      () => listCriticalAlerts(tech),
      (rows) => rows.some((a) => a.order_id === routineId),
    );
  });
});
