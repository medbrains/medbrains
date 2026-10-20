/**
 * Collect anywhere (#4885), step 1 — the money bugs, on the screens that had
 * them. Real screen, real server; only Razorpay is stood in for at its
 * boundary (`support/razorpay.ts`). After each journey the saved rows are
 * read back from the server.
 *
 * - A split at the cashier was posted line by line with no rollback, so a
 *   retry after a lost answer double-charged; now one collection, keyed.
 * - The invoice printed a receipt for the last leg of a split only.
 * - A UPI QR paid at the pharmacy counter was filed beside the sale, not
 *   linked to it.
 * - The refunds screen offered a refund to anyone who could raise invoices.
 * - The billing token said "Paid" while no money was recorded.
 *
 * Server pins: crates/medbrains-server/tests/collect_test.rs.
 */
import type { Page } from "@playwright/test";
import { api } from "../helpers/api";
import { expectScreenAccessible, expectUsable } from "./support/a11y";
import {
  billingDepartment,
  expectBillOnScreen,
  issuedBill,
  paymentsCard,
  savedBill,
} from "./support/billing";
import {
  addByKeyboard,
  keepSheetsOpen,
  newCounter,
  openCounter,
  openDrawer,
  receiveStock,
  setThreeAndOpenPayment,
} from "./support/pos-counter";
import {
  mockUnavailable,
  postWebhook,
  qrCreditedEvent,
  razorpayMock,
  useTestKeys,
} from "./support/razorpay";
import { expect, freshPerson, type Hospital, test } from "./support/world";

test.describe.configure({ mode: "serial" });

interface SavedPayment {
  id: string;
  amount: string;
  mode: string;
  collection_id: string | null;
}

/** Receipts the page sends to print, captured instead of opening a window. */
async function capturePrints(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const w = window as unknown as { __printed: string[] };
    w.__printed = [];
    window.open = (() => ({
      document: { write: (html: string) => w.__printed.push(html), close: () => undefined },
    })) as unknown as typeof window.open;
  });
  return () => page.evaluate(() => (window as unknown as { __printed: string[] }).__printed);
}

async function cashier(hospital: Hospital) {
  const person = freshPerson();
  return hospital.newStaff(
    "billing_clerk",
    `${person.firstName} Cashier`,
    undefined,
    [await billingDepartment(hospital.admin)],
  );
}

test("a split at the cashier is one collection: a lost answer, retried, posts nothing twice, and one receipt covers both legs", async ({
  hospital,
}) => {
  const invoiceId = await issuedBill(hospital.admin, 500);
  const { page } = await cashier(hospital);
  const printed = await capturePrints(page);
  // The first collection reaches the server, but its answer never comes back.
  let answered = false;
  await page.route("**/billing/collect", async (route) => {
    if (answered) return route.continue();
    answered = true;
    await route.fetch();
    return route.abort("connectionreset");
  });

  await page.goto(`/billing/invoices/${invoiceId}`);
  const card = paymentsCard(page);
  await card.getByRole("button", { name: "Record Payment" }).click();
  await card.getByRole("textbox", { name: "Amount" }).first().fill("300");
  await card.getByRole("button", { name: "Split payment" }).click();
  await card.getByRole("textbox", { name: "Reference no." }).fill("UTR4885");
  const record = card.getByRole("button", { name: /^Record ₹500\.00/ });
  await expectUsable(record, "Record ₹500.00");
  await expectScreenAccessible(page, "invoice detail");
  await record.click();
  await expect(page.getByText("Payment failed")).toBeVisible();
  // The cashier presses Record again, as anyone would.
  await record.click();
  await expect.poll(async () => (await savedBill(hospital.admin, invoiceId)).status).toBe("paid");

  const saved = await savedBill(hospital.admin, invoiceId);
  expect(saved.paid).toBe(500);
  expect(saved.payments.map((p) => [p.mode, p.amount]).sort()).toEqual([
    ["cash", 300],
    ["upi", 200],
  ]);
  const detail = await api<{ payments: SavedPayment[] }>(
    hospital.admin,
    "GET",
    `/api/billing/invoices/${invoiceId}`,
  );
  const collections = new Set(detail.payments.map((p) => p.collection_id));
  expect(collections.size, "both legs are one collection").toBe(1);
  expect([...collections][0]).toBeTruthy();
  const receipts = await api<Array<{ amount: string }>>(
    hospital.admin,
    "GET",
    `/api/billing/invoices/${invoiceId}/receipts`,
  );
  expect(receipts.map((r) => Number(r.amount))).toEqual([500]);
  const sent = await printed();
  expect(sent, "one receipt printed for the whole collection").toHaveLength(1);
  expect(sent[0]).toContain("500.00");
  expect(sent[0]).toMatch(/cash \+ upi|upi \+ cash/);

  await page.reload();
  await expectBillOnScreen(page, saved);
});

