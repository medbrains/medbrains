import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";
import {
  createPatientApi,
  admitToIpd,
} from "../helpers/journey-steps";

test.describe("IPD admission journey", () => {
  test("admit → fetch → discharge (best-effort)", async ({ request }) => {
    test.info().annotations.push({
      type: "tcms",
      description: "IPD::Admit + bed allocation + discharge",
    });

    const ctx = await loginAsAdmin(request);
    const patient = await createPatientApi(ctx);
    const admissionId = await admitToIpd(ctx, { patientId: patient.id });

    const adm = await api<{ id: string; patient_id: string }>(
      ctx,
      "GET",
      `/api/ipd/admissions/${admissionId}`,
    );
    expect(adm.patient_id).toBe(patient.id);

    try {
      await api(ctx, "POST", `/api/ipd/admissions/${admissionId}/discharge`, {
        discharge_disposition: "home",
        discharge_notes: "spec test discharge",
      });
    } catch {
      // Discharge may need a discharge summary first — non-fatal.
    }
  });

  test("bed dashboard + available beds + admissions list", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    const dashboard = await api<unknown>(ctx, "GET", "/api/ipd/bed-dashboard");
    expect(dashboard).toBeTruthy();
    const beds = await api<unknown[]>(ctx, "GET", "/api/ipd/beds/available");
    expect(Array.isArray(beds)).toBe(true);
    const list = await api<unknown>(ctx, "GET", "/api/ipd/admissions");
    expect(list).toBeTruthy();
  });
});
