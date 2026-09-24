import { test, expect } from "@playwright/test";
import { getAuthContextFromCookies, api } from "../helpers/api";
import { admitToIpd, createPatientApi, dischargeAdmission } from "../helpers/journey-steps";

test.describe("IPD admission journey", () => {
  test("admit → fetch → discharge", async ({ request }) => {
    test.info().annotations.push({
      type: "tcms",
      description: "IPD::Admit + bed allocation + discharge",
    });

    const ctx = await getAuthContextFromCookies(request);
    const patient = await createPatientApi(ctx);
    const admissionId = await admitToIpd(ctx, { patientId: patient.id });

    // GET returns { admission, encounter, tasks }
    const admission = async () =>
      (
        await api<{ admission: { id: string; patient_id: string; status: string } }>(
          ctx,
          "GET",
          `/api/ipd/admissions/${admissionId}`,
        )
      ).admission;
    expect(await admission()).toMatchObject({ patient_id: patient.id, status: "admitted" });

    // Discharge is a PUT; the POST this once sent was a 405 hidden in a try/catch.
    await dischargeAdmission(ctx, admissionId);
    expect((await admission()).status).toBe("discharged");
  });

  test("bed dashboard + available beds + admissions list", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const dashboard = await api<unknown>(ctx, "GET", "/api/ipd/bed-dashboard");
    expect(dashboard).toBeTruthy();
    const beds = await api<unknown[]>(ctx, "GET", "/api/ipd/beds/available");
    expect(Array.isArray(beds)).toBe(true);
    const list = await api<unknown>(ctx, "GET", "/api/ipd/admissions");
    expect(list).toBeTruthy();
  });
});