test("a UPI QR paid at the pharmacy counter pays that sale and is linked to it", async ({
  hospital,
  request,
}) => {
  test.skip(mockUnavailable !== null, mockUnavailable ?? "");
  const mock = await razorpayMock();
  await useTestKeys(hospital.setting);
  const drug = await receiveStock(hospital.admin, {
    generic: "Cetirizine",
    schedule: "OTC",
    price: 12,
    quantity: 30,
  });
  const drawerAt = await newCounter(hospital.admin);
  const { page } = await hospital.newStaff("pharmacist", "Counter Pharmacist", [
    "billing.payments.create",
  ]);
  await keepSheetsOpen(page);
  await openCounter(page);
  await openDrawer(page, drawerAt);
  await addByKeyboard(page, drug);
  const dialog = await setThreeAndOpenPayment(page, drug);

  const upi = dialog.getByRole("radio", { name: "UPI" });
  await dialog.locator(`label[for="${await upi.getAttribute("id")}"]`).click();
  const made = page.waitForResponse("**/payments/upi-qr");
  await dialog.getByRole("button", { name: "Generate UPI QR Code" }).click();
  const qr = (await (await made).json()) as { transaction_id: string };
  await expect(dialog.getByTestId("text-qr-waiting")).toBeVisible();
  await expectScreenAccessible(page, "collect payment");

  const code = mock.qrCodes.at(-1);
  if (!code) throw new Error("no QR was made at Razorpay");
  expect(await postWebhook(request, qrCreditedEvent(code))).toBe(200);
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("alert").filter({ hasText: /Sale PH-SALE-\w+ recorded/ })).toBeVisible();

  const txn = await api<{
    transaction: { status: string; pharmacy_pos_sale_id: string | null };
  }>(hospital.admin, "GET", `/api/payments/${qr.transaction_id}/status`);
  expect(txn.transaction.status).toBe("captured");
  expect(txn.transaction.pharmacy_pos_sale_id, "the QR paid this one sale").toBeTruthy();
  const sale = await api<{ total_amount: string; payment_mode: string }>(
    hospital.admin,
    "GET",
    `/api/pharmacy/pos/sales/${txn.transaction.pharmacy_pos_sale_id}`,
  );
  expect(Number(sale.total_amount)).toBe(36);
  expect(sale.payment_mode).toBe("upi");
});

test("a refund is offered only to those who may refund, and posts back on the bill", async ({
  hospital,
}) => {
  const invoiceId = await issuedBill(hospital.admin, 200);
  await api(hospital.admin, "POST", `/api/billing/invoices/${invoiceId}/payments`, {
    amount: 200,
    mode: "cash",
  });

  // A receptionist raises invoices but gives no money back.
  const desk = await hospital.newStaff("receptionist", `${freshPerson().firstName} Desk`);
  await desk.page.goto("/billing?tab=refunds");
  await expect(desk.page.getByText("Refunds", { exact: true })).toBeVisible();
  await expect(desk.page.getByRole("button", { name: "Create Refund" })).toHaveCount(0);

  const { page } = await cashier(hospital);
  await page.goto("/billing?tab=refunds");
  const create = page.getByRole("button", { name: "Create Refund" });
  await expectUsable(create, "Create Refund");
  await create.click();
  await page.getByRole("textbox", { name: "Invoice ID" }).fill(invoiceId);
  await page.getByRole("textbox", { name: "Amount" }).fill("50");
  await page.getByRole("textbox", { name: "Reason" }).fill("Test not done");
  await page.getByRole("button", { name: "Process Refund" }).click();
  await expect.poll(async () => (await savedBill(hospital.admin, invoiceId)).paid).toBe(150);
});

test("the billing token says where the patient is, never that they paid", async ({ hospital }) => {
  const dept = await hospital.department("Collect token");
  const token = await api<{ id: string; number: string }>(hospital.admin, "POST", "/api/tokens/issue", {
    module: "billing",
    scope: "department",
    scope_id: dept.id,
  });
  const page = await hospital.asAdmin();
  await page.goto("/token-console");
  await page.getByTestId("picker-module").click();
  await page.getByRole("option", { name: "Billing", exact: true }).click();
  const department = page.getByPlaceholder("All departments");
  await department.click();
  await department.fill(dept.name);
  await page.getByRole("option", { name: dept.name }).click();

  const row = page.getByRole("row").filter({ hasText: token.number });
  for (const [step, shows] of [
    ["Call", "At counter"],
    ["Serve", "Being served"],
  ] as const) {
    const action = row.getByRole("button", { name: step, exact: true });
    await expectUsable(action, step);
    await action.click();
    await expect(row).toContainText(shows);
  }
  await expect(row.getByRole("button", { name: /collect/i })).toHaveCount(0);
  await row.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(page.getByText("Paid", { exact: true })).toHaveCount(0);

  const board = await api<Array<{ id: string; status: string }>>(
    hospital.admin,
    "GET",
    `/api/tokens/board?module=billing&scope=department&scope_id=${dept.id}&include_finished=true`,
  );
  expect(board.find((t) => t.id === token.id)?.status).toBe("completed");
});
