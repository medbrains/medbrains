/**
 * Composable journey steps reused across CRUD, journey, and form specs.
 */

import { type Page, expect } from "@playwright/test";
import { api, qs, withStepUp } from "./api";
import {
  getOpdDept,
  getFirstDrug,
  getFirstLabTest,
  getAvailableBed,
  getIpdDept,
} from "./seed-resolvers";
import type { ApiCallOptions, AuthContext } from "./types";

interface PatientLite {
  id: string;
  uhid: string;
  first_name: string;
  last_name: string;
}

interface TenantSummaryLite {
  id: string;
  code: string;
  name: string;
}

interface DoctorScheduleLite {
  id: string;
  doctor_id: string;
  department_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_mins: number;
  max_patients: number;
  is_active?: boolean;
}

type NursingShift = "morning" | "afternoon" | "night";
type MarStatus =
  | "scheduled"
  | "given"
  | "held"
  | "refused"
  | "missed"
  | "self_administered";

interface VendorLite {
  id: string;
  code: string;
  name: string;
  status?: string;
}

interface PurchaseOrderLite {
  id: string;
  po_number: string;
  vendor_id: string;
  status: string;
  total_amount: string | number;
}

interface PurchaseOrderItemLite {
  id: string;
  item_name: string;
  quantity_ordered: number;
  quantity_received?: number;
  unit_price: string | number;
}

interface PurchaseOrderDetailLite {
  purchase_order: PurchaseOrderLite;
  items: PurchaseOrderItemLite[];
}

interface GrnLite {
  id: string;
  grn_number: string;
  status: string;
  vendor_id: string;
  po_id: string;
}

interface GrnDetailLite {
  grn: GrnLite;
  items: Array<{ id: string; item_name: string; quantity_accepted: number }>;
}

interface SupplierPaymentLite {
  id: string;
  vendor_id: string;
  po_id: string | null;
  grn_id: string | null;
  status: string;
  invoice_amount: string | number;
  paid_amount: string | number;
  balance_amount: string | number;
}

export function dateDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export function isoAtDayOffset(days: number, hour = 9, minute = 0): string {
  const date = new Date(Date.now() + days * 86_400_000);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

function dayOfWeekForIsoDate(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

export async function getTenantSummary(ctx: AuthContext): Promise<TenantSummaryLite> {
  return api<TenantSummaryLite>(ctx, "GET", "/api/setup/tenant");
}

export async function ensureDoctorScheduleForDate(
  ctx: AuthContext,
  args: {
    doctorId: string;
    departmentId?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    slotDurationMins?: number;
    maxPatients?: number;
  },
): Promise<DoctorScheduleLite> {
  const date = args.date ?? dateDaysFromNow(0);
  const departmentId = args.departmentId ?? (await getOpdDept(ctx)).id;
  const dayOfWeek = dayOfWeekForIsoDate(date);
  const existing = await api<DoctorScheduleLite[]>(
    ctx,
    "GET",
    `/api/opd/schedules${qs({ doctor_id: args.doctorId, department_id: departmentId })}`,
  );
  const activeForDate = existing.find(
    (schedule) => schedule.day_of_week === dayOfWeek && schedule.is_active !== false,
  );
  if (activeForDate) return activeForDate;

  return api<DoctorScheduleLite>(ctx, "POST", "/api/opd/schedules", {
    doctor_id: args.doctorId,
    department_id: departmentId,
    day_of_week: dayOfWeek,
    start_time: args.startTime ?? "09:00:00",
    end_time: args.endTime ?? "10:00:00",
    slot_duration_mins: args.slotDurationMins ?? 15,
    max_patients: args.maxPatients ?? 20,
  });
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
    email?: string;
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
    email: base.email,
  });
  return created;
}

