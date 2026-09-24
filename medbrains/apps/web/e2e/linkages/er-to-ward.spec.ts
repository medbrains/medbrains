/**
 * Emergency → ward: visit, triage, medico-legal case, police intimation,
 * admission from the ER floor.
 *
 * The ER admit path is its own handler, not the IPD one, so it has to be
 * proven to do the same things: take the bed, link the visit to the
 * admission, and raise the ward's initial nursing assessment through the
 * same admission event. The MLC chain is the legal half — an MLC without a
 * visit to hang on is refused, one visit carries one MLC, and an intimation
 * needs a case that exists.
 */

import { expect, test } from "@playwright/test";
import { api, getAuthContextFromCookies, loginAsRoleApi, pollUntil } from "../helpers/api";
import {
  admitFromEr,
  createEmergencyVisit,
  createMlcCase,
  createPatientApi,
  createPoliceIntimation,
  createTriage,
  deleteRosterEntry,
  dischargeAdmission,
  getBedDashboardBeds,
  getEmergencyVisit,
  listAdmissionTasks,
  listAvailableBeds,
  rosterNurse,
  setBedStatus,
} from "../helpers/journey-steps";

const RANDOM_ID = "00000000-0000-4000-8000-000000000001";

test.describe("An ER visit becomes a ward admission", () => {
  test("triage → MLC → intimation → admit takes the bed and raises the nursing assessment", async ({
    request,
  }) => {
    const admin = await getAuthContextFromCookies(request);
    const nurse = await loginAsRoleApi(request, "nurse");
    const doctor = await loginAsRoleApi(request, "doctor");
    const patient = await createPatientApi(admin);

    // A complaint that does not read as medico-legal, so the MLC below is
    // the doctor's explicit decision rather than the registration heuristic.
    const visit = await createEmergencyVisit(nurse, patient.id, {
      arrivalMode: "walk_in",
      chiefComplaint: "Severe abdominal pain",
    });
    expect(visit).toMatchObject({ status: "registered", is_mlc: false, admission_id: null });

    const triage = await createTriage(nurse, visit.id, "immediate");
    expect(triage).toMatchObject({ er_visit_id: visit.id, triage_level: "immediate" });
    expect((await getEmergencyVisit(admin, visit.id)).status).toBe("triaged");

    // Negative: an MLC cannot hang on a visit that does not exist.
    await createMlcCase(doctor, { patientId: patient.id, visitId: RANDOM_ID }, { expectStatus: 404 });

    const mlc = await createMlcCase(doctor, { patientId: patient.id, visitId: visit.id, caseType: "assault" });
    expect(mlc).toMatchObject({ er_visit_id: visit.id, patient_id: patient.id, case_type: "assault" });
    expect(mlc.mlc_number).toMatch(/^MLC-/);
    // Negative: one visit, one case.
    await createMlcCase(doctor, { patientId: patient.id, visitId: visit.id }, { expectStatus: 409 });

    const intimation = await createPoliceIntimation(doctor, mlc.id, "Central Police Station");
    expect(intimation).toMatchObject({ mlc_case_id: mlc.id, police_station: "Central Police Station" });
    expect(intimation.intimation_number).toMatch(/^PI-/);
    await createPoliceIntimation(doctor, RANDOM_ID, "Nowhere", { expectStatus: 404 });

    const bed = (await listAvailableBeds(admin)).find((b) => b.ward_id);
    expect(bed, "a free bed on a ward").toBeDefined();
    const wardId = bed?.ward_id as string;
    const roster = await rosterNurse(admin, { nurseUserId: nurse.userId, wardId, isCharge: true });
    try {
      const admitted = await admitFromEr(admin, visit.id, {
        bedId: bed?.bed_id as string,
        admittingDoctorId: doctor.userId,
        wardId,
      });
      expect(admitted).toMatchObject({ er_visit_id: visit.id, patient_id: patient.id, status: "admitted" });

      expect(await getEmergencyVisit(admin, visit.id)).toMatchObject({
        status: "admitted",
        admission_id: admitted.admission_id,
      });
      const row = (await getBedDashboardBeds(admin)).find((b) => b.bed_location_id === bed?.bed_id);
      expect(row).toMatchObject({ bed_status: "occupied", admission_id: admitted.admission_id });

      // The care team the ER named can reach the admission it created: the
      // admitting doctor as attending, the ward's nurse as ward staff.
      const seenByDoctor = await api<{ admission: { id: string } }>(
        doctor,
        "GET",
        `/api/ipd/admissions/${admitted.admission_id}`,
      );
      expect(seenByDoctor.admission.id).toBe(admitted.admission_id);

      // Same admission event as a direct IPD admit → same nursing linkage,
      // on the nurse's own list.
      const tasks = await pollUntil(
        () => listAdmissionTasks(nurse, admitted.admission_id),
        (t) => t.some((x) => x.task_type === "initial_assessment" && x.assigned_to === nurse.userId),
        { label: "initial assessment for the ER admission" },
      );
      expect(tasks.filter((x) => x.task_type === "initial_assessment")).toHaveLength(1);

      // Negative: the visit is already on a ward.
      await admitFromEr(
        admin,
        visit.id,
        { bedId: bed?.bed_id as string, admittingDoctorId: doctor.userId },
        { expectStatus: 409 },
      );

      await dischargeAdmission(admin, admitted.admission_id);
    } finally {
      await deleteRosterEntry(admin, roster.id);
      // Discharge hands the bed to housekeeping; mark it clean so the next
      // run finds it available again.
      await setBedStatus(admin, bed?.bed_id as string, "vacant_clean").catch(() => undefined);
    }
  });
});
