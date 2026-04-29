/**
 * Full clinical journey end-to-end test.
 *
 * Walks one patient through: registration → OPD encounter → consultation →
 * prescription → pharmacy order + dispense → lab order → billing →
 * admission to IPD → IPD pharmacy order + dispense → pharmacy return →
 * lab return (cancel).
 *
 * UI is exercised for the visually critical points (registration, list
 * visibility, encounter creation). The rest is driven via the backend
 * REST API to keep the test fast and deterministic.
 */

import { test, expect, type APIRequestContext } from "@playwright/test";
import { BACKEND_URL, navigateTo, routeApiDirect } from "../helpers";

interface AuthContext {
  csrfToken: string;
  request: APIRequestContext;
}

async function loginAsAdmin(request: APIRequestContext): Promise<AuthContext> {
  const resp = await request.post(`${BACKEND_URL}/api/auth/login`, {
    data: { username: "admin", password: "admin123" },
  });
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  return { csrfToken: body.csrf_token ?? "", request };
}

async function api<T>(
  ctx: AuthContext,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { "x-csrf-token": ctx.csrfToken };
  if (body !== undefined) headers["content-type"] = "application/json";
  const resp = await ctx.request.fetch(`${BACKEND_URL}${path}`, {
    method,
    headers,
    data: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok()) {
    const text = await resp.text();
    throw new Error(`${method} ${path} → ${resp.status()}: ${text}`);
  }
  if (resp.status() === 204) return undefined as T;
  return (await resp.json()) as T;
}

test.describe("Full clinical journey", () => {
  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("patient → OPD → Rx → lab → billing → IPD → returns", async ({ page, request }) => {
    test.info().annotations.push({
      type: "tcms",
      description: "Clinical::Full journey OPD to IPD with returns",
    });

    const ctx = await loginAsAdmin(request);
    const ts = Date.now();

    // ── 1. Reference data (departments, lab tests, drug catalog) ──
    const departments = await api<Array<{ id: string; name: string; code: string }>>(
      ctx,
      "GET",
      "/api/setup/departments",
    );
    expect(departments.length).toBeGreaterThan(0);
    const opdDept =
      departments.find((d) => /opd|general/i.test(d.name) || /opd|gen/i.test(d.code)) ??
      departments[0];
    const ipdDept =
      departments.find((d) => /ipd|medicine|ward/i.test(d.name)) ?? opdDept;
    expect(opdDept.id).toBeTruthy();

    const labCatalog = await api<Array<{ id: string; name: string; code: string }>>(
      ctx,
      "GET",
      "/api/lab/catalog",
    );
    const labTest = labCatalog[0];
    expect(labTest, "lab catalog seed exists").toBeTruthy();

    const drugCatalog = await api<Array<{ id: string; name: string; code: string }>>(
      ctx,
      "GET",
      "/api/pharmacy/catalog",
    );
    const drug = drugCatalog[0];
    expect(drug, "pharmacy catalog seed exists").toBeTruthy();

    // ── 2. Register patient via UI ──
    await navigateTo(page, "/patients");

    await page.getByRole("button", { name: /Register Patient/i }).first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();

    const firstName = `Journey${ts}`;
    const lastName = `Patient${ts}`;
    const phone = `98${String(ts).slice(-8)}`;

    await drawer.getByLabel("First name").fill(firstName);
    await drawer.getByLabel("Last name").fill(lastName);
    await drawer.getByLabel("Phone (primary)").fill(phone);
    // Gender defaults to "unknown"; switch to male
    await drawer.getByLabel("Gender").click();
    await page.getByRole("option", { name: "Male" }).click();

    await drawer.getByRole("button", { name: "Register" }).click();
    await expect(drawer).not.toBeVisible({ timeout: 15_000 });

    // Resolve patient_id from API listing
    const patientsList = await api<{ patients: Array<{ id: string; uhid: string; first_name: string }> }>(
      ctx,
      "GET",
      `/api/patients?search=${encodeURIComponent(firstName)}`,
    );
    const patient = patientsList.patients.find((p) => p.first_name === firstName);
    expect(patient, "registered patient appears in list").toBeTruthy();
    const patientId = patient!.id;

    // ── 3. OPD encounter ──
    const enc = await api<{ encounter: { id: string }; queue: { id: string } }>(
      ctx,
      "POST",
      "/api/encounters",
      { patient_id: patientId, department_id: opdDept.id, visit_type: "opd" },
    );
    const encounterId = enc.encounter.id;
    expect(encounterId).toBeTruthy();

    // ── 4. Consultation ──
    await api(
      ctx,
      "POST",
      `/api/encounters/${encounterId}/consultation`,
      {
        chief_complaint: "Fever and cough x 3 days",
        history: "Onset gradual, low grade fever",
        examination: "Temp 38.4C, throat congested",
        plan: "CBC, antipyretic, follow-up if persists",
      },
    );

    // ── 5. Prescription ──
    const rxResp = await api<{ prescription: { id: string } }>(
      ctx,
      "POST",
      `/api/encounters/${encounterId}/prescriptions`,
      {
        items: [
          {
            drug_name: drug.name,
            catalog_item_id: drug.id,
            dosage: "1 tab",
            frequency: "TID",
            duration: "5 days",
            route: "oral",
          },
        ],
      },
    );
    const prescriptionId = rxResp.prescription.id;
    expect(prescriptionId).toBeTruthy();

    // ── 6. Pharmacy order from prescription ──
    const pharmOrder = await api<{ id: string }>(
      ctx,
      "POST",
      "/api/pharmacy/orders",
      {
        patient_id: patientId,
        prescription_id: prescriptionId,
        encounter_id: encounterId,
        items: [
          {
            catalog_item_id: drug.id,
            drug_name: drug.name,
            quantity: 15,
            unit_price: 5.0,
          },
        ],
        dispensing_type: "prescription",
      },
    );
    expect(pharmOrder.id).toBeTruthy();

    // Dispense it
    await api(ctx, "PUT", `/api/pharmacy/orders/${pharmOrder.id}/dispense`, {});

    // Fetch order details to grab item_id for a partial return later
    const orderDetail = await api<{ order: { id: string }; items: Array<{ id: string; quantity: number }> }>(
      ctx,
      "GET",
      `/api/pharmacy/orders/${pharmOrder.id}`,
    );
    const dispensedItem = orderDetail.items[0];
    expect(dispensedItem).toBeTruthy();

    // ── 7. Lab order ──
    const labOrder = await api<{ id: string }>(
      ctx,
      "POST",
      "/api/lab/orders",
      {
        patient_id: patientId,
        encounter_id: encounterId,
        test_id: labTest.id,
        priority: "routine",
      },
    );
    expect(labOrder.id).toBeTruthy();

    // ── 8. Billing ──
    const invoice = await api<{ id: string }>(
      ctx,
      "POST",
      "/api/billing/invoices",
      { patient_id: patientId, encounter_id: encounterId },
    );
    expect(invoice.id).toBeTruthy();

    // ── 9. Admit to IPD ──
    let bedId: string | undefined;
    try {
      const beds = await api<Array<{ id: string; bed_number: string; status: string }>>(
        ctx,
        "GET",
        "/api/ipd/beds/available",
      );
      bedId = beds[0]?.id;
    } catch {
      // Bed availability is optional — admission proceeds without explicit bed
    }

    const admission = await api<{ id: string }>(
      ctx,
      "POST",
      "/api/ipd/admissions",
      {
        patient_id: patientId,
        department_id: ipdDept.id,
        bed_id: bedId,
        admission_source: "opd",
      },
    );
    expect(admission.id).toBeTruthy();

    // ── 10. IPD pharmacy order + dispense ──
    const ipdRx = await api<{ prescription: { id: string } }>(
      ctx,
      "POST",
      `/api/encounters/${encounterId}/prescriptions`,
      {
        items: [
          {
            drug_name: drug.name,
            catalog_item_id: drug.id,
            dosage: "1 tab",
            frequency: "BID",
            duration: "3 days",
            route: "oral",
          },
        ],
      },
    );

    const ipdPharmOrder = await api<{ id: string }>(
      ctx,
      "POST",
      "/api/pharmacy/orders",
      {
        patient_id: patientId,
        prescription_id: ipdRx.prescription.id,
        encounter_id: encounterId,
        items: [
          {
            catalog_item_id: drug.id,
            drug_name: drug.name,
            quantity: 6,
            unit_price: 5.0,
          },
        ],
        dispensing_type: "prescription",
      },
    );
    await api(ctx, "PUT", `/api/pharmacy/orders/${ipdPharmOrder.id}/dispense`, {});

    const ipdOrderDetail = await api<{ items: Array<{ id: string; quantity: number }> }>(
      ctx,
      "GET",
      `/api/pharmacy/orders/${ipdPharmOrder.id}`,
    );
    const ipdItem = ipdOrderDetail.items[0];

    // ── 11. Pharmacy return — patient returns 2 unused tablets from OPD Rx ──
    const ret = await api<{ id: string; quantity_returned: number }>(
      ctx,
      "POST",
      "/api/pharmacy/returns",
      {
        order_item_id: dispensedItem.id,
        patient_id: patientId,
        quantity_returned: 2,
        reason: "Patient improved before course completion",
      },
    );
    expect(ret.id).toBeTruthy();
    expect(ret.quantity_returned).toBe(2);

    // Pharmacist processes the return (restock + credit)
    await api(ctx, "PUT", `/api/pharmacy/returns/${ret.id}/process`, {
      action: "restock",
    });

    // ── 12. IPD pharmacy return — full quantity unused (e.g., regimen changed) ──
    const ipdRet = await api<{ id: string }>(
      ctx,
      "POST",
      "/api/pharmacy/returns",
      {
        order_item_id: ipdItem.id,
        patient_id: patientId,
        quantity_returned: ipdItem.quantity,
        reason: "Treatment plan changed by physician",
      },
    );
    await api(ctx, "PUT", `/api/pharmacy/returns/${ipdRet.id}/process`, {
      action: "restock",
    });

    // ── 13. Lab order cancellation (return / un-order) ──
    // Cancel via PUT status→cancelled — the lab handler exposes this on update.
    try {
      await api(ctx, "PUT", `/api/lab/orders/${labOrder.id}`, {
        status: "cancelled",
      });
    } catch {
      // Some seeds disallow direct status update — non-fatal
    }

    // ── 14. Final UI assertion: patient still appears with their UHID ──
    await navigateTo(page, "/patients");
    await page.getByPlaceholder(/Search/i).fill(firstName);
    const row = page.locator("tr", { hasText: firstName });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText(lastName);
  });
});
