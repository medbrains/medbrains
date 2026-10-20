/**
 * Collect anywhere (#4885), the visible part: one Collect drawer, opened from
 * the "₹X due · Collect" chip on every patient banner, the counters' own
 * buttons, and the check-in. Each desk collects its own department; the
 * central cashier collects them all. Real screen, real server; starting data
 * through the API; what was saved is read back from the database.
 *
 * Server pins: crates/medbrains-server/tests/collect_test.rs.
 */
import type { Page } from "@playwright/test";
import { api } from "../helpers/api";
import { admitToIpd, createEncounter, createPatientApi, freshWardBeds } from "../helpers/journey-steps";
import { expectScreenAccessible, expectUsable } from "./support/a11y";
import { cardDoes, counterWithMachine, retire, saleAtMachine, sendToMachine, simulatorUnavailable } from "./support/card-machine";
import {
  billOf,
  billUnderEntity,
  collectDrawer,
  collectionsOf,
  db,
  expectDrawerAccessible,
  grantView,
  pharmacyEntity,
  receiptsOf,
  savedInvoice,
  shotPath,
} from "./support/collect";
import { addByKeyboard, keepSheetsOpen, newCounter, openCounter, openDrawer, receiveStock } from "./support/pos-counter";
import { expect, freshPerson, type Hospital, test } from "./support/world";

test.describe.configure({ mode: "serial" });

/** Pick the patient on a screen's patient search. */
async function pickPatient(page: Page, uhid: string) {
  await page.getByLabel("Patient").first().fill(uhid);
  await page.getByRole("option", { name: new RegExp(uhid) }).first().click();
}

/** A desk member of `role` who may see these patients. */
async function deskOf(hospital: Hospital, role: string, patients: string[]) {
  const staff = await hospital.newStaff(role, `${freshPerson().firstName} ${role}`);
  for (const p of patients) grantView(staff.id, p);
  return staff;
}

test("(a) the lab desk takes the lab's dues from the chip in two moves, and never sees All dues", async ({
  hospital,
}) => {
  const patient = await createPatientApi(hospital.admin);
  const labBill = await billOf(hospital.admin, patient.id, "lab", 1200);
  const pharmacyBill = await billOf(hospital.admin, patient.id, "pharmacy", 450);
  const { page } = await deskOf(hospital, "lab_technician", [patient.id]);

  await page.goto("/lab/orders/new");
  await pickPatient(page, patient.uhid);
  const chip = page.getByRole("button", { name: "₹1,200.00 due · Collect" });
  await expectUsable(chip, "due chip");
  await expectScreenAccessible(page, "lab walk-in");

  // Move 1: the chip. Move 2: Shift+Enter — the whole lab due, in cash.
  await chip.click();
  const drawer = collectDrawer(page);
  await expect(drawer.getByRole("button", { name: "Collect ₹1,200.00" })).toBeEnabled();
  await expect(drawer.getByText(/All dues/)).toHaveCount(0);
  await expect(drawer.getByRole("radio", { name: /Online/ })).toHaveCount(0);
  await expectDrawerAccessible(page);
  await page.screenshot({ path: shotPath("lab-desk-drawer") });
  await page.keyboard.press("Shift+Enter");
  await expect(drawer.getByText("₹1,200.00 received")).toBeVisible();

  expect(savedInvoice(labBill)).toEqual({ status: "paid", paid: 1200 });
  expect(savedInvoice(pharmacyBill).paid, "the pharmacy's bill is the pharmacy's").toBe(0);
  const [collection] = collectionsOf(patient.id);
  expect(collection).toMatchObject({ scope: "department", lane: "lab", total: 1200, payments: "cash:1200.00" });
});

