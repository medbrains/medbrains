/**
 * The pharmacy's day, as the pharmacist does it: a doctor's prescription
 * arrives in the Rx queue, the pharmacist reviews and dispenses it from the
 * right batch, the patient pays at the counter, and the day is closed.
 *
 * Starting data goes through the API — the drugs and their stock, the
 * patient, and the doctor's signed prescription (the doctor's own screens are
 * walked in opd-visit-journey). Every pharmacy step is a click by a
 * pharmacist provisioned for this test.
 */
import type { APIRequestContext, Page } from "@playwright/test";
import { type AuthContext, api, E2E_BACKEND_URL, withStepUp } from "../helpers/api";
import { expectScreenAccessible } from "./support/a11y";
import {
  addByKeyboard,
  keepSheetsOpen,
  newCounter,
  openCounter,
  openDrawer,
  payCashForThree,
  receiveStock,
} from "./support/pos-counter";
import { expect, freshPerson, type Hospital, test } from "./support/world";

const stamp = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

interface Drug {
  id: string;
  name: string;
}

/** A catalogue drug with its regulatory flags, as the pharmacy master holds it. */
async function addDrug(
  admin: AuthContext,
  opts: {
    generic: string;
    schedule: string;
    controlled?: boolean;
    lasaGroup?: string;
    price?: number;
  },
): Promise<Drug> {
  const tag = stamp();
  const name = `${opts.generic} ${tag}`;
  const drug = await api<{ id: string }>(admin, "POST", "/api/pharmacy/catalog", {
    code: `E2E-RX-${tag}`,
    name,
    generic_name: opts.generic,
    unit: "tablet",
    base_price: opts.price ?? 10,
    tax_percent: 5,
    current_stock: 0,
    reorder_level: 5,
    drug_schedule: opts.schedule,
    is_controlled: opts.controlled ?? false,
    formulary_status: "approved",
    is_lasa: Boolean(opts.lasaGroup),
    lasa_group: opts.lasaGroup,
    batch_tracking_required: true,
  });
  return { id: drug.id, name };
}

async function receiveBatch(
  admin: AuthContext,
  drug: Drug,
  batch: { number: string; expiry: string; quantity: number },
): Promise<void> {
  await api(admin, "POST", "/api/pharmacy/batches", {
    catalog_item_id: drug.id,
    batch_number: batch.number,
    expiry_date: batch.expiry,
    quantity_received: batch.quantity,
    selling_rate: 10,
  });
}

/** Signs in through the API as a user provisioned for this test. */
async function signIn(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<AuthContext> {
  const post = () =>
    request.post(`${E2E_BACKEND_URL}/api/auth/login`, { data: { username, password } });
  let resp = await post();
  // Five sign-ins a minute per address; a journey with several staff meets it.
  for (let attempt = 0; resp.status() === 429 && attempt < 4; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 15_000));
    resp = await post();
  }
  expect(resp.status(), `${username} signs in`).toBe(200);
  const body = await resp.json();
  const cookieHeader = (resp.headersArray() ?? [])
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value.split(";")[0])
    .join("; ");
  return {
    csrfToken: body.csrf_token ?? "",
    cookieHeader,
    request,
    userId: body.user?.id ?? "",
    tenantId: body.user?.tenant_id ?? "",
    password,
  };
}

interface Prescribed {
  patientId: string;
  uhid: string;
  name: string;
}

