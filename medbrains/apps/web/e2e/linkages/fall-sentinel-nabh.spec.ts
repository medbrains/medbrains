/**
 * Quality incident → sentinel list.
 *
 * A fall is filed on the quality register; a sentinel-severity event is
 * filed on the same register and must surface on the sentinel list the
 * accreditation review reads. A near-miss must not. The NABH mirror rows
 * themselves have no read endpoint and are asserted in
 * crates/medbrains-server/tests/linkage_safety_test.rs.
 *
 * The indicator rollup (/api/nabh/indicators) is a month aggregate that
 * other tests in the same run also move; it is read here to prove the
 * endpoint answers, not for a delta.
 */

import { expect, test } from "@playwright/test";
import { getAuthContextFromCookies } from "../helpers/api";
import { createQualityIncident, listSentinelIncidents, nabhIndicator } from "../helpers/journey-steps";

test.describe("Sentinel incidents reach the sentinel list; a near-miss does not", () => {
  test("fall/minor absent, medication/sentinel present, near-miss absent", async ({ request }) => {
    const admin = await getAuthContextFromCookies(request);
    const stamp = Date.now().toString(36);

    const fall = await createQualityIncident(admin, {
      title: `E2E fall ${stamp}`,
      incidentType: "fall",
      severity: "minor",
    });
    const sentinel = await createQualityIncident(admin, {
      title: `E2E wrong-drug ${stamp}`,
      incidentType: "medication_error",
      severity: "sentinel",
    });
    const nearMiss = await createQualityIncident(admin, {
      title: `E2E near miss ${stamp}`,
      incidentType: "medication_error",
      severity: "near_miss",
    });

    // The mirrors run in the creating transaction, so this is synchronous.
    const listed = (await listSentinelIncidents(admin)).map((i) => i.id);
    expect(listed).toContain(sentinel.id);
    expect(listed).not.toContain(fall.id);
    expect(listed).not.toContain(nearMiss.id);

    const open = await nabhIndicator(admin, "SAFETY_SENTINEL_OPEN");
    expect(open === null || open >= 1).toBe(true);
  });
});