test("(b) at the pharmacy counter a sale is paid part on the card machine, the rest in cash", async ({
  hospital,
}) => {
  const why = await simulatorUnavailable(hospital.admin);
  test.skip(why !== null, why ?? "");
  const machine = await counterWithMachine(hospital.admin, "pharmacy_counter");
  try {
    const drug = await receiveStock(hospital.admin, { generic: "Cetirizine", schedule: "OTC", price: 12, quantity: 30 });
    const drawerAt = await newCounter(hospital.admin);
    const { page } = await hospital.newStaff("pharmacist", "Counter Pharmacist");
    await keepSheetsOpen(page);
    await openCounter(page);
    await openDrawer(page, drawerAt);
    await addByKeyboard(page, drug);
    await page.getByRole("textbox", { name: `Quantity of ${drug.name}` }).fill("3");
    await expect(page.getByTestId("pos-total")).toContainText("36.00");
    await page.getByRole("button", { name: "Take payment" }).click();

    const drawer = collectDrawer(page);
    const amount = drawer.getByRole("textbox", { name: /Amount/ });
    await amount.fill("20");
    await drawer.getByRole("radio", { name: /Card/ }).click();
    await sendToMachine(page, drawer, machine, "₹20.00");
    await page.screenshot({ path: shotPath("pharmacy-drawer-card") });
    const saleId = await saleAtMachine(hospital.admin, machine);
    await cardDoes(hospital.admin, saleId, "approve");
    await expect(drawer.getByTestId("collect-part")).toContainText("₹20.00");
    await expect(drawer.getByTestId("collect-remaining")).toContainText("₹16.00");

    await drawer.getByRole("radio", { name: /Cash/ }).click();
    await drawer.getByRole("textbox", { name: "Cash handed over" }).fill("20");
    await expect(drawer.getByTestId("cash-change")).toHaveText("₹4.00");
    await expectDrawerAccessible(page);
    await page.screenshot({ path: shotPath("pharmacy-drawer-split") });
    await drawer.getByRole("button", { name: "Collect ₹36.00" }).click();
    await expect(drawer).toBeHidden();
    await expect(page.getByRole("alert").filter({ hasText: /Sale PH-SALE-\w+ recorded/ })).toContainText("4.00");

    const [row] = db(
      `SELECT s.total_amount, s.payment_mode, s.change_due FROM pharmacy_pos_sales s
         JOIN payment_gateway_transactions g ON g.pharmacy_pos_sale_id = s.id WHERE g.id = '${saleId}'`,
    );
    expect(row, "the card approval paid this one sale: ₹20 card + ₹16 cash").toBe("36.00|mixed|4.00");
  } finally {
    await retire(hospital.admin, machine);
  }
});

test("(c) the registration fee is collected at check-in, in the same breath", async ({ hospital }) => {
  const lanes = await api<Array<Record<string, unknown> & { lane: string }>>(hospital.admin, "GET", "/api/billing/lanes");
  const registration = lanes.find((l) => l.lane === "registration");
  if (!registration) throw new Error("no registration lane");
  const put = (fee: number | null, at: string) =>
    api(hospital.admin, "PUT", "/api/billing/lanes/registration", {
      legal_entity_id: registration.legal_entity_id,
      revenue_department_id: registration.revenue_department_id,
      default_mode: registration.default_mode,
      charge_at: at,
      fee_amount: fee,
    });
  const clinic = await hospital.department("Collect OPD");
  const doctor = await hospital.colleague(clinic);
  const patient = await createPatientApi(hospital.admin);
  // A returning patient: the desk's form has their doctor and department.
  await createEncounter(hospital.admin, patient.id, { departmentId: clinic.id, doctorId: doctor.id });
  await put(150, "checkin");
  try {
    const { page: desk } = await deskOf(hospital, "receptionist", [patient.id]);
    await desk.goto("/opd/new");
    await pickPatient(desk, patient.uhid);
    await expect(desk.getByTestId("last-visit-hint")).toContainText(doctor.fullName);
    await desk.getByRole("button", { name: "Create Visit" }).click();

    const drawer = collectDrawer(desk);
    await expect(drawer.getByRole("button", { name: "Collect ₹150.00" })).toBeEnabled();
    await expectDrawerAccessible(desk);
    await desk.keyboard.press("Shift+Enter");
    await expect(drawer.getByText("₹150.00 received")).toBeVisible();

    const collections = collectionsOf(patient.id);
    expect(collections.at(-1)).toMatchObject({ total: 150, payments: "cash:150.00" });
    const [fee] = db(
      `SELECT i.status FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
        WHERE i.patient_id = '${patient.id}' AND ii.source = 'registration' ORDER BY i.created_at DESC LIMIT 1`,
    );
    expect(fee).toBe("paid");
  } finally {
    await put((registration.fee_amount as number | null) ?? null, String(registration.charge_at));
  }
});

test("(d) the central cashier takes all dues at once — one receipt per legal entity", async ({ hospital }) => {
  const patient = await createPatientApi(hospital.admin);
  const lab = await billOf(hospital.admin, patient.id, "lab", 300);
  const radiology = await billOf(hospital.admin, patient.id, "radiology", 900);
  const pharmacy = await billOf(hospital.admin, patient.id, "pharmacy", 450);
  billUnderEntity(pharmacy, await pharmacyEntity(hospital.admin));
  const { page } = await deskOf(hospital, "billing_clerk", [patient.id]);

  await page.goto("/billing/counter");
  await pickPatient(page, patient.uhid);
  await expect(page.getByTestId("row-counter-bill")).toHaveCount(3);
  const collectAll = page.getByRole("button", { name: "Collect ₹1,650.00" });
  await expectUsable(collectAll, "Collect all");
  await expectScreenAccessible(page, "cashier counter");
  await collectAll.click();
  const drawer = collectDrawer(page);
  await expect(drawer.getByTestId("row-collect-bill")).toHaveCount(3);
  await expectDrawerAccessible(page);
  await page.keyboard.press("Shift+Enter");
  await expect(drawer.getByText("₹1,650.00 received")).toBeVisible();
  await expect(drawer.getByTestId("row-collect-receipt")).toHaveCount(2);

  for (const id of [lab, radiology, pharmacy]) expect(savedInvoice(id).status).toBe("paid");
  const [collection] = collectionsOf(patient.id);
  expect(collection?.total).toBe(1650);
  const receipts = receiptsOf(collection?.id ?? "");
  expect(receipts.map((r) => r.amount).sort((a, b) => a - b)).toEqual([450, 1200]);
  expect(new Set(receipts.map((r) => r.entity)).size, "one receipt per legal entity").toBe(2);
});

