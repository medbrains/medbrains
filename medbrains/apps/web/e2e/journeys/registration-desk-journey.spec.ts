/**
 * The front desk's day, end to end, as two receptionists on two shifts:
 *
 *   the morning desk registers a new patient → reads out the UHID → lands on
 *   the patient's record, not the doctor's visit → prints the patient card →
 *   the evening desk, who never met this patient, finds them by phone and by
 *   UHID in the hospital register → reprints the card.
 *
 * Every person is new staff provisioned by the administrator for this test,
 * so nobody inherits a relationship with the patient from an earlier run.
 * Starting data (the department) goes through the API; every step the
 * journey is about is a click.
 */
import type { Page } from "@playwright/test";
import { E2E_BACKEND_URL } from "../helpers/api";
import { RegistrationDesk } from "./pages/registration-desk";
import { expectScreenAccessible } from "./support/a11y";
import { expect, freshPerson, test } from "./support/world";

/** The card window prints and closes itself; the test stands in for the printer. */
async function standInForPrinter(page: Page): Promise<void> {
  await page.context().addInitScript(() => {
    window.print = () => undefined;
    window.close = () => undefined;
  });
}

/** Presses a print control and returns the card window it opens. */
async function printCard(page: Page, press: () => Promise<void>): Promise<Page> {
  const opened = page.waitForEvent("popup");
  await press();
  const card = await opened;
  await card.waitForLoadState("domcontentloaded");
  return card;
}

async function expectCard(card: Page, uhid: string, name: string): Promise<void> {
  await expect(card.locator(".uhid")).toHaveText(uhid);
  await expect(card.locator(".name")).toContainText(name);
}

test("the desk registers a patient, prints the card, and the next shift finds and reprints it", async ({
  hospital,
}) => {
  test.setTimeout(240_000);
  const dept = await hospital.department("Desk OPD");
  const person = freshPerson();
  const fullName = `${person.firstName} ${person.lastName}`;

  // Morning shift.
  const morning = await hospital.newStaff("receptionist", "Morning Desk");
  await standInForPrinter(morning.page);
  const desk = new RegistrationDesk(morning.page);
  await desk.open();
  await desk.register({ ...person, sex: "Female", department: dept.name });
  const toast = morning.page.getByText(/UHID: \S+/).first();
  await expect(toast).toBeVisible({ timeout: 15_000 });
  const uhid = (await toast.innerText()).match(/UHID: (\S+?)(?: ·|$)/)?.[1] ?? "";
  expect(uhid, "the desk reads out a UHID").not.toBe("");

  // The desk queues the visit but does not work it: registration lands on the
  // patient's record, where the card is printed, not on the doctor's workup.
  await expect(morning.page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);
  const patientId = new URL(morning.page.url()).pathname.split("/").pop() ?? "";
  await expect(morning.page.getByText(uhid).first()).toBeVisible();
  await expectScreenAccessible(morning.page, "patient-record");
  const printed = await printCard(morning.page, () =>
    morning.page.getByRole("button", { name: "Print Card", exact: true }).click(),
  );
  await expectCard(printed, uhid, fullName);

  // Evening shift: a receptionist who has never seen this patient. The
  // directory lists only their own patients; the hospital register below it
  // finds everyone, identity only.
  const evening = await hospital.newStaff("receptionist", "Evening Desk");
  await standInForPrinter(evening.page);
  const page = evening.page;
  await page.goto("/patients");
  const register = page.getByRole("region", { name: "In the hospital register" });
  for (const told of [person.phone, uhid]) {
    await page.getByRole("textbox", { name: "Search patients by UHID, name or phone" }).fill(told);
    await expect(register.getByRole("row").filter({ hasText: uhid }), `found by ${told}`).toHaveCount(
      1,
      { timeout: 15_000 },
    );
  }
  await expect(register.getByRole("row").filter({ hasText: uhid })).toContainText(fullName);
  await expectScreenAccessible(page, "patient-directory");
  const reprinted = await printCard(page, () =>
    register.getByRole("button", { name: `Print card for ${uhid}` }).click(),
  );
  await expectCard(reprinted, uhid, fullName);

  // The reprint is the desk's grant, not a way round the record: a lab
  // technician can look the patient up, but cannot print their card.
  const lab = await hospital.newStaff("lab_technician", "Lab Bench");
  const refused = await lab.page.request.get(
    `${E2E_BACKEND_URL}/api/print-data/patient-card/${patientId}`,
  );
  expect([403, 404], "no card without the reprint grant or a relationship").toContain(
    refused.status(),
  );
});
