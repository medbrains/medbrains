/**
 * The pharmacy counter, as a cashier works it — shared by the counter, return
 * and day-close journeys.
 */
import type { Page } from "@playwright/test";
import type { AuthContext } from "../../helpers/api";
import { api } from "../../helpers/api";
import { expect } from "./world";

/** The sheet prints itself and closes on load; keep it open to read it. */
export async function keepSheetsOpen(page: Page) {
  await page.context().addInitScript(() => {
    window.print = () => undefined;
    window.close = () => undefined;
  });
}

export function nextYear(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

export interface Received {
  name: string;
  batchNumber: string;
  stamp: string;
}

/** A new medicine and a batch of it, received the way stock intake posts it. */
export async function receiveStock(
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

export async function openCounter(page: Page) {
  await page.goto("/pharmacy");
  await page.getByRole("tab", { name: "POS Counter" }).click();
}

/** Search, pick with the keyboard, and land back in the search box. */
export async function addByKeyboard(page: Page, drug: Received) {
  const search = page.getByRole("textbox", { name: "Add medicine" });
  await search.fill(drug.stamp);
  await expect(page.getByRole("option", { name: new RegExp(drug.name) })).toBeVisible();
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
}

/**
 * A counter of the test's own. Counters share a business day across every
 * cashier on them, so a shared one can be closed — or hold another suite's
 * open drawer — under a test that only meant to sell.
 */
export async function newCounter(admin: AuthContext): Promise<string> {
  const tag = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const name = `E2E counter ${tag}`;
  await api(admin, "POST", "/api/procurement/store-locations", {
    code: `E2E-CTR-${tag}`,
    name,
    location_type: "pharmacy",
  });
  return name;
}

/** Cash goes into a drawer: open one from the counter. */
export async function openDrawer(page: Page, counter: string) {
  const strip = page.getByTestId("counter-drawer");
  await expect(strip).toContainText("No cash drawer is open");
  await strip.getByRole("button", { name: "Open drawer" }).click();
  const dialog = page.getByRole("dialog", { name: "Open cash drawer" });
  await dialog.getByRole("combobox", { name: "Pharmacy location" }).click();
  await page.getByRole("option", { name: new RegExp(`^${counter}`) }).click();
  await dialog.getByRole("textbox", { name: "Opening float (₹)" }).fill("500");
  await dialog.getByRole("button", { name: "Open", exact: true }).click();
  await expect(strip).toContainText("Drawer open since");
}

/**
 * Three tablets at MRP ₹12. MRP includes GST, so the bill is ₹36.00 — never
 * ₹37.80 with 5% added on top. Paid ₹50 cash: ₹14.00 back.
 */
export async function setThreeAndOpenPayment(page: Page, drug: Received) {
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

  const dialog = page.getByRole("dialog", { name: "Collect payment" });
  await expect(dialog).toBeVisible();
  // Counter tenders only — a gateway order needs a record the sale is not yet.
  await expect(dialog.getByRole("radio", { name: /Online/ })).toHaveCount(0);
  return dialog;
}

/** The sale went through: its number, the change, focus back on the search. */
export async function expectSaleDone(page: Page, change: string) {
  const done = page.getByRole("alert").filter({ hasText: /Sale PH-SALE-\w+ recorded/ });
  await expect(done).toBeVisible();
  await expect(done).toContainText("change due");
  await expect(done).toContainText(change);
  await expect(page.getByRole("textbox", { name: "Add medicine" })).toBeFocused();
  return done;
}

export async function payCashForThree(page: Page, drug: Received) {
  const dialog = await setThreeAndOpenPayment(page, drug);
  await dialog.getByRole("radio", { name: /Cash/ }).click();
  await dialog.getByRole("textbox", { name: "Cash handed over" }).fill("50");
  await expect(dialog.getByTestId("cash-change")).toHaveText("₹14.00");
  await dialog.getByRole("button", { name: "Collect ₹36.00" }).click();
  await expect(dialog).toBeHidden();
  return expectSaleDone(page, "14.00");
}
