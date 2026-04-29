/**
 * Composable journey steps reused across CRUD, journey, and form specs.
 */

import { type Page, expect } from "@playwright/test";
import { api } from "./api";
import {
  getOpdDept,
  getFirstDrug,
  getFirstLabTest,
  getAvailableBed,
  getIpdDept,
} from "./seed-resolvers";
import type { AuthContext } from "./types";

interface PatientLite {
  id: string;
  uhid: string;
  first_name: string;
  last_name: string;
}

/** Register a patient via the UI (drives PatientRegisterForm). */
export async function registerPatientUI(
  ctx: AuthContext,
  page: Page,
  base: { firstName?: string; lastName?: string; phone?: string } = {},
): Promise<PatientLite> {
  const ts = Date.now();
  const firstName = base.firstName ?? `E2E${ts}`;
  const lastName = base.lastName ?? `Patient${ts}`;
  const phone = base.phone ?? `98${String(ts).slice(-8)}`;

  await page.getByRole("button", { name: /Register Patient/i }).first().click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();

  await drawer.getByLabel("First name").fill(firstName);
  await drawer.getByLabel("Last name").fill(lastName);
  await drawer.getByLabel("Phone (primary)").fill(phone);
  await drawer.getByLabel("Gender").click();
  await page.getByRole("option", { name: "Male", exact: true }).click();

  await drawer.getByRole("button", { name: "Register" }).click();
  await expect(drawer).not.toBeVisible({ timeout: 15_000 });

  const list = await api<{ patients: PatientLite[] }>(
    ctx,
    "GET",
    "/api/patients?per_page=20",
  );
  const found = list.patients.find((p) => p.first_name === firstName);
  if (!found) {
    throw new Error(
      `registered patient ${firstName} not found in /api/patients (got ${list.patients.length} rows)`,
    );
  }
  return found;
}

/** Create a patient directly via REST (faster than UI). */
export async function createPatientApi(
  ctx: AuthContext,
  base: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    gender?: string;
  } = {},
): Promise<PatientLite> {
  const ts = Date.now() + Math.floor(Math.random() * 1000);
  const firstName = base.firstName ?? `E2E${ts}`;
  const lastName = base.lastName ?? `Patient${ts}`;
  const phone = base.phone ?? `98${String(ts).slice(-8)}`;
  const gender = base.gender ?? "male";

  const created = await api<PatientLite>(ctx, "POST", "/api/patients", {
    first_name: firstName,
    last_name: lastName,
    phone,
    gender,
  });
  return created;
}

export async function createEncounter(
  ctx: AuthContext,
  patientId: string,
  opts: { departmentId?: string; visitType?: string } = {},
): Promise<string> {
  const departmentId = opts.departmentId ?? (await getOpdDept(ctx)).id;
  const resp = await api<{ encounter: { id: string } }>(
    ctx,
    "POST",
    "/api/opd/encounters",
    {
      patient_id: patientId,
      department_id: departmentId,
      visit_type: opts.visitType ?? "walk_in",
    },
  );
  return resp.encounter.id;
}

export async function createConsultation(
  ctx: AuthContext,
  encounterId: string,
  body: Record<string, unknown> = {
    chief_complaint: "Fever x 3 days",
    history: "Onset gradual",
    examination: "Temp 38.4C",
    plan: "Antipyretic + follow-up",
  },
): Promise<void> {
  await api(
    ctx,
    "POST",
    `/api/opd/encounters/${encounterId}/consultation`,
    body,
  );
}

export async function createPrescription(
  ctx: AuthContext,
  encounterId: string,
  opts: { drugId?: string; drugName?: string; itemCount?: number } = {},
): Promise<string> {
  const drug = opts.drugId
    ? { id: opts.drugId, name: opts.drugName ?? "Unknown" }
    : await getFirstDrug(ctx);
  const items = Array.from({ length: opts.itemCount ?? 1 }).map(() => ({
    drug_name: drug.name,
    catalog_item_id: drug.id,
    dosage: "1 tab",
    frequency: "TID",
    duration: "5 days",
    route: "oral",
  }));
  const resp = await api<{ prescription: { id: string } }>(
    ctx,
    "POST",
    `/api/opd/encounters/${encounterId}/prescriptions`,
    { items },
  );
  return resp.prescription.id;
}

