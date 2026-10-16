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
import type { AuthContext } from "../helpers/api";
import { api } from "../helpers/api";
import { createPatientApi } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

/** The sheet prints itself and closes on load; keep it open to read it. */
async function keepSheetsOpen(page: Page) {
  await page.context().addInitScript(() => {
    window.print = () => undefined;
    window.close = () => undefined;
  });
}

function nextYear(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

interface Received {
  name: string;
  batchNumber: string;
  stamp: string;
}

/** A new medicine and a batch of it, received the way stock intake posts it. */
async function receiveStock(
  admin: AuthContext,
  opts: { generic: string; schedule: string; price: number; quantity: number },
): Promise<Received> {
  const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const name = `Counter ${opts.generic} ${stamp}`;
  const batchNumber = `POS-${stamp}`;
  const drug = await api<{ id: string }>(admin, "POST", "/api/pharmacy/catalog", {
    code: `E2E-POS-${stamp}`,
    name,
    generic_name: opts.generic,
    unit: "tablet",
    base_price: opts.price,
    tax_percent: 5,
    current_stock: 0,
    reorder_level: 5,
    drug_schedule: opts.schedule,
    is_controlled: false,
    formulary_status: "approved",
    is_lasa: false,
    batch_tracking_required: true,
  });
  await api(admin, "POST", "/api/pharmacy/batches", {
    catalog_item_id: drug.id,
    batch_number: batchNumber,
    expiry_date: nextYear(),
    quantity_received: opts.quantity,
    selling_rate: opts.price,
  });
  return { name, batchNumber, stamp };
}

async function openCounter(page: Page) {
  await page.goto("/pharmacy");
  await page.getByRole("tab", { name: "POS Counter" }).click();
}

/** Search, pick with the keyboard, and land back in the search box. */
async function addByKeyboard(page: Page, drug: Received) {
  const search = page.getByRole("textbox", { name: "Add medicine" });
  await search.fill(drug.stamp);
  await expect(page.getByRole("option", { name: new RegExp(drug.name) })).toBeVisible();
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
}

/** Cash goes into a drawer: open one from the counter. */
async function openDrawer(page: Page) {
  const strip = page.getByTestId("counter-drawer");
  await expect(strip).toContainText("No cash drawer is open");
  await strip.getByRole("button", { name: "Open drawer" }).click();
  const dialog = page.getByRole("dialog", { name: "Open cash drawer" });
  await dialog.getByRole("combobox", { name: "Pharmacy location" }).click();
  await page.getByRole("option").first().click();
  await dialog.getByRole("textbox", { name: "Opening float (₹)" }).fill("500");
  await dialog.getByRole("button", { name: "Open", exact: true }).click();
  await expect(strip).toContainText("Drawer open since");
}

/**
 * Three tablets at MRP ₹12. MRP includes GST, so the bill is ₹36.00 — never
 * ₹37.80 with 5% added on top. Paid ₹50 cash: ₹14.00 back.
 */
async function setThreeAndOpenPayment(page: Page, drug: Received) {
  const takePayment = page.getByRole("button", { name: "Take payment" });
  const quantity = page.getByRole("textbox", { name: `Quantity of ${drug.name}` });
  await quantity.fill("31");
  await expect(
    page.getByText(`Only 30 of ${drug.name} in stock — lower the quantity.`),
  ).toBeVisible();
  await expect(takePayment).toBeDisabled();

  await quantity.fill("3");
  await expect(page.getByTestId("pos-total")).toContainText("36.00");
  await expect(page.getByText(/incl\. GST ₹1\.71/)).toBeVisible();
  await expect(takePayment).toBeEnabled();
  // Enter from the basket goes straight to payment.
  await quantity.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Collect Payment" });
  await expect(dialog).toBeVisible();
  // Counter tenders only — a gateway order needs a record the sale is not yet.
  await expect(dialog.getByText("Online")).toHaveCount(0);
  return dialog;
}

/** The sale went through: its number, the change, focus back on the search. */
async function expectSaleDone(page: Page, change: string) {
  const done = page.getByRole("alert").filter({ hasText: /Sale PH-SALE-\w+ recorded/ });
  await expect(done).toBeVisible();
  await expect(done).toContainText("change due");
  await expect(done).toContainText(change);
  await expect(page.getByRole("textbox", { name: "Add medicine" })).toBeFocused();
  return done;
}

async function payCashForThree(page: Page, drug: Received) {
  const dialog = await setThreeAndOpenPayment(page, drug);
  await dialog.getByRole("textbox", { name: "Cash Received" }).fill("50");
  await expect(dialog.getByText("₹14.00")).toBeVisible();
  await dialog.getByRole("button", { name: "Record Cash Payment" }).click();
  await expect(dialog).toBeHidden();
  return expectSaleDone(page, "14.00");
}

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
  const { page } = await hospital.newStaff("pharmacist", "Counter Pharmacist");
  await keepSheetsOpen(page);
  await openCounter(page);

  const takePayment = page.getByRole("button", { name: "Take payment" });
  await expect(takePayment).toBeDisabled();
  await expect(page.getByText("Add a medicine to start the sale.")).toBeVisible();

  await openDrawer(page);
  await addByKeyboard(page, drug);
  const row = page.getByRole("row").filter({ hasText: drug.name });
  await expect(row.getByRole("cell", { name: "30", exact: true })).toBeVisible();

  const done = await payCashForThree(page, drug);
  await expectReceipt(page, done, drug);
});

test("the counter names a prescription-only drug instead of greying out", async ({
  hospital,
}) => {
  const drug = await receiveStock(hospital.admin, {
    generic: "Telmisartan",
    schedule: "H",
    price: 8,
    quantity: 10,
  });
  const page = await hospital.as("pharmacist");
  await openCounter(page);
  await addByKeyboard(page, drug);

  await expect(page.getByRole("button", { name: "Take payment" })).toBeDisabled();
  await expect(
    page.getByText(
      `${drug.name} is Schedule H — dispense it against a prescription from the Rx queue.`,
    ),
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
  const { page } = await hospital.newStaff("pharmacist", "Counter Pharmacist");
  await keepSheetsOpen(page);
  await openCounter(page);
  await openDrawer(page);
  await addByKeyboard(page, drug);
  const dialog = await setThreeAndOpenPayment(page, drug);

  const split = dialog.getByTestId("payment-split");
  await split.getByRole("textbox", { name: "Part amount" }).fill("20");
  // A card part needs its approval code before it can be added.
  await expect(split.getByRole("button", { name: "Add part" })).toBeDisabled();
  await expect(split.getByText("Enter the card approval code.")).toBeVisible();
  await split.getByRole("textbox", { name: "Approval code" }).fill("AP4471");
  await split.getByRole("button", { name: "Add part" }).click();
  await expect(split.getByText(/Card ₹20\.00 · AP4471/)).toBeVisible();

  // ₹16.00 is left for cash; ₹20 handed over leaves ₹4.00 change.
  await expect(dialog.getByText("₹16.00").first()).toBeVisible();
  await dialog.getByRole("textbox", { name: "Cash Received" }).fill("20");
  await expect(dialog.getByText("₹4.00")).toBeVisible();
  await dialog.getByRole("button", { name: "Record Cash Payment" }).click();
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
  const { page } = await hospital.newStaff("pharmacist", "Counter Pharmacist");
  await keepSheetsOpen(page);
  await openCounter(page);
  await openDrawer(page);

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
