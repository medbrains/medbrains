/**
 * Golden patient journey.
 *
 * Covers the cross-module business chain that must stay intact after
 * safety, billing, discharge, and MRD changes:
 * patient -> OPD -> lab -> Rx -> pharmacy dispense -> billing ->
 * IPD -> bed transfer -> discharge workflow -> MRD seal.
 */

import { expect, test } from "@playwright/test";
import { navigateTo, routeApiDirect } from "../helpers";
import { api, getAuthContextFromCookies } from "../helpers/api";
import {
  admitToIpd,
  archiveMrdRecord,
  createConsultation,
  createEncounter,
  createInvoice,
  createLabOrder,
  createMrdRecord,
  createPatientApi,
  createPharmacyOrder,
  createPrescription,
  dischargeAdmission,
  dispensePharmacyOrder,
  issueInvoice,
  markDischargeStep,
  transferAdmissionBedIfAvailable,
} from "../helpers/journey-steps";

interface PatientContextResponse {
  uhid: string;
  full_name: string;
  last_vitals: unknown | null;
}

interface InvoiceDetail {
  invoice: { id: string; status: string };
  items: Array<{ id: string; source: string; source_id: string | null }>;
}

test.describe("Golden patient journey", () => {
  test.beforeEach(async ({ page }) => {
    await routeApiDirect(page);
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("OPD to discharge closes billing and seals MRD", async ({ page, request }) => {
    test.info().annotations.push({
      type: "tcms",
      description: "Clinical::Golden patient journey OPD to MRD seal",
    });

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedUiApiCalls: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/api/") && response.status() >= 400) {
        failedUiApiCalls.push(`${response.status()} ${url.pathname}`);
      }
    });

    const ctx = await getAuthContextFromCookies(request);
    const patient = await createPatientApi(ctx, {
      firstName: `Golden${Date.now()}`,
      lastName: "Journey",
    });

    const context = await api<PatientContextResponse>(
      ctx,
      "GET",
      `/api/patients/${patient.id}/context`,
    );
    expect(context.uhid).toBeTruthy();
    expect(context.full_name).toContain("Golden");

    await navigateTo(page, `/patients/${patient.id}`);
    await expect(page.getByText(patient.uhid).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/No vitals on record/i).first()).toBeVisible();

    const encounterId = await createEncounter(ctx, patient.id);
    await createConsultation(ctx, encounterId, {
      chief_complaint: "Golden journey fever review",
      history: "No red flags",
      examination: "Stable",
      plan: "Lab, medication, review, then admit for observation",
    });

    const labOrderId = await createLabOrder(ctx, {
      patientId: patient.id,
      encounterId,
    });
    expect(labOrderId).toBeTruthy();

    const prescriptionId = await createPrescription(ctx, encounterId);
    const pharmacyOrder = await createPharmacyOrder(ctx, {
      patientId: patient.id,
      prescriptionId,
      encounterId,
      quantity: 10,
    });
    await dispensePharmacyOrder(ctx, pharmacyOrder.id);

    const invoiceId = await createInvoice(ctx, {
      patientId: patient.id,
      encounterId,
    });
    expect(invoiceId).toBeTruthy();

    const invoiceList = await api<{
      invoices: Array<{ id: string; status: string }>;
    }>(
      ctx,
      "GET",
      `/api/billing/invoices?patient_id=${patient.id}&per_page=50`,
    );
    const invoiceDetails = await Promise.all(
      invoiceList.invoices.map((invoice) =>
        api<InvoiceDetail>(ctx, "GET", `/api/billing/invoices/${invoice.id}`),
      ),
    );
    const chargeInvoice = invoiceDetails.find((detail) =>
      detail.items.some((item) => item.source === "pharmacy"),
    );
    expect(chargeInvoice, "pharmacy dispense should auto-capture a charge").toBeTruthy();
    expect(chargeInvoice?.items.length ?? 0).toBeGreaterThan(0);

    const issuedInvoice =
      chargeInvoice?.invoice.status === "draft"
        ? await issueInvoice(ctx, chargeInvoice.invoice.id)
        : chargeInvoice?.invoice;
    expect(issuedInvoice?.status).toBe("issued");

    const admissionId = await admitToIpd(ctx, { patientId: patient.id });
    expect(admissionId).toBeTruthy();
    const transferredBedId = await transferAdmissionBedIfAvailable(ctx, admissionId);
    if (transferredBedId) expect(transferredBedId).toBeTruthy();

    const mrdRecord = await createMrdRecord(ctx, patient.id);
    expect(mrdRecord.status.toLowerCase()).toBe("active");

    const ordered = await markDischargeStep(ctx, admissionId, "discharge_ordered");
    expect(ordered.discharge_ordered_at).toBeTruthy();
    const billClosed = await markDischargeStep(ctx, admissionId, "bill_closed");
    expect(billClosed.bill_closed_at).toBeTruthy();
    const rxDispensed = await markDischargeStep(ctx, admissionId, "rx_dispensed");
    expect(rxDispensed.rx_dispensed_at).toBeTruthy();
    const counseled = await markDischargeStep(ctx, admissionId, "counseling_done", {
      counseling_topics: ["Medication timing", "Danger signs", "Follow-up"],
    });
    expect(counseled.counseling_done_at).toBeTruthy();
    const cardPrinted = await markDischargeStep(ctx, admissionId, "card_printed");
    expect(cardPrinted.card_printed_at).toBeTruthy();
    const bedReleased = await markDischargeStep(ctx, admissionId, "bed_released");
    expect(bedReleased.bed_released_at).toBeTruthy();

    await dischargeAdmission(ctx, admissionId);
    const completed = await markDischargeStep(ctx, admissionId, "completed", {
      notes: "E2E golden journey completed",
    });
    expect(completed.completed_at).toBeTruthy();

    const sealedMrd = await archiveMrdRecord(ctx, mrdRecord.id);
    expect(sealedMrd.status.toLowerCase()).toBe("archived");

    expect(failedUiApiCalls).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
