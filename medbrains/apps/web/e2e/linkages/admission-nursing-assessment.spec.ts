/**
 * Admission → nursing — the 24-hour initial assessment NABH requires.
 *
 * Rostering a nurse on a ward and admitting a patient to a bed on that ward
 * are two modules' actions. The linkage is a nursing task that appears on the
 * admission, assigned to the ward's charge nurse, due a day later. Until the
 * roster screen existed nothing could write nurse_shift_assignments, so this
 * task was never raised on any admission.
 *
 * The negatives are the point: no roster ⇒ no task (writing an unassigned
 * task would sit on nobody's list and make the register look attended to);
 * the same nurse twice on one shift ⇒ 409; a nurse rostering herself ⇒ 403.
 *
 * The table-only half — dispatching the event twice and proving one row — is
 * in crates/medbrains-server/tests/linkage_admission_assessment_test.rs.
 */

import { expect, test } from "@playwright/test";
import { expectAbsent, getAuthContextFromCookies, loginAsRoleApi, pollUntil } from "../helpers/api";
import {
  admitToIpd,
  createPatientApi,
  deleteRosterEntry,
  dischargeAdmission,
  freshWardBeds,
  getRosterCandidates,
  listAdmissionTasks,
  rosterNurse,
  setBedStatus,
} from "../helpers/journey-steps";

const isAssessment = (nurseId: string) => (t: { task_type: string; assigned_to: string | null }) =>
  t.task_type === "initial_assessment" && t.assigned_to === nurseId;

test.describe("An admission raises the initial nursing assessment for the ward's nurse", () => {
  test("rostered ward → task assigned; unrostered ward → nothing; duplicates and self-rostering refused", async ({
    request,
  }) => {
    const admin = await getAuthContextFromCookies(request);
    const nurse = await loginAsRoleApi(request, "nurse");

    // The nurse this run provisioned is a candidate: active, role nurse.
    const candidates = await getRosterCandidates(admin);
    expect(candidates.map((c) => c.id)).toContain(nurse.userId);

    // Wards of this run's own: one the nurse is rostered on, one nobody is.
    const [bed] = await freshWardBeds(admin, 1);
    const [other] = await freshWardBeds(admin, 1);
    const wardId = bed?.ward_id ?? "";
    const bedId = bed?.bed_id ?? "";

    // A nurse may not restaff the ward. Roster.manage is held by bypass roles only.
    await rosterNurse(nurse, { nurseUserId: nurse.userId, wardId }, { expectStatus: 403 });

    const entry = await rosterNurse(admin, { nurseUserId: nurse.userId, wardId, isCharge: true });
    const admissions: string[] = [];
    const usedBeds: string[] = [bedId];
    try {
      // The same nurse on the same shift is a double-click, not two people.
      await rosterNurse(admin, { nurseUserId: nurse.userId, wardId, isCharge: true }, { expectStatus: 409 });

      const patient = await createPatientApi(admin);
      const admissionId = await admitToIpd(admin, { patientId: patient.id, bedId });
      admissions.push(admissionId);

      const tasks = await pollUntil(
        () => listAdmissionTasks(admin, admissionId),
        (list) => list.some(isAssessment(nurse.userId)),
        { label: "initial assessment assigned to the rostered nurse" },
      );
      const task = tasks.find(isAssessment(nurse.userId));
      const dueInHours = (Date.parse(task?.due_at ?? "") - Date.now()) / 3_600_000;
      expect(dueInHours).toBeGreaterThan(22);
      expect(dueInHours).toBeLessThanOrEqual(24.5);

      // Negative: a ward with nobody rostered raises nothing.
      if (other) usedBeds.push(other.bed_id);
      const patient2 = await createPatientApi(admin);
      const admission2 = await admitToIpd(admin, { patientId: patient2.id, bedId: other?.bed_id });
      admissions.push(admission2);
      await expectAbsent(
        () => listAdmissionTasks(admin, admission2),
        (list) => list.some((t) => t.task_type === "initial_assessment"),
        { label: "assessment on an unrostered ward" },
      );
    } finally {
      // Free the beds and the shift for the next run.
      for (const id of admissions) {
        await dischargeAdmission(admin, id).catch(() => undefined);
      }
      await deleteRosterEntry(admin, entry.id).catch(() => undefined);
      // Discharge hands a bed to housekeeping; mark them clean for the next run.
      for (const id of usedBeds) {
        await setBedStatus(admin, id, "vacant_clean").catch(() => undefined);
      }
    }
  });
});
