/**
 * Starting data and saved-result checks for the payments journeys: an issued
 * bill made through the API, and what the server holds for it afterwards.
 */
import { expect, type Locator, type Page } from "@playwright/test";
import { type AuthContext, api } from "../../helpers/api";
import {
  addBillingItem,
  createInvoice,
  createPatientApi,
  issueInvoice,
} from "../../helpers/journey-steps";
import { expectScreenAccessible, expectUsable } from "./a11y";

export interface SavedBill {
  status: string;
  total: number;
  paid: number;
  payments: Array<{ id: string; amount: number; mode: string; reference: string | null }>;
}

/** The billing department, where bills are handed to cashiers. */
export async function billingDepartment(admin: AuthContext): Promise<string> {
  const rows = await api<Array<{ id: string; code?: string }>>(admin, "GET", "/api/setup/departments");
  const dept = rows.find((d) => d.code === "BILLING-DEPT");
  if (!dept) throw new Error("no BILLING-DEPT department to put cashiers in");
  return dept.id;
}

/** An issued bill for a new patient, for `total` rupees. */
export async function issuedBill(admin: AuthContext, total: number): Promise<string> {
  const patient = await createPatientApi(admin);
  const invoiceId = await createInvoice(admin, { patientId: patient.id });
  await addBillingItem(admin, invoiceId, {
    chargeCode: "MISC",
    description: "Consultation",
    unitPrice: total,
  });
  await issueInvoice(admin, invoiceId);
  return invoiceId;
}

/** What the server has saved for the bill. */
export async function savedBill(admin: AuthContext, invoiceId: string): Promise<SavedBill> {
  const detail = await api<{
    invoice: { status: string; total_amount: string; paid_amount: string };
    payments: Array<{ id: string; amount: string; mode: string; reference_number: string | null }>;
  }>(admin, "GET", `/api/billing/invoices/${invoiceId}`);
  return {
    status: detail.invoice.status,
    total: Number(detail.invoice.total_amount),
    paid: Number(detail.invoice.paid_amount),
    payments: detail.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      mode: p.mode,
      reference: p.reference_number,
    })),
  };
}

const rupees = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The bill's header shows what the server saved: paid and balance. */
export async function expectBillOnScreen(page: Page, saved: SavedBill): Promise<void> {
  await expect(page.getByText(`Paid: ${rupees(saved.paid)}`)).toBeVisible();
  await expect(page.getByText(`Balance: ${rupees(saved.total - saved.paid)}`)).toBeVisible();
  const rows = page.getByTestId("row-payment");
  await expect(rows).toHaveCount(saved.payments.length);
  for (const p of saved.payments) {
    const row = rows.filter({ hasText: p.reference ?? p.mode });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(p.mode);
    await expect(row).toContainText(rupees(p.amount));
  }
}

/** The payments card on the invoice screen. */
export function paymentsCard(page: Page): Locator {
  return page.locator("#billing-payments");
}

/** Open the bill's Collect drawer from the payments card, checking the screen on the way. */
export async function openCollectOnBill(page: Page, invoiceId: string): Promise<Locator> {
  await page.goto(`/billing/invoices/${invoiceId}`);
  await expectScreenAccessible(page, "invoice detail");
  const collect = paymentsCard(page).getByRole("button", { name: "Collect" });
  await expectUsable(collect, "Collect");
  await collect.click();
  const drawer = page.getByRole("dialog", { name: "Collect payment" });
  await expect(drawer).toBeVisible();
  return drawer;
}

/** Open the bill and start an online collection, checking the screen on the way. */
export async function openOnlineCollect(page: Page, invoiceId: string): Promise<Locator> {
  const drawer = await openCollectOnBill(page, invoiceId);
  await drawer.getByRole("radio", { name: /Online/ }).click();
  const pay = drawer.getByTestId("btn-pay-online");
  await expectUsable(pay, "Pay online");
  return drawer;
}

/** The collection went through: the drawer says so, and the cashier closes it. */
export async function closeCollected(drawer: Locator, amount: string): Promise<void> {
  await expect(drawer.getByText(`${amount} received`)).toBeVisible();
  await drawer.getByRole("button", { name: "Close", exact: true }).last().click();
  await expect(drawer).toBeHidden();
}

export { rupees };
