/**
 * The free-revisit window (#296): an administrator sets "7 days, same doctor"
 * on the billing settings screen; a patient seen by a doctor with their own
 * fee pays that fee, and on coming back inside the window gets a bill that
 * charges nothing and says why.
 */
import { api } from "../helpers/api";
import { createPatientApi } from "../helpers/journey-steps";
import { getOpdDept } from "../helpers/seed-resolvers";
import { expect, test } from "./support/world";

test("a revisit inside the window is billed free and the bill says so", async ({ hospital }) => {
  test.setTimeout(120_000);
  const admin = hospital.admin;
  await hospital.setting("billing", "opd_revisit", { days: 0, same_doctor: true });
  const doctor = await hospital.newStaff("doctor", `Revisit ${Date.now().toString(36).slice(-4)}`);
  await api(admin, "PUT", `/api/setup/users/${doctor.id}`, { consultation_fee: 600 });

  const page = await hospital.as("hospital_admin");
  await page.goto("/billing");
  await page.getByRole("tab", { name: "Settings" }).click();
  const card = page.getByRole("form", { name: "Free revisit window" });
  await card.getByRole("textbox", { name: "Days" }).fill("7");
  await card.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/saved|updated/i).first()).toBeVisible();

  const patient = await createPatientApi(admin);
  const department = (await getOpdDept(admin)).id;
  const visit = async () => {
    const res = await api<{ encounter: { id: string }; queue: { id: string } }>(admin, "POST", "/api/opd/encounters", {
      patient_id: patient.id,
      department_id: department,
      doctor_id: doctor.id,
    });
    for (const step of ["call", "start", "complete"]) {
      await api(admin, "PUT", `/api/opd/queue/${res.queue.id}/${step}`);
    }
    const bills = await api<{ invoices: Array<{ id: string }> }>(
      admin,
      "GET",
      `/api/billing/invoices?encounter_id=${res.encounter.id}`,
    );
    return bills.invoices[0].id;
  };

  const paid = await visit();
  await page.goto(`/billing/invoices/${paid}`);
  await expect(page.getByRole("row").filter({ hasText: "OPD consultation — Dr Revisit" })).toContainText("600");

  const free = await visit();
  await page.goto(`/billing/invoices/${free}`);
  const line = page.getByRole("row").filter({ hasText: "Free revisit (day 0 of 7)" });
  await expect(line).toBeVisible();
  await expect(line).toContainText("OPD consultation");
});
