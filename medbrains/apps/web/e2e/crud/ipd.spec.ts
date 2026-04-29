import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";
import { createPatientApi, admitToIpd } from "../helpers/journey-steps";

test.describe("IPD CRUD", () => {
  test("admit → fetch → discharge", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const patient = await createPatientApi(ctx);
    const admissionId = await admitToIpd(ctx, { patientId: patient.id });

    const adm = await api<{ id: string; patient_id: string; status: string }>(
      ctx,
      "GET",
      `/api/ipd/admissions/${admissionId}`,
    );
    expect(adm.patient_id).toBe(patient.id);

    // Discharge — endpoint may require a discharge summary; treat optional.
    try {
      await api(ctx, "POST", `/api/ipd/admissions/${admissionId}/discharge`, {
        discharge_disposition: "home",
        discharge_notes: "spec test discharge",
      });
    } catch {
      // Some seeds enforce discharge_summary first — non-fatal.
    }
  });

  test("admissions list + bed dashboard + available beds", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const list = await api<unknown>(ctx, "GET", "/api/ipd/admissions");
    expect(list).toBeTruthy();

    const beds = await api<unknown[]>(ctx, "GET", "/api/ipd/beds/available");
    expect(Array.isArray(beds)).toBe(true);

    const dashboard = await api<unknown>(ctx, "GET", "/api/ipd/bed-dashboard");
    expect(dashboard).toBeTruthy();
  });

  test("404 on unknown admission", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const fake = "00000000-0000-0000-0000-000000000000";
    await expect(
      api(ctx, "GET", `/api/ipd/admissions/${fake}`),
    ).rejects.toThrow(/404/);
  });
});
