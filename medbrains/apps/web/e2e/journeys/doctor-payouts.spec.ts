/**
 * Doctor payouts (#4886), through the screens: a visiting doctor's day
 * settled at session close; a monthly statement prepared by one person,
 * approved by another and paid by bank file; and a doctor who sees only
 * their own earnings. Pricing, bases, reversals, TDS and the referral
 * switches are proven in the server's `doctor_payouts_test`.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { type AuthContext, api } from "../helpers/api";
import { createPatientApi } from "../helpers/journey-steps";
import { expect, test } from "./support/world";

const COMPOSE_DIR = fileURLToPath(new URL("../../../../", import.meta.url));
const tag = () => crypto.randomUUID().slice(0, 6).toUpperCase();

/**
 * One value from the database the screens wrote to: `E2E_DATABASE_URL` when
 * the stack under test has its own database, else the local docker compose
 * one. Never empty — an empty answer means the wrong database, not "nothing".
 */
function db(sql: string): string {
  const url = process.env.E2E_DATABASE_URL;
  const out = url
    ? execFileSync("psql", [url, "-tAc", sql], { encoding: "utf8" })
    : execFileSync(
        "docker",
        ["compose", "exec", "-T", "postgres", "psql", "-U", "medbrains", "-d", "medbrains", "-tAc", sql],
        { cwd: COMPOSE_DIR, encoding: "utf8" },
      );
  const value = out.trim();
  if (value === "") throw new Error(`no row for: ${sql} — is E2E_DATABASE_URL the server's database?`);
  return value;
}

const uuid = (v: string) => {
  if (!/^[0-9a-f-]{36}$/.test(v)) throw new Error(`not an id: ${v}`);
  return v;
};

/** A rate card paying a fixed amount for one charge code. */
async function card(admin: AuthContext, code: string, amount: string): Promise<string> {
  const id = await api<string>(admin, "POST", "/api/doctor-payouts/rate-cards", {
    plan_name: `Card ${code}`,
    plan_code: code,
    effective_from: "2020-01-01",
  });
  await api(admin, "POST", `/api/doctor-payouts/rate-cards/${id}/rules`, {
    rule_name: `${code} fee`,
    charge_code: code,
    role: "primary",
    calc_kind: "fixed",
    fixed_amount: amount,
  });
  return id;
}

/** An issued bill for a new patient, one line performed by `doctor`. */
async function issuedBill(admin: AuthContext, doctor: string, code: string, price: string) {
  const patient = await createPatientApi(admin, {});
  const invoice = await api<{ id: string }>(admin, "POST", "/api/billing/invoices", {
    patient_id: patient.id,
  });
  await api(admin, "POST", `/api/billing/invoices/${invoice.id}/items`, {
    charge_code: code,
    description: `Consultation ${code}`,
    source: "manual",
    quantity: 1,
    unit_price: price,
    tax_percent: 0,
    performing_doctor_id: doctor,
  });
  await api(admin, "POST", `/api/billing/invoices/${invoice.id}/issue`, {});
  return invoice.id;
}

async function pickDoctor(page: Page, name: string) {
  const box = page.getByRole("textbox", { name: "Doctor" }).first();
  await box.click();
  await box.fill(name);
  await page.getByRole("option", { name: new RegExp(name) }).click();
}

test("a visiting doctor's day is settled at session close", async ({ hospital }) => {
  test.setTimeout(180_000);
  const code = `VIS${tag()}`;
  const name = `Visiting Rao ${tag()}`;
  const doctor = await hospital.newStaff("doctor", name);
  const cardId = await card(hospital.admin, code, "2000");
  await api(hospital.admin, "POST", "/api/doctor-payouts/agreements", {
    doctor_id: doctor.id,
    plan_id: cardId,
    effective_from: "2020-01-01",
    engagement_type: "visiting",
    accrual_basis: "billed",
    charity_rule: "zero",
    settlement_cycle: "same_day",
    session_minimum: "3000",
    payout_mode: "upi",
    upi_vpa: "drrao@okbank",
  });
  await issuedBill(hospital.admin, doctor.id, code, "2500");

  const cashier = await hospital.newStaff("billing_clerk", `Cashier ${tag()}`);
  const page = cashier.page;
  await page.goto("/billing/doctor-payouts?tab=day");
  await pickDoctor(page, name);
  await expect(page.getByText("₹2,000.00").first()).toBeVisible();
  await expect(page.getByText("₹1,000.00").first()).toBeVisible();
  await page.getByText("UPI", { exact: true }).click();
  await page.getByRole("textbox", { name: "Transaction reference" }).fill("UPI98765432");
  await page.getByRole("button", { name: "Settle and pay" }).click();
  await expect(page.getByText("Settled", { exact: true })).toBeVisible();

  const id = uuid(doctor.id);
  expect(db(`SELECT status || '|' || incentive_amount FROM incentive_calculations WHERE doctor_id = '${id}' AND kind = 'same_day'`)).toBe("paid|3000.00");
  expect(
    db(
      `SELECT o.mode || '|' || o.status || '|' || o.amount FROM doctor_payouts o JOIN incentive_calculations s ON s.id = o.statement_id WHERE s.doctor_id = '${id}'`,
    ),
  ).toBe("upi|paid|3000.00");
});

