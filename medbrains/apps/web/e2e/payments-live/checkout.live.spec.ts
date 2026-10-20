/**
 * Live lane — Razorpay TEST mode, real checkout.js, real api.razorpay.com.
 *
 * Skipped unless RAZORPAY_LIVE_TEST=1. The server must run with the TEST
 * keys (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET from medbrains/.env), WITHOUT
 * RAZORPAY_API_BASE_OVERRIDE, and with no `payments.razorpay_config` on the
 * tenant (so the env keys are used). Razorpay's hosted checkout is an iframe
 * whose markup Razorpay changes; this lane pays by UPI with Razorpay's test
 * VPA `success@razorpay` and is best-effort — if Razorpay's markup moves,
 * finish the payment by hand in the opened window and the assertions still
 * check the bill.
 */
import { expect, test } from "@playwright/test";
import { getAuthContextFromCookies } from "../helpers/api";
import { issuedBill, openOnlineCollect, savedBill } from "../journeys/support/billing";

test.skip(process.env.RAZORPAY_LIVE_TEST !== "1", "set RAZORPAY_LIVE_TEST=1 to pay Razorpay TEST mode");

test("a real TEST-mode checkout pays a bill and posts it once", async ({ page, request }) => {
  test.setTimeout(180_000);
  const admin = await getAuthContextFromCookies(request);
  const invoiceId = await issuedBill(admin, 10);
  const dialog = await openOnlineCollect(page, invoiceId);
  await dialog.getByTestId("btn-pay-online").click();

  const checkout = page.frameLocator("iframe.razorpay-checkout-frame");
  await checkout.getByText("UPI", { exact: false }).first().click();
  await checkout.getByPlaceholder(/upi id|vpa/i).fill("success@razorpay");
  await checkout.getByRole("button", { name: /verify|pay/i }).first().click();

  await expect
    .poll(async () => (await savedBill(admin, invoiceId)).status, { timeout: 150_000 })
    .toBe("paid");
  const saved = await savedBill(admin, invoiceId);
  expect(saved.payments).toHaveLength(1);
  expect(saved.payments[0]).toMatchObject({ amount: 10, mode: "upi" });
});
