/**
 * Payments P0 (#4870) — money that cannot honestly post goes to finance,
 * and a refund to the card comes off the bill exactly once.
 *
 * Real screen, real server; only Razorpay is stood in for, at its boundary.
 */
import { api } from "../helpers/api";
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

interface ExceptionRow {
  id: string;
  order_ref: string | null;
  reason: string;
  amount: string | null;
  status: string;
}

test("an over-capture is held for finance, who sees it and resolves it on screen", async ({
  hospital,
}) => {
  const mock = await razorpayMock();
  mock.extraCaptured = 20_000; // Razorpay reports ₹200 more than the order asked
  await useTestKeys(hospital.setting);
  const invoiceId = await issuedBill(hospital.admin, 1000);
  const person = freshPerson();
  const cashier = await hospital.newStaff("billing_clerk", `${person.firstName} Cashier`, undefined, [await billingDepartment(hospital.admin)]);
  await serveCheckout(cashier.page);

  const dialog = await openOnlineCollect(cashier.page, invoiceId);
  await dialog.getByTestId("btn-pay-online").click();
  const opened = await checkoutOpened(cashier.page);
  await expect(dialog.getByTestId("alert-online-held")).toBeVisible();
  await expect(dialog.getByTestId("btn-pay-online"), "no second collection").toBeDisabled();

  const saved = await savedBill(hospital.admin, invoiceId);
  expect(saved.status, "nothing posted to the bill").toBe("issued");
  expect(saved.payments).toEqual([]);
  const open = await api<ExceptionRow[]>(hospital.admin, "GET", "/api/payments/exceptions?status=open");
  const held = open.filter((e) => e.order_ref === opened.order_id);
  expect(held).toEqual([
    expect.objectContaining({ reason: "amount_mismatch", amount: "1200.00", status: "open" }),
  ]);

  const finance = await hospital.newStaff("billing_clerk", `${person.lastName} Finance`, undefined, [await billingDepartment(hospital.admin)]);
  await finance.page.goto("/billing?tab=payment-exceptions");
  await expectScreenAccessible(finance.page, "payment exceptions");
  const row = finance.page.getByTestId("row-exception").filter({ hasText: opened.order_id });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("amount_mismatch");
  await expect(row).toContainText("₹1,200");
  const resolve = row.getByRole("button", { name: "Resolve" });
  await expectUsable(resolve, "Resolve");
  await resolve.click();
  await expect(finance.page.getByText("Marked resolved")).toBeVisible();
  const resolved = await api<ExceptionRow[]>(
    hospital.admin,
    "GET",
    "/api/payments/exceptions?status=resolved",
  );
  expect(resolved.find((e) => e.id === held[0]?.id)?.status).toBe("resolved");
  // The cashier's bill is untouched by the review.
  await cashier.page.reload();
  await expectBillOnScreen(cashier.page, await savedBill(hospital.admin, invoiceId));
});

test("the cashier refunds part of an online payment; the bill goes from paid to partially paid", async ({
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
  await expect(dialog).toBeHidden();
  let saved = await savedBill(hospital.admin, invoiceId);
  expect(saved.status).toBe("paid");
  const payment = saved.payments[0];
  if (!payment) throw new Error("the online payment did not post");

  const refund = paymentsCard(page).getByTestId(`btn-refund-${payment.id}`);
  await expectUsable(refund, "Refund online payment");
  await refund.click();
  const modal = page.getByRole("dialog", { name: "Refund online payment" });
  await expect(modal).toBeVisible();
  await modal.getByTestId("field-refund-amount").fill("300");
  await modal.getByTestId("field-refund-reason").fill("Test was not done");
  const confirm = modal.getByTestId("btn-confirm-refund");
  await expectUsable(confirm, "Refund");
  await confirm.click();
  await expect(modal).toBeHidden();

  const made = mock.refunds.at(-1);
  expect(made, "Razorpay was asked for the refund").toMatchObject({
    paymentId: opened.payment_id,
    amount: 30_000,
  });
  saved = await savedBill(hospital.admin, invoiceId);
  expect(saved.status).toBe("partially_paid");
  expect(saved.paid).toBe(700);
  await expectBillOnScreen(page, saved);

  // Razorpay's refund.created for the same refund changes nothing.
  const status = await postWebhook(request, {
    event: "refund.created",
    payload: {
      refund: { entity: { id: made?.id, amount: 30_000, payment_id: opened.payment_id } },
      payment: { entity: { id: opened.payment_id, order_id: opened.order_id } },
    },
  });
  expect(status).toBe(200);
  saved = await savedBill(hospital.admin, invoiceId);
  expect(saved.paid, "the refund came off once").toBe(700);
  const refunds = await api<{ data: Array<{ invoice_id: string }> }>(
    hospital.admin,
    "GET",
    "/api/billing/refunds?per_page=100",
  );
  expect(refunds.data.filter((r) => r.invoice_id === invoiceId)).toHaveLength(1);
});