/** A patient seen by the doctor today, with the prescription the doctor signed. */
async function prescribe(
  hospital: Hospital,
  request: APIRequestContext,
  rx: {
    lines: Array<{ drug: Drug; quantity: number }>;
    /** A documented drug allergy, recorded before the visit. */
    allergy?: string;
    /** The doctor is authorised to prescribe Schedule X (NDPS). */
    scheduleX?: boolean;
  },
): Promise<Prescribed> {
  const { lines, allergy, scheduleX } = rx;
  const dept = await hospital.department("Rx OPD");
  const doctor = await hospital.colleague(dept);
  if (scheduleX) {
    await api(hospital.admin, "POST", "/api/admin/doctors", {
      user_id: doctor.id,
      display_name: doctor.fullName,
      specialty_ids: [],
      can_prescribe_schedule_x: true,
    });
  }
  const person = freshPerson();
  const patient = await api<{ id: string; uhid: string }>(hospital.admin, "POST", "/api/patients", {
    first_name: person.firstName,
    last_name: person.lastName,
    gender: "male",
    date_of_birth: "1980-06-15",
    phone: person.phone,
  });
  if (allergy) {
    await api(hospital.admin, "POST", `/api/patients/${patient.id}/allergies`, {
      allergy_type: "drug",
      allergen_name: allergy,
      reaction: "Urticaria",
      severity: "moderate",
    });
  }
  const doctorCtx = await signIn(request, doctor.username, doctor.password);
  const visit = await api<{ encounter: { id: string } }>(doctorCtx, "POST", "/api/opd/encounters", {
    patient_id: patient.id,
    department_id: dept.id,
    doctor_id: doctor.id,
    visit_type: "walk_in",
  });
  await api(await withStepUp(doctorCtx), "POST", `/api/opd/encounters/${visit.encounter.id}/prescriptions`, {
    items: lines.map(({ drug, quantity }) => ({
      drug_name: drug.name,
      catalog_item_id: drug.id,
      dosage: "1 tab",
      frequency: "TID",
      duration: `${Math.ceil(quantity / 3)} days`,
      route: "oral",
      quantity,
    })),
    ...(allergy ? { allergy_override_reason: "Prescribed knowingly; pharmacist to confirm" } : {}),
  });
  return { patientId: patient.id, uhid: patient.uhid, name: `${person.firstName} ${person.lastName}` };
}

/** A pharmacist on the pharmacy's staff: orders reach the Pharmacy department. */
async function newPharmacist(hospital: Hospital, fullName: string) {
  const departments = await api<Array<{ id: string; code: string }>>(
    hospital.admin,
    "GET",
    "/api/setup/departments",
  );
  const pharmacy = departments.find((d) => d.code === "PHARMACY");
  if (!pharmacy) throw new Error("the hospital has no Pharmacy department");
  return hospital.newStaff("pharmacist", fullName, undefined, [pharmacy.id]);
}

async function openRxQueue(page: Page): Promise<void> {
  await page.goto("/pharmacy");
  await page.getByRole("tab", { name: /Rx queue/i }).click();
  await expectScreenAccessible(page, "pharmacy-rx-queue");
}

