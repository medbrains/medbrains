/**
 * Bed lifecycle — admit, transfer, discharge, turnaround.
 *
 * A bed is a location row with one bed_states row. Admission takes it
 * (occupied, and gone from the available list), a transfer hands the old
 * bed to housekeeping (vacant_dirty) and takes the new one, discharge hands
 * the last bed over the same way. Every release writes a turnaround entry;
 * completing it stamps ready_at, and only a status change to vacant_clean
 * puts the bed back in the available list.
 *
 * The negatives are what keep two patients out of one bed: a second
 * admission into an occupied bed and a transfer onto the bed already held
 * are both refused.
 */

import { expect, test } from "@playwright/test";
import { api, getAuthContextFromCookies } from "../helpers/api";
import {
  admitToIpd,
  completeBedTurnaround,
  createPatientApi,
  dischargeAdmission,
  getBedDashboardBeds,
  listAvailableBeds,
  listBedTurnaround,
  setBedStatus,
  transferAdmissionBed,
} from "../helpers/journey-steps";
import { getIpdDept } from "../helpers/seed-resolvers";

test.describe("A bed follows the admission through transfer and discharge", () => {
  test("occupied → transferred → released, with a turnaround entry per release", async ({ request }) => {
    const admin = await getAuthContextFromCookies(request);
    const [bedA, bedB] = await listAvailableBeds(admin);
    if (!bedA || !bedB) throw new Error("two free beds — the seed has 28");
    const patient = await createPatientApi(admin);

    const admissionId = await admitToIpd(admin, { patientId: patient.id, bedId: bedA.bed_id });

    const bedRow = async (bedId: string) => {
      const row = (await getBedDashboardBeds(admin)).find((b) => b.bed_location_id === bedId);
      expect(row, `dashboard row for ${bedId}`).toBeDefined();
      return row as NonNullable<typeof row>;
    };

    expect(await bedRow(bedA.bed_id)).toMatchObject({ bed_status: "occupied", admission_id: admissionId });
    expect((await listAvailableBeds(admin)).map((b) => b.bed_id)).not.toContain(bedA.bed_id);

    // Negative: nobody else gets that bed.
    const second = await createPatientApi(admin);
    await api(
      admin,
      "POST",
      "/api/ipd/admissions",
      { patient_id: second.id, department_id: (await getIpdDept(admin)).id, bed_id: bedA.bed_id },
      { expectStatus: 400 },
    );

    await transferAdmissionBed(admin, admissionId, bedB.bed_id, "Isolation required");
    expect(await bedRow(bedA.bed_id)).toMatchObject({ bed_status: "vacant_dirty", admission_id: null });
    expect(await bedRow(bedB.bed_id)).toMatchObject({ bed_status: "occupied", admission_id: admissionId });
    const afterTransfer = (await listBedTurnaround(admin)).find(
      (t) => t.bed_id === bedA.bed_id && t.admission_id === admissionId,
    );
    expect(afterTransfer, "the released bed is on housekeeping's list").toBeDefined();
    expect(afterTransfer?.ready_at).toBeNull();

    // Negative: a transfer onto the bed already held is refused.
    await transferAdmissionBed(admin, admissionId, bedB.bed_id, "Same bed", { expectStatus: 400 });

    await dischargeAdmission(admin, admissionId);
    const detail = await api<{ admission: { status: string; bed_id: string | null } }>(
      admin,
      "GET",
      `/api/ipd/admissions/${admissionId}`,
    );
    expect(detail.admission.status).toBe("discharged");
    expect(await bedRow(bedB.bed_id)).toMatchObject({ bed_status: "vacant_dirty", admission_id: null });

    const afterDischarge = (await listBedTurnaround(admin)).find(
      (t) => t.bed_id === bedB.bed_id && t.admission_id === admissionId,
    );
    expect(afterDischarge).toBeDefined();
    const done = await completeBedTurnaround(admin, (afterDischarge as { id: string }).id);
    expect(done.ready_at).not.toBeNull();
    expect(typeof done.turnaround_minutes).toBe("number");

    // Cleaning done is not the same as ready for the next patient: the bed
    // returns to the available list only when its status says vacant_clean.
    expect((await listAvailableBeds(admin)).map((b) => b.bed_id)).not.toContain(bedB.bed_id);
    await setBedStatus(admin, bedB.bed_id, "vacant_clean");
    await setBedStatus(admin, bedA.bed_id, "vacant_clean");
    expect((await listAvailableBeds(admin)).map((b) => b.bed_id)).toEqual(
      expect.arrayContaining([bedA.bed_id, bedB.bed_id]),
    );
  });
});
