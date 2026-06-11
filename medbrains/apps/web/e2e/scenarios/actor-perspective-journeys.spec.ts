/**
 * Actor-perspective journeys.
 *
 * Coverage intent:
 * - patient/public access without a hospital login
 * - hospital handoffs by real role credentials
 * - external user/vendor fulfilment through procurement
 * - inpatient continuity across multiple dates
 * - external system exchange surfaces
 */

import { expect, test } from "@playwright/test";
import { getE2EIdentity } from "../helpers/e2e-identities";
import {
  api,
  externalApi,
  getAuthContextFromCookies,
  loginAsRoleApi,
  publicApi,
  qs,
} from "../helpers/api";
import { getAvailableBed, getFirstDrug, getIpdDept, getOpdDept } from "../helpers/seed-resolvers";
import {
  acknowledgeIpdHandover,
  admitToIpd,
  approvePurchaseOrder,
  completeGoodsReceiptNote,
  createConsultation,
  createEncounter,
  createGoodsReceiptNote,
  createInvoice,
  createIpdCarePlan,
  createIpdClinicalAssessment,
  createIpdHandover,
  createIpdIoEntry,
  createIpdMar,
  createIpdNursingAssessment,
  createIpdProgressNote,
  createLabOrder,
  createPatientApi,
  createPharmacyOrder,
  createProcurementVendor,
  createPurchaseOrder,
  createPrescription,
  createSupplierPayment,
  dateDaysFromNow,
  dispensePharmacyOrder,
  ensureDoctorScheduleForDate,
  getIpdIoBalance,
  getTenantSummary,
  issueInvoice,
  listSupplierPayments,
  sendPurchaseOrderToVendor,
  updateIpdMar,
} from "../helpers/journey-steps";

