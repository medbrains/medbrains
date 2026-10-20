/**
 * Payments P4 (#4874) — card machines at every counter.
 *
 * A cashier sends the amount to the card machine at their counter and the
 * screen follows it: sent, waiting for the card, then approved, declined or
 * timed out. The machine is the card-machine simulator; the patient at it is
 * this test, through the simulator's API. After each step the bill is read
 * back from the server: an approval posts exactly one card payment, anything
 * else posts nothing.
 *
 * #4878: a cancel the machine refuses leaves the sale live (the approval
 * that follows posts once); a sale the machine never answers goes to a
 * supervisor, who resolves it from the slip's RRN; UPI taken on the machine
 * posts as UPI.
 *
 * Needs the server started with MEDBRAINS_POS_SIMULATOR=true; skipped
 * otherwise. Runs in Playwright UI mode as well as headless.
 */
import { api } from "../helpers/api";
import { expectScreenAccessible, expectUsable } from "./support/a11y";
import { billingDepartment, expectBillOnScreen, issuedBill, openCollectOnBill, paymentsCard, savedBill } from "./support/billing";
import { expectDrawerAccessible } from "./support/collect";
import {
  asUser,
  cardDoes,
  counterWithMachine,
  type Machine,
  power,
  retire,
  saleAtMachine,
  savedSale,
  sendToMachine,
  simulatorUnavailable,
} from "./support/card-machine";
import {
  addByKeyboard,
  expectSaleDone,
  keepSheetsOpen,
  newCounter,
  openCounter,
  openDrawer,
  receiveStock,
  setThreeAndOpenPayment,
} from "./support/pos-counter";
import { expect, freshPerson, type Hospital, test } from "./support/world";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ hospital }) => {
  const why = await simulatorUnavailable(hospital.admin);
  test.skip(why !== null, why ?? "");
});

async function cashier(hospital: Hospital, denied?: string[]) {
  const person = freshPerson();
  return hospital.newStaff(
    "billing_clerk",
    `${person.firstName} Cashier`,
    undefined,
    [await billingDepartment(hospital.admin)],
    denied,
  );
}

/** The cashier opens the bill and starts collecting by card. */
async function collectByCard(page: Awaited<ReturnType<typeof cashier>>["page"], invoiceId: string) {
  const drawer = await openCollectOnBill(page, invoiceId);
  await drawer.getByRole("radio", { name: /Card/ }).click();
  return drawer;
}

async function withMachine(hospital: Hospital, type: "billing_counter" | "pharmacy_counter", run: (m: Machine) => Promise<void>) {
  const machine = await counterWithMachine(hospital.admin, type);
  try {
    await run(machine);
  } finally {
    await retire(hospital.admin, machine);
  }
}

test("a card payment at the billing counter is approved at the machine and posts once", async ({ hospital }) => {
  await withMachine(hospital, "billing_counter", async (machine) => {
    const invoiceId = await issuedBill(hospital.admin, 500);
    const { page } = await cashier(hospital);
    const card = await collectByCard(page, invoiceId);
    const panel = await sendToMachine(page, card, machine, "₹500.00");
    await expect(panel.getByRole("status")).toContainText("Waiting for the card");
    await expectDrawerAccessible(page);
    expect((await savedBill(hospital.admin, invoiceId)).payments, "nothing posts while waiting").toEqual([]);

    const saleId = await saleAtMachine(hospital.admin, machine);
    await cardDoes(hospital.admin, saleId, "approve");
    await expect.poll(async () => (await savedBill(hospital.admin, invoiceId)).status).toBe("paid");
    const sale = await savedSale(hospital.admin, saleId);
    expect(sale.stage).toBe("approved");
    expect(sale.card_last4).toBe("4242");
    const saved = await savedBill(hospital.admin, invoiceId);
    expect(saved.paid).toBe(500);
    expect(saved.payments).toEqual([expect.objectContaining({ amount: 500, mode: "card", reference: sale.reference })]);

    await page.reload();
    await expectBillOnScreen(page, saved);
    expect((await savedBill(hospital.admin, invoiceId)).payments, "still one payment").toHaveLength(1);
  });
});

