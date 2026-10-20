/**
 * A pharmacist sells stock that has just been received, at the counter, and
 * hands over a receipt.
 *
 * The counter used to grey its button out after a medicine was added: the
 * "Received" box defaulted to zero, so every priced basket was short, and it
 * said nothing about why. Tender now lives in the payment step billing uses,
 * and a held button always says what it is waiting for.
 */
import type { Page } from "@playwright/test";
import { createPatientApi } from "../helpers/journey-steps";
import {
  addByKeyboard,
  expectSaleDone,
  keepSheetsOpen,
  newCounter,
  openCounter,
  openDrawer,
  payCashForThree,
  type Received,
  receiveStock,
  setThreeAndOpenPayment,
} from "./support/pos-counter";
import { expect, test } from "./support/world";

async function expectReceipt(page: Page, done: ReturnType<Page["getByRole"]>, drug: Received) {
  const [sheet] = await Promise.all([
    page.context().waitForEvent("page"),
    done.getByRole("button", { name: "Print receipt" }).click(),
  ]);
  await sheet.waitForLoadState();
  await expect(sheet.getByRole("heading", { name: "Counter receipt" })).toBeVisible();
  await expect(sheet.getByText(drug.name)).toBeVisible();
  await expect(sheet.getByText(drug.batchNumber)).toBeVisible();
}

test("a walk-in buys freshly received stock for cash and gets a receipt", async ({
  hospital,
}) => {
  const drug = await receiveStock(hospital.admin, {
    generic: "Cetirizine",
    schedule: "OTC",
    price: 12,
    quantity: 30,
  });
  // Their own login: a cash drawer belongs to one cashier.
  const counter = await newCounter(hospital.admin);
  const { page } = await hospital.newStaff("pharmacist", "Counter Pharmacist");
  await keepSheetsOpen(page);
  await openCounter(page);

  const takePayment = page.getByRole("button", { name: "Take payment" });
  await expect(takePayment).toBeDisabled();
  await expect(page.getByText("Add a medicine to start the sale.")).toBeVisible();

  await openDrawer(page, counter);
  await addByKeyboard(page, drug);
  const row = page.getByRole("row").filter({ hasText: drug.name });
  await expect(row.getByRole("cell", { name: "30", exact: true })).toBeVisible();

  const done = await payCashForThree(page, drug);
  await expectReceipt(page, done, drug);
});

test("a Schedule H drug sells against the prescription the customer brings; Schedule X never sells at the counter", async ({
  hospital,
}) => {
  const h = await receiveStock(hospital.admin, {
    generic: "Telmisartan",
    schedule: "H",
    price: 8,
    quantity: 10,
  });
  const page = await hospital.as("pharmacist");
  await openCounter(page);
  await addByKeyboard(page, h);

  // Schedule H at the counter (#4865): the prescription's patient is recorded first.
  const takePayment = page.getByRole("button", { name: "Take payment" });
  await expect(takePayment).toBeDisabled();
  await expect(
    page.getByText(
      "Schedule H/H1: pick the patient, or enter their name and mobile from the prescription.",
    ),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Customer" }).fill("Walk In Customer");
  await page.getByRole("textbox", { name: "Phone" }).fill("9876501234");
  await expect(takePayment).toBeEnabled();

  // Schedule X is refused here and named, never greyed out.
  const x = await receiveStock(hospital.admin, {
    generic: "Buprenorphine",
    schedule: "X",
    price: 20,
    quantity: 5,
  });
  await addByKeyboard(page, x);
  await expect(takePayment).toBeDisabled();
  await expect(
    page.getByText(`${x.name} is Schedule X — dispense it against a prescription from the Rx queue.`),
  ).toBeVisible();
});

test("a counter bill is split: part on card, the rest in cash with change", async ({
  hospital,
}) => {
  const drug = await receiveStock(hospital.admin, {
    generic: "Montelukast",
    schedule: "OTC",
    price: 12,
    quantity: 30,
  });
  // Their own login: a cash drawer belongs to one cashier.
  const counter = await newCounter(hospital.admin);
  const { page } = await hospital.newStaff("pharmacist", "Counter Pharmacist");
  await keepSheetsOpen(page);
  await openCounter(page);
  await openDrawer(page, counter);
  await addByKeyboard(page, drug);
  const dialog = await setThreeAndOpenPayment(page, drug);

  // ₹20 on a standalone card machine: the amount, the card tile, the slip's approval code.
  const amount = dialog.getByRole("textbox", { name: /Amount/ });
  await amount.fill("20");
  await dialog.getByRole("radio", { name: /Card/ }).click();
  const addWay = dialog.getByRole("button", { name: "Add another way" });
  // A card part needs its approval code before it can be added.
  await expect(addWay).toBeDisabled();
  await dialog.getByRole("textbox", { name: "Approval code" }).fill("AP4471");
  await addWay.click();
  await expect(dialog.getByTestId("collect-part")).toContainText("₹20.00");

  // ₹16.00 is left for cash; ₹20 handed over leaves ₹4.00 change.
  await expect(dialog.getByTestId("collect-remaining")).toContainText("₹16.00");
  await dialog.getByRole("radio", { name: /Cash/ }).click();
  await dialog.getByRole("textbox", { name: "Cash handed over" }).fill("20");
  await expect(dialog.getByTestId("cash-change")).toHaveText("₹4.00");
  await dialog.getByRole("button", { name: "Collect ₹36.00" }).click();
  await expect(dialog).toBeHidden();

  const done = await expectSaleDone(page, "4.00");
  await expect(done).toContainText("mixed");
  await expectReceipt(page, done, drug);
});

test("a registered patient is found at the counter and gets a GST bill", async ({
  hospital,
}) => {
  const patient = await createPatientApi(hospital.admin);
  const drug = await receiveStock(hospital.admin, {
    generic: "Loratadine",
    schedule: "OTC",
    price: 12,
    quantity: 30,
  });
  // Their own login: a cash drawer belongs to one cashier.
  const counter = await newCounter(hospital.admin);
  const { page } = await hospital.newStaff("pharmacist", "Counter Pharmacist");
  await keepSheetsOpen(page);
  await openCounter(page);
  await openDrawer(page, counter);

  // The counter's own search: name, UHID, age and sex — no chart access.
  const patientBox = page.getByRole("textbox", { name: "Registered patient" });
  await patientBox.fill(patient.uhid);
  await page.getByRole("option", { name: new RegExp(patient.uhid) }).click();
  await expect(page.getByText(/post a paid invoice into Billing/)).toBeVisible();

  await addByKeyboard(page, drug);
  const done = await payCashForThree(page, drug);

  const [sheet] = await Promise.all([
    page.context().waitForEvent("page"),
    done.getByRole("button", { name: "Print GST bill" }).click(),
  ]);
  await sheet.waitForLoadState();
  await expect(sheet.getByRole("heading", { name: "Pharmacy GST bill" })).toBeVisible();
  await expect(sheet.getByText(patient.uhid).first()).toBeVisible();
  await expect(sheet.getByText(drug.batchNumber).first()).toBeVisible();
});
