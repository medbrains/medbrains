/**
 * MedBrains as the payments layer over any provider (#4884): the hospital's
 * administrator switches online payments to Cashfree on the settings screen —
 * keys entered write-only, tested, chosen — and a cashier then collects a bill
 * online through Cashfree, posted once whichever of the browser and
 * Cashfree's webhook says so first.
 *
 * Real screens, real server. Only Cashfree is stood in for, at its boundary
 * (`support/cashfree.ts`). What was saved is read from the server's database
 * (`E2E_DATABASE_URL`). Server pins: crates/medbrains-server/tests/online_providers_test.rs.
 */
import { expectScreenAccessible, expectUsable } from "./support/a11y";
import { billingDepartment, expectBillOnScreen, issuedBill, openOnlineCollect, savedBill } from "./support/billing";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  cashfreeMock,
  mockUnavailable,
  paymentIdFor,
  postPaymentSuccess,
  sdkOpened,
  serveSdk,
} from "./support/cashfree";
import { db } from "./support/collect";
import { expect, freshPerson, test } from "./support/world";

test.skip(mockUnavailable !== null, mockUnavailable ?? "");
test.describe.configure({ mode: "serial" });

test("the hospital switches to Cashfree and a cashier collects online through it, once", async ({
  hospital,
  request,
}) => {
  const mock = await cashfreeMock();
  // Whatever the hospital had is put back after the test.
  await hospital.setting("payments", "active_provider", "razorpay");
  await hospital.setting("payments", "fallback_provider", null);
  await hospital.setting("payments", "cashfree_config", null);

  // ── The administrator: keys, a test call, then the switch ──
  const admin = await hospital.asAdmin();
  await admin.goto("/admin/settings#online-payments");
  await expect(admin.getByText("Online payments", { exact: true })).toBeVisible();
  await expectScreenAccessible(admin, "online payments settings");
  const keys = admin.getByRole("button", { name: "Set Cashfree keys" });
  await expectUsable(keys, "Set Cashfree keys");
  await keys.click();
  const modal = admin.getByRole("dialog", { name: "Cashfree keys" });
  await modal.getByLabel("App ID (client ID)").fill(CLIENT_ID);
  await modal.getByLabel("Secret key").fill(CLIENT_SECRET);
  await modal.getByRole("button", { name: "Save keys" }).click();
  await expect(modal).toBeHidden();
  const row = admin.getByTestId("provider-row-cashfree");
  await expect(row.getByText("Test keys set")).toBeVisible();
  await expect(row, "a stored secret is never shown back").not.toContainText(CLIENT_SECRET);
  expect(db("SELECT value->>'client_id' FROM tenant_settings WHERE key = 'cashfree_config' AND deleted_at IS NULL")).toContain(CLIENT_ID);

  await row.getByRole("button", { name: "Test Cashfree" }).click();
  await expect(admin.getByText("Cashfree answered and accepted the keys")).toBeVisible();

  await admin.getByLabel("Online payment provider").click();
  await admin.getByRole("option", { name: "Cashfree", exact: true }).click();
  await admin.getByRole("button", { name: "Save provider" }).click();
  await expect(admin.getByText("Online payment provider saved.")).toBeVisible();
  expect(db("SELECT value #>> '{}' FROM tenant_settings WHERE key = 'active_provider' AND deleted_at IS NULL")).toContain("cashfree");

  // ── The cashier: the bill collected online, through Cashfree ──
  const invoiceId = await issuedBill(hospital.admin, 1000);
  const person = freshPerson();
  const { page } = await hospital.newStaff("billing_clerk", `${person.firstName} Cashier`, undefined, [
    await billingDepartment(hospital.admin),
  ]);
  await serveSdk(page);
  const drawer = await openOnlineCollect(page, invoiceId);
  await expect(drawer.getByText("Cashfree")).toBeVisible();
  const pay = drawer.getByTestId("btn-pay-online");
  await expectUsable(pay, "Pay online");
  await pay.click();
  const opened = await sdkOpened(page);
  expect(opened.mode, "test keys open Cashfree's sandbox").toBe("sandbox");
  await expect(page.getByText("Payment successful")).toBeVisible();

  const [txn] = db(
    `SELECT id || '|' || gateway || '|' || status || '|' || gateway_order_id FROM payment_gateway_transactions WHERE invoice_id = '${invoiceId}'`,
  );
  const [txnId, gateway, status, orderId] = (txn ?? "").split("|");
  expect([gateway, status], "the payment went through Cashfree and settled").toEqual(["cashfree", "captured"]);
  expect(orderId, "Cashfree's order is the payment row itself").toBe(txnId);
  expect(mock.orders.get(orderId ?? ""), "the order asked for the whole bill").toBe(100_000);
  const paymentsOf = () =>
    db(`SELECT amount || '|' || mode || '|' || reference_number FROM payments WHERE invoice_id = '${invoiceId}' AND deleted_at IS NULL`);
  expect(paymentsOf()).toEqual([`1000.00|card|${paymentIdFor(orderId ?? "")}`]);

  // Cashfree's own notice of the same payment arrives afterwards: nothing more posts.
  expect(await postPaymentSuccess(request, orderId ?? "", 100_000)).toBe(200);
  expect(paymentsOf(), "the webhook did not post the money a second time").toHaveLength(1);
  const saved = await savedBill(hospital.admin, invoiceId);
  expect(saved.status).toBe("paid");
  await page.reload();
  await expectBillOnScreen(page, saved);
});
