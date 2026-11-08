/**
 * The paper file follows the patient, and the doctor does not wait for it:
 *
 *   the desk starts the visit of a returning patient whose file is on an MRD
 *   shelf → the request appears in the records room's queue with the shelf
 *   and the clinic → the runner scans it at the shelf, then at the clinic →
 *   the doctor's consultation shows "File: arrived", and the digital summary
 *   was there before it did.
 *
 * Starting data (the department, the patient, the shelf and the file) goes
 * through the API; every step the journey is about is a click.
 */
import { api } from "../helpers/api";
import { OpdWorklist } from "./pages/opd-worklist";
import { expectScreenAccessible } from "./support/a11y";
import { expect, freshPerson, test } from "./support/world";

test("a registered visit asks for its file, the runner delivers it, and the doctor sees it arrive", async ({
  hospital,
}) => {
  test.setTimeout(240_000);
  const dept = await hospital.department("File OPD");
  const doctor = await hospital.colleague(dept);
  const person = freshPerson();
  const patient = await api<{ id: string; uhid: string }>(hospital.admin, "POST", "/api/patients", {
    first_name: person.firstName,
    last_name: person.lastName,
    gender: "female",
    date_of_birth: "1979-06-12",
    phone: person.phone,
  });
  const shelf = `J-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  await api(hospital.admin, "POST", "/api/mrd/storage-locations", {
    code: shelf,
    name: `Journey rack ${shelf}`,
    room: "Records",
    rack: "4",
    shelf: "C",
    bin: "2",
  });
  const file = await api<{ record_number: string }>(hospital.admin, "POST", "/api/mrd/records", {
    patient_id: patient.id,
    shelf_location: shelf,
  });

  // The desk starts today's visit.
  const desk = await hospital.newStaff("receptionist", "File Desk");
  await desk.page.goto("/opd");
  await desk.page.getByRole("button", { name: "New visit" }).click();
  await expect(desk.page.getByText("New OPD visit")).toBeVisible();
  const patientSearch = desk.page.getByRole("textbox", { name: "Patient" });
  await expect(async () => {
    await patientSearch.fill(patient.uhid);
    await expect(patientSearch).toHaveValue(patient.uhid, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await desk.page.getByRole("option", { name: new RegExp(patient.uhid) }).click();
  const department = desk.page.getByRole("combobox", { name: "Department" });
  await department.fill(dept.name);
  await desk.page.getByRole("option", { name: dept.name, exact: true }).click();
  const doctorPick = desk.page.getByRole("textbox", { name: "Doctor" });
  await doctorPick.fill(doctor.fullName);
  await desk.page.getByRole("option", { name: new RegExp(doctor.fullName) }).first().click();
  await desk.page.getByRole("button", { name: "Create Visit" }).click();
  await expect(desk.page.getByText(/^Token \S+$/).first()).toBeVisible({ timeout: 15_000 });

  // The records room: the request is waiting, with the shelf and the clinic.
  const runner = await hospital.newStaff("mrd_officer", "File Runner");
  await runner.page.setViewportSize({ width: 390, height: 844 });
  await runner.page.goto("/mrd#file-requests");
  const card = runner.page
    .getByTestId("mrd-file-request")
    .filter({ hasText: file.record_number });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card).toContainText("Records / Rack 4 / Shelf C / Bin 2");
  await expect(card).toContainText(`To ${doctor.fullName}, ${dept.name}`);
  await expect(card).toContainText(/min left/);
  await expectScreenAccessible(runner.page, "mrd-file-requests");

  // Picked at the shelf: the wrong folder is refused first.
  await card.getByRole("button", { name: "Scan at shelf" }).click();
  const scan = runner.page.getByRole("dialog", { name: "Scan at the shelf" });
  await scan.getByLabel("File barcode").fill("NOT-THIS-FILE");
  await scan.getByRole("button", { name: "Picked up" }).click();
  await expect(scan.getByText(/not the requested file/)).toBeVisible();
  await scan.getByLabel("File barcode").fill(file.record_number);
  await scan.getByRole("button", { name: "Picked up" }).click();
  await expect(scan).toBeHidden({ timeout: 15_000 });
  await expect(card).toContainText("On the way");

  // The doctor starts before the file arrives.
  const clinic = new OpdWorklist(doctor.page);
  await clinic.open(dept.name);
  await clinic.act(patient.uhid, "call_patient");
  await clinic.act(patient.uhid, "start_consultation");
  await (await clinic.row(patient.uhid)).getByRole("button", { name: "Open OPD visit" }).click();
  await expect(doctor.page).toHaveURL(/\/opd\/encounters\//, { timeout: 15_000 });
  const panel = doctor.page.getByTestId("visit-file-panel");
  await expect(panel.getByTestId("visit-file-chip")).toHaveText("File: on the way");
  await expect(panel).toContainText("Allergies");

  // Delivered at the clinic.
  await card.getByRole("button", { name: "Scan at clinic" }).click();
  const deliver = runner.page.getByRole("dialog", { name: "Scan at the clinic" });
  await deliver.getByLabel("File barcode").fill(file.record_number);
  await deliver.getByRole("button", { name: "Delivered" }).click();
  await expect(deliver).toBeHidden({ timeout: 15_000 });
  await expect(card, "a delivered file leaves the queue").toBeHidden({ timeout: 20_000 });

  await doctor.page.reload();
  await expect(panel.getByTestId("visit-file-chip")).toHaveText("File: arrived", {
    timeout: 15_000,
  });
  await expectScreenAccessible(doctor.page, "opd-visit-file-arrived");
});
