import { expect, test } from "@playwright/test";
import { api, getAuthContextFromCookies, withStepUp } from "../helpers/api";
import { createEncounter, createPatientApi, createPrescription } from "../helpers/journey-steps";

/**
 * A patient's prescription history, assembled from batched reads.
 *
 * The handler used to fetch each prescription's items and its encounter header
 * one prescription at a time — 101 round trips at the 50-prescription cap. Both
 * are now single `= ANY($1)` reads grouped in memory, and the risk that carries
 * is mis-grouping: items landing under the wrong prescription. One prescription
 * with one item cannot show that, so this builds two with different item counts
 * and checks each entry carries exactly its own.
 */
interface HistoryEntry {
  prescription: { id: string };
  items: Array<{ id: string; prescription_id: string }>;
  encounter_date: string | null;
  doctor_name: string | null;
}

test.describe("OPD prescription history", () => {
  test("each prescription carries exactly its own items", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const patient = await createPatientApi(ctx);
    const encounterId = await createEncounter(ctx, patient.id);

    const first = await createPrescription(ctx, encounterId, { itemCount: 1 });

    // Three lines, three different ingredients — repeating one drug is refused
    // by the therapeutic-duplication check, which is a different rule than the
    // one under test here.
    const signing = ctx.password ? await withStepUp(ctx) : ctx;
    const secondResp = await api<{ prescription: { id: string } }>(
      signing,
      "POST",
      `/api/opd/encounters/${encounterId}/prescriptions`,
      {
        items: ["Amlodipine", "Metformin", "Atorvastatin"].map((drug) => ({
          drug_name: `${drug} e2e-${Date.now()}`,
          dosage: "1 tab",
          frequency: "OD",
          duration: "5 days",
          route: "oral",
        })),
      },
    );
    const second = secondResp.prescription.id;

    const history = await api<HistoryEntry[]>(
      ctx,
      "GET",
      `/api/opd/patients/${patient.id}/prescriptions`,
    );

    const byId = new Map(history.map((h) => [h.prescription.id, h]));
    expect(byId.has(first)).toBe(true);
    expect(byId.has(second)).toBe(true);

    // The grouping assertion: no item may appear under a prescription that is
    // not its parent, and the counts must match what was prescribed.
    for (const entry of history) {
      for (const item of entry.items) {
        expect(item.prescription_id).toBe(entry.prescription.id);
      }
    }
    expect(byId.get(first)?.items).toHaveLength(1);
    expect(byId.get(second)?.items).toHaveLength(3);

    // The encounter header is joined in the same batch; both share an encounter
    // so both must carry its date rather than falling back to created_at.
    expect(byId.get(first)?.encounter_date).toBe(byId.get(second)?.encounter_date);
    expect(byId.get(first)?.encounter_date).toBeTruthy();
  });
});