test("(e) the IPD desk collects the final balance at discharge", async ({ hospital }) => {
  test.setTimeout(180_000);
  const patient = await createPatientApi(hospital.admin);
  const [bed] = await freshWardBeds(hospital.admin, 1);
  const admissionId = await admitToIpd(hospital.admin, { patientId: patient.id, bedId: bed?.bed_id });
  const admission = await api<{ encounter_id: string }>(hospital.admin, "GET", `/api/ipd/admissions/${admissionId}`);
  const invoice = await api<{ id: string }>(hospital.admin, "POST", "/api/billing/invoices", {
    patient_id: patient.id,
    encounter_id: admission.encounter_id,
    admission_id: admissionId,
  });
  await api(hospital.admin, "POST", `/api/billing/invoices/${invoice.id}/items`, {
    charge_code: "BED-GEN",
    description: "General ward bed-day",
    source: "manual",
    quantity: 2,
    unit_price: 1500,
  });
  const page = await hospital.asAdmin();
  await page.goto(`/ipd/admissions/${admissionId}#billing-tab`);
  const checklist = page.getByRole("region", { name: "Discharge bill checklist" });
  await checklist.getByRole("button", { name: "Issue final bill" }).click();
  const collect = checklist.getByRole("button", { name: "Collect balance ₹3,000.00" });
  await expectUsable(collect, "Collect balance");
  await collect.click();
  const drawer = collectDrawer(page);
  await expect(drawer.getByRole("button", { name: "Collect ₹3,000.00" })).toBeEnabled();
  await expectDrawerAccessible(page);
  await page.keyboard.press("Shift+Enter");
  await expect(drawer.getByText("₹3,000.00 received")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(checklist.getByRole("listitem", { name: "Balance to collect" })).toContainText("₹0.00");
  expect(savedInvoice(invoice.id)).toEqual({ status: "paid", paid: 3000 });
});

test("(f) a receptionist sees no way to collect a lab-only bill, and the server refuses it", async ({ hospital }) => {
  const patient = await createPatientApi(hospital.admin);
  const labBill = await billOf(hospital.admin, patient.id, "lab", 700);
  const { page } = await deskOf(hospital, "receptionist", [patient.id]);
  // The front desk's own counter screen: the lab bill shows, with no way to take it.
  await page.goto("/billing/counter");
  await pickPatient(page, patient.uhid);
  const row = page.getByTestId("row-counter-bill");
  await expect(row).toContainText("Lab");
  await expect(row.getByRole("button", { name: "Collect" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Collect ₹/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /due · Collect/ })).toHaveCount(0);
  await expect(page.getByTestId("due-chip-elsewhere")).toHaveText("₹700.00 due at other desks");

  const cookies = await page.context().cookies();
  const csrf = cookies.find((c) => c.name === "csrf_token")?.value ?? "";
  const refused = await page.request.post(`${process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:3000"}/api/billing/collect`, {
    headers: { "x-csrf-token": csrf },
    data: {
      patient_id: patient.id,
      scope: "all",
      invoice_ids: [labBill],
      tenders: [{ mode: "cash", amount: 700 }],
      idempotency_key: crypto.randomUUID(),
    },
  });
  expect(refused.status()).toBe(403);
  expect(savedInvoice(labBill).paid).toBe(0);
  expect(collectionsOf(patient.id)).toEqual([]);
});

test("(g) a lost answer, retried, posts once", async ({ hospital }) => {
  const patient = await createPatientApi(hospital.admin);
  const labBill = await billOf(hospital.admin, patient.id, "lab", 500);
  const { page } = await deskOf(hospital, "lab_technician", [patient.id]);
  // The first collection reaches the server, but its answer never comes back.
  let answered = false;
  await page.route("**/billing/collect", async (route) => {
    if (answered) return route.continue();
    answered = true;
    await route.fetch();
    return route.abort("connectionreset");
  });
  await page.goto("/lab/orders/new");
  await pickPatient(page, patient.uhid);
  await page.getByRole("button", { name: "₹500.00 due · Collect" }).click();
  const drawer = collectDrawer(page);
  const collect = drawer.getByRole("button", { name: "Collect ₹500.00" });
  await collect.click();
  await expect(drawer.getByText(/it will not be charged twice/)).toBeVisible();
  await collect.click();
  await expect(drawer.getByText("₹500.00 received")).toBeVisible();

  expect(savedInvoice(labBill)).toEqual({ status: "paid", paid: 500 });
  const collections = collectionsOf(patient.id);
  expect(collections, "one collection, one payment").toHaveLength(1);
  expect(collections[0]?.payments).toBe("cash:500.00");
});
