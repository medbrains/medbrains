/**
 * Storefront part 2 (#4864), through the screens: a prescribed medicine is
 * out of stock, the pharmacist proposes a substitute, the doctor approves it
 * in their sign-offs and the patient accepts it in the store; the patient
 * prints a prescription for another pharmacy instead; and a return where the
 * law sends a sealed pack back to stock and an opened one to quarantine.
 * The rules behind each step are proven in the server's
 * `pharmacy_storefront_p2_*_test`.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { type AuthContext, api, loginAsRoleApi, withStepUp } from "../helpers/api";
import { createEncounter, createPatientApi, dispensePharmacyOrder } from "../helpers/journey-steps";
import { latestPortalCode } from "../helpers/patient-sms";
import { expect, type Hospital, test } from "./support/world";

const COMPOSE_DIR = fileURLToPath(new URL("../../../../", import.meta.url));
const tag = () => crypto.randomUUID().slice(0, 6).toUpperCase();

/** One value from the database the screens wrote to (see doctor-payouts.spec). */
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

/** The storefront open: licence, a registered pharmacist in charge, a grievance officer. */
async function openStore(hospital: Hospital): Promise<string> {
  const pharmacist = await hospital.newStaff("pharmacist", `In charge ${tag()}`);
  db(`UPDATE users SET registration_number = 'TN-PH-${tag()}' WHERE id = '${uuid(pharmacist.id)}' RETURNING id`);
  await hospital.setting("billing", "drug_licence", "TN-20-1234, TN-21-1234");
  await hospital.setting("pharmacy", "storefront_enabled", true);
  await hospital.setting("pharmacy", "pharmacist_in_charge", pharmacist.id);
  await hospital.setting("pharmacy", "grievance_officer", {
    name: "R. Officer",
    email: "grievance@example.test",
    phone: "9000000099",
  });
  const tenant = await api<{ code: string }>(hospital.admin, "GET", "/api/setup/tenant");
  return tenant.code;
}

/** A medicine listed online with `stock` units (none: out of stock). */
async function medicine(
  admin: AuthContext,
  name: string,
  inn: string,
  opts: { schedule?: string; stock: number },
): Promise<string> {
  const item = await api<{ id: string }>(admin, "POST", "/api/pharmacy/catalog", {
    code: `P2${tag()}`,
    name,
    generic_name: inn,
    inn_name: inn,
    base_price: 10,
    tax_percent: 5,
    reorder_level: 0,
    drug_schedule: opts.schedule ?? null,
  });
  await api(admin, "PUT", `/api/pharmacy/storefront/catalog/${item.id}`, {
    sold_online: true,
    online_reserve_floor: 0,
  });
  if (opts.stock > 0) {
    await api(admin, "POST", "/api/pharmacy/batches", {
      catalog_item_id: item.id,
      batch_number: `B${tag()}`,
      expiry_date: `${new Date().getFullYear() + 2}-12-31`,
      quantity_received: opts.stock,
      selling_rate: 10,
      mrp: 12,
    });
  }
  return item.id;
}

/** The patient signs in to the store with the code texted to them. */
async function signIn(hospital: Hospital, code: string, phone: string): Promise<Page> {
  const store = await hospital.asPublic();
  await store.goto(`/store/${code}`);
  await store.getByRole("textbox", { name: "Mobile number" }).fill(phone);
  await store.getByRole("button", { name: "Send code" }).click();
  await store.getByRole("textbox", { name: "Code" }).fill(latestPortalCode(phone));
  await store.getByRole("button", { name: "Sign in" }).click();
  return store;
}

/** A patient with a prescription for `drug` written by the doctor. */
async function prescribed(hospital: Hospital, request: Parameters<typeof loginAsRoleApi>[0], drug: string, name: string) {
  const doctorCtx = await withStepUp(await loginAsRoleApi(request, "doctor"));
  const phone = `9${String(Date.now()).slice(-9)}`;
  const patient = await createPatientApi(hospital.admin, { phone });
  const visit = await createEncounter(doctorCtx, patient.id);
  await api(doctorCtx, "POST", `/api/opd/encounters/${visit}/prescriptions`, {
    items: [{ drug_name: name, catalog_item_id: drug, dosage: "1 tab", frequency: "OD", duration: "10 days", route: "oral" }],
  });
  return { patient, phone };
}

