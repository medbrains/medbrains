/**
 * Payments P0 (#4870) — a cashier collects a bill online, and the money is
 * posted exactly once whichever of the browser and Razorpay's webhook tells
 * the server first.
 *
 * Real screen, real server. Only Razorpay is stood in for, at its boundary
 * (`support/razorpay.ts`). After every step the saved result is read back
 * from the server and the screen must show the same numbers.
 */
import { expectScreenAccessible, expectUsable } from "./support/a11y";
import {
  expectBillOnScreen,
  billingDepartment,
  issuedBill,
  openOnlineCollect,
  paymentsCard,
  savedBill,
} from "./support/billing";
import {
  capturedEvent,
  checkoutOpened,
  mockUnavailable,
  postWebhook,
  razorpayMock,
  serveCheckout,
  useTestKeys,
} from "./support/razorpay";
import { expect, freshPerson, test } from "./support/world";

test.skip(mockUnavailable !== null, mockUnavailable ?? "");
test.describe.configure({ mode: "serial" });

test("a cashier collects a whole bill online by card; the later webhook posts nothing more", async ({
  hospital,
  request,
}) => {
  const mock = await razorpayMock();
  await useTestKeys(hospital.setting);
  const invoiceId = await issuedBill(hospital.admin, 1000);
  const person = freshPerson();
  const { page } = await hospital.newStaff("billing_clerk", `${person.firstName} Cashier`, undefined, [await billingDepartment(hospital.admin)]);
  await serveCheckout(page);

  const dialog = await openOnlineCollect(page, invoiceId);
  await dialog.getByTestId("btn-pay-online").click();
  const opened = await checkoutOpened(page);
  expect(opened.amount, "checkout opened on the whole bill, in paise").toBe(100_000);
  expect(mock.orders.get(opened.order_id)?.amount).toBe(100_000);
  await expect(page.getByText("Payment successful")).toBeVisible();
  await expect(dialog).toBeHidden();

  let saved = await savedBill(hospital.admin, invoiceId);
  expect(saved.status).toBe("paid");
  expect(saved.paid).toBe(1000);
  expect(saved.payments).toEqual([
    expect.objectContaining({ amount: 1000, mode: "card", reference: opened.payment_id }),
  ]);
  await expectBillOnScreen(page, saved);

  // Razorpay's own notice of the same payment arrives afterwards.
  expect(await postWebhook(request, capturedEvent(opened))).toBe(200);
  saved = await savedBill(hospital.admin, invoiceId);
  expect(saved.payments, "the webhook did not post the money a second time").toHaveLength(1);
  await page.reload();
  await expectBillOnScreen(page, saved);
  await expectScreenAccessible(page, "invoice detail");
  // The receipt for the payment is there to print.
  const receipt = paymentsCard(page).getByRole("button", { name: "Generate + print receipt packet" });
  await expectUsable(receipt, "Print receipt");
});

test("the webhook beats the browser: the bill is paid once, by UPI", async ({
  hospital,
  request,
}) => {
  const mock = await razorpayMock();
  mock.method = "upi";
  await useTestKeys(hospital.setting);
  const invoiceId = await issuedBill(hospital.admin, 750);
  const person = freshPerson();
  const { page } = await hospital.newStaff("billing_clerk", `${person.firstName} Cashier`, undefined, [await billingDepartment(hospital.admin)]);
  await serveCheckout(page);
  // The stand-in checkout waits, so Razorpay's webhook lands first.
  await page.addInitScript(() => {
    (window as unknown as { __holdCheckout: boolean }).__holdCheckout = true;
  });

  const dialog = await openOnlineCollect(page, invoiceId);
  await dialog.getByTestId("btn-pay-online").click();
  const opened = await checkoutOpened(page);
  expect(await postWebhook(request, capturedEvent(opened, "upi"))).toBe(200);
  let saved = await savedBill(hospital.admin, invoiceId);
  expect(saved.status).toBe("paid");
  expect(saved.payments).toEqual([
    expect.objectContaining({ amount: 750, mode: "upi", reference: opened.payment_id }),
  ]);

  // Now the browser's verify arrives: it finds the payment settled.
  await page.evaluate(() =>
    (window as unknown as { __releaseCheckout: () => void }).__releaseCheckout(),
  );
  await expect(page.getByText("Payment successful")).toBeVisible();
  saved = await savedBill(hospital.admin, invoiceId);
  expect(saved.payments, "verify did not post the money a second time").toHaveLength(1);
  await page.reload();
  await expectBillOnScreen(page, saved);
});

test("part of the bill online, the rest in cash: partially paid, then paid", async ({ hospital }) => {
  await razorpayMock();
  await useTestKeys(hospital.setting);
  const invoiceId = await issuedBill(hospital.admin, 1000);
  const person = freshPerson();
  const { page } = await hospital.newStaff("billing_clerk", `${person.firstName} Cashier`, undefined, [await billingDepartment(hospital.admin)]);
  await serveCheckout(page);

  const dialog = await openOnlineCollect(page, invoiceId);
  const amount = dialog.getByLabel("Amount to collect online");
  await amount.fill("400");
  const pay = dialog.getByRole("button", { name: "Pay ₹400.00 Online" });
  await expectUsable(pay, "Pay ₹400 online");
  await pay.click();
  const opened = await checkoutOpened(page);
  expect(opened.amount).toBe(40_000);
  await expect(dialog).toBeHidden();

  let saved = await savedBill(hospital.admin, invoiceId);
  expect(saved.status).toBe("partially_paid");
  expect(saved.paid).toBe(400);
  await expectBillOnScreen(page, saved);

  const record = paymentsCard(page).getByRole("button", { name: "Record Payment" });
  await expectUsable(record, "Record Payment");
  await record.click();
  const recordCash = paymentsCard(page).getByRole("button", { name: /^Record ₹600/ });
  await expectUsable(recordCash, "Record ₹600");
  await recordCash.click();
  await expect
    .poll(async () => (await savedBill(hospital.admin, invoiceId)).status)
    .toBe("paid");
  saved = await savedBill(hospital.admin, invoiceId);
  expect(saved.paid).toBe(1000);
  expect(saved.payments.map((p) => [p.mode, p.amount])).toEqual([
    ["card", 400],
    ["cash", 600],
  ]);
  await expectBillOnScreen(page, saved);

});