export async function createPharmacyOrder(
  ctx: AuthContext,
  args: {
    patientId: string;
    prescriptionId?: string;
    encounterId?: string;
    quantity?: number;
    unitPrice?: number;
  },
): Promise<{ id: string; itemId: string }> {
  const drug = await getFirstDrug(ctx);
  const order = await api<{ id: string }>(ctx, "POST", "/api/pharmacy/orders", {
    patient_id: args.patientId,
    prescription_id: args.prescriptionId,
    encounter_id: args.encounterId,
    items: [
      {
        catalog_item_id: drug.id,
        drug_name: drug.name,
        quantity: args.quantity ?? 10,
        unit_price: args.unitPrice ?? 5,
      },
    ],
    dispensing_type: "prescription",
  });
  const detail = await api<{ items: Array<{ id: string }> }>(
    ctx,
    "GET",
    `/api/pharmacy/orders/${order.id}`,
  );
  return { id: order.id, itemId: detail.items[0].id };
}

export async function dispensePharmacyOrder(
  ctx: AuthContext,
  orderId: string,
): Promise<void> {
  await api(ctx, "PUT", `/api/pharmacy/orders/${orderId}/dispense`, {});
}

export async function createLabOrder(
  ctx: AuthContext,
  args: { patientId: string; encounterId?: string; priority?: string },
): Promise<string> {
  const test = await getFirstLabTest(ctx);
  const resp = await api<{ id: string }>(ctx, "POST", "/api/lab/orders", {
    patient_id: args.patientId,
    encounter_id: args.encounterId,
    test_id: test.id,
    priority: args.priority ?? "routine",
  });
  return resp.id;
}

export async function cancelLabOrder(
  ctx: AuthContext,
  labOrderId: string,
  reason = "spec test cancellation",
): Promise<void> {
  await api(ctx, "PUT", `/api/lab/orders/${labOrderId}/cancel`, { reason });
}

export async function createInvoice(
  ctx: AuthContext,
  args: { patientId: string; encounterId?: string },
): Promise<string> {
  const resp = await api<{ id: string }>(ctx, "POST", "/api/billing/invoices", {
    patient_id: args.patientId,
    encounter_id: args.encounterId,
  });
  return resp.id;
}

export async function admitToIpd(
  ctx: AuthContext,
  args: { patientId: string; departmentId?: string; bedId?: string },
): Promise<string> {
  const departmentId = args.departmentId ?? (await getIpdDept(ctx)).id;
  let bedId = args.bedId;
  if (!bedId) {
    const bed = await getAvailableBed(ctx);
    bedId = bed?.id;
  }
  const resp = await api<{ id: string }>(ctx, "POST", "/api/ipd/admissions", {
    patient_id: args.patientId,
    department_id: departmentId,
    bed_id: bedId,
    admission_source: "opd",
  });
  return resp.id;
}

export async function createPharmacyReturn(
  ctx: AuthContext,
  args: {
    orderItemId: string;
    patientId: string;
    quantity: number;
    reason?: string;
  },
): Promise<string> {
  const resp = await api<{ id: string }>(ctx, "POST", "/api/pharmacy/returns", {
    order_item_id: args.orderItemId,
    patient_id: args.patientId,
    quantity_returned: args.quantity,
    reason: args.reason ?? "spec test return",
  });
  return resp.id;
}

export async function processPharmacyReturn(
  ctx: AuthContext,
  returnId: string,
  action: "restock" | "discard" = "restock",
): Promise<void> {
  await api(ctx, "PUT", `/api/pharmacy/returns/${returnId}/process`, {
    action,
  });
}
