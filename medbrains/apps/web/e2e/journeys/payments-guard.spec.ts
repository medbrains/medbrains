/**
 * Payments P0 (#4870) — when online payment cannot happen the cashier is
 * told why and offered the other modes, and nothing is posted; a user who
 * may not collect never sees the control and the server refuses them.
 *
 * Real screen, real server; only Razorpay is stood in for, at its boundary.
 */
import { loginAsRole, routeApiDirect } from "../helpers";
import { api, E2E_BACKEND_URL } from "../helpers/api";
import { expectScreenAccessible, expectUsable } from "./support/a11y";
import { issuedBill, openOnlineCollect, paymentsCard, savedBill } from "./support/billing";
import { mockUnavailable, razorpayMock, serveCheckout, useTestKeys } from "./support/razorpay";
import { expect, freshPerson, test } from "./support/world";

test.skip(mockUnavailable !== null, mockUnavailable ?? "");
test.describe.configure({ mode: "serial" });

test("checkout.js will not load: the cashier is told, offered cash or UPI, and nothing posts", async ({
  hospital,
}) => {
  await razorpayMock();
  await useTestKeys(hospital.setting);
  const invoiceId = await issuedBill(hospital.admin, 500);
  const person = freshPerson();
  const { page } = await hospital.newStaff("billing_clerk", `${person.firstName} Cashier`);
  await serveCheckout(page, "fails");

  const dialog = await openOnlineCollect(page, invoiceId);
  await dialog.getByTestId("btn-pay-online").click();
  const alert = dialog.getByTestId("alert-online-error");
  await expect(alert).toContainText("Razorpay checkout could not be loaded");
  const cash = dialog.getByTestId("btn-use-cash");
  await expectUsable(dialog.getByTestId("btn-use-upi_qr"), "Use UPI QR instead");
  await expectUsable(cash, "Take cash instead");
  await cash.click();
  await expect(dialog.getByRole("button", { name: "Record Cash Payment" })).toBeVisible();

  const saved = await savedBill(hospital.admin, invoiceId);
  expect(saved.status).toBe("issued");
  expect(saved.payments).toEqual([]);
});

test("Razorpay refuses the order: the reason is shown, no checkout opens, nothing posts", async ({
  hospital,
}) => {
  const mock = await razorpayMock();
  mock.refuseOrders = true;
  await useTestKeys(hospital.setting);
  const invoiceId = await issuedBill(hospital.admin, 500);
  const person = freshPerson();
  const { page } = await hospital.newStaff("billing_clerk", `${person.firstName} Cashier`);
  await serveCheckout(page);

  const dialog = await openOnlineCollect(page, invoiceId);
  await dialog.getByTestId("btn-pay-online").click();
  await expect(dialog.getByTestId("alert-online-error")).toContainText(
    "The api key provided is invalid",
  );
  await expectUsable(dialog.getByTestId("btn-use-upi_qr"), "Use UPI QR instead");
  const opened = await page.evaluate(
    () => (window as unknown as { __lastCheckout?: unknown }).__lastCheckout ?? null,
  );
  expect(opened, "no checkout opened").toBeNull();
  const saved = await savedBill(hospital.admin, invoiceId);
  expect(saved.status).toBe("issued");
  expect(saved.payments).toEqual([]);
});

test("a user who may not collect sees no collect control and the server refuses them", async ({
  hospital,
  browser,
}) => {
  await razorpayMock();
  await useTestKeys(hospital.setting);
  const invoiceId = await issuedBill(hospital.admin, 500);
  // A receptionist whose hospital took collection away from them.
  const suffix = crypto.randomUUID().slice(0, 8).toLowerCase();
  const username = `recep_nocollect_${suffix}`;
  const password = `Recep-${suffix}-Pass1!`;
  await api(hospital.admin, "POST", "/api/setup/users", {
    username,
    email: `${username}@e2e.medbrains.localhost`,
    password,
    full_name: `${freshPerson().firstName} Reception`,
    role: "receptionist",
    access_matrix: { extra: [], denied: ["billing.payments.create"] },
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await routeApiDirect(page);
    await loginAsRole(page, username, password);
    await page.goto(`/billing/invoices/${invoiceId}`);
    await expectScreenAccessible(page, "invoice detail");
    await expect(page.getByText("Balance:")).toBeVisible();
    await expect(paymentsCard(page).getByRole("button", { name: "Gateway" })).toHaveCount(0);
    await expect(paymentsCard(page).getByRole("button", { name: "Record Payment" })).toHaveCount(0);

    const login = await page.request.post(`${E2E_BACKEND_URL}/api/auth/login`, {
      data: { username, password },
    });
    const csrf = ((await login.json()) as { csrf_token?: string }).csrf_token ?? "";
    const refused = await page.request.post(`${E2E_BACKEND_URL}/api/payments/create-order`, {
      headers: { "x-csrf-token": csrf },
      data: { invoice_id: invoiceId, amount: 500 },
    });
    expect(refused.status()).toBe(403);
    const saved = await savedBill(hospital.admin, invoiceId);
    expect(saved.payments).toEqual([]);
  } finally {
    await context.close();
  }
});
