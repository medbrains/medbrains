import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";
import {
  createPatientApi,
  createEncounter,
  createConsultation,
  createPrescription,
} from "../helpers/journey-steps";

test.describe("OPD visit journey", () => {
  test("encounter → consultation → prescription → queue presence", async ({ request }) => {
    test.info().annotations.push({
      type: "tcms",
      description: "OPD::Full visit with consultation + prescription",
    });

    const ctx = await loginAsAdmin(request);
    const patient = await createPatientApi(ctx);
    const encounterId = await createEncounter(ctx, patient.id);

    await createConsultation(ctx, encounterId, {
      chief_complaint: "Persistent dry cough",
      history: "Two-week onset, worse at night",
      examination: "Throat congested, lungs clear",
      plan: "CXR, antitussive, follow-up in 7 days",
    });

    const consultation = await api<{ chief_complaint: string }>(
      ctx,
      "GET",
      `/api/opd/encounters/${encounterId}/consultation`,
    );
    expect(consultation.chief_complaint).toMatch(/cough/i);

    const rxId = await createPrescription(ctx, encounterId);
    expect(rxId).toMatch(/^[0-9a-f-]{36}$/i);

    const queue = await api<unknown[]>(ctx, "GET", "/api/opd/queue");
    expect(Array.isArray(queue)).toBe(true);
  });
});
