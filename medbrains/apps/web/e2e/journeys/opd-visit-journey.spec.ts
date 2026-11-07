/**
 * An OPD visit, end to end, each person on their own screen as their own role:
 *
 *   the front desk registers the patient and reads out the token → the nurse
 *   records vitals → the doctor calls the patient, writes the note, records a
 *   diagnosis, prescribes and orders a lab test → the doctor closes the visit.
 *
 * Everyone is new staff provisioned by the administrator for this test.
 * Starting data (the department) goes through the API; every step the journey
 * is about is a click.
 */
import type { Page } from "@playwright/test";
import { api } from "../helpers/api";
import { OpdWorklist } from "./pages/opd-worklist";
import { RegistrationDesk } from "./pages/registration-desk";
import { expectScreenAccessible } from "./support/a11y";
import { expect, freshPerson, test } from "./support/world";

/**
 * Every read this page sends that the server refuses. A screen must not ask
 * for what its user may not see (ENGINEERING.md, authorization rule 8): a
 * refused read is either a missing gate or a promise the screen cannot keep.
 * A step-up challenge also answers 403 (`step_up_required`): that is the
 * server asking the user to confirm it's them, not a refusal.
 */
function watchRefusals(page: Page): string[] {
  const refused: string[] = [];
  page.on("response", async (response) => {
    const url = new URL(response.url());
    if (response.status() !== 403 || !url.pathname.startsWith("/api/")) return;
    const body = await response.text().catch(() => "");
    if (body.includes("step_up_required")) return;
    refused.push(`${response.request().method()} ${url.pathname}`);
  });
  return refused;
}