test("a declined card posts nothing; the retry is approved and posts once", async ({ hospital }) => {
  await withMachine(hospital, "billing_counter", async (machine) => {
    const invoiceId = await issuedBill(hospital.admin, 300);
    const { page } = await cashier(hospital);
    const card = await collectByCard(page, invoiceId);
    const panel = await sendToMachine(page, card, machine, "₹300.00");
    await cardDoes(hospital.admin, await saleAtMachine(hospital.admin, machine), "decline");
    await expect(panel.getByRole("status")).toContainText("Declined — no money was taken");
    expect((await savedBill(hospital.admin, invoiceId)).payments).toEqual([]);

    const retry = panel.getByRole("button", { name: "Try the card again" });
    await expectUsable(retry, "Try the card again");
    await retry.click();
    await cardDoes(hospital.admin, await saleAtMachine(hospital.admin, machine), "approve");
    await expect.poll(async () => (await savedBill(hospital.admin, invoiceId)).status).toBe("paid");
    const saved = await savedBill(hospital.admin, invoiceId);
    expect(saved.payments).toHaveLength(1);
    expect(saved.payments[0]).toMatchObject({ amount: 300, mode: "card" });
    await page.reload();
    await expectBillOnScreen(page, saved);
  });
});

test("a card that times out at the machine posts nothing and says so", async ({ hospital }) => {
  await withMachine(hospital, "billing_counter", async (machine) => {
    const invoiceId = await issuedBill(hospital.admin, 250);
    const { page } = await cashier(hospital);
    const card = await collectByCard(page, invoiceId);
    const panel = await sendToMachine(page, card, machine, "₹250.00");
    await cardDoes(hospital.admin, await saleAtMachine(hospital.admin, machine), "timeout");
    await expect(panel.getByRole("status")).toContainText("timed out");
    await expect(panel.getByRole("button", { name: "Take it another way" })).toBeVisible();
    const saved = await savedBill(hospital.admin, invoiceId);
    expect(saved.payments).toEqual([]);
    expect(saved.paid).toBe(0);
  });
});

test("an offline machine is refused up front and the cashier takes cash instead", async ({ hospital }) => {
  await withMachine(hospital, "billing_counter", async (machine) => {
    await power(hospital.admin, machine, false);
    const invoiceId = await issuedBill(hospital.admin, 120);
    const { page } = await cashier(hospital);
    const card = await collectByCard(page, invoiceId);
    const panel = card.getByTestId("card-terminal-panel");
    const counter = panel.getByRole("combobox", { name: "Your counter" });
    const offline = panel.getByText(`${machine.label} is offline`);
    // The machines load first: either the counter picker or (one counter) the machine's state appears.
    await expect(counter.or(offline)).toBeVisible();
    if (await counter.isVisible()) {
      await counter.click();
      await page.getByRole("option", { name: machine.stationName, exact: true }).click();
    }
    await expect(offline).toBeVisible();
    await expect(panel.getByRole("button", { name: /^Send / })).toHaveCount(0);
    await expectDrawerAccessible(page);
    await panel.getByRole("button", { name: "Take it another way" }).click();

    await expect(card.getByRole("radio", { name: /Cash/ })).toBeChecked();
    const recordCash = card.getByRole("button", { name: "Collect ₹120.00" });
    await expectUsable(recordCash, "Collect ₹120");
    await recordCash.click();
    await expect.poll(async () => (await savedBill(hospital.admin, invoiceId)).status).toBe("paid");
    const saved = await savedBill(hospital.admin, invoiceId);
    expect(saved.payments.map((p) => p.mode)).toEqual(["cash"]);
  });
});

test("a cashier who may not collect sees no way to charge the card, and the server refuses", async ({ hospital }) => {
  await withMachine(hospital, "billing_counter", async (machine) => {
    const invoiceId = await issuedBill(hospital.admin, 90);
    const { page } = await cashier(hospital, ["billing.payments.create", "billing.collect.cross"]);
    await page.goto(`/billing/invoices/${invoiceId}`);
    await expect(paymentsCard(page)).toBeVisible();
    await expect(paymentsCard(page).getByRole("button", { name: "Collect" })).toHaveCount(0);
    const refused = await asUser(page, "/api/payments/pos-sale", {
      terminal_id: machine.terminalId,
      invoice_id: invoiceId,
      amount: 90,
    });
    expect(refused.status()).toBe(403);
    expect((await savedBill(hospital.admin, invoiceId)).payments).toEqual([]);
  });
});

