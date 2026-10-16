/**
 * DPDP rights desk: a patient asks the front desk to erase their data. The
 * receptionist records it — it is due in 90 days — and shows the patient what
 * the hospital holds. The privacy officer answers from the register: refused
 * for the medical record, with the rule named; a refusal without a reason is
 * not accepted.
 */
import { api } from "../helpers/api";
import { RegistrationDesk } from "./pages/registration-desk";
import { expect, test } from "./support/world";

test("the desk records an erasure request and the privacy officer answers it", async ({ hospital }) => {
  test.setTimeout(90_000);
  const t = Date.now().toString(36).toUpperCase().slice(-6);
  const dept = await hospital.department(`Rights OPD ${t}`);
  const desk = await hospital.newStaff("receptionist", `Desk ${t}`);
  const registration = new RegistrationDesk(desk.page);
  await registration.open();
  await registration.register({
    firstName: "Kavya",
    lastName: `Rights${t}`,
    phone: `95${String(Date.now()).slice(-8)}`,
    sex: "Female",
    ageYears: 37,
    department: dept.name,
  });
  const found = await api<{ patients: Array<{ id: string }> }>(hospital.admin, "GET", `/api/patients?search=Rights${t}`);
  await desk.page.goto(`/patients/${found.patients[0]?.id ?? ""}`);
  const card = desk.page.getByTestId("privacy-requests-card");
  await expect(card).toContainText("No privacy requests.");
  await card.getByRole("button", { name: "New request" }).click();
  const form = desk.page.getByRole("form", { name: "New privacy request" });
  await form.getByRole("combobox", { name: "The patient asks to" }).click();
  await desk.page.getByRole("option", { name: "Erase their data" }).click();
  await form.getByRole("textbox", { name: "In their words" }).fill("Please delete all my records");
  await form.getByRole("button", { name: "Record request" }).click();
  await expect(form).toBeHidden();
  await expect(card).toContainText("Erase their data");
  await expect(card).toContainText(/Due in (89|90) days/);

  await card.getByRole("button", { name: "What we hold" }).click();
  await expect(desk.page.getByTestId("data-summary")).toContainText("staff opened this record");

  const officer = await hospital.newStaff("audit_officer", `Privacy Officer ${t}`);
  await officer.page.goto("/audit");
  await officer.page.getByRole("tab", { name: "Privacy requests" }).click();
  const row = officer.page.getByRole("row").filter({ hasText: `Rights${t}` });
  await row.getByRole("button", { name: "Answer" }).click();
  const answer = officer.page.getByRole("form", { name: "Answer request" });
  await answer.getByText("Refused", { exact: true }).click();
  await answer.getByRole("button", { name: "Record answer" }).click();
  await expect(answer.getByText("Say what was done, or why it is refused")).toBeVisible();
  await answer
    .getByRole("textbox", { name: "Answer to the patient" })
    .fill("Medical records must be kept for 3 years (IMC Regulations 1.3.1); contact details removed.");
  await answer.getByRole("button", { name: "Record answer" }).click();
  await expect(answer).toBeHidden();

  await desk.page.reload();
  await expect(desk.page.getByTestId("privacy-requests-card")).toContainText("refused");
});