/** Order the prescription from the store's "My prescriptions" and place it. */
async function orderPrescription(store: Page) {
  await store.getByRole("tab", { name: "My prescriptions" }).click();
  await store.getByRole("button", { name: "Order these medicines" }).first().click();
  await store.getByRole("button", { name: "Place order" }).click();
  await expect(store.getByText("Order placed")).toBeVisible();
}

test("an out-of-stock medicine goes out as a substitute the doctor and the patient approved", async ({
  hospital,
  request,
}) => {
  test.setTimeout(240_000);
  const code = await openStore(hospital);
  const inn = `amoxicillin ${tag().toLowerCase()}`;
  const prescribedName = `Amoxone ${tag()}`;
  const substituteName = `Amoxtwo ${tag()}`;
  const drug = await medicine(hospital.admin, prescribedName, inn, { schedule: "H", stock: 0 });
  await medicine(hospital.admin, substituteName, inn, { schedule: "H", stock: 100 });
  const { patient, phone } = await prescribed(hospital, request, drug, prescribedName);
  const store = await signIn(hospital, code, phone);
  await orderPrescription(store);

  const pharmacist = await hospital.as("pharmacist");
  await pharmacist.goto("/pharmacy/online-orders");
  await pharmacist.getByRole("row").filter({ hasText: patient.first_name }).getByRole("button", { name: "Verify" }).click();
  await pharmacist.getByRole("button", { name: "Find a substitute" }).click();
  const panel = pharmacist.getByRole("dialog", { name: "Find a substitute" });
  await panel.getByRole("textbox", { name: "Substitute" }).click();
  await pharmacist.getByRole("option", { name: new RegExp(substituteName) }).click();
  await panel.getByRole("button", { name: "Propose substitute" }).click();
  await expect(pharmacist.getByText("Substitute proposed")).toBeVisible();

  const doctor = await hospital.as("doctor");
  await doctor.goto("/doctor/signoffs");
  await doctor.getByRole("tab", { name: /Substitute/ }).click();
  const entry = doctor.getByRole("tabpanel").locator(".mantine-Card-root").filter({ hasText: patient.uhid });
  await entry.getByRole("button", { name: "Decide substitute" }).click();
  await doctor.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect(doctor.getByText("Substitute approved")).toBeVisible();

  await store.getByRole("tab", { name: "Orders" }).click();
  await store.getByRole("button", { name: "Accept substitute" }).click();
  await expect(store.getByText(`${substituteName} ×`)).toBeVisible();

  await pharmacist.reload();
  await pharmacist.getByRole("row").filter({ hasText: patient.first_name }).getByRole("button", { name: "Verify" }).click();
  await pharmacist.getByRole("button", { name: "Save verdict" }).click();
  await expect(pharmacist.getByText("Sent to fulfilment")).toBeVisible();

  expect(
    db(
      `SELECT s.prescriber_consent_method || '|' || s.patient_consent_method || '|' || c.name \
         FROM pharmacy_substitutions s JOIN pharmacy_catalog c ON c.id = s.substituted_drug_id \
        WHERE s.original_drug_id = '${uuid(drug)}'`,
    ),
  ).toBe(`sign_off|portal|${substituteName}`);
});

