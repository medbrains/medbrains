/**
 * BME breakdown → equipment status.
 *
 * A breakdown is recorded in one place and the machine's availability lives
 * in another. The linkage takes active kit out of the pool the moment
 * somebody reports it broken — and leaves alone anything already out of it.
 * A breakdown logged against a condemned asset must not quietly promote it
 * back into the maintenance pool.
 *
 * Table half — the outbox row and the NABH downtime mirror — in
 * crates/medbrains-server/tests/linkage_safety_test.rs.
 */

import { expect, test } from "@playwright/test";
import { expectAbsent, getAuthContextFromCookies, pollUntil } from "../helpers/api";
import { createBmeEquipment, createBreakdown, getBmeEquipment } from "../helpers/journey-steps";

test.describe("A breakdown takes active equipment out of service", () => {
  test("active → under_maintenance; condemned stays condemned", async ({ request }) => {
    const admin = await getAuthContextFromCookies(request);
    const stamp = Date.now().toString(36);

    const ventilator = await createBmeEquipment(admin, { name: `E2E Ventilator ${stamp}`, status: "active" });
    await createBreakdown(admin, { equipmentId: ventilator.id, description: "E2E: no tidal volume" });
    const locked = await pollUntil(
      () => getBmeEquipment(admin, ventilator.id),
      (e) => e.status === "under_maintenance",
      { label: "equipment taken out of service" },
    );
    expect(locked.status).toBe("under_maintenance");

    const condemned = await createBmeEquipment(admin, { name: `E2E Condemned ${stamp}`, status: "condemned" });
    await createBreakdown(admin, { equipmentId: condemned.id, description: "E2E: reported anyway" });
    await expectAbsent(() => getBmeEquipment(admin, condemned.id), (e) => e.status !== "condemned", {
      label: "condemned kit changing status",
    });
  });
});
