/**
 * A patient walks up to the laboratory counter with an outside doctor's
 * prescription: no visit in this hospital, no doctor on its staff.
 *
 * The counter used to send them away — a lab order needed an OPD visit, the
 * patient search was closed to lab staff, and the test search ignored what
 * was typed. Now the lab technician registers the patient, books the tests
 * by the short names on the slip ("hemogram", "LFT"), records the outside
 * doctor, and the bill is raised for the billing desk in one step.
 */
import type { Page } from "@playwright/test";
import { api } from "../helpers/api";
import { expect, freshPerson, test } from "./support/world";

interface CatalogTest {
  id: string;
  code: string;
  name: string;
  price: string;
}

/** Registers the patient from the picker, the way the counter does. */
async function registerAtCounter(page: Page, person: ReturnType<typeof freshPerson>) {
  const patient = page.getByRole("textbox", { name: "Patient" });
  await patient.fill(`${person.firstName} ${person.lastName}`);
  await page.getByRole("button", { name: "Register new patient" }).click();
  const dialog = page.getByRole("dialog", { name: "Register new patient" });
  await dialog.getByRole("textbox", { name: "Phone" }).fill(person.phone);
  const born = new Date();
  born.setFullYear(born.getFullYear() - person.ageYears);
  await dialog.getByLabel("Date of birth").fill(born.toISOString().slice(0, 10));
  await dialog.getByLabel("Sex").click();
  await page.getByRole("option", { name: "Female" }).click();
  await dialog.getByRole("button", { name: "Register & select" }).click();
  await expect(dialog).toBeHidden();
  await expect(patient).toHaveValue(new RegExp(person.firstName));
}

/** Types what is on the slip and picks the catalogue test it should find. */
async function addTest(page: Page, typed: string, test: CatalogTest) {
  const search = page.getByRole("textbox", { name: "Add a test" });
  await search.fill(typed);
  await page.getByRole("option", { name: new RegExp(test.name) }).click();
  await expect(search).toHaveValue("");
  await expect(page.getByRole("row").filter({ hasText: test.name })).toBeVisible();
}

test("a walk-in with an outside prescription is booked and billed at the lab counter", async ({
  hospital,
}) => {
  const [cbc] = await api<CatalogTest[]>(hospital.admin, "GET", "/api/lab/catalog?search=CBC");
  const [lft] = await api<CatalogTest[]>(hospital.admin, "GET", "/api/lab/catalog?search=LFT");
  expect(cbc?.code).toBe("CBC");
  expect(lft?.code).toBe("PROF_LFT");
  if (!cbc || !lft) return;
  const total = (Number(cbc.price) + Number(lft.price)).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
  });

  const page = await hospital.as("lab_technician");
  await page.goto("/lab/orders/new");
  await expect(page.getByRole("radio", { name: "Walk-in (no doctor's order here)" })).toBeChecked();

  const person = freshPerson();
  await registerAtCounter(page, person);

  // "hemogram" is not in the name "Complete Blood Count": it is a short name.
  await addTest(page, "hemogram", cbc);
  await addTest(page, "LFT", lft);
  await expect(page.getByRole("row").filter({ hasText: "Total" })).toContainText(total);

  // An outside doctor with no record yet: name and registration from the slip.
  await page.getByText("Outside doctor", { exact: true }).click();
  const doctor = `Dr. ${person.lastName} Outside`;
  await page.getByRole("textbox", { name: "Doctor's name" }).fill(doctor);
  await page.getByRole("textbox", { name: "Registration no." }).fill(`KMC-${person.phone.slice(-5)}`);

  await page.getByRole("button", { name: "Book tests and raise bill" }).click();

  // A lab technician does not take payment: the bill goes to the billing desk.
  await expect(
    page.getByRole("alert").filter({ hasText: `Bill raised ₹${total} — collect at billing` }),
  ).toBeVisible();
  await expect(page.getByText("2 tests are booked.")).toBeVisible();

  await page.getByRole("button", { name: "Open the order" }).click();
  await page.waitForURL(/\/lab\/orders\/[0-9a-f-]{36}$/);
  const orderId = page.url().split("/").pop() ?? "";
  const detail = await api<{ order: { encounter_id: string } }>(
    hospital.admin,
    "GET",
    `/api/lab/orders/${orderId}`,
  );
  const visit = await api<{ orders: Array<{ test_id: string }> }>(
    hospital.admin,
    "GET",
    `/api/lab/orders?encounter_id=${detail.order.encounter_id}`,
  );
  expect(visit.orders.map((o) => o.test_id).sort()).toEqual([cbc.id, lft.id].sort());

  // The outside doctor is now on file for the next slip from them.
  const onFile = await api<Array<{ name: string }>>(
    hospital.admin,
    "GET",
    "/api/lab/referral-doctors",
  );
  expect(onFile.some((d) => d.name === doctor)).toBe(true);
});