test("an out-of-stock medicine is printed for the patient's own choice of pharmacy", async ({
  hospital,
  request,
}) => {
  test.setTimeout(180_000);
  const code = await openStore(hospital);
  const name = `Outsidamol ${tag()}`;
  const drug = await medicine(hospital.admin, name, `outsidamol ${tag().toLowerCase()}`, {
    schedule: "H",
    stock: 0,
  });
  const { phone } = await prescribed(hospital, request, drug, name);
  const store = await signIn(hospital, code, phone);
  await orderPrescription(store);

  await store.getByRole("tab", { name: "Orders" }).click();
  await store.getByRole("button", { name: "Buy elsewhere: print my prescription" }).click();
  const sheet = store.getByRole("dialog", { name: "Prescription for another pharmacy" });
  await expect(sheet).toContainText(name);
  await expect(sheet).toContainText("any licensed pharmacy of your choice");
  await expect(sheet).not.toContainText("partner pharmacy");

  expect(
    db(
      `SELECT p.requested_by_patient::text || '|' || (p.partner IS NULL)::text || '|' || o.status \
         FROM prescription_outside_prints p JOIN pharmacy_store_orders o ON o.id = p.store_order_id \
         JOIN pharmacy_store_order_lines l ON l.store_order_id = o.id \
        WHERE l.catalog_item_id = '${uuid(drug)}'`,
    ),
  ).toBe("true|true|closed");
});

test("a returned sealed pack goes back to stock and an opened one to quarantine", async ({
  hospital,
}) => {
  test.setTimeout(240_000);
  const code = await openStore(hospital);
  const sealedName = `Sealamol ${tag()}`;
  const openedName = `Openamol ${tag()}`;
  const sealed = await medicine(hospital.admin, sealedName, "cetirizine", { stock: 50 });
  const opened = await medicine(hospital.admin, openedName, "loratadine", { stock: 50 });
  const phone = `9${String(Date.now()).slice(-9)}`;
  await createPatientApi(hospital.admin, { phone });
  const store = await signIn(hospital, code, phone);
  for (const name of [sealedName, openedName]) {
    await store.getByRole("tab", { name: "Shop" }).click();
    await store.getByRole("textbox", { name: "Search medicines" }).fill(name);
    await store.getByRole("button", { name: "Add to cart" }).first().click();
  }
  await store.getByRole("tab", { name: "Cart" }).click();
  await store.getByRole("button", { name: "Place order" }).click();
  await expect(store.getByText("Order placed")).toBeVisible();
  const order = db(
    `SELECT s.pharmacy_order_id FROM pharmacy_store_orders s JOIN pharmacy_store_order_lines l \
       ON l.store_order_id = s.id WHERE l.catalog_item_id = '${uuid(sealed)}'`,
  );
  // Dispensed at the counter (dispensing has its own journeys).
  await dispensePharmacyOrder(hospital.admin, uuid(order), {
    unpaidOverrideReason: "Paid at collection",
  });

  await store.reload();
  await store.getByRole("tab", { name: "Orders" }).click();
  await store.getByRole("button", { name: "Return medicines" }).click();
  const form = store.getByRole("dialog", { name: "Return medicines" });
  await form.getByRole("textbox", { name: sealedName }).fill("1");
  await form.getByRole("textbox", { name: openedName }).fill("1");
  await form.getByRole("button", { name: "Ask to return" }).click();
  await expect(store.getByText("Return requested")).toBeVisible();

  const pharmacist = await hospital.as("pharmacist");
  await pharmacist.goto("/pharmacy/online-orders");
  await pharmacist.getByRole("tab", { name: "Returns" }).click();
  await pharmacist.getByRole("row").filter({ hasText: sealedName }).getByRole("button", { name: "Receive" }).click();
  const receive = pharmacist.getByRole("dialog", { name: "Receive the return" });
  await receive.getByRole("checkbox", { name: new RegExp(`${sealedName}.*seal unbroken`) }).check();
  await receive.getByRole("button", { name: "Receive and refund" }).click();
  await expect(pharmacist.getByText("Return received")).toBeVisible();

  expect(
    db(
      `SELECT string_agg(drug_name || ':' || disposition, ',' ORDER BY drug_name) \
         FROM pharmacy_store_return_lines WHERE catalog_item_id IN ('${uuid(sealed)}', '${uuid(opened)}')`,
    ),
  ).toBe(`${openedName}:quarantined,${sealedName}:restocked`);
  expect(
    db(
      `SELECT route || '|' || array_to_string(reasons, ',') FROM pharmacy_return_quarantine \
        WHERE catalog_item_id = '${uuid(opened)}'`,
    ),
  ).toBe("bmw|opened");
});
