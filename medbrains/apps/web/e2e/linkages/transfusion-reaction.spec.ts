/**
 * Transfusion reaction → blood bank inventory → quality.
 *
 * A reaction is recorded against one transfusion. Its effects live in two
 * other places: every other component from the same donation is held
 * (quarantined) so it cannot be issued to the next patient while the
 * investigation is open, and the reaction is filed on the quality register
 * — as a sentinel event when it was fatal, which is what NABH means by one.
 *
 * Negatives: a component from a different donation stays available, and a
 * mild reaction is on the register but is not sentinel.
 *
 * Table half — the outbox alert and two deliveries → one incident — in
 * crates/medbrains-server/tests/linkage_safety_test.rs.
 */

import { expect, test } from "@playwright/test";
import { getAuthContextFromCookies, loginAsRoleApi, pollUntil } from "../helpers/api";
import {
  createBloodComponent,
  createDonation,
  createDonor,
  createPatientWithBloodGroup,
  createTransfusion,
  listBloodComponents,
  listQualityIncidents,
  type QualityIncidentLite,
  recordTransfusionReaction,
  setBloodComponentStatus,
} from "../helpers/journey-steps";

const BG = "o_positive";

/** One donation with two available PRBC units. */
async function donationWithTwoUnits(admin: Awaited<ReturnType<typeof getAuthContextFromCookies>>) {
  const donor = await createDonor(admin, BG);
  const donation = await createDonation(admin, donor.id);
  const units = [];
  for (let i = 0; i < 2; i++) {
    const c = await createBloodComponent(admin, { donationId: donation.id, bloodGroup: BG, componentType: "prbc" });
    await setBloodComponentStatus(admin, c.id, "available");
    units.push(c.id);
  }
  return { donationId: donation.id, units };
}

const reactionFor = (patientId: string) => (i: QualityIncidentLite) =>
  i.incident_type === "transfusion_reaction" && i.patient_id === patientId;

test.describe("A transfusion reaction holds the donation's other units and reaches quality", () => {
  test("severe → sibling quarantined, incident major; fatal → sentinel; other donation untouched", async ({
    request,
  }) => {
    const admin = await getAuthContextFromCookies(request);
    const nurse = await loginAsRoleApi(request, "nurse");

    const a = await donationWithTwoUnits(admin);
    const other = await donationWithTwoUnits(admin);
    const patient = await createPatientWithBloodGroup(admin, BG);

    const transfusion = await createTransfusion(admin, {
      patientId: patient.id,
      componentId: a.units[0] ?? "",
      patientVerifiedBy: admin.userId,
      productVerifiedBy: nurse.userId,
    });
    await recordTransfusionReaction(admin, transfusion.id, { reactionType: "febrile", severity: "severe" });

    const components = await pollUntil(
      () => listBloodComponents(admin),
      (list) => list.some((c) => c.id === a.units[1] && c.status === "quarantined"),
      { label: "sibling unit quarantined" },
    );
    const byId = new Map(components.map((c) => [c.id, c.status]));
    expect(byId.get(a.units[1])).toBe("quarantined");
    // The implicated unit keeps its own truth, and another donation is untouched.
    expect(byId.get(a.units[0])).toBe("transfused");
    expect(byId.get(other.units[0])).toBe("available");
    expect(byId.get(other.units[1])).toBe("available");

    const incidents = await pollUntil(
      () => listQualityIncidents(admin),
      (list) => list.some(reactionFor(patient.id)),
      { label: "reaction on the quality register" },
    );
    expect(incidents.find(reactionFor(patient.id))?.severity).toBe("major");

    // Fatal is a sentinel event.
    const patient2 = await createPatientWithBloodGroup(admin, BG);
    const t2 = await createTransfusion(admin, {
      patientId: patient2.id,
      componentId: other.units[0] ?? "",
      patientVerifiedBy: admin.userId,
      productVerifiedBy: nurse.userId,
    });
    await recordTransfusionReaction(admin, t2.id, { reactionType: "haemolytic", severity: "fatal" });
    const fatal = await pollUntil(
      () => listQualityIncidents(admin),
      (list) => list.some(reactionFor(patient2.id)),
      { label: "fatal reaction on the register" },
    );
    expect(fatal.find(reactionFor(patient2.id))?.severity).toBe("sentinel");
  });
});
