/**
 * A department-scoped nurse lists the ward — the query, not the policy.
 *
 * `GET /api/ipd/admissions` narrows a non-bypass caller to the admissions
 * ReBAC says they may view, with `a.id = ANY($2::uuid[])` as the first
 * condition after the tenant. The array was bound *after* the status filter,
 * so the moment a nurse had one visible admission the parameters swapped and
 * Postgres answered "operator does not exist: text = uuid[]" — a 500 on the
 * one list a ward nurse opens first thing. With no visible admission the
 * scope short-circuits to an empty page, which is why it never showed in a
 * fresh database and why the native Mobile-Nurse "My shift" screen found it.
 *
 * The assertion is shaped for that: the nurse must see *this* admission, in
 * her own department, through the status-filtered list. A 500 or an empty
 * page both fail.
 */

import { expect, test } from "@playwright/test";
import { api, getAuthContextFromCookies, loginAsRoleApi } from "../helpers/api";
import { admitToIpd, createPatientApi, dischargeAdmission } from "../helpers/journey-steps";

interface SetupUserRow {
  id: string;
  department_ids?: string[];
}

interface AdmissionPage {
  admissions: Array<{ id: string }>;
  total: number;
}

test.describe("A scoped nurse's admission list", () => {
  test("lists an admission in her department through the status filter, never a 500", async ({ request }) => {
    const admin = await getAuthContextFromCookies(request);
    const nurse = await loginAsRoleApi(request, "nurse");
    // The run provisions its nurse with a clinical department (e2e-identities);
    // /api/auth/me does not echo it, the setup list does.
    const users = await api<SetupUserRow[]>(admin, "GET", "/api/setup/users");
    const departmentId = users.find((u) => u.id === nurse.userId)?.department_ids?.[0];
    expect(departmentId, "the e2e nurse holds a department, or nothing can be scoped to her").toBeTruthy();

    const patient = await createPatientApi(admin, { firstName: "Scoped", lastName: "Ward" });
    const admissionId = await admitToIpd(admin, { patientId: patient.id, departmentId });
    try {
      const page = await api<AdmissionPage>(nurse, "GET", "/api/ipd/admissions?status=admitted&per_page=100");
      expect(page.admissions.map((a) => a.id), "the nurse sees her department's admission").toContain(admissionId);
      expect(page.total).toBeGreaterThanOrEqual(1);
    } finally {
      await dischargeAdmission(admin, admissionId);
    }
  });
});
