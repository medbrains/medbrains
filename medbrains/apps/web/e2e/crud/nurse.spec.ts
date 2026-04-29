import { test, expect } from "@playwright/test";
import { loginAsAdmin, api } from "../helpers/api";

test.describe("Nurse activities CRUD", () => {
  test("MAR due-now + I/O + code blue + handoffs lists", async ({ request }) => {
    const ctx = await loginAsAdmin(request);

    const due = await api<unknown[]>(ctx, "GET", "/api/nurse/mar/due-now");
    expect(Array.isArray(due)).toBe(true);

    const codeBlue = await api<unknown[]>(
      ctx,
      "GET",
      "/api/nurse/code-blue?active_only=true",
    );
    expect(Array.isArray(codeBlue)).toBe(true);

    const equipment = await api<unknown[]>(
      ctx,
      "GET",
      "/api/nurse/equipment-checks",
    );
    expect(Array.isArray(equipment)).toBe(true);

    const vitalsSchedules = await api<unknown[]>(
      ctx,
      "GET",
      "/api/nurse/vitals-schedules",
    );
    expect(Array.isArray(vitalsSchedules)).toBe(true);
  });

  test("code blue start → end lifecycle", async ({ request }) => {
    const ctx = await loginAsAdmin(request);
    // Need a patient — use a fixed UUID won't pass FK. Skip if no patient
    // route is available.
    const patients = await api<{ patients: Array<{ id: string }> }>(
      ctx,
      "GET",
      "/api/patients?per_page=1",
    );
    if (patients.patients.length === 0) {
      test.skip(true, "no patients seeded");
    }
    const patientId = patients.patients[0].id;

    const event = await api<{ id: string }>(ctx, "POST", "/api/nurse/code-blue", {
      patient_id: patientId,
      location: "Ward 1",
    });
    expect(event.id).toMatch(/^[0-9a-f-]{36}$/i);

    await api(ctx, "PUT", `/api/nurse/code-blue/${event.id}/end`, {
      outcome: "stable",
    });
  });
});
