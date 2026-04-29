import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";
import {
  createPatientApi,
  createEncounter,
  createConsultation,
  createPrescription,
} from "../helpers/journey-steps";

test.describe("OPD CRUD", () => {
  test("encounter → consultation → prescription lifecycle", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const patient = await createPatientApi(ctx);
    const encounterId = await createEncounter(ctx, patient.id);
    expect(encounterId).toMatch(/^[0-9a-f-]{36}$/i);

    const enc = await api<{ id: string; patient_id: string; status: string }>(
      ctx,
      "GET",
      `/api/opd/encounters/${encounterId}`,
    );
    expect(enc.patient_id).toBe(patient.id);

    await createConsultation(ctx, encounterId);
    const cons = await api<{ id: string }>(
      ctx,
      "GET",
      `/api/opd/encounters/${encounterId}/consultation`,
    );
    expect(cons.id).toBeTruthy();

    const rxId = await createPrescription(ctx, encounterId);
    expect(rxId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test("queue list returns array", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const queue = await api<unknown[]>(ctx, "GET", "/api/opd/queue");
    expect(Array.isArray(queue)).toBe(true);
  });

  test("404 on unknown encounter id", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const fake = "00000000-0000-0000-0000-000000000000";
    await expect(
      api(ctx, "GET", `/api/opd/encounters/${fake}`),
    ).rejects.toThrow(/404/);
  });
});