test("at the pharmacy counter part goes on the card machine and the rest is cash", async ({ hospital }) => {
  await withMachine(hospital, "pharmacy_counter", async (machine) => {
    const drug = await receiveStock(hospital.admin, { generic: "Cetirizine", schedule: "OTC", price: 12, quantity: 30 });
    const drawerAt = await newCounter(hospital.admin);
    const { page } = await hospital.newStaff("pharmacist", "Counter Pharmacist");
    await keepSheetsOpen(page);
    await openCounter(page);
    await openDrawer(page, drawerAt);
    await addByKeyboard(page, drug);
    const dialog = await setThreeAndOpenPayment(page, drug);

    // ₹20 of the ₹36 on the card: the amount first, then the card tile.
    await dialog.getByRole("textbox", { name: /Amount/ }).fill("20");
    await dialog.getByRole("radio", { name: /Card/ }).click();
    const panel = await sendToMachine(page, dialog, machine, "₹20.00");
    await expectDrawerAccessible(page);
    const saleId = await saleAtMachine(hospital.admin, machine);
    await cardDoes(hospital.admin, saleId, "approve");
    await expect(dialog.getByTestId("collect-part")).toContainText("₹20.00");
    await expect(panel).toBeHidden();

    // ₹16.00 is left for cash; ₹20 handed over leaves ₹4.00 change.
    await dialog.getByRole("radio", { name: /Cash/ }).click();
    await dialog.getByRole("textbox", { name: "Cash handed over" }).fill("20");
    await dialog.getByRole("button", { name: "Collect ₹36.00" }).click();
    await expect(dialog).toBeHidden();
    const done = await expectSaleDone(page, "4.00");
    await expect(done).toContainText("mixed");

    const txn = await api<{
      transaction: { status: string; amount: string; pharmacy_pos_sale_id: string | null };
    }>(hospital.admin, "GET", `/api/payments/${saleId}/status`);
    expect(txn.transaction.status).toBe("captured");
    expect(Number(txn.transaction.amount)).toBe(20);
    expect(txn.transaction.pharmacy_pos_sale_id, "the approval paid this one sale").toBeTruthy();
    const sale = await api<{ total_amount: string; payment_mode: string }>(
      hospital.admin,
      "GET",
      `/api/pharmacy/pos/sales/${txn.transaction.pharmacy_pos_sale_id}`,
    );
    expect(Number(sale.total_amount)).toBe(36);
    expect(sale.payment_mode).toBe("mixed");
  });
});

test("a cancel the machine refuses keeps the sale live; the approval that follows posts once", async ({ hospital }) => {
  await withMachine(hospital, "billing_counter", async (machine) => {
    const invoiceId = await issuedBill(hospital.admin, 400);
    const { page } = await cashier(hospital);
    const card = await collectByCard(page, invoiceId);
    const panel = await sendToMachine(page, card, machine, "₹400.00");
    const saleId = await saleAtMachine(hospital.admin, machine);
    await cardDoes(hospital.admin, saleId, "refuse_cancel");
    await expect(panel.getByRole("status")).toContainText("Waiting for the card");
    const cancel = panel.getByRole("button", { name: "Cancel on machine" });
    await expectUsable(cancel, "Cancel on machine");
    await cancel.click();
    await expect(panel.getByRole("status")).toContainText("Still on the machine — cancel refused");
    await expect(panel.getByRole("button", { name: "Try the card again" })).toHaveCount(0);
    await expectScreenAccessible(page, "invoice detail");
    expect((await savedBill(hospital.admin, invoiceId)).payments, "nothing posts while still on the machine").toEqual([]);

    await cardDoes(hospital.admin, saleId, "approve");
    await expect.poll(async () => (await savedBill(hospital.admin, invoiceId)).status).toBe("paid");
    const saved = await savedBill(hospital.admin, invoiceId);
    expect(saved.payments).toEqual([expect.objectContaining({ amount: 400, mode: "card" })]);
    expect((await savedSale(hospital.admin, saleId)).stage).toBe("approved");
    await page.reload();
    await expectBillOnScreen(page, saved);
    expect((await savedBill(hospital.admin, invoiceId)).payments, "still one payment").toHaveLength(1);
  });
});