export async function createEncounter(
  ctx: AuthContext,
  patientId: string,
  opts: { departmentId?: string; visitType?: string; doctorId?: string } = {},
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
      doctor_id: opts.doctorId ?? ctx.userId,
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

export interface PrescriptionFanout {
  id: string;
  /** The pharmacist's review-queue entry the prescription raised. */
  pharmacyRxQueueId: string | null;
  /** The pharmacy order the prescription raised. */
  pharmacyOrderId: string | null;
}

export async function createPrescription(
  ctx: AuthContext,
  encounterId: string,
  opts: { drugId?: string; drugName?: string; itemCount?: number } = {},
): Promise<string> {
  return (await createPrescriptionDetailed(ctx, encounterId, opts)).id;
}

export async function createPrescriptionDetailed(
  ctx: AuthContext,
  encounterId: string,
  opts: { drugId?: string; drugName?: string; itemCount?: number } = {},
): Promise<PrescriptionFanout> {
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
  // Signing a prescription is a high-risk action behind step-up
  // re-authentication (Pillar 3, #3599): without a fresh `step_up` cookie the
  // handler answers 403 `step_up_required`. This helper predated the control,
  // so every journey that prescribed — the OPD and pharmacy lifecycles among
  // them — failed at this line.
  //
  // Step up when the context knows its own password; otherwise call as-is and
  // let the refusal surface, which is the honest outcome for a context that
  // genuinely cannot re-prove identity.
  const signing = ctx.password ? await withStepUp(ctx) : ctx;

  const resp = await api<{
    prescription: { id: string };
    pharmacy_rx_queue_id: string | null;
    pharmacy_order_id: string | null;
  }>(
    signing,
    "POST",
    `/api/opd/encounters/${encounterId}/prescriptions`,
    { items },
  );
  return {
    id: resp.prescription.id,
    pharmacyRxQueueId: resp.pharmacy_rx_queue_id,
    pharmacyOrderId: resp.pharmacy_order_id,
  };
}

export async function createPharmacyOrder(
  ctx: AuthContext,
  args: {
    patientId: string;
    prescriptionId?: string;
    encounterId?: string;
    quantity?: number;
    /** A specific catalogue item; the shared FEFO drug when omitted. */
    drugId?: string;
    drugName?: string;
    unitPrice?: number;
  },
): Promise<{ id: string; itemId: string }> {
  const drug = args.drugId
    ? { id: args.drugId, name: args.drugName ?? "E2E drug" }
    : await getFirstDrug(ctx);
  // POST returns { order: { id }, items: [{ id }] }
  const resp = await api<{
    order: { id: string };
    items: Array<{ id: string }>;
  }>(ctx, "POST", "/api/pharmacy/orders", {
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
    safety_override_reason: "E2E medication safety context acknowledged",
  });
  return { id: resp.order.id, itemId: resp.items[0].id };
}

export async function dispensePharmacyOrder(
  ctx: AuthContext,
  orderId: string,
  opts: { unpaidOverrideReason?: string | null } = {},
): Promise<{ id: string; status: string }> {
  // Dispensing against an outstanding balance is refused unless a reason is
  // given, and the reason is logged with the patient, the dispenser and the
  // amount. A hospital that sets `require_payment_before_dispense` refuses
  // outright and no reason will help.
  //
  // Fixtures leave the bill unpaid, so a journey testing the dispense
  // lifecycle has to say why — the same words a pharmacist would type. Pass
  // `null` to omit it deliberately and assert the refusal.
  const reason =
    opts.unpaidOverrideReason === null
      ? undefined
      : (opts.unpaidOverrideReason ?? "E2E lifecycle fixture — bill settled at the counter");

  return api<{ id: string; status: string }>(
    ctx,
    "PUT",
    `/api/pharmacy/orders/${orderId}/dispense`,
    reason ? { unpaid_override_reason: reason } : {},
  );
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
  opts: ApiCallOptions = {},
): Promise<void> {
  await api(ctx, "PUT", `/api/lab/orders/${labOrderId}/cancel`, undefined, opts);
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

export async function addBillingItem(
  ctx: AuthContext,
  invoiceId: string,
  args: { chargeCode?: string; description?: string; unitPrice?: number; quantity?: number } = {},
): Promise<{ id: string; total_price: number }> {
  return api(ctx, "POST", `/api/billing/invoices/${invoiceId}/items`, {
    charge_code: args.chargeCode ?? "CONS-001",
    description: args.description ?? "Consultation fee",
    source: "manual",
    quantity: args.quantity ?? 1,
    unit_price: args.unitPrice ?? 500,
  });
}

export interface InvoiceItemLite {
  id: string;
  charge_code: string;
  description: string;
  source: string | null;
  source_id: string | null;
  quantity: number;
  total_price: string | number;
}

export interface InvoiceDetailLite {
  invoice: { id: string; status: string; total_amount: string | number; patient_id: string };
  items: InvoiceItemLite[];
  payments: Array<{ id: string }>;
}

export async function getInvoiceDetail(ctx: AuthContext, invoiceId: string): Promise<InvoiceDetailLite> {
  return api(ctx, "GET", `/api/billing/invoices/${invoiceId}`);
}

export async function listPatientInvoices(
  ctx: AuthContext,
  patientId: string,
): Promise<Array<{ id: string; status: string }>> {
  const resp = await api<{ invoices: Array<{ id: string; status: string }> }>(
    ctx,
    "GET",
    `/api/billing/invoices${qs({ patient_id: patientId })}`,
  );
  return resp.invoices;
}

/** The invoice item a module's auto-charge wrote for one source record. */
export async function findChargeFor(
  ctx: AuthContext,
  patientId: string,
  source: string,
  sourceId: string,
): Promise<{ invoiceId: string; item: InvoiceItemLite } | undefined> {
  for (const inv of await listPatientInvoices(ctx, patientId)) {
    const detail = await getInvoiceDetail(ctx, inv.id);
    const item = detail.items.find((i) => i.source === source && i.source_id === sourceId);
    if (item) return { invoiceId: inv.id, item };
  }
  return undefined;
}

export async function setTenantSetting(
  ctx: AuthContext,
  category: string,
  key: string,
  value: unknown,
): Promise<void> {
  await api(ctx, "PUT", "/api/setup/settings", { category, key, value });
}

export async function issueInvoice(
  ctx: AuthContext,
  invoiceId: string,
): Promise<{ id: string; status: string; issued_at: string | null }> {
  return api(ctx, "POST", `/api/billing/invoices/${invoiceId}/issue`);
}

export async function admitToIpd(
  ctx: AuthContext,
  args: {
    patientId: string;
    departmentId?: string;
    bedId?: string;
    encounterId?: string;
    admissionType?: string;
    provisionalDiagnosis?: string;
  },
): Promise<string> {
  const departmentId = args.departmentId ?? (await getIpdDept(ctx)).id;
  let bedId = args.bedId;
  if (!bedId) {
    const bed = await getAvailableBed(ctx);
    bedId = bed?.id;
  }
  // POST returns { encounter, admission: { id } }
  const resp = await api<{ admission: { id: string } }>(
    ctx,
    "POST",
    "/api/ipd/admissions",
    {
      patient_id: args.patientId,
      department_id: departmentId,
      bed_id: bedId,
      encounter_id: args.encounterId,
      admission_source: "opd",
      admission_type: args.admissionType,
      provisional_diagnosis: args.provisionalDiagnosis,
    },
  );
  return resp.admission.id;
}

export async function transferAdmissionBedIfAvailable(
  ctx: AuthContext,
  admissionId: string,
): Promise<string | undefined> {
  const detail = await api<{ admission: { bed_id: string | null } }>(
    ctx,
    "GET",
    `/api/ipd/admissions/${admissionId}`,
  );
  const beds = await listAvailableBeds(ctx);
  const bed = beds.find((candidate) => candidate.bed_id !== detail.admission.bed_id);
  if (!bed) return undefined;
  await transferAdmissionBed(ctx, admissionId, bed.bed_id, "E2E transfer during golden patient journey");
  return bed.bed_id;
}

export interface AvailableBedLite {
  bed_id: string;
  bed_number: string;
  ward_id: string | null;
}

/** Uncached, unlike seed-resolvers' `getAvailableBed`: a bed journey needs the list as it is now. */
export async function listAvailableBeds(ctx: AuthContext): Promise<AvailableBedLite[]> {
  return api(ctx, "GET", "/api/ipd/beds/available");
}

export interface BedDashboardRowLite {
  bed_location_id: string;
  bed_status: string;
  admission_id: string | null;
  patient_id: string | null;
}

export async function getBedDashboardBeds(ctx: AuthContext): Promise<BedDashboardRowLite[]> {
  return api(ctx, "GET", "/api/ipd/bed-dashboard/beds");
}

export async function setBedStatus(
  ctx: AuthContext,
  bedId: string,
  status: string,
  reason?: string,
): Promise<void> {
  await api(ctx, "PUT", `/api/ipd/bed-dashboard/beds/${bedId}/status`, { status, reason });
}

export async function transferAdmissionBed(
  ctx: AuthContext,
  admissionId: string,
  bedId: string,
  notes: string,
  opts: ApiCallOptions = {},
): Promise<void> {
  await api(ctx, "PUT", `/api/ipd/admissions/${admissionId}/transfer`, { bed_id: bedId, notes }, opts);
}

export interface BedTurnaroundLite {
  id: string;
  bed_id: string;
  admission_id: string | null;
  vacated_at: string;
  ready_at: string | null;
  turnaround_minutes: number | null;
}

export async function listBedTurnaround(ctx: AuthContext): Promise<BedTurnaroundLite[]> {
  return api(ctx, "GET", "/api/ipd/bed-turnaround");
}

export async function completeBedTurnaround(ctx: AuthContext, id: string): Promise<BedTurnaroundLite> {
  return api(ctx, "POST", `/api/ipd/bed-turnaround/${id}/complete`, { notes: "E2E cleaned" });
}

export async function createIpdProgressNote(
  ctx: AuthContext,
  admissionId: string,
  opts: {
    dayOffset?: number;
    noteType?: string;
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  } = {},
): Promise<{ id: string; note_date: string; note_type: string }> {
  const dayOffset = opts.dayOffset ?? 0;
  return api(ctx, "POST", `/api/ipd/admissions/${admissionId}/progress-notes`, {
    note_type: opts.noteType ?? "doctor_round",
    note_date: dateDaysFromNow(dayOffset),
    subjective: opts.subjective ?? `Day ${dayOffset} review: symptoms improving`,
    objective: opts.objective ?? "Vitals stable, no new red flags",
    assessment: opts.assessment ?? "Observation admission, clinically stable",
    plan:
      opts.plan ??
      "Continue monitoring, medication administration, and discharge planning",
  });
}

export async function createIpdClinicalAssessment(
  ctx: AuthContext,
  admissionId: string,
  opts: {
    assessmentType?: string;
    scoreValue?: number;
    riskLevel?: string;
    scoreDetails?: Record<string, unknown>;
  } = {},
): Promise<{ id: string; assessment_type: string; risk_level: string | null }> {
  return api(ctx, "POST", `/api/ipd/admissions/${admissionId}/assessments`, {
    assessment_type: opts.assessmentType ?? "braden_scale",
    score_value: opts.scoreValue ?? 18,
    risk_level: opts.riskLevel ?? "low",
    score_details:
      opts.scoreDetails ??
      {
        sensory_perception: 4,
        moisture: 3,
        activity: 3,
        mobility: 3,
        nutrition: 3,
        friction_shear: 2,
        repositioning_plan: "Two-hourly turns while admitted",
      },
  });
}

export async function createIpdNursingAssessment(
  ctx: AuthContext,
  admissionId: string,
  opts: { dayOffset?: number } = {},
): Promise<{ id: string }> {
  const dayOffset = opts.dayOffset ?? 0;
  return api(ctx, "POST", `/api/ipd/admissions/${admissionId}/nursing-assessments`, {
    general_appearance: { status: "comfortable", day_offset: dayOffset },
    skin_assessment: { pressure_injury: false, repositioning: "explained" },
    pain_assessment: { score: dayOffset === 0 ? 3 : 1, scale: "nrs" },
    nutritional_status: { oral_intake: "adequate" },
    elimination_status: { urine: "adequate" },
    respiratory_status: { distress: false },
    psychosocial_status: { anxiety: "mild" },
    fall_risk_assessment: {
      risk: dayOffset === 0 ? "moderate" : "low",
      side_rails: true,
    },
    allergies: "No known drug allergy recorded during E2E journey",
    medications_on_admission: "Paracetamol as prescribed",
    personal_belongings: { documented: true, handed_to: "patient" },
    patient_education_needs: "Medication timing, fall prevention, call-bell use",
  });
}

export async function createIpdCarePlan(
  ctx: AuthContext,
  admissionId: string,
  opts: { dayOffset?: number; diagnosis?: string } = {},
): Promise<{ id: string; status: string }> {
  const dayOffset = opts.dayOffset ?? 0;
  return api(ctx, "POST", `/api/ipd/admissions/${admissionId}/care-plans`, {
    nursing_diagnosis: opts.diagnosis ?? "Risk for falls related to inpatient observation",
    goals: `Day ${dayOffset}: patient remains free from fall and pressure injury`,
    interventions: [
      "Verify patient using two identifiers before care",
      "Keep call bell within reach",
      "Reposition and inspect pressure areas each shift",
    ],
    evaluation: "Plan active and communicated in handover",
  });
}

export async function createIpdMar(
  ctx: AuthContext,
  admissionId: string,
  opts: {
    dayOffset?: number;
    drugName?: string;
    scheduledHour?: number;
    highAlert?: boolean;
  } = {},
): Promise<{ id: string; status: string; scheduled_at: string }> {
  const dayOffset = opts.dayOffset ?? 0;
  return api(ctx, "POST", `/api/ipd/admissions/${admissionId}/mar`, {
    drug_name: opts.drugName ?? "E2E Paracetamol",
    dose: "500 mg",
    route: "oral",
    frequency: "TID",
    scheduled_at: isoAtDayOffset(dayOffset, opts.scheduledHour ?? 8, 0),
    is_high_alert: opts.highAlert ?? false,
  });
}

export async function updateIpdMar(
  ctx: AuthContext,
  admissionId: string,
  marId: string,
  opts: {
    status?: MarStatus;
    dayOffset?: number;
    barcodeVerified?: boolean;
    notes?: string;
  } = {},
): Promise<{ id: string; status: string; administered_at: string | null }> {
  const status = opts.status ?? "given";
  return api(ctx, "PUT", `/api/ipd/admissions/${admissionId}/mar/${marId}`, {
    status,
    administered_at:
      status === "given" ? isoAtDayOffset(opts.dayOffset ?? 0, 8, 15) : undefined,
    barcode_verified: opts.barcodeVerified ?? true,
    notes: opts.notes ?? "E2E 5-rights medication administration check completed",
  });
}

export async function createIpdIoEntry(
  ctx: AuthContext,
  admissionId: string,
  opts: {
    isIntake: boolean;
    category?: string;
    volumeMl: number;
    shift?: NursingShift;
    dayOffset?: number;
  },
): Promise<{ id: string; is_intake: boolean; volume_ml: string | number }> {
  return api(ctx, "POST", `/api/ipd/admissions/${admissionId}/io`, {
    is_intake: opts.isIntake,
    category: opts.category ?? (opts.isIntake ? "oral_fluids" : "urine"),
    volume_ml: opts.volumeMl,
    description: `E2E day ${opts.dayOffset ?? 0} ${opts.isIntake ? "intake" : "output"}`,
    shift: opts.shift ?? "morning",
  });
}

export async function getIpdIoBalance(
  ctx: AuthContext,
  admissionId: string,
): Promise<{
  total_intake_ml: string | number;
  total_output_ml: string | number;
  balance_ml: string | number;
}> {
  return api(ctx, "GET", `/api/ipd/admissions/${admissionId}/io/balance`);
}

export async function createIpdHandover(
  ctx: AuthContext,
  admissionId: string,
  args: {
    incomingNurseId: string;
    dayOffset?: number;
    shift?: NursingShift;
  },
): Promise<{ id: string; handover_date: string; acknowledged_at: string | null }> {
  const dayOffset = args.dayOffset ?? 0;
  return api(ctx, "POST", `/api/ipd/admissions/${admissionId}/handovers`, {
    shift: args.shift ?? "morning",
    handover_date: dateDaysFromNow(dayOffset),
    incoming_nurse: args.incomingNurseId,
    identification: "Two identifiers checked: UHID and patient phone",
    situation: `E2E day ${dayOffset} inpatient observation`,
    background: "Admitted from OPD for observation after consultation",
    assessment: "Stable, fall-prevention and medication plan active",
    recommendation: "Continue MAR, I/O charting, pressure-area checks, and discharge readiness",
    pending_tasks: ["medication_due", "io_balance_review", "discharge_readiness_review"],
  });
}

export async function acknowledgeIpdHandover(
  ctx: AuthContext,
  admissionId: string,
  handoverId: string,
): Promise<{ id: string; acknowledged_at: string | null }> {
  return api(
    ctx,
    "PUT",
    `/api/ipd/admissions/${admissionId}/handovers/${handoverId}/acknowledge`,
  );
}

export async function createProcurementVendor(
  ctx: AuthContext,
  opts: {
    code?: string;
    name?: string;
    vendorType?: string;
    supplyCategories?: string[];
  } = {},
): Promise<VendorLite> {
  const stamp = String(Date.now()).slice(-9);
  return api(ctx, "POST", "/api/procurement/vendors", {
    code: opts.code ?? `E2EV${stamp}`,
    name: opts.name ?? `E2E External Vendor ${stamp}`,
    vendor_type: opts.vendorType ?? "supplier",
    contact_person: "E2E Vendor Contact",
    phone: `98${stamp.slice(-8)}`,
    email: `vendor.${stamp}@e2e.medbrains.localhost`,
    gst_number: `29ABCDE${stamp.slice(-4)}F1Z5`,
    payment_terms: "Net 15",
    supply_categories: opts.supplyCategories ?? ["general_consumables"],
    notes: "Created by actor-perspective external vendor journey",
  });
}

export async function createPurchaseOrder(
  ctx: AuthContext,
  opts: {
    vendorId: string;
    itemName?: string;
    itemCode?: string;
    quantity?: number;
    unitPrice?: string;
    expectedDelivery?: string;
  },
): Promise<PurchaseOrderDetailLite> {
  const itemName = opts.itemName ?? "E2E Vendor Consumable";
  return api(ctx, "POST", "/api/procurement/purchase-orders", {
    vendor_id: opts.vendorId,
    expected_delivery: opts.expectedDelivery ?? dateDaysFromNow(2),
    payment_terms: "Net 15 after accepted GRN",
    delivery_terms: "Vendor delivery to receiving store",
    notes: "External vendor fulfilment journey PO",
    items: [
      {
        item_name: itemName,
        item_code: opts.itemCode ?? "E2E-CONSUMABLE",
        unit: "unit",
        quantity_ordered: opts.quantity ?? 10,
        unit_price: opts.unitPrice ?? "125.00",
        tax_percent: "0",
        discount_percent: "0",
        notes: "Externally supplied E2E item",
      },
    ],
  });
}

export async function approvePurchaseOrder(
  ctx: AuthContext,
  purchaseOrderId: string,
): Promise<PurchaseOrderLite> {
  return api(ctx, "PUT", `/api/procurement/purchase-orders/${purchaseOrderId}/approve`);
}

export async function sendPurchaseOrderToVendor(
  ctx: AuthContext,
  purchaseOrderId: string,
): Promise<PurchaseOrderLite> {
  return api(ctx, "PUT", `/api/procurement/purchase-orders/${purchaseOrderId}/send`);
}

export async function createGoodsReceiptNote(
  ctx: AuthContext,
  opts: {
    purchaseOrderId: string;
    purchaseOrderItem: PurchaseOrderItemLite;
    invoiceAmount?: string;
    invoiceDate?: string;
  },
): Promise<GrnDetailLite> {
  return api(ctx, "POST", "/api/procurement/grns", {
    po_id: opts.purchaseOrderId,
    invoice_number: `INV-E2E-${String(Date.now()).slice(-8)}`,
    invoice_date: opts.invoiceDate ?? dateDaysFromNow(2),
    invoice_amount: opts.invoiceAmount ?? "1250.00",
    notes: "Vendor delivery received and checked by store",
    items: [
      {
        po_item_id: opts.purchaseOrderItem.id,
        item_name: opts.purchaseOrderItem.item_name,
        quantity_received: opts.purchaseOrderItem.quantity_ordered,
        quantity_accepted: opts.purchaseOrderItem.quantity_ordered,
        quantity_rejected: 0,
        unit_price: String(opts.purchaseOrderItem.unit_price),
        notes: "Accepted after vendor delivery inspection",
      },
    ],
  });
}

export async function completeGoodsReceiptNote(
  ctx: AuthContext,
  grnId: string,
): Promise<GrnLite> {
  return api(ctx, "PUT", `/api/procurement/grns/${grnId}/complete`);
}

export async function createSupplierPayment(
  ctx: AuthContext,
  opts: {
    vendorId: string;
    purchaseOrderId: string;
    grnId: string;
    invoiceAmount?: string;
    paidAmount?: string;
  },
): Promise<SupplierPaymentLite> {
  return api(ctx, "POST", "/api/procurement/supplier-payments", {
    vendor_id: opts.vendorId,
    po_id: opts.purchaseOrderId,
    grn_id: opts.grnId,
    invoice_amount: opts.invoiceAmount ?? "1250.00",
    paid_amount: opts.paidAmount ?? "0",
    due_date: dateDaysFromNow(15),
    payment_method: "bank_transfer",
    reference_number: `E2E-PAY-${String(Date.now()).slice(-8)}`,
    notes: "Vendor invoice acknowledged for payment",
  });
}

export async function listSupplierPayments(
  ctx: AuthContext,
  vendorId: string,
): Promise<SupplierPaymentLite[]> {
  return api(
    ctx,
    "GET",
    `/api/procurement/supplier-payments${qs({ vendor_id: vendorId })}`,
  );
}

export async function markDischargeStep(
  ctx: AuthContext,
  admissionId: string,
  step: string,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  return api(
    ctx,
    "POST",
    `/api/ipd/admissions/${admissionId}/discharge-workflow/step`,
    { step, ...extra },
  );
}

export async function dischargeAdmission(
  ctx: AuthContext,
  admissionId: string,
): Promise<void> {
  await api(ctx, "PUT", `/api/ipd/admissions/${admissionId}/discharge`, {
    discharge_type: "normal",
    discharge_summary: "E2E golden journey discharge",
  });
}

export async function createMrdRecord(
  ctx: AuthContext,
  patientId: string,
): Promise<{ id: string; status: string }> {
  return api(ctx, "POST", "/api/mrd/records", {
    patient_id: patientId,
    record_type: "ipd",
    total_pages: 12,
    shelf_location: "E2E",
    retention_years: 10,
    notes: "E2E golden journey MRD record",
  });
}

export async function archiveMrdRecord(
  ctx: AuthContext,
  recordId: string,
): Promise<{ id: string; status: string }> {
  return api(ctx, "PUT", `/api/mrd/records/${recordId}`, {
    status: "archived",
    notes: "Sealed after E2E discharge workflow",
  });
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
  opts: { skipApproval?: boolean } = {},
): Promise<void> {
  // A return is a state machine, not a flag:
  //
  //   requested → approved | rejected
  //   approved  → returned_to_stock | destroyed
  //
  // Medicine coming back over the counter cannot go straight onto the shelf.
  // Somebody approves it first, having checked it is intact, in date and was
  // stored properly — which is why `requested → returned_to_stock` is refused
  // with a 409 rather than allowed. This helper skipped the approval and the
  // lifecycle journey died there.
  //
  // `skipApproval` exists so a test can assert that refusal deliberately.
  if (!opts.skipApproval) {
    await api(ctx, "PUT", `/api/pharmacy/returns/${returnId}/process`, {
      status: "approved",
    });
  }

  const status = action === "restock" ? "returned_to_stock" : "destroyed";
  await api(ctx, "PUT", `/api/pharmacy/returns/${returnId}/process`, {
    status,
  });
}

// ---------------------------------------------------------------------------
// Lab — sample collection, result entry, critical alerts
// ---------------------------------------------------------------------------

export interface LabResultRow {
  id: string;
  parameter_name: string;
  value: string;
  unit: string | null;
  flag: string | null;
  is_delta_flagged: boolean;
}

export interface CriticalAlertLite {
  id: string;
  order_id: string;
  patient_id: string;
  parameter_name: string;
  value: string;
  flag: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
}

/** Collection confirms identity first: the identifier must match the order's patient. */
export async function collectLabSample(
  ctx: AuthContext,
  orderId: string,
  patientIdentifier: string,
): Promise<void> {
  await api(ctx, "PUT", `/api/lab/orders/${orderId}/collect`, {
    patient_identifier: patientIdentifier,
    collected_at: new Date().toISOString(),
    collection_notes: "E2E sample collection",
  });
}

export async function processLabOrder(
  ctx: AuthContext,
  orderId: string,
): Promise<void> {
  await api(ctx, "PUT", `/api/lab/orders/${orderId}/process`, {});
}

export async function addLabResults(
  ctx: AuthContext,
  orderId: string,
  results: Array<{ parameter_name: string; value: string; unit?: string; flag?: string; notes?: string }>,
): Promise<LabResultRow[]> {
  return api(ctx, "POST", `/api/lab/orders/${orderId}/results`, { results });
}

export async function completeLabOrder(
  ctx: AuthContext,
  orderId: string,
): Promise<void> {
  await api(ctx, "PUT", `/api/lab/orders/${orderId}/complete`, {});
}

export async function verifyLabResults(
  ctx: AuthContext,
  orderId: string,
  opts: ApiCallOptions = {},
): Promise<void> {
  await api(ctx, "PUT", `/api/lab/orders/${orderId}/verify`, {}, opts);
}

export async function listCriticalAlerts(
  ctx: AuthContext,
): Promise<CriticalAlertLite[]> {
  return api(ctx, "GET", "/api/lab/critical-alerts");
}

export async function acknowledgeLabCriticalAlert(
  ctx: AuthContext,
  alertId: string,
  readbackValue: string,
  opts: ApiCallOptions = {},
): Promise<CriticalAlertLite> {
  // Closing the loop means reading the value back; it must match what was reported.
  return api(
    ctx,
    "PUT",
    `/api/lab/critical-alerts/${alertId}/acknowledge`,
    { readback_value: readbackValue },
    opts,
  );
}

export async function getDoctorCriticalAlerts(
  ctx: AuthContext,
): Promise<CriticalAlertLite[]> {
  return api(ctx, "GET", `/api/lab/critical-alerts/doctor/${ctx.userId}`);
}

// ---------------------------------------------------------------------------
// Emergency — visits, triage, MLC, police intimation
// ---------------------------------------------------------------------------

export interface EmergencyVisitLite {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  visit_number: string;
  status: string;
  triage_level: string | null;
  admission_id: string | null;
  is_mlc: boolean;
}

export type TriageLevel =
  | "immediate"
  | "emergent"
  | "urgent"
  | "less_urgent"
  | "non_urgent"
  | "expectant";

export interface TriageLite {
  id: string;
  er_visit_id: string;
  triage_level: TriageLevel;
  chief_complaint: string | null;
}

export interface MlcCaseLite {
  id: string;
  mlc_number: string;
  er_visit_id: string | null;
  patient_id: string;
  case_type: string | null;
  status: string;
}

export interface PoliceIntimationLite {
  id: string;
  mlc_case_id: string;
  intimation_number: string;
  police_station: string;
  sent_via: string | null;
  sent_at: string;
}

export async function createEmergencyVisit(
  ctx: AuthContext,
  patientId: string,
  opts: { arrivalMode?: string; chiefComplaint?: string } = {},
): Promise<EmergencyVisitLite> {
  return api(ctx, "POST", "/api/emergency/visits", {
    patient_id: patientId,
    arrival_mode: opts.arrivalMode ?? "walk_in",
    chief_complaint: opts.chiefComplaint ?? "E2E test complaint",
  });
}

export async function getEmergencyVisit(ctx: AuthContext, visitId: string): Promise<EmergencyVisitLite> {
  return api(ctx, "GET", `/api/emergency/visits/${visitId}`);
}

export async function createTriage(
  ctx: AuthContext,
  visitId: string,
  triageLevel: TriageLevel = "urgent",
): Promise<TriageLite> {
  return api(ctx, "POST", `/api/emergency/visits/${visitId}/triage`, {
    triage_level: triageLevel,
    chief_complaint: "E2E triage assessment",
    pulse_rate: 88,
    blood_pressure_systolic: 120,
    blood_pressure_diastolic: 80,
    spo2: 98,
    respiratory_rate: 16,
    gcs_score: 15,
    pain_score: 4,
    notes: "E2E triage note",
  });
}

export async function createMlcCase(
  ctx: AuthContext,
  args: { patientId: string; visitId?: string; caseType?: string },
  opts: ApiCallOptions = {},
): Promise<MlcCaseLite> {
  return api(
    ctx,
    "POST",
    "/api/emergency/mlc",
    {
      patient_id: args.patientId,
      er_visit_id: args.visitId,
      case_type: args.caseType ?? "road_traffic_accident",
      history_of_incident: "E2E MLC case",
      examination_findings: "Laceration 3 cm on forehead; conscious, GCS 15",
    },
    opts,
  );
}

export async function createPoliceIntimation(
  ctx: AuthContext,
  mlcId: string,
  policeStation = "E2E Police Station",
  opts: ApiCallOptions = {},
): Promise<PoliceIntimationLite> {
  return api(
    ctx,
    "POST",
    `/api/emergency/mlc/${mlcId}/police-intimations`,
    { police_station: policeStation, sent_via: "in_person", notes: "E2E police intimation" },
    opts,
  );
}

export interface ErAdmissionLite {
  er_visit_id: string;
  admission_id: string;
  encounter_id: string;
  patient_id: string;
  ward_id: string | null;
  bed_id: string;
  status: string;
}

export async function admitFromEr(
  ctx: AuthContext,
  visitId: string,
  args: { bedId: string; admittingDoctorId: string; wardId?: string },
  opts: ApiCallOptions = {},
): Promise<ErAdmissionLite> {
  return api(
    ctx,
    "POST",
    `/api/emergency/visits/${visitId}/admit`,
    {
      bed_id: args.bedId,
      admitting_doctor_id: args.admittingDoctorId,
      ward_id: args.wardId,
      admission_notes: "E2E admitted from the ER",
    },
    opts,
  );
}

// ---------------------------------------------------------------------------
// Pharmacy — NDPS register
// ---------------------------------------------------------------------------

export interface NdpsEntryLite {
  id: string;
  catalog_item_id: string;
  action: string;
  quantity: number;
  balance_after: number;
  patient_id: string | null;
  witnessed_by: string | null;
  notes: string | null;
}

export async function createNdpsEntry(
  ctx: AuthContext,
  args: {
    catalogItemId: string;
    patientId?: string;
    action?: string;
    quantity: number;
    witnessUserId?: string;
    prescriptionId?: string;
    notes?: string;
  },
): Promise<NdpsEntryLite> {
  return api(ctx, "POST", "/api/pharmacy/ndps-register", {
    catalog_item_id: args.catalogItemId,
    action: args.action ?? "dispensed",
    quantity: args.quantity,
    patient_id: args.patientId,
    prescription_id: args.prescriptionId,
    witnessed_by: args.witnessUserId,
    notes: args.notes ?? "E2E NDPS dispense",
  });
}

export async function listNdpsEntries(
  ctx: AuthContext,
): Promise<NdpsEntryLite[]> {
  const resp = await api<{ entries: NdpsEntryLite[] } | NdpsEntryLite[]>(
    ctx,
    "GET",
    "/api/pharmacy/ndps-register",
  );
  return Array.isArray(resp) ? resp : resp.entries;
}

// ---------------------------------------------------------------------------
// Insurance — patient policy, verification, prior auth
// ---------------------------------------------------------------------------

export interface PatientInsuranceLite {
  id: string;
  patient_id: string;
  insurance_provider: string;
  policy_number: string;
}

export interface InsuranceVerificationLite {
  id: string;
  patient_id: string;
  status: string;
  coverage_type: string | null;
}

export interface PriorAuthLite {
  id: string;
  patient_insurance_id: string;
  status: string;
  approved_amount: string | number | null;
  auth_number: string | null;
  denial_reason: string | null;
}

export async function createPatientInsurance(
  ctx: AuthContext,
  patientId: string,
): Promise<PatientInsuranceLite> {
  const today = new Date().toISOString().split("T")[0];
  const nextYear = new Date(Date.now() + 365 * 86400_000).toISOString().split("T")[0];
  return api(ctx, "POST", `/api/patients/${patientId}/insurance`, {
    insurance_provider: "E2E TPA Insurance",
    policy_number: `E2E-POL-${Date.now()}`,
    member_id: "E2E-MEM-001",
    tpa_name: "E2E TPA",
    valid_from: today,
    valid_until: nextYear,
    coverage_type: "cashless",
    sum_insured: 500000,
    priority: 1,
    is_active: true,
  });
}

export async function createInsuranceVerification(
  ctx: AuthContext,
  patientId: string,
  patientInsuranceId: string,
): Promise<InsuranceVerificationLite> {
  return api(ctx, "POST", "/api/insurance/verifications", {
    patient_id: patientId,
    patient_insurance_id: patientInsuranceId,
    trigger_point: "manual",
    trigger_entity_id: null,
  });
}

export async function createPriorAuth(
  ctx: AuthContext,
  args: {
    patientId: string;
    patientInsuranceId: string;
    encounterId?: string;
    diagnosisCode?: string;
    estimatedCost?: number;
  },
): Promise<PriorAuthLite> {
  return api(ctx, "POST", "/api/insurance/prior-auths", {
    patient_id: args.patientId,
    patient_insurance_id: args.patientInsuranceId,
    service_type: "inpatient",
    service_description: "E2E Test Procedure",
    diagnosis_codes: args.diagnosisCode ? [args.diagnosisCode] : ["J18.9"],
    encounter_id: args.encounterId ?? null,
    estimated_cost: args.estimatedCost ?? 30000,
  });
}

export async function submitPriorAuth(
  ctx: AuthContext,
  priorAuthId: string,
): Promise<PriorAuthLite> {
  return api(ctx, "POST", `/api/insurance/prior-auths/${priorAuthId}/submit`, {});
}

export async function respondPriorAuth(
  ctx: AuthContext,
  priorAuthId: string,
  decision: "approved" | "denied" | "partially_approved",
  approvedAmount?: number,
): Promise<PriorAuthLite> {
  return api(ctx, "POST", `/api/insurance/prior-auths/${priorAuthId}/respond`, {
    status: decision,
    approved_amount: approvedAmount ?? null,
    auth_number: decision === "approved" ? "E2E-AUTH-001" : null,
    denial_reason: decision === "denied" ? "E2E denial — not covered" : null,
    notes: `E2E ${decision} decision`,
  });
}

// ---------------------------------------------------------------------------
// Billing — payments, day close, reports
// ---------------------------------------------------------------------------

export interface BillingPaymentLite {
  id: string;
  invoice_id: string;
  amount: string | number;
  mode: string;
  paid_at: string;
}

export interface DayCloseLite {
  id: string;
  close_date: string;
  status: string;
  total_collection: number;
}

export async function recordBillingPayment(
  ctx: AuthContext,
  invoiceId: string,
  amount: number,
  paymentMode: "cash" | "card" | "upi" | "cheque" = "cash",
): Promise<BillingPaymentLite> {
  return api(ctx, "POST", `/api/billing/invoices/${invoiceId}/payments`, {
    amount,
    mode: paymentMode,
    reference_number: `E2E-PAY-${Date.now()}`,
    notes: "E2E payment",
  });
}

export async function createDayClose(
  ctx: AuthContext,
  closeDate: string,
): Promise<DayCloseLite> {
  return api(ctx, "POST", "/api/billing/day-closes", {
    close_date: closeDate,
    actual_cash: 0,
    actual_card: 0,
    actual_upi: 0,
    notes: "E2E day close",
  });
}

export async function getBillingDailyReport(
  ctx: AuthContext,
  date: string,
): Promise<Record<string, unknown>> {
  return api(ctx, "GET", `/api/billing/reports/daily${qs({ date })}`);
}

export async function getBillingDepartmentRevenue(
  ctx: AuthContext,
  fromDate: string,
  toDate: string,
): Promise<Record<string, unknown>> {
  return api(ctx, "GET", `/api/billing/reports/department-revenue${qs({ from: fromDate, to: toDate })}`);
}

export async function getBillingAgingReport(
  ctx: AuthContext,
): Promise<Record<string, unknown>> {
  return api(ctx, "GET", "/api/billing/reports/aging");
}

// ─── Notifications ───────────────────────────────────────────────────

export interface NotificationLite {
  id: string;
  title: string;
  body?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action_url?: string | null;
  is_read: boolean;
}

/** The caller's own feed. `unread` narrows to what the bell would show. */
export async function listNotifications(
  ctx: AuthContext,
  opts: { unread?: boolean; limit?: number } = {},
): Promise<NotificationLite[]> {
  const resp = await api<{ notifications: NotificationLite[] }>(
    ctx,
    "GET",
    `/api/notifications${qs({ unread: opts.unread ? "true" : undefined, limit: opts.limit ?? 50 })}`,
  );
  return resp.notifications;
}

// ─── Nurse roster ────────────────────────────────────────────────────

export interface RosterCandidateLite {
  id: string;
  full_name: string;
}

export interface RosterEntryLite {
  id: string;
  nurse_user_id: string;
  ward_id: string | null;
  shift_date: string;
  shift_type: string;
  is_charge: boolean | null;
}

/** Needs `nurse.roster.manage`, which no built-in role holds — call as a bypass role. */
export async function getRosterCandidates(ctx: AuthContext): Promise<RosterCandidateLite[]> {
  return api(ctx, "GET", "/api/nurse/roster/candidates");
}

export async function rosterNurse(
  ctx: AuthContext,
  args: {
    nurseUserId: string;
    wardId: string;
    shiftType?: "day" | "evening" | "night";
    shiftDate?: string;
    isCharge?: boolean;
  },
  opts: ApiCallOptions = {},
): Promise<{ id: string }> {
  return api(
    ctx,
    "POST",
    "/api/nurse/roster",
    {
      nurse_user_id: args.nurseUserId,
      ward_id: args.wardId,
      shift_type: args.shiftType ?? "day",
      shift_date: args.shiftDate,
      is_charge: args.isCharge ?? false,
    },
    opts,
  );
}

export async function listRoster(
  ctx: AuthContext,
  args: { wardId?: string; shiftDate?: string } = {},
): Promise<RosterEntryLite[]> {
  return api(ctx, "GET", `/api/nurse/roster${qs({ ward_id: args.wardId, shift_date: args.shiftDate })}`);
}

export async function deleteRosterEntry(ctx: AuthContext, id: string): Promise<void> {
  await api(ctx, "DELETE", `/api/nurse/roster/${id}`);
}

// ─── Code blue ───────────────────────────────────────────────────────

export interface CodeBlueResponderLite {
  code_blue_id: string;
  user_id: string;
  user_name: string;
  seconds_after_call: number;
}

export async function startCodeBlue(
  ctx: AuthContext,
  args: { patientId: string; location: string; encounterId?: string },
): Promise<{ id: string }> {
  return api(ctx, "POST", "/api/nurse/code-blue", {
    patient_id: args.patientId,
    location: args.location,
    encounter_id: args.encounterId,
  });
}

export async function respondCodeBlue(
  ctx: AuthContext,
  id: string,
  opts: ApiCallOptions = {},
): Promise<unknown> {
  return api(ctx, "POST", `/api/nurse/code-blue/${id}/respond`, undefined, opts);
}

/** Everyone who has answered every arrest still in progress. */
export async function listCodeBlueResponders(ctx: AuthContext): Promise<CodeBlueResponderLite[]> {
  return api(ctx, "GET", "/api/nurse/code-blue/responders");
}

export async function endCodeBlue(
  ctx: AuthContext,
  id: string,
  outcome = "rosc",
): Promise<{ id: string; ended_at: string | null }> {
  return api(ctx, "PUT", `/api/nurse/code-blue/${id}/end`, { outcome });
}

// ─── Nursing tasks ───────────────────────────────────────────────────

export interface NursingTaskLite {
  id: string;
  admission_id: string;
  assigned_to: string | null;
  task_type: string;
  due_at: string | null;
}

export async function listAdmissionTasks(ctx: AuthContext, admissionId: string): Promise<NursingTaskLite[]> {
  return api(ctx, "GET", `/api/ipd/admissions/${admissionId}/tasks`);
}

// ─── Blood bank ──────────────────────────────────────────────────────

export interface BloodComponentLite {
  id: string;
  donation_id: string;
  status: string;
}

/** A patient with a blood group — the transfusion handler refuses one without. */
export async function createPatientWithBloodGroup(
  ctx: AuthContext,
  bloodGroup: string,
): Promise<{ id: string }> {
  const ts = Date.now().toString(36);
  // Digits only: the patient validator rejects base-36 letters in a phone.
  const digits = Date.now().toString().slice(-8);
  return api(ctx, "POST", "/api/patients", {
    first_name: `E2E${ts}`,
    last_name: "Transfusion",
    gender: "female",
    phone: `98${digits}`,
    blood_group: bloodGroup,
  });
}

export async function createDonor(ctx: AuthContext, bloodGroup: string): Promise<{ id: string }> {
  const ts = Date.now().toString(36);
  return api(ctx, "POST", "/api/blood-bank/donors", {
    donor_number: `E2E-D-${ts}`,
    first_name: "E2E",
    last_name: `Donor${ts}`,
    blood_group: bloodGroup,
  });
}

export async function createDonation(ctx: AuthContext, donorId: string): Promise<{ id: string }> {
  return api(ctx, "POST", `/api/blood-bank/donors/${donorId}/donations`, {
    bag_number: `E2E-BAG-${Date.now().toString(36)}`,
    volume_ml: 450,
  });
}

export async function createBloodComponent(
  ctx: AuthContext,
  args: { donationId: string; bloodGroup: string; componentType: string },
): Promise<{ id: string }> {
  const expiry = new Date(Date.now() + 30 * 24 * 3_600_000).toISOString();
  return api(ctx, "POST", "/api/blood-bank/components", {
    donation_id: args.donationId,
    component_type: args.componentType,
    bag_number: `E2E-C-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    blood_group: args.bloodGroup,
    volume_ml: 250,
    expiry_at: expiry,
  });
}

export async function setBloodComponentStatus(ctx: AuthContext, id: string, status: string): Promise<void> {
  await api(ctx, "PUT", `/api/blood-bank/components/${id}/status`, { status });
}

export async function listBloodComponents(ctx: AuthContext): Promise<BloodComponentLite[]> {
  return api(ctx, "GET", "/api/blood-bank/components");
}

export async function createTransfusion(
  ctx: AuthContext,
  args: { patientId: string; componentId: string; patientVerifiedBy: string; productVerifiedBy: string },
): Promise<{ id: string }> {
  return api(ctx, "POST", "/api/blood-bank/transfusions", {
    patient_id: args.patientId,
    component_id: args.componentId,
    patient_verified_by: args.patientVerifiedBy,
    product_verified_by: args.productVerifiedBy,
  });
}

export async function recordTransfusionReaction(
  ctx: AuthContext,
  transfusionId: string,
  args: { reactionType: string; severity: "mild" | "moderate" | "severe" | "fatal" },
): Promise<unknown> {
  return api(ctx, "PUT", `/api/blood-bank/transfusions/${transfusionId}/reaction`, {
    reaction_type: args.reactionType,
    reaction_severity: args.severity,
  });
}

// ─── BME ─────────────────────────────────────────────────────────────

export interface BmeEquipmentLite {
  id: string;
  status: string;
}

export async function createBmeEquipment(
  ctx: AuthContext,
  args: { name: string; status: "active" | "under_maintenance" | "out_of_service" | "condemned" },
): Promise<BmeEquipmentLite> {
  return api(ctx, "POST", "/api/bme/equipment", { name: args.name, status: args.status });
}

export async function getBmeEquipment(ctx: AuthContext, id: string): Promise<BmeEquipmentLite> {
  return api(ctx, "GET", `/api/bme/equipment/${id}`);
}

export async function createBreakdown(
  ctx: AuthContext,
  args: { equipmentId: string; description?: string },
): Promise<{ id: string }> {
  return api(ctx, "POST", "/api/bme/breakdowns", {
    equipment_id: args.equipmentId,
    description: args.description ?? "E2E breakdown",
  });
}

// ─── Quality ─────────────────────────────────────────────────────────

export interface QualityIncidentLite {
  id: string;
  title: string;
  incident_type: string;
  severity: string;
  patient_id: string | null;
}

export async function createQualityIncident(
  ctx: AuthContext,
  args: {
    title: string;
    incidentType: string;
    severity: "near_miss" | "minor" | "moderate" | "major" | "sentinel";
    patientId?: string;
  },
): Promise<QualityIncidentLite> {
  return api(ctx, "POST", "/api/quality/incidents", {
    title: args.title,
    incident_type: args.incidentType,
    severity: args.severity,
    incident_date: new Date().toISOString(),
    patient_id: args.patientId,
    description: "E2E linkage incident",
  });
}

/** No incident_type filter server-side; filter here. */
export async function listQualityIncidents(ctx: AuthContext): Promise<QualityIncidentLite[]> {
  return api(ctx, "GET", "/api/quality/incidents");
}

export async function listSentinelIncidents(ctx: AuthContext): Promise<QualityIncidentLite[]> {
  return api(ctx, "GET", "/api/quality/incidents/sentinel");
}

/** Current-month rollup value for one NABH indicator, or null when it has none. */
export async function nabhIndicator(ctx: AuthContext, code: string): Promise<number | null> {
  const resp = await api<{ indicators: Array<{ code: string; value_current_month: number | null }> }>(
    ctx,
    "GET",
    "/api/nabh/indicators",
  );
  return resp.indicators.find((i) => i.code === code)?.value_current_month ?? null;
}