test("a prescription is reviewed, dispensed from the earliest-expiring batch, billed and the day closed", async ({
  hospital,
  request,
}) => {
  test.setTimeout(300_000);
  // Schedule H, and a look-alike of another drug on the shelf.
  const amox = await addDrug(hospital.admin, { generic: "Amoxicillin", schedule: "H", lasaGroup: "AMOX-AMOXAPINE" });
  await receiveBatch(hospital.admin, amox, { number: `LATE-${stamp()}`, expiry: inDays(400), quantity: 50 });
  const early = `EARLY-${stamp()}`;
  await receiveBatch(hospital.admin, amox, { number: early, expiry: inDays(90), quantity: 50 });
  const rx = await prescribe(hospital, request, { lines: [{ drug: amox, quantity: 15 }] });

  const pharmacist = await newPharmacist(hospital, "Counter Pharmacist");
  const page = pharmacist.page;
  await openRxQueue(page);
  await page.getByRole("textbox", { name: /search/i }).first().fill(rx.uhid);
  const row = page.getByRole("row").filter({ hasText: rx.uhid });
  await expect(row).toHaveCount(1, { timeout: 15_000 });

  // Review: the detail names the look-alike before the pharmacist approves.
  await row.getByRole("button", { name: "View prescription details" }).click();
  const detail = page.getByRole("dialog").last();
  await expect(detail.getByText(amox.name).first()).toBeVisible();
  await expect(
    detail.getByText(/look-alike sound-alike medicine \(group AMOX-AMOXAPINE\)/).first(),
    "the look-alike is named before approval",
  ).toBeVisible();
  await expectScreenAccessible(page, "pharmacy-rx-detail");
  await detail.getByRole("button", { name: "Approve & Create Billing" }).click();
  const review = page.getByRole("dialog").last();
  await expectScreenAccessible(page, "pharmacy-rx-approve");
  await review.getByRole("button", { name: /Approve/ }).last().click();
  await expect(review).toBeHidden({ timeout: 15_000 });

  // Dispense from the order the approval made.
  await page.getByRole("tab", { name: "Orders" }).click();
  await expectScreenAccessible(page, "pharmacy-orders");
  const order = page.getByRole("row").filter({ hasText: rx.uhid });
  await order.getByRole("button", { name: "View pharmacy order" }).click();
  await expect(page.getByRole("heading", { name: "Pharmacy Order" })).toBeVisible();
  await expectScreenAccessible(page, "pharmacy-order");
  // FEFO: the earliest-expiring batch is the one suggested.
  await expect(page.getByRole("row").filter({ hasText: `Batch ${early}` })).toBeVisible();
  await page.getByRole("button", { name: "Dispense", exact: true }).click();
  const dispense = page.getByRole("dialog", { name: "Dispense order" });
  await expectScreenAccessible(page, "pharmacy-dispense");
  await expect(dispense.getByText(/look-alike sound-alike medicine \(group AMOX-AMOXAPINE\)/)).toBeVisible();
  await dispense.getByRole("button", { name: "Dispense", exact: true }).click();

  // The OPD bill is the cashier's; the pharmacist hands over against a reason.
  const unpaid = page.getByRole("dialog", { name: "Dispense unpaid?" });
  await expect(unpaid).toBeVisible({ timeout: 15_000 });
  await unpaid
    .getByRole("textbox", { name: "Why dispense before payment" })
    .fill("Paying at the main billing counter");
  await unpaid.getByRole("button", { name: "Dispense unpaid" }).click();
  await expect(page.getByText("dispensed", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  const handed = await api<{ items: Array<{ batch_number: string | null; quantity_dispensed: number }> }>(
    hospital.admin,
    "GET",
    `/api/pharmacy/orders/${new URL(page.url()).pathname.split("/").pop()}`,
  );
  expect(handed.items[0]?.batch_number, "FEFO: the earliest-expiring batch went out").toBe(early);
  expect(handed.items[0]?.quantity_dispensed).toBe(15);

  // The counter: a walk-in buys over the counter, and the day is closed.
  const counter = await newCounter(hospital.admin);
  const otc = await receiveStock(hospital.admin, {
    generic: "Cetirizine",
    schedule: "OTC",
    price: 12,
    quantity: 30,
  });
  await keepSheetsOpen(page);
  await openCounter(page);
  await expectScreenAccessible(page, "pharmacy-pos");
  await openDrawer(page, counter);
  await addByKeyboard(page, otc);
  await payCashForThree(page, otc);
  await page.getByRole("button", { name: "Close drawer and cash up" }).click();
  const cashUp = page.getByRole("dialog", { name: "Close cash drawer" });
  await cashUp.getByRole("textbox", { name: "Actual cash counted (₹)" }).fill("536");
  await cashUp.getByRole("button", { name: /Close/ }).last().click();
  await expect(cashUp).toBeHidden();

  await page.goto("/pharmacy/finance?tab=day-close");
  const day = page.getByRole("row").filter({ hasText: counter });
  await day.getByRole("button", { name: "Open day" }).click();
  const panel = page.getByRole("dialog", { name: new RegExp(counter) });
  await expect(panel.getByText("₹536.00").first()).toBeVisible();
  await expectScreenAccessible(page, "pharmacy-day-close");
  const count = (note: string, pieces: string) =>
    panel.getByRole("textbox", { name: `Number of ₹${note}`, exact: true }).fill(pieces);
  await count("500", "1");
  await count("20", "1");
  await count("10", "1");
  await count("5", "1");
  await count("1", "1");
  await expect(panel.getByTestId("day-variance")).toHaveText(/No difference|Balanced|₹0\.00/);
  await panel.getByRole("button", { name: "Close the day" }).click();
  await expect(panel.getByText(/Closed ·/)).toBeVisible();
});

/** Reviews the prescription in the Rx queue and opens the order it made. */
async function reviewAndOpen(page: Page, uhid: string, safetyReason?: string): Promise<void> {
  await openRxQueue(page);
  await page.getByRole("textbox", { name: /search/i }).first().fill(uhid);
  const row = page.getByRole("row").filter({ hasText: uhid });
  await row.getByRole("button", { name: "View prescription details" }).click();
  const detail = page.getByRole("dialog").last();
  await detail.getByRole("button", { name: "Approve & Create Billing" }).click();
  const review = page.getByRole("dialog").last();
  if (safetyReason) {
    await review.getByRole("textbox", { name: "Override reason", exact: true }).fill(safetyReason);
  }
  await review.getByRole("button", { name: /Approve/ }).last().click();
  await expect(review).toBeHidden({ timeout: 15_000 });
  await page.getByRole("tab", { name: "Orders" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: uhid })
    .getByRole("button", { name: "View pharmacy order" })
    .click();
  await expect(page.getByRole("heading", { name: "Pharmacy Order" })).toBeVisible();
}

async function dispenseUnpaid(page: Page): Promise<void> {
  const unpaid = page.getByRole("dialog", { name: "Dispense unpaid?" });
  await expect(unpaid).toBeVisible({ timeout: 15_000 });
  await unpaid
    .getByRole("textbox", { name: "Why dispense before payment" })
    .fill("Paying at the main billing counter");
  await unpaid.getByRole("button", { name: "Dispense unpaid" }).click();
}

test("a Schedule X controlled drug is refused without a witness, the refusal is filed, and the witnessed dispense reaches the NDPS register", async ({
  hospital,
  request,
}) => {
  test.setTimeout(300_000);
  const morphine = await addDrug(hospital.admin, { generic: "Morphine", schedule: "X", controlled: true });
  await receiveBatch(hospital.admin, morphine, { number: `NDPS-${stamp()}`, expiry: inDays(300), quantity: 20 });
  const rx = await prescribe(hospital, request, {
    lines: [{ drug: morphine, quantity: 6 }],
    scheduleX: true,
  });
  const pharmacist = await newPharmacist(hospital, "Charge Pharmacist");
  const witnessName = `Witness ${stamp()}`;
  const witness = await newPharmacist(hospital, witnessName);
  await witness.page.context().close();
  const page = pharmacist.page;
  await reviewAndOpen(page, rx.uhid);

  // The quick dispense from the order list sends no witness: refused, and filed.
  await page.getByRole("button", { name: "Orders", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: rx.uhid })
    .getByRole("button", { name: "Dispense pharmacy order" })
    .click();
  await expect(page.getByText(/Schedule X dispense requires a witness/).first()).toBeVisible({
    timeout: 15_000,
  });
  await page
    .getByRole("row")
    .filter({ hasText: rx.uhid })
    .getByRole("button", { name: "View pharmacy order" })
    .click();
  const record = page.getByRole("region", { name: "Safety record" });
  await expect(record.getByRole("row").filter({ hasText: "Refused" })).toContainText(
    "Schedule X dispense requires a witness",
  );

  // The dispense screen will not go without the second pharmacist.
  await page.getByRole("button", { name: "Dispense", exact: true }).click();
  const dispense = page.getByRole("dialog", { name: "Dispense order" });
  await expect(dispense.getByRole("button", { name: "Dispense", exact: true })).toBeDisabled();
  await dispense.getByRole("combobox", { name: /Witness/ }).click();
  await page.getByRole("option", { name: witnessName, exact: true }).click();
  await expectScreenAccessible(page, "pharmacy-dispense-controlled");
  await dispense.getByRole("button", { name: "Dispense", exact: true }).click();
  await dispenseUnpaid(page);
  await expect(page.getByText("dispensed", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

  // The NDPS register carries the receipt and the witnessed issue, and its
  // balance matches the shelf: 20 received, 6 dispensed.
  await page.goto("/pharmacy");
  await page.getByRole("tab", { name: "NDPS Register" }).click();
  await expectScreenAccessible(page, "pharmacy-ndps-register");
  const register = page.getByRole("tabpanel", { name: "NDPS Register" });
  await expect(register.getByText(`${morphine.name}: 14`)).toBeVisible({ timeout: 15_000 });
  await expect(register.getByRole("row").filter({ hasText: /Dispensed\s*6\s*14/ })).toHaveCount(1);
});
});

test("a documented allergy stops the dispense until the pharmacist records why, and the override is filed", async ({
  hospital,
  request,
}) => {
  test.setTimeout(300_000);
  const cotrim = await addDrug(hospital.admin, { generic: "Cotrimoxazole", schedule: "H" });
  await receiveBatch(hospital.admin, cotrim, { number: `ALG-${stamp()}`, expiry: inDays(300), quantity: 30 });
  const rx = await prescribe(hospital, request, {
    lines: [{ drug: cotrim, quantity: 10 }],
    allergy: cotrim.name,
  });
  const pharmacist = await newPharmacist(hospital, "Ward Pharmacist");
  const page = pharmacist.page;
  // The review stops on the allergy too: approving it takes a clinical reason.
  await reviewAndOpen(page, rx.uhid, "Prescriber confirmed: tolerated a full course in March");

  await page.getByRole("button", { name: "Dispense", exact: true }).click();
  const dispense = page.getByRole("dialog", { name: "Dispense order" });
  await expect(dispense.getByText("Documented drug allergy").first()).toBeVisible();
  const go = dispense.getByRole("button", { name: "Dispense", exact: true });
  await expect(go, "no dispense without a reason").toBeDisabled();
  await dispense
    .getByRole("textbox", { name: "Override reason" })
    .first()
    .fill("Patient tolerated this course in March; prescriber confirmed");
  await expectScreenAccessible(page, "pharmacy-dispense-allergy");
  await go.click();
  await dispenseUnpaid(page);
  await expect(page.getByText("dispensed", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  // The allergy override is on the order's safety record, with its reason.
  await expect(
    page
      .getByRole("region", { name: "Safety record" })
      .getByRole("row")
      .filter({ hasText: "Overridden" })
      .first(),
  ).toContainText("tolerated");
});

test("a Schedule H drug is not sold at the counter until the prescription's patient is recorded", async ({
  hospital,
}) => {
  test.setTimeout(180_000);
  const counter = await newCounter(hospital.admin);
  const drug = await receiveStock(hospital.admin, {
    generic: "Azithromycin",
    schedule: "H",
    price: 12,
    quantity: 30,
  });
  const pharmacist = await newPharmacist(hospital, "Counter Pharmacist");
  const page = pharmacist.page;
  await keepSheetsOpen(page);
  await openCounter(page);
  await openDrawer(page, counter);
  await addByKeyboard(page, drug);
  const takePayment = page.getByRole("button", { name: "Take payment" });
  await expect(takePayment, "no sale until the prescription's patient is recorded").toBeDisabled();
  await expect(
    page.getByText(
      "Schedule H/H1: pick the patient, or enter their name and mobile from the prescription.",
    ),
  ).toBeVisible();
  await expectScreenAccessible(page, "pharmacy-pos-schedule-h");
});