interface PublicSlot {
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface PublicBookingResponse {
  appointment_id: string;
  qr_code_data: string;
  status: string;
}

interface KioskCheckinResponse {
  appointment_id: string;
  token_number: string;
  status: string;
}

test.describe("Actor-perspective user journeys", () => {
  test("patient/public user books OPD and checks in at kiosk", async ({ request }) => {
    test.info().annotations.push({
      type: "tcms",
      description: "Journey::Patient public appointment booking and kiosk check-in",
    });

    const adminCtx = await getAuthContextFromCookies(request);
    const doctor = getE2EIdentity("doctor");
    const department = await getOpdDept(adminCtx);
    const appointmentDate = dateDaysFromNow(0);

    await ensureDoctorScheduleForDate(adminCtx, {
      doctorId: doctor.id,
      departmentId: department.id,
      date: appointmentDate,
    });

    const tenant = await getTenantSummary(adminCtx);
    const slots = await publicApi<PublicSlot[]>(
      request,
      "GET",
      `/api/public/appointments/slots${qs({
        tenant_code: tenant.code,
        doctor_id: doctor.id,
        date: appointmentDate,
      })}`,
    );
    const slot = slots.find((candidate) => candidate.is_available) ?? slots[0];
    expect(slot, "public slot should be available for the doctor schedule").toBeTruthy();

    const stamp = Date.now();
    const booking = await publicApi<PublicBookingResponse>(
      request,
      "POST",
      "/api/public/appointments/book",
      {
        tenant_code: tenant.code,
        doctor_id: doctor.id,
        department_id: department.id,
        appointment_date: appointmentDate,
        slot_start: slot.start_time,
        slot_end: slot.end_time,
        patient_name: `Public E2E ${stamp}`,
        patient_phone: `97${String(stamp).slice(-8)}`,
        patient_dob: "1990-01-01",
        reason: "Public journey appointment check",
      },
    );
    expect(booking.status).toBe("confirmed");
    expect(booking.qr_code_data).toBeTruthy();

    const checkin = await publicApi<KioskCheckinResponse>(
      request,
      "POST",
      "/api/public/kiosk/checkin",
      { qr_data: booking.qr_code_data },
    );
    expect(checkin.appointment_id).toBe(booking.appointment_id);
    expect(checkin.status).toBe("checked_in");
    expect(checkin.token_number).toMatch(/^T-\d{3}$/);
  });

  test(
    "hospital users hand off OPD to lab, pharmacy, and billing by role",
    async ({ request }) => {
      test.info().annotations.push({
        type: "tcms",
        description: "Journey::Hospital role handoff registration to billing",
      });

      const adminCtx = await getAuthContextFromCookies(request);
      const receptionistCtx = await loginAsRoleApi(request, "receptionist");
      const doctorCtx = await loginAsRoleApi(request, "doctor");
      const labCtx = await loginAsRoleApi(request, "lab_technician");
      const pharmacistCtx = await loginAsRoleApi(request, "pharmacist");
      const billingCtx = await loginAsRoleApi(request, "billing_clerk");

      const patient = await createPatientApi(receptionistCtx, {
        firstName: `Role${Date.now()}`,
        lastName: "Handoff",
      });
      const opdDept = await getOpdDept(adminCtx);
      const encounterId = await createEncounter(doctorCtx, patient.id, {
        departmentId: opdDept.id,
      });

      await createConsultation(doctorCtx, encounterId, {
        chief_complaint: "Role-handoff fever review",
        history: "Patient registered at front desk and reviewed by doctor",
        examination: "Stable vitals",
        plan: "Order lab, prescribe medication, bill and dispense",
      });

      const labOrderId = await createLabOrder(doctorCtx, {
        patientId: patient.id,
        encounterId,
      });
      const labDetail = await api<{ order: { id: string } }>(
        labCtx,
        "GET",
        `/api/lab/orders/${labOrderId}`,
      );
      expect(labDetail.order.id).toBe(labOrderId);

      const drug = await getFirstDrug(adminCtx);
      const prescriptionId = await createPrescription(doctorCtx, encounterId, {
        drugId: drug.id,
        drugName: drug.name,
      });
      const pharmacyOrder = await createPharmacyOrder(pharmacistCtx, {
        patientId: patient.id,
        prescriptionId,
        encounterId,
        quantity: 5,
      });
      await dispensePharmacyOrder(pharmacistCtx, pharmacyOrder.id);

      const invoiceId = await createInvoice(billingCtx, {
        patientId: patient.id,
        encounterId,
      });
      const issued = await issueInvoice(billingCtx, invoiceId);
      expect(issued.status).toBe("issued");
    },
  );

  test("external vendor journey dispatches PO, receives delivery, and opens payment", async ({
    request,
  }) => {
    test.info().annotations.push({
      type: "tcms",
      description: "Journey::External vendor fulfilment through procurement",
    });

    const procurementCtx = await loginAsRoleApi(request, "procurement_officer");
    const storeCtx = await loginAsRoleApi(request, "store_keeper");
    const stamp = String(Date.now()).slice(-8);

    const vendor = await createProcurementVendor(procurementCtx, {
      code: `E2EV${stamp}`,
      name: `E2E Vendor Supplies ${stamp}`,
    });
    expect(vendor.id).toBeTruthy();

    const poDetail = await createPurchaseOrder(procurementCtx, {
      vendorId: vendor.id,
      itemName: `Vendor Consumable ${stamp}`,
      itemCode: `VC${stamp}`,
      quantity: 10,
      unitPrice: "125.00",
    });
    const purchaseOrder = poDetail.purchase_order;
    const poItem = poDetail.items[0];
    if (!poItem) throw new Error("Purchase order should include one vendor line item");

    const approved = await approvePurchaseOrder(procurementCtx, purchaseOrder.id);
    expect(approved.status).toBe("approved");

    const sent = await sendPurchaseOrderToVendor(procurementCtx, purchaseOrder.id);
    expect(sent.status).toBe("sent_to_vendor");

    const grn = await createGoodsReceiptNote(storeCtx, {
      purchaseOrderId: purchaseOrder.id,
      purchaseOrderItem: poItem,
      invoiceAmount: "1250.00",
    });
    expect(grn.grn.po_id).toBe(purchaseOrder.id);

    const completedGrn = await completeGoodsReceiptNote(storeCtx, grn.grn.id);
    expect(completedGrn.status).toBe("completed");

    const payment = await createSupplierPayment(procurementCtx, {
      vendorId: vendor.id,
      purchaseOrderId: purchaseOrder.id,
      grnId: grn.grn.id,
      invoiceAmount: "1250.00",
      paidAmount: "0",
    });
    expect(payment.status).toBe("pending");
    expect(payment.vendor_id).toBe(vendor.id);

    const payments = await listSupplierPayments(procurementCtx, vendor.id);
    expect(payments.some((row) => row.id === payment.id)).toBe(true);
  });

  test("multi-day IPD continuity keeps doctor, nurse, MAR, I/O, and handover evidence", async ({
    request,
  }) => {
    test.info().annotations.push({
      type: "tcms",
      description: "Journey::Multi-day IPD continuity and discharge readiness",
    });

    const adminCtx = await getAuthContextFromCookies(request);
    const receptionistCtx = await loginAsRoleApi(request, "receptionist");
    const doctorCtx = await loginAsRoleApi(request, "doctor");
    const nurseCtx = await loginAsRoleApi(request, "nurse");
    const billingCtx = await loginAsRoleApi(request, "billing_clerk");
    const nurse = getE2EIdentity("nurse");

    const patient = await createPatientApi(receptionistCtx, {
      firstName: `IPD${Date.now()}`,
      lastName: "Continuity",
    });
    const ipdDept = await getIpdDept(adminCtx);
    const bed = await getAvailableBed(adminCtx);
    const admissionId = await admitToIpd(doctorCtx, {
      patientId: patient.id,
      departmentId: ipdDept.id,
      bedId: bed?.id,
    });

    await createIpdProgressNote(doctorCtx, admissionId, {
      dayOffset: 0,
      subjective: "Admission day review after OPD referral",
      plan: "Begin observation, MAR, I/O and fall-prevention bundle",
    });
    await createIpdNursingAssessment(nurseCtx, admissionId, { dayOffset: 0 });
    const day0Mar = await createIpdMar(nurseCtx, admissionId, { dayOffset: 0 });
    await updateIpdMar(nurseCtx, admissionId, day0Mar.id, { dayOffset: 0 });
    await createIpdIoEntry(nurseCtx, admissionId, {
      isIntake: true,
      volumeMl: 1200,
      dayOffset: 0,
    });
    await createIpdIoEntry(nurseCtx, admissionId, {
      isIntake: false,
      volumeMl: 850,
      dayOffset: 0,
    });
    const day0Handover = await createIpdHandover(nurseCtx, admissionId, {
      incomingNurseId: nurse.id,
      dayOffset: 0,
      shift: "morning",
    });
    await acknowledgeIpdHandover(nurseCtx, admissionId, day0Handover.id);

    await createIpdProgressNote(doctorCtx, admissionId, {
      dayOffset: 1,
      subjective: "Day 1 review: symptoms controlled",
      plan: "Continue oral medication and discharge-readiness checks",
    });
    await createIpdClinicalAssessment(nurseCtx, admissionId, {
      assessmentType: "braden_scale",
      scoreValue: 17,
      riskLevel: "low",
    });
    await createIpdCarePlan(nurseCtx, admissionId, { dayOffset: 1 });
    const day1Mar = await createIpdMar(nurseCtx, admissionId, { dayOffset: 1 });
    await updateIpdMar(nurseCtx, admissionId, day1Mar.id, { dayOffset: 1 });
    await createIpdIoEntry(nurseCtx, admissionId, {
      isIntake: true,
      volumeMl: 1450,
      dayOffset: 1,
      shift: "afternoon",
    });
    await createIpdIoEntry(nurseCtx, admissionId, {
      isIntake: false,
      volumeMl: 1100,
      dayOffset: 1,
      shift: "afternoon",
    });
    await createIpdHandover(nurseCtx, admissionId, {
      incomingNurseId: nurse.id,
      dayOffset: 1,
      shift: "afternoon",
    });

    await createIpdProgressNote(doctorCtx, admissionId, {
      dayOffset: 2,
      subjective: "Day 2 review: fit for discharge planning",
      assessment: "Discharge-ready after billing and medication reconciliation",
      plan: "Close billing summary and provide follow-up instructions",
    });

    const notes = await api<Array<{ note_date: string }>>(
      doctorCtx,
      "GET",
      `/api/ipd/admissions/${admissionId}/progress-notes`,
    );
    const noteDates = [...new Set(notes.map((note) => note.note_date))];
    expect(noteDates).toEqual(
      expect.arrayContaining([dateDaysFromNow(0), dateDaysFromNow(1), dateDaysFromNow(2)]),
    );

    const handovers = await api<
      Array<{ handover_date: string; acknowledged_at: string | null }>
    >(nurseCtx, "GET", `/api/ipd/admissions/${admissionId}/handovers`);
    expect(handovers.map((handover) => handover.handover_date)).toEqual(
      expect.arrayContaining([dateDaysFromNow(0), dateDaysFromNow(1)]),
    );
    expect(handovers.some((handover) => Boolean(handover.acknowledged_at))).toBe(true);

    const mar = await api<Array<{ status: string; scheduled_at: string }>>(
      nurseCtx,
      "GET",
      `/api/ipd/admissions/${admissionId}/mar`,
    );
    expect(mar.filter((row) => row.status === "given").length).toBeGreaterThanOrEqual(2);

    const ioBalance = await getIpdIoBalance(nurseCtx, admissionId);
    expect(Number(ioBalance.total_intake_ml)).toBeGreaterThan(0);
    expect(Number(ioBalance.total_output_ml)).toBeGreaterThan(0);

    const billingSummary = await api<unknown>(
      billingCtx,
      "GET",
      `/api/ipd/admissions/${admissionId}/billing-summary`,
    );
    expect(billingSummary).toBeTruthy();
  });

  test("external systems read FHIR and post bridge heartbeat", async ({ request }) => {
    test.info().annotations.push({
      type: "tcms",
      description: "Journey::External system FHIR and bridge integration",
    });

    const ctx = await getAuthContextFromCookies(request);
    const patient = await createPatientApi(ctx, {
      firstName: `FHIR${Date.now()}`,
      lastName: "Exchange",
    });
    const encounterId = await createEncounter(ctx, patient.id);

    const metadata = await api<{ resourceType: string; fhirVersion: string }>(
      ctx,
      "GET",
      "/api/fhir/metadata",
    );
    expect(metadata.resourceType).toBe("CapabilityStatement");
    expect(metadata.fhirVersion).toBe("4.0.1");

    const fhirPatient = await api<{ resourceType: string; id: string }>(
      ctx,
      "GET",
      `/api/fhir/Patient/${patient.id}`,
    );
    expect(fhirPatient.resourceType).toBe("Patient");
    expect(fhirPatient.id).toBe(patient.id);

    const everything = await api<{ resourceType: string; total: number }>(
      ctx,
      "GET",
      `/api/fhir/Patient/${patient.id}/$everything`,
    );
    expect(everything.resourceType).toBe("Bundle");
    expect(everything.total).toBeGreaterThanOrEqual(1);

    const fhirEncounter = await api<{ resourceType: string; id: string }>(
      ctx,
      "GET",
      `/api/fhir/Encounter/${encounterId}`,
    );
    expect(fhirEncounter.resourceType).toBe("Encounter");

    const bridge = await externalApi<{ agent_id: string; status: string }>(
      request,
      "POST",
      "/api/bridge/register",
      {
        agent_key: `e2e-bridge-${Date.now()}`,
        name: "E2E Device Bridge",
        version: "0.0.0-e2e",
        hostname: "e2e-bridge.local",
        capabilities: ["hl7v2", "device-ingest", "fhir-readiness"],
        deployment_mode: "on_premise",
      },
    );
    expect(bridge.status).toBe("registered");
    expect(bridge.agent_id).toBeTruthy();

    const heartbeat = await externalApi<{ status: string }>(
      request,
      "POST",
      "/api/bridge/heartbeat",
      {
        agent_id: bridge.agent_id,
        devices_connected: 2,
        devices_errored: 0,
        messages_processed: 4,
        buffer_depth: 0,
        memory_usage_mb: 128,
        uptime_seconds: 60,
      },
    );
    expect(heartbeat.status).toBe("ok");
  });
});