test("a monthly statement is prepared, approved by someone else and paid", async ({ hospital }) => {
  test.setTimeout(240_000);
  const code = `MON${tag()}`;
  const name = `Monthly Iyer ${tag()}`;
  const doctor = await hospital.newStaff("doctor", name);
  const cardId = await card(hospital.admin, code, "8000");
  await api(hospital.admin, "POST", "/api/doctor-payouts/agreements", {
    doctor_id: doctor.id,
    plan_id: cardId,
    effective_from: "2020-01-01",
    engagement_type: "fee_for_service",
    accrual_basis: "billed",
    charity_rule: "zero",
    settlement_cycle: "monthly",
    payout_mode: "bank",
    bank_account_name: name,
    bank_account_number: "123456789012",
    bank_ifsc: "HDFC0001234",
    pan: "ABCPI1234Q",
  });
  await issuedBill(hospital.admin, doctor.id, code, "10000");

  const preparer = await hospital.newStaff("billing_clerk", `Preparer ${tag()}`);
  await preparer.page.goto("/billing/doctor-payouts?tab=statements");
  await pickDoctor(preparer.page, name);
  await preparer.page.getByRole("button", { name: "Prepare" }).click();
  await expect(preparer.page.getByText("Statement prepared")).toBeVisible();

  const approver = await hospital.newStaff("billing_clerk", `Approver ${tag()}`, [
    "doctor_payouts.statements.approve",
    "doctor_payouts.payouts.execute",
  ]);
  const page = approver.page;
  await page.goto("/billing/doctor-payouts?tab=approvals");
  const draft = page.getByRole("row").filter({ hasText: name });
  await draft.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Payout run" }).click();
  await page.getByRole("checkbox", { name: `Pay ${name}` }).check();
  await page.getByRole("button", { name: /Pay 1 selected/ }).click();
  await expect(page.getByRole("button", { name: "Download bank file" })).toBeVisible();
  const payout = page.getByRole("row").filter({ hasText: name }).filter({ hasText: "pending" });
  await payout.getByRole("button", { name: "Record result" }).click();
  const modal = page.getByRole("dialog", { name: "What happened to this payout?" });
  const utr = `HDFCN${Date.now()}`;
  await modal.getByRole("textbox", { name: "UTR" }).fill(utr);
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("row").filter({ hasText: utr })).toBeVisible();

  const id = uuid(doctor.id);
  expect(
    db(
      `SELECT status || '|' || payment_reference || '|' || (approved_by <> prepared_by)::text FROM incentive_calculations WHERE doctor_id = '${id}' AND kind = 'monthly'`,
    ),
  ).toBe(`paid|${utr}|true`);
});

test("a doctor sees their own earnings and nobody else's", async ({ hospital }) => {
  test.setTimeout(180_000);
  const code = `OWN${tag()}`;
  const cardId = await card(hospital.admin, code, "700");
  const mine = await hospital.newStaff("doctor", `Own Menon ${tag()}`);
  const theirs = await hospital.newStaff("doctor", `Other Pillai ${tag()}`);
  for (const d of [mine, theirs]) {
    await api(hospital.admin, "POST", "/api/doctor-payouts/agreements", {
      doctor_id: d.id,
      plan_id: cardId,
      effective_from: "2020-01-01",
      engagement_type: "fee_for_service",
      accrual_basis: "billed",
      charity_rule: "zero",
      settlement_cycle: "monthly",
      payout_mode: "cash",
    });
  }
  const myBill = await issuedBill(hospital.admin, mine.id, code, "900");
  const theirBill = await issuedBill(hospital.admin, theirs.id, code, "900");
  const myNumber = db(`SELECT invoice_number FROM invoices WHERE id = '${uuid(myBill)}'`);
  const theirNumber = db(`SELECT invoice_number FROM invoices WHERE id = '${uuid(theirBill)}'`);

  const page = mine.page;
  await page.goto("/my-earnings");
  await expect(page.getByText(myNumber, { exact: false })).toBeVisible();
  await expect(page.getByText(theirNumber, { exact: false })).toHaveCount(0);
  await expect(page.getByText("₹700.00").first()).toBeVisible();

  await page.goto("/billing/doctor-payouts");
  await expect(page).toHaveURL(/\/forbidden/);
  expect(db(`SELECT COUNT(*) FROM doctor_payout_accruals WHERE doctor_id = '${uuid(theirs.id)}'`)).toBe("1");
});
