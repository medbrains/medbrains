/**
 * NDPS register → quality — a Schedule X movement short of a signature.
 *
 * The register row is written by pharmacy. The deficiency lives in quality:
 * an incident, reportable against NDPS, raised when a movement that needs
 * a witness has none — a receipt, since the handler refuses an unwitnessed dispense. Until this suite, nothing could raise it at all —
 * `requires_dual_sign` was a column no handler wrote, so the pipeline's
 * condition was never true. The handler now derives it from the drug.
 *
 * Negative: a movement WITH a witness raises nothing.
 *
 * Table half — two deliveries, one incident — in
 * crates/medbrains-server/tests/linkage_safety_test.rs.
 */

import { expect, test } from "@playwright/test";
import { expectAbsent, loginAsAdmin, loginAsRoleApi, pollUntil, withStepUp } from "../helpers/api";
import { createNdpsEntry, listQualityIncidents, type QualityIncidentLite } from "../helpers/journey-steps";
import { getOrCreateNdpsDrug } from "../helpers/seed-resolvers";

const deficiencyFor = (entryId: string) => (i: QualityIncidentLite) =>
  i.incident_type === "ndps_dual_signature_missing" && i.title.includes(entryId);

test.describe("An NDPS movement without its second signature reaches the quality register", () => {
  test("unwitnessed → reportable incident; witnessed → nothing", async ({ request }) => {
    // A controlled-drug register entry is a high-risk act: the server demands
    // step-up re-authentication. First real consumer of withStepUp.
    const admin = await withStepUp(await loginAsAdmin(request));
    const nurse = await loginAsRoleApi(request, "nurse");
    const drug = await getOrCreateNdpsDrug(admin);

    // The handler refuses an unwitnessed dispense outright, so the register
    // can only go wrong on the way in: a receipt with no witness.
    const unwitnessed = await createNdpsEntry(admin, {
      catalogItemId: drug.id,
      action: "receipt",
      quantity: 5,
    });
    const incidents = await pollUntil(
      () => listQualityIncidents(admin),
      (list) => list.some(deficiencyFor(unwitnessed.id)),
      { label: "NDPS deficiency incident" },
    );
    const incident = incidents.find(deficiencyFor(unwitnessed.id));
    expect(incident?.severity).toBe("major");

    // The second signature present: the register is complete, nothing to raise.
    const witnessed = await createNdpsEntry(admin, {
      catalogItemId: drug.id,
      quantity: 1,
      witnessUserId: nurse.userId,
    });
    await expectAbsent(() => listQualityIncidents(admin), (list) => list.some(deficiencyFor(witnessed.id)), {
      label: "incident for a witnessed movement",
    });
  });
});