test("a sale the machine never answers goes to a supervisor, who resolves it from the slip once", async ({ hospital }) => {
  await withMachine(hospital, "billing_counter", async (machine) => {
    const invoiceId = await issuedBill(hospital.admin, 650);
    const { page } = await cashier(hospital, ["billing.payments.reconcile"]);
    const card = await collectByCard(page, invoiceId);
    const panel = await sendToMachine(page, card, machine, "₹650.00");
    await cardDoes(hospital.admin, await saleAtMachine(hospital.admin, machine), "unknown");
    await expect(panel.getByRole("status")).toContainText("Outcome unknown — check the machine slip");
    await expect(panel.getByText(/Do not charge the card again/)).toBeVisible();
    await expect(panel.getByRole("button", { name: "Resolve from the slip" })).toHaveCount(0);
    await expect(panel.getByRole("button", { name: /^Send / })).toHaveCount(0);
    await expectScreenAccessible(page, "invoice detail");
    expect((await savedBill(hospital.admin, invoiceId)).payments).toEqual([]);
    const again = await asUser(page, "/api/payments/pos-sale", {
      terminal_id: machine.terminalId,
      invoice_id: invoiceId,
      amount: 650,
    });
    expect(again.status(), "the bill is not charged again while the first is unknown").toBe(409);

    const supervisor = await hospital.newStaff(
      "billing_clerk",
      `${freshPerson().firstName} Supervisor`,
      undefined,
      [await billingDepartment(hospital.admin)],
    );
    const desk = (await collectByCard(supervisor.page, invoiceId)).getByTestId("card-terminal-panel");
    await expect(desk.getByRole("status")).toContainText("Outcome unknown");
    const resolve = desk.getByRole("button", { name: "Resolve from the slip" });
    await expectUsable(resolve, "Resolve from the slip");
    await resolve.click();
    const dialog = supervisor.page.getByRole("dialog", { name: "Resolve from the machine's slip" });
    await dialog.getByRole("button", { name: "Record as paid" }).click();
    await expect(dialog.getByText("Type the RRN or the approval code printed on the slip")).toBeVisible();
    expect((await savedBill(hospital.admin, invoiceId)).payments, "no RRN, nothing posts").toEqual([]);
    await dialog.getByRole("textbox", { name: "RRN" }).fill("429011223344");
    await expectScreenAccessible(supervisor.page, "resolve card payment");
    await dialog.getByRole("button", { name: "Record as paid" }).click();
    await expect(dialog).toBeHidden();

    await expect.poll(async () => (await savedBill(hospital.admin, invoiceId)).status).toBe("paid");
    const saved = await savedBill(hospital.admin, invoiceId);
    expect(saved.payments).toEqual([
      expect.objectContaining({ amount: 650, mode: "card", reference: "429011223344" }),
    ]);
    await supervisor.page.reload();
    await expectBillOnScreen(supervisor.page, saved);
    expect((await savedBill(hospital.admin, invoiceId)).payments, "resolved once").toHaveLength(1);
  });
});

test("UPI paid on the card machine posts as UPI, not card", async ({ hospital }) => {
  await withMachine(hospital, "billing_counter", async (machine) => {
    const invoiceId = await issuedBill(hospital.admin, 280);
    const { page } = await cashier(hospital);
    const card = await collectByCard(page, invoiceId);
    await sendToMachine(page, card, machine, "₹280.00", "UPI on machine");
    await expectScreenAccessible(page, "invoice detail");
    const saleId = await saleAtMachine(hospital.admin, machine);
    await cardDoes(hospital.admin, saleId, "upi");
    await expect.poll(async () => (await savedBill(hospital.admin, invoiceId)).status).toBe("paid");
    const saved = await savedBill(hospital.admin, invoiceId);
    const sale = await savedSale(hospital.admin, saleId);
    expect(saved.payments).toEqual([
      expect.objectContaining({ amount: 280, mode: "upi", reference: sale.reference }),
    ]);
    await page.reload();
    await expectBillOnScreen(page, saved);
    expect((await savedBill(hospital.admin, invoiceId)).payments).toHaveLength(1);
  });
});
