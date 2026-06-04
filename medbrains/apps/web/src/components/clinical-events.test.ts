// @vitest-environment node

import { describe, expect, it } from "vitest";
import { buildClinicalEventTrace, normalizeClinicalEventName } from "./clinical-events";

describe("clinical event normalization", () => {
  it("keeps canonical event names unchanged", () => {
    expect(normalizeClinicalEventName("billing.payment.received")).toBe("billing.payment.received");
    expect(normalizeClinicalEventName("ipd.admission.created")).toBe("ipd.admission.created");
  });

  it("maps UI trigger aliases to canonical cross-module events", () => {
    expect(normalizeClinicalEventName("appointment.checked_in_to_opd")).toBe(
      "opd.encounter.created",
    );
    expect(normalizeClinicalEventName("invoice.created")).toBe("billing.invoice.created");
    expect(normalizeClinicalEventName("lab.completed")).toBe("lab.result.posted");
    expect(normalizeClinicalEventName("lab.results_verified")).toBe("lab.result.verified");
    expect(normalizeClinicalEventName("mrd.case_sheet.sent")).toBe("mrd.case_sheet.generated");
    expect(normalizeClinicalEventName("mlc.case.created")).toBe("mlc.created");
    expect(normalizeClinicalEventName("mlc.police_intimation.created")).toBe(
      "emergency.mlc_police_intimation.created",
    );
    expect(normalizeClinicalEventName("payment.recorded")).toBe("billing.payment.received");
    expect(normalizeClinicalEventName("order.dispensed")).toBe("pharmacy.order.dispensed");
    expect(normalizeClinicalEventName("er.visit.created")).toBe("emergency.visit.created");
    expect(normalizeClinicalEventName("camp.registration_created")).toBe(
      "camp.registration.created",
    );
  });

  it("captures patient and missing payload key metadata", () => {
    const event = buildClinicalEventTrace({
      contextCode: "billing-invoice-detail",
      moduleCode: "billing",
      occurredAt: "2026-05-29T10:00:00.000Z",
      rawTrigger: "payment.recorded",
      payload: {
        invoice_id: "invoice-1",
        patient_id: "patient-1",
      },
    });

    expect(event.eventName).toBe("billing.payment.received");
    expect(event.sourceModule).toBe("billing");
    expect(event.patientId).toBe("patient-1");
    expect(event.sourceRecordId).toBe("invoice-1");
    expect(event.missingPayloadKeys).toEqual(["payment_id"]);
  });

  it("tracks patient profile action events without missing payload keys", () => {
    const updated = buildClinicalEventTrace({
      contextCode: "patient-edit",
      moduleCode: "patients",
      occurredAt: "2026-05-29T10:01:00.000Z",
      rawTrigger: "patient.updated",
      payload: {
        patient_id: "patient-1",
        source_record_id: "patient-1",
      },
    });

    const shared = buildClinicalEventTrace({
      contextCode: "patient-detail",
      moduleCode: "patients",
      occurredAt: "2026-05-29T10:02:00.000Z",
      rawTrigger: "patient.access_shared",
      payload: {
        expires_at: "2026-05-30T10:02:00.000Z",
        grant_id: "grant-1",
        patient_id: "patient-1",
        relation: "viewer",
        source_record_id: "patient-1",
        subject_type: "user",
      },
    });

    const cardPrinted = buildClinicalEventTrace({
      contextCode: "patient-detail",
      moduleCode: "patients",
      occurredAt: "2026-05-29T10:03:00.000Z",
      rawTrigger: "patient.card_printed",
      payload: {
        copies: 2,
        patient_id: "patient-1",
        source_record_id: "patient-1",
      },
    });

    expect(updated.eventName).toBe("patient.updated");
    expect(updated.patientId).toBe("patient-1");
    expect(updated.sourceRecordId).toBe("patient-1");
    expect(updated.missingPayloadKeys).toEqual([]);

    expect(shared.eventName).toBe("patient.access_shared");
    expect(shared.patientId).toBe("patient-1");
    expect(shared.sourceRecordId).toBe("patient-1");
    expect(shared.missingPayloadKeys).toEqual([]);

    expect(cardPrinted.eventName).toBe("patient.card_printed");
    expect(cardPrinted.patientId).toBe("patient-1");
    expect(cardPrinted.sourceRecordId).toBe("patient-1");
    expect(cardPrinted.missingPayloadKeys).toEqual([]);
  });

  it("tracks patient directory search completion without storing search text", () => {
    const event = buildClinicalEventTrace({
      contextCode: "patient-directory",
      moduleCode: "patients",
      occurredAt: "2026-05-29T10:04:00.000Z",
      rawTrigger: "patient.search.completed",
      payload: {
        page: 1,
        query_length: 8,
        result_count: 3,
        search_id: "patient-search:1:8:3",
        source_record_id: "patient-search:1:8:3",
      },
    });

    expect(event.eventName).toBe("patient.search.completed");
    expect(event.sourceModule).toBe("patients");
    expect(event.sourceRecordId).toBe("patient-search:1:8:3");
    expect(event.patientId).toBeNull();
    expect(event.payload).not.toHaveProperty("query");
    expect(event.payload).not.toHaveProperty("search");
    expect(event.missingPayloadKeys).toEqual([]);
  });

  it("tracks billing invoice finalization and payment receipt events without missing payload keys", () => {
    const finalized = buildClinicalEventTrace({
      contextCode: "billing-invoice-detail",
      moduleCode: "billing",
      occurredAt: "2026-05-29T10:02:00.000Z",
      rawTrigger: "invoice.issued",
      payload: {
        invoice_id: "invoice-1",
        patient_id: "patient-1",
      },
    });

    const payment = buildClinicalEventTrace({
      contextCode: "billing-invoice-detail",
      moduleCode: "billing",
      occurredAt: "2026-05-29T10:03:00.000Z",
      rawTrigger: "payment.recorded",
      payload: {
        invoice_id: "invoice-1",
        patient_id: "patient-1",
        payment_id: "payment-1",
      },
    });

    expect(finalized.eventName).toBe("billing.invoice.finalized");
    expect(finalized.patientId).toBe("patient-1");
    expect(finalized.sourceRecordId).toBe("invoice-1");
    expect(finalized.missingPayloadKeys).toEqual([]);

    expect(payment.eventName).toBe("billing.payment.received");
    expect(payment.patientId).toBe("patient-1");
    expect(payment.sourceRecordId).toBe("payment-1");
    expect(payment.missingPayloadKeys).toEqual([]);
  });

  it("tracks MRD case-sheet handoff events by packet and patient", () => {
    const generated = buildClinicalEventTrace({
      contextCode: "ipd-admission-detail",
      moduleCode: "ipd",
      occurredAt: "2026-05-29T10:05:00.000Z",
      rawTrigger: "mrd.case_sheet.generated",
      payload: {
        admission_id: "admission-1",
        packet_id: "packet-1",
        packet_type: "ipd",
        patient_id: "patient-1",
      },
    });

    const printed = buildClinicalEventTrace({
      contextCode: "mrd-page",
      moduleCode: "mrd",
      occurredAt: "2026-05-29T10:06:00.000Z",
      rawTrigger: "mrd.case_sheet.printed",
      payload: {
        admission_id: "admission-1",
        copies: 3,
        document_output_id: "document-1",
        is_reprint: false,
        packet_id: "packet-1",
        packet_number: "CS-001",
        packet_type: "ipd",
        patient_id: "patient-1",
        print_job_id: "print-job-1",
        printed_at: "2026-05-29T10:06:00.000Z",
        source_record_id: "packet-1",
        status: "printed",
      },
    });

    expect(generated.eventName).toBe("mrd.case_sheet.generated");
    expect(generated.patientId).toBe("patient-1");
    expect(generated.admissionId).toBe("admission-1");
    expect(generated.sourceRecordId).toBe("packet-1");
    expect(generated.missingPayloadKeys).toEqual([]);

    expect(printed.eventName).toBe("mrd.case_sheet.printed");
    expect(printed.patientId).toBe("patient-1");
    expect(printed.admissionId).toBe("admission-1");
    expect(printed.sourceRecordId).toBe("packet-1");
    expect(printed.payload).not.toHaveProperty("source_snapshot");
    expect(printed.payload).not.toHaveProperty("reprint_reason");
    expect(printed.missingPayloadKeys).toEqual([]);
  });

  it("tracks emergency visit events as emergency source events", () => {
    const event = buildClinicalEventTrace({
      contextCode: "emergency-create-visit",
      moduleCode: "emergency",
      occurredAt: "2026-05-29T10:10:00.000Z",
      rawTrigger: "emergency.visit.created",
      payload: {
        arrival_mode: "ambulance",
        arrival_time: "2026-05-29T10:08:00.000Z",
        bay_number: "ER-2",
        chief_complaint: "Chest pain",
        is_brought_dead: false,
        is_mlc: true,
        patient_id: "patient-1",
        source_record_id: "visit-1",
        status: "registered",
        triage_level: "emergency",
        visit_id: "visit-1",
        visit_number: "ER-2026-0001",
      },
    });

    expect(event.eventName).toBe("emergency.visit.created");
    expect(event.sourceModule).toBe("emergency");
    expect(event.patientId).toBe("patient-1");
    expect(event.sourceRecordId).toBe("visit-1");
    expect(event.missingPayloadKeys).toEqual([]);
    expect(event.payload.is_mlc).toBe(true);
    expect(event.payload.triage_level).toBe("emergency");
  });

  it("tracks code-blue lifecycle events without missing payload keys", () => {
    const activated = buildClinicalEventTrace({
      contextCode: "emergency-visits",
      moduleCode: "emergency",
      occurredAt: "2026-05-29T10:12:00.000Z",
      rawTrigger: "emergency.code_blue.activated",
      payload: {
        activated_at: "2026-05-29T10:11:00.000Z",
        code_activation_id: "code-1",
        code_blue_id: "code-1",
        code_type: "code_blue",
        crash_cart_checklist: { defibrillator: true },
        er_visit_id: "visit-1",
        location: "ER Bay 2",
        source_record_id: "code-1",
      },
    });

    const completed = buildClinicalEventTrace({
      contextCode: "emergency-visits",
      moduleCode: "emergency",
      occurredAt: "2026-05-29T10:30:00.000Z",
      rawTrigger: "emergency.code_blue.completed",
      payload: {
        code_activation_id: "code-1",
        code_blue_id: "code-1",
        code_type: "code_blue",
        deactivated_at: "2026-05-29T10:29:00.000Z",
        er_visit_id: "visit-1",
        location: "ER Bay 2",
        outcome: "rosc",
        source_record_id: "code-1",
      },
    });

    expect(activated.eventName).toBe("emergency.code_blue.activated");
    expect(activated.sourceModule).toBe("emergency");
    expect(activated.sourceRecordId).toBe("code-1");
    expect(activated.missingPayloadKeys).toEqual([]);

    expect(completed.eventName).toBe("emergency.code_blue.completed");
    expect(completed.sourceModule).toBe("emergency");
    expect(completed.sourceRecordId).toBe("code-1");
    expect(completed.missingPayloadKeys).toEqual([]);
  });

  it("tracks MLC registration and police-intimation events without missing payload keys", () => {
    const registered = buildClinicalEventTrace({
      contextCode: "emergency-visits",
      moduleCode: "emergency",
      occurredAt: "2026-05-29T10:35:00.000Z",
      rawTrigger: "mlc.created",
      payload: {
        er_visit_id: "visit-1",
        mlc_case_id: "mlc-1",
        mlc_number: "MLC-2026-0001",
        patient_id: "patient-1",
        registered_at: "2026-05-29T10:34:00.000Z",
        source_record_id: "mlc-1",
        status: "registered",
      },
    });

    const intimation = buildClinicalEventTrace({
      contextCode: "emergency-visits",
      moduleCode: "emergency",
      occurredAt: "2026-05-29T10:40:00.000Z",
      rawTrigger: "emergency.mlc_police_intimation.created",
      payload: {
        er_visit_id: "visit-1",
        intimation_id: "intimation-1",
        intimation_number: "PI-2026-0001",
        mlc_case_id: "mlc-1",
        mlc_number: "MLC-2026-0001",
        patient_id: "patient-1",
        receipt_confirmed: false,
        sent_at: "2026-05-29T10:39:00.000Z",
        sent_via: "written_memo",
        source_record_id: "intimation-1",
      },
    });

    expect(registered.eventName).toBe("mlc.created");
    expect(registered.sourceModule).toBe("emergency");
    expect(registered.patientId).toBe("patient-1");
    expect(registered.sourceRecordId).toBe("mlc-1");
    expect(registered.missingPayloadKeys).toEqual([]);

    expect(intimation.eventName).toBe("emergency.mlc_police_intimation.created");
    expect(intimation.sourceModule).toBe("emergency");
    expect(intimation.patientId).toBe("patient-1");
    expect(intimation.sourceRecordId).toBe("intimation-1");
    expect(intimation.missingPayloadKeys).toEqual([]);
  });

  it("tracks camp registration events by camp registration and patient", () => {
    const started = buildClinicalEventTrace({
      contextCode: "camp-list",
      moduleCode: "camp",
      occurredAt: "2026-05-29T10:10:00.000Z",
      rawTrigger: "camp.started",
      payload: {
        camp_code: "CAMP-001",
        camp_id: "camp-1",
        camp_type: "general_health",
        scheduled_date: "2026-05-29",
        source_record_id: "camp-1",
        status: "active",
      },
    });

    const event = buildClinicalEventTrace({
      contextCode: "patient-registration",
      moduleCode: "camp",
      occurredAt: "2026-05-29T10:15:00.000Z",
      rawTrigger: "camp.registration.created",
      payload: {
        camp_id: "camp-1",
        patient_id: "patient-1",
        registration_id: "registration-1",
      },
    });

    expect(started.eventName).toBe("camp.started");
    expect(started.sourceModule).toBe("camp");
    expect(started.sourceRecordId).toBe("camp-1");
    expect(started.patientId).toBeNull();
    expect(started.missingPayloadKeys).toEqual([]);

    expect(event.eventName).toBe("camp.registration.created");
    expect(event.sourceModule).toBe("camp");
    expect(event.patientId).toBe("patient-1");
    expect(event.sourceRecordId).toBe("registration-1");
    expect(event.missingPayloadKeys).toEqual([]);
  });

  it("tracks pharmacy order lifecycle events without missing payload keys", () => {
    const created = buildClinicalEventTrace({
      contextCode: "pharmacy-order-create",
      moduleCode: "pharmacy",
      occurredAt: "2026-05-29T10:20:00.000Z",
      rawTrigger: "pharmacy.order.created",
      payload: {
        items: [{ item_id: "order-item-1", quantity: 1 }],
        order_id: "order-1",
        order_type: "pharmacy",
        patient_id: "patient-1",
      },
    });

    const dispensed = buildClinicalEventTrace({
      contextCode: "pharmacy-orders",
      moduleCode: "pharmacy",
      occurredAt: "2026-05-29T10:25:00.000Z",
      rawTrigger: "order.dispensed",
      payload: {
        items: [{ item_id: "order-item-1", quantity: 1 }],
        order_id: "order-1",
        patient_id: "patient-1",
      },
    });

    const cancelled = buildClinicalEventTrace({
      contextCode: "pharmacy-orders",
      moduleCode: "pharmacy",
      occurredAt: "2026-05-29T10:30:00.000Z",
      rawTrigger: "order.cancelled",
      payload: {
        order_id: "order-2",
        order_type: "pharmacy",
        reason: "cancelled_from_pharmacy_queue",
      },
    });

    expect(created.eventName).toBe("order.created");
    expect(created.sourceRecordId).toBe("order-1");
    expect(created.patientId).toBe("patient-1");
    expect(created.missingPayloadKeys).toEqual([]);

    expect(dispensed.eventName).toBe("pharmacy.order.dispensed");
    expect(dispensed.sourceRecordId).toBe("order-1");
    expect(dispensed.patientId).toBe("patient-1");
    expect(dispensed.missingPayloadKeys).toEqual([]);

    expect(cancelled.eventName).toBe("order.cancelled");
    expect(cancelled.sourceRecordId).toBe("order-2");
    expect(cancelled.missingPayloadKeys).toEqual([]);
  });

  it("tracks pharmacy NDPS register movements without sensitive register fields", () => {
    const movement = buildClinicalEventTrace({
      contextCode: "pharmacy-orders",
      moduleCode: "pharmacy",
      occurredAt: "2026-05-29T10:32:00.000Z",
      rawTrigger: "pharmacy.ndps.movement.created",
      payload: {
        action: "receipt",
        catalog_item_id: "drug-1",
        created_at: "2026-05-29T10:32:00.000Z",
        entry_id: "entry-1",
        quantity: 2,
        register_number: "NDPS-001",
        source_record_id: "entry-1",
      },
    });

    expect(movement.eventName).toBe("pharmacy.ndps.movement.created");
    expect(movement.sourceRecordId).toBe("entry-1");
    expect(movement.payload).not.toHaveProperty("balance_after");
    expect(movement.payload).not.toHaveProperty("dispensed_by");
    expect(movement.payload).not.toHaveProperty("witnessed_by");
    expect(movement.payload).not.toHaveProperty("notes");
    expect(movement.missingPayloadKeys).toEqual([]);
  });

  it("tracks IPD bed transfer and discharge completion events without missing payload keys", () => {
    const transfer = buildClinicalEventTrace({
      contextCode: "ipd-admission-detail",
      moduleCode: "ipd",
      occurredAt: "2026-05-29T10:35:00.000Z",
      rawTrigger: "transfer.completed",
      payload: {
        admission_id: "admission-1",
        from_bed_id: "bed-1",
        patient_id: "patient-1",
        to_bed_id: "bed-2",
        transfer_id: "transfer-1",
      },
    });

    const discharge = buildClinicalEventTrace({
      contextCode: "ipd-admission-detail",
      moduleCode: "ipd",
      occurredAt: "2026-05-29T10:40:00.000Z",
      rawTrigger: "discharge.completed",
      payload: {
        admission_id: "admission-1",
        discharge_type: "normal",
        patient_id: "patient-1",
      },
    });

    const finalized = buildClinicalEventTrace({
      contextCode: "ipd-admission-detail",
      moduleCode: "ipd",
      occurredAt: "2026-05-29T10:45:00.000Z",
      rawTrigger: "ipd.discharge.finalized",
      payload: {
        admission_id: "admission-1",
        finalized_at: "2026-05-29T10:45:00.000Z",
        patient_id: "patient-1",
        source_record_id: "summary-1",
        status: "finalized",
        summary_id: "summary-1",
      },
    });

    expect(transfer.eventName).toBe("bed.transferred");
    expect(transfer.admissionId).toBe("admission-1");
    expect(transfer.patientId).toBe("patient-1");
    expect(transfer.sourceRecordId).toBe("transfer-1");
    expect(transfer.missingPayloadKeys).toEqual([]);

    expect(discharge.eventName).toBe("ipd.discharge.completed");
    expect(discharge.admissionId).toBe("admission-1");
    expect(discharge.patientId).toBe("patient-1");
    expect(discharge.missingPayloadKeys).toEqual([]);

    expect(finalized.eventName).toBe("ipd.discharge.finalized");
    expect(finalized.admissionId).toBe("admission-1");
    expect(finalized.patientId).toBe("patient-1");
    expect(finalized.sourceRecordId).toBe("summary-1");
    expect(finalized.payload).not.toHaveProperty("final_diagnosis");
    expect(finalized.payload).not.toHaveProperty("course_in_hospital");
    expect(finalized.missingPayloadKeys).toEqual([]);
  });

  it("tracks lab and radiology diagnostic order lifecycle events without missing payload keys", () => {
    const labCreated = buildClinicalEventTrace({
      contextCode: "lab-orders",
      moduleCode: "lab",
      occurredAt: "2026-05-29T10:45:00.000Z",
      rawTrigger: "lab.order_created",
      payload: {
        order_id: "lab-order-1",
        order_type: "lab",
        patient_id: "patient-1",
        test_id: "test-1",
      },
    });

    const labCompleted = buildClinicalEventTrace({
      contextCode: "lab-orders",
      moduleCode: "lab",
      occurredAt: "2026-05-29T10:50:00.000Z",
      rawTrigger: "lab.completed",
      payload: {
        order_id: "lab-order-1",
        patient_id: "patient-1",
        result_status: "completed",
      },
    });

    const labVerified = buildClinicalEventTrace({
      contextCode: "lab-orders",
      moduleCode: "lab",
      occurredAt: "2026-05-29T10:52:00.000Z",
      rawTrigger: "lab.results_verified",
      payload: {
        order_id: "lab-order-1",
        patient_id: "patient-1",
        result_status: "verified",
      },
    });

    const radiologyCreated = buildClinicalEventTrace({
      contextCode: "radiology-orders",
      moduleCode: "radiology",
      occurredAt: "2026-05-29T10:55:00.000Z",
      rawTrigger: "radiology.order.created",
      payload: {
        modality_id: "modality-1",
        order_id: "radiology-order-1",
        order_type: "radiology",
        patient_id: "patient-1",
      },
    });

    const radiologyCompleted = buildClinicalEventTrace({
      contextCode: "radiology-orders",
      moduleCode: "radiology",
      occurredAt: "2026-05-29T11:00:00.000Z",
      rawTrigger: "radiology.order.completed",
      payload: {
        order_id: "radiology-order-1",
        patient_id: "patient-1",
      },
    });

    const radiologyVerified = buildClinicalEventTrace({
      contextCode: "radiology-orders",
      moduleCode: "radiology",
      occurredAt: "2026-05-29T11:05:00.000Z",
      rawTrigger: "radiology.report.verified",
      payload: {
        order_id: "radiology-order-1",
        patient_id: "patient-1",
        report_id: "radiology-report-1",
        report_status: "verified",
      },
    });

    expect(labCreated.eventName).toBe("order.created");
    expect(labCreated.sourceRecordId).toBe("lab-order-1");
    expect(labCreated.patientId).toBe("patient-1");
    expect(labCreated.missingPayloadKeys).toEqual([]);

    expect(labCompleted.eventName).toBe("lab.result.posted");
    expect(labCompleted.sourceRecordId).toBe("lab-order-1");
    expect(labCompleted.patientId).toBe("patient-1");
    expect(labCompleted.missingPayloadKeys).toEqual([]);

    expect(labVerified.eventName).toBe("lab.result.verified");
    expect(labVerified.sourceRecordId).toBe("lab-order-1");
    expect(labVerified.patientId).toBe("patient-1");
    expect(labVerified.missingPayloadKeys).toEqual([]);

    expect(radiologyCreated.eventName).toBe("order.created");
    expect(radiologyCreated.sourceRecordId).toBe("radiology-order-1");
    expect(radiologyCreated.patientId).toBe("patient-1");
    expect(radiologyCreated.missingPayloadKeys).toEqual([]);

    expect(radiologyCompleted.eventName).toBe("radiology.order.completed");
    expect(radiologyCompleted.sourceRecordId).toBe("radiology-order-1");
    expect(radiologyCompleted.patientId).toBe("patient-1");
    expect(radiologyCompleted.missingPayloadKeys).toEqual([]);

    expect(radiologyVerified.eventName).toBe("radiology.report.verified");
    expect(radiologyVerified.sourceRecordId).toBe("radiology-report-1");
    expect(radiologyVerified.patientId).toBe("patient-1");
    expect(radiologyVerified.missingPayloadKeys).toEqual([]);
  });

  it("tracks OPD queue and order events without missing payload keys", () => {
    const checkedIn = buildClinicalEventTrace({
      contextCode: "opd-queue",
      moduleCode: "opd",
      occurredAt: "2026-05-29T11:05:00.000Z",
      rawTrigger: "appointment.checked_in_to_opd",
      payload: {
        appointment_id: "appointment-1",
        encounter_id: "encounter-1",
        patient_id: "patient-1",
        queue_entry_id: "queue-1",
      },
    });

    const completed = buildClinicalEventTrace({
      contextCode: "opd-queue",
      moduleCode: "opd",
      occurredAt: "2026-05-29T11:10:00.000Z",
      rawTrigger: "encounter.completed",
      payload: {
        encounter_id: "encounter-1",
        patient_id: "patient-1",
        queue_entry_id: "queue-1",
      },
    });

    const prescription = buildClinicalEventTrace({
      contextCode: "opd-encounter-1",
      moduleCode: "opd",
      occurredAt: "2026-05-29T11:15:00.000Z",
      rawTrigger: "prescription.created",
      payload: {
        encounter_id: "encounter-1",
        order_id: "prescription-1",
        order_type: "prescription",
        patient_id: "patient-1",
        prescription_id: "prescription-1",
      },
    });

    const procedure = buildClinicalEventTrace({
      contextCode: "opd-encounter-1",
      moduleCode: "opd",
      occurredAt: "2026-05-29T11:20:00.000Z",
      rawTrigger: "procedure.ordered",
      payload: {
        encounter_id: "encounter-1",
        order_id: "procedure-order-1",
        order_type: "procedure",
        patient_id: "patient-1",
        procedure_id: "procedure-1",
      },
    });

    expect(checkedIn.eventName).toBe("opd.encounter.created");
    expect(checkedIn.encounterId).toBe("encounter-1");
    expect(checkedIn.patientId).toBe("patient-1");
    expect(checkedIn.missingPayloadKeys).toEqual([]);

    expect(completed.eventName).toBe("opd.encounter.created");
    expect(completed.encounterId).toBe("encounter-1");
    expect(completed.patientId).toBe("patient-1");
    expect(completed.missingPayloadKeys).toEqual([]);

    expect(prescription.eventName).toBe("order.created");
    expect(prescription.sourceRecordId).toBe("prescription-1");
    expect(prescription.patientId).toBe("patient-1");
    expect(prescription.missingPayloadKeys).toEqual([]);

    expect(procedure.eventName).toBe("order.created");
    expect(procedure.sourceRecordId).toBe("procedure-order-1");
    expect(procedure.patientId).toBe("patient-1");
    expect(procedure.missingPayloadKeys).toEqual([]);
  });

  it("tracks OPD certificate and consent printable activations without clinical text", () => {
    const certificate = buildClinicalEventTrace({
      contextCode: "opd-encounter-1",
      moduleCode: "opd",
      occurredAt: "2026-05-29T11:30:00.000Z",
      rawTrigger: "opd.certificate.created",
      payload: {
        certificate_id: "certificate-1",
        certificate_number: "CERT-001",
        certificate_type: "medical",
        encounter_id: "encounter-1",
        issued_date: "2026-05-29",
        patient_id: "patient-1",
        source_record_id: "certificate-1",
      },
    });

    const consent = buildClinicalEventTrace({
      contextCode: "opd-encounter-1",
      moduleCode: "opd",
      occurredAt: "2026-05-29T11:35:00.000Z",
      rawTrigger: "opd.consent.signed",
      payload: {
        consent_id: "consent-1",
        consent_type: "procedure",
        encounter_id: "encounter-1",
        patient_id: "patient-1",
        signed_at: "2026-05-29T11:35:00.000Z",
        source_record_id: "consent-1",
        status: "signed",
      },
    });

    expect(certificate.eventName).toBe("opd.certificate.created");
    expect(certificate.sourceRecordId).toBe("certificate-1");
    expect(certificate.patientId).toBe("patient-1");
    expect(certificate.payload).not.toHaveProperty("diagnosis");
    expect(certificate.payload).not.toHaveProperty("remarks");
    expect(certificate.missingPayloadKeys).toEqual([]);

    expect(consent.eventName).toBe("opd.consent.signed");
    expect(consent.sourceRecordId).toBe("consent-1");
    expect(consent.patientId).toBe("patient-1");
    expect(consent.payload).not.toHaveProperty("risks_explained");
    expect(consent.payload).not.toHaveProperty("benefits_explained");
    expect(consent.missingPayloadKeys).toEqual([]);
  });
});
