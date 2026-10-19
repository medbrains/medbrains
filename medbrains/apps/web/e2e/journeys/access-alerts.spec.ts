/**
 * An access alert reaches a person who acts on it. The scan that raises them
 * runs every five minutes on the server, so the starting data is the alert
 * it would raise — a record opened at night by someone not on shift — written
 * the way the scan writes it. The audit officer reviews it from the screen;
 * their note is added to what happened, not written over it.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createPatientApi } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

const COMPOSE_DIR = fileURLToPath(new URL("../../../../", import.meta.url));
const UUID = /^[0-9a-f-]{36}$/;

function raiseAfterHoursAlert(userId: string, patientId: string): void {
  if (!UUID.test(userId) || !UUID.test(patientId)) throw new Error("not uuids");
  const sql =
    "INSERT INTO access_alerts (tenant_id, patient_id, user_id, access_type, module, notes) " +
    `SELECT tenant_id, '${patientId}', '${userId}', 'after_hours', 'patients', ` +
    "'Opened at 23:14 with no shift clocked in' FROM users WHERE id = " +
    `'${userId}'`;
  execFileSync(
    "docker",
    ["compose", "exec", "-T", "postgres", "psql", "-U", "medbrains", "-d", "medbrains", "-c", sql],
    { cwd: COMPOSE_DIR, encoding: "utf8" },
  );
}

test("the audit officer reviews an after-hours access alert", async ({ hospital }) => {
  test.setTimeout(90_000);
  const t = Date.now().toString(36).toUpperCase().slice(-6);
  const patient = await createPatientApi(hospital.admin, { firstName: "Night", lastName: `Alert${t}` });
  const doctor = await hospital.newStaff("doctor", `Dr Night ${t}`);
  raiseAfterHoursAlert(doctor.id, patient.id);

  const officer = await hospital.newStaff("audit_officer", `Auditor ${t}`);
  await officer.page.goto("/audit");
  await officer.page.getByRole("tab", { name: "Access alerts" }).click();
  const row = officer.page.getByRole("row").filter({ hasText: `Dr Night ${t}` });
  await expect(row).toContainText("Opened after hours");
  await expect(row).toContainText("Opened at 23:14 with no shift clocked in");
  await row.getByRole("button", { name: "Review" }).click();

  const dialog = officer.page.getByRole("dialog", { name: "Review access alert" });
  await dialog.getByRole("textbox", { name: "What you found" }).fill("On-call cover, rota not updated");
  await dialog.getByRole("button", { name: "Mark reviewed" }).click();
  await expect(dialog).toBeHidden();
  // Reviewed alerts leave the to-review list and keep both notes.
  await expect(row).toBeHidden();
  await officer.page
    .getByRole("tabpanel", { name: "Access alerts" })
    .getByText("All", { exact: true })
    .click();
  const reviewed = officer.page.getByRole("row").filter({ hasText: `Dr Night ${t}` });
  await expect(reviewed).toContainText("Reviewed: On-call cover, rota not updated");
  await expect(reviewed).toContainText("Opened at 23:14 with no shift clocked in");
});