test("a patient is registered, has vitals taken, is seen, prescribed and tested, and the visit closes", async ({
  hospital,
}) => {
  test.setTimeout(300_000);
  const dept = await hospital.department("Journey OPD");
  const doctor = await hospital.colleague(dept);
  const nurse = await hospital.newStaff("nurse", "Ward Nurse", undefined, [dept.id]);
  const doctorRefused = watchRefusals(doctor.page);
  const nurseRefused = watchRefusals(nurse.page);
  const person = freshPerson();

  // Front desk.
  const deskStaff = await hospital.newStaff("receptionist", "Front Desk");
  const deskRefused = watchRefusals(deskStaff.page);
  const desk = new RegistrationDesk(deskStaff.page);
  await desk.open();
  await desk.register({
    ...person,
    sex: "Male",
    department: dept.name,
    consultant: doctor.fullName,
  });
  const toast = deskStaff.page.getByText(/UHID: \S+ · token \S+/).first();
  await expect(toast).toBeVisible({ timeout: 15_000 });
  const [, uhid, token] = (await toast.innerText()).match(/UHID: (\S+) · token (\S+)/) ?? [];
  expect(uhid, "the desk reads out a UHID").toBeTruthy();

  // Nurse.
  const ward = new OpdWorklist(nurse.page);
  await ward.open(dept.name);
  const row = await ward.row(uhid ?? "");
  await expect(row, "the queue shows the token the desk read out").toContainText(token ?? "");
  await expectScreenAccessible(nurse.page, "opd-worklist");
  await row.getByRole("button", { name: "Record vitals" }).click();
  await expect(nurse.page.getByText("Record OPD vitals")).toBeVisible();
  await expect(
    nurse.page.getByText(new RegExp(`Token ${token}`)).first(),
    "the vitals screen names the same token",
  ).toBeVisible();
  await expectScreenAccessible(nurse.page, "opd-vitals");
  await nurse.page.getByRole("textbox", { name: "Systolic (high)" }).fill("128");
  await nurse.page.getByRole("textbox", { name: "Diastolic (low)" }).fill("84");
  await nurse.page.getByTestId("vital-temperature").fill("37.0");
  await nurse.page.getByTestId("vital-pulse").fill("78");
  await nurse.page.getByTestId("vital-spo2").fill("98");
  await nurse.page.getByTestId("vital-respiratory_rate").fill("16");
  await nurse.page.getByTestId("vital-weight").fill("70");
  await nurse.page.getByRole("button", { name: "Record vitals" }).last().click();
  // Back on the worklist, the row now carries the reading.
  await expect(nurse.page).toHaveURL(/\/opd$/, { timeout: 15_000 });
  // The queue says in words that the vitals are taken.
  await expect((await ward.row(uhid ?? "")).getByText("Vitals taken")).toBeVisible();

  // Doctor.
  const clinic = new OpdWorklist(doctor.page);
  await clinic.open(dept.name);
  await clinic.act(uhid ?? "", "call_patient");
  await clinic.act(uhid ?? "", "start_consultation");
  await (await clinic.row(uhid ?? "")).getByRole("button", { name: "Open OPD visit" }).click();
  await expect(doctor.page).toHaveURL(/\/opd\/encounters\//, { timeout: 15_000 });
  await expectScreenAccessible(doctor.page, "opd-visit");
  const visit = doctor.page;
  // The nurse's reading is in front of the doctor.
  await visit.getByRole("tab", { name: "Vitals" }).click();
  await expect(visit.getByRole("tabpanel", { name: "Vitals" })).toContainText("128");
  await expectScreenAccessible(visit, "opd-visit-vitals");

  // The note.
  await visit.getByRole("tab", { name: "Consultation" }).click();
  await visit.getByRole("button", { name: "New note" }).click();
  await visit.getByRole("menuitem", { name: "Consultation", exact: true }).click();
  await visit.getByRole("textbox", { name: "Plan", exact: true }).click();
  await visit.keyboard.type("Paracetamol for fever, CBC today, review in three days");
  await visit.getByRole("button", { name: "Sign", exact: true }).click();
  await expect(visit.getByText(/Signed \w+ \d/).first()).toBeVisible({ timeout: 15_000 });

  // The diagnosis.
  await visit.getByRole("tab", { name: "Diagnoses" }).click();
  await expectScreenAccessible(visit, "opd-visit-diagnoses");
  const diagnoses = visit.getByRole("tabpanel", { name: "Diagnoses" });
  // Local runs have no WHO ICD-11 service; the screen says so and asks for
  // the diagnosis in words rather than offering nothing.
  await diagnoses.getByRole("textbox", { name: "Diagnosis description" }).fill("Acute febrile illness");
  await diagnoses.getByRole("button", { name: "Add" }).click();
  await expect(diagnoses.getByText("Acute febrile illness").first()).toBeVisible();

  // The prescription.
  await visit.getByRole("tab", { name: "Prescriptions" }).click();
  // The search is a combobox: its matches are a listbox, and Enter adds the
  // highlighted one without a mouse.
  const search = visit.getByRole("textbox", { name: "Search formulary" });
  await search.fill("Paracetamol 500");
  const matches = visit.getByRole("listbox", { name: "Formulary matches" });
  await expect(matches.getByRole("option", { name: /^Paracetamol 500mg/ })).toBeVisible();
  await search.press("Enter");
  await expectScreenAccessible(visit, "opd-visit-prescriptions");
  const rx = visit.getByRole("row").filter({ hasText: "Paracetamol 500mg" });
  await rx.getByText("TID", { exact: true }).click();
  await expect(rx.getByRole("radio", { name: "TID" })).toBeChecked();
  await visit.getByRole("button", { name: "Sign & save" }).click();
  const confirm = visit.getByRole("dialog", { name: "Confirm it's you" });
  await confirm.getByLabel("Password").fill(doctor.password);
  await confirm.getByRole("button", { name: "Confirm" }).click();
  await expect(confirm).toBeHidden({ timeout: 15_000 });

  // The lab order.
  await visit.getByRole("tab", { name: "Investigations" }).click();
  await visit.getByRole("button", { name: "Order Investigation" }).click();
  const order = visit.getByRole("dialog", { name: "Order Investigation" });
  await order.getByRole("combobox", { name: "Lab Test" }).fill("Complete Blood");
  await visit.getByRole("option", { name: /Complete Blood Count/ }).first().click();
  await order.getByRole("button", { name: "Place Order" }).click();
  await expect(order).toBeHidden({ timeout: 15_000 });
  await expect(
    visit.getByRole("tabpanel", { name: "Investigations" }).getByText("Complete Blood Count").first(),
  ).toBeVisible();
  await expectScreenAccessible(visit, "opd-visit-investigations");

  // The desk opens the visit from the patient's record, as it does to answer
  // "has the doctor seen him?". It sees the visit; it asks for nothing it may not see.
  await deskStaff.page.goto("/patients");
  await deskStaff.page
    .getByRole("textbox", { name: "Search patients by UHID, name or phone" })
    .fill(uhid ?? "");
  await deskStaff.page
    .getByRole("row")
    .filter({ hasText: uhid ?? "" })
    .getByRole("button", { name: "Full profile" })
    .click();
  await deskStaff.page.getByRole("button", { name: "OPD", exact: true }).click();
  await expect(deskStaff.page).toHaveURL(/\/opd\/encounters\//);
  await expectScreenAccessible(deskStaff.page, "opd-visit-desk");
  expect(deskRefused, "the desk's screens ask only for what it may see").toEqual([]);

  // The doctor closes the visit from the queue.
  await clinic.open(dept.name);
  await clinic.act(uhid ?? "", "complete_visit");
  await expect(doctor.page.getByTestId(`row-patient-${uhid}`)).toContainText("Completed", {
    timeout: 15_000,
  });

  expect(nurseRefused, "the nurse's screens ask only for what she may see").toEqual([]);
  expect(doctorRefused, "the doctor's screens ask only for what he may see").toEqual([]);
});

test("the desk starts today's visit for a returning patient it never registered", async ({
  hospital,
}) => {
  test.setTimeout(180_000);
  const dept = await hospital.department("Return OPD");
  const person = freshPerson();
  // Registered on an earlier day by someone else: starting data.
  const patient = await api<{ id: string; uhid: string }>(hospital.admin, "POST", "/api/patients", {
    first_name: person.firstName,
    last_name: person.lastName,
    gender: "female",
    date_of_birth: "1985-04-02",
    phone: person.phone,
  });

  const desk = await hospital.newStaff("receptionist", "Evening Desk");
  const deskRefused = watchRefusals(desk.page);
  await desk.page.goto("/opd");
  await desk.page.getByRole("button", { name: "New visit" }).click();
  await expect(desk.page).toHaveURL(/\/opd\/new/);
  await expect(desk.page.getByText("New OPD visit")).toBeVisible();
  const patientSearch = desk.page.getByRole("textbox", { name: "Patient" });
  await patientSearch.fill(patient.uhid);
  await expect(patientSearch).toHaveValue(patient.uhid);
  await desk.page.getByRole("option", { name: new RegExp(patient.uhid) }).click();
  const department = desk.page.getByRole("combobox", { name: "Department" });
  await expect(desk.page.getByText("First OPD visit.")).toBeVisible();
  await expect(department, "no error before the desk has chosen").not.toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await department.fill(dept.name);
  await desk.page.getByRole("option", { name: dept.name, exact: true }).click();
  await expectScreenAccessible(desk.page, "opd-new-visit");
  await desk.page.getByRole("button", { name: "Create Visit" }).click();

  // The desk reads the number out and stays on the queue it is filling.
  await expect(desk.page.getByText(/^Token \S+$/).first()).toBeVisible({ timeout: 15_000 });
  await expect(desk.page).toHaveURL(/\/opd$/);
  expect(deskRefused, "the desk's screens ask only for what it may see").toEqual([]);
});
