// @vitest-environment node

import { describe, expect, it } from "vitest";
import { buildClinicalEventTrace, normalizeClinicalEventName } from "./clinical-events";

describe("clinical event normalization", () => {
  it("keeps canonical event names unchanged", () => {
    expect(normalizeClinicalEventName("billing.payment.received")).toBe("billing.payment.received");
  });

  it("maps UI trigger aliases to canonical cross-module events", () => {
    expect(normalizeClinicalEventName("appointment.checked_in_to_opd")).toBe(
      "opd.encounter.created",
    );
    expect(normalizeClinicalEventName("invoice.created")).toBe("billing.invoice.created");
    expect(normalizeClinicalEventName("mrd.case_sheet.sent")).toBe("mrd.case_sheet.generated");
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
    const event = buildClinicalEventTrace({
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

    expect(event.eventName).toBe("mrd.case_sheet.generated");
    expect(event.patientId).toBe("patient-1");
    expect(event.admissionId).toBe("admission-1");
    expect(event.sourceRecordId).toBe("packet-1");
    expect(event.missingPayloadKeys).toEqual([]);
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

  it("tracks camp registration events by camp registration and patient", () => {
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

    expect(transfer.eventName).toBe("bed.transferred");
    expect(transfer.admissionId).toBe("admission-1");
    expect(transfer.patientId).toBe("patient-1");
    expect(transfer.sourceRecordId).toBe("transfer-1");
    expect(transfer.missingPayloadKeys).toEqual([]);

    expect(discharge.eventName).toBe("ipd.discharge.completed");
    expect(discharge.admissionId).toBe("admission-1");
    expect(discharge.patientId).toBe("patient-1");
    expect(discharge.missingPayloadKeys).toEqual([]);
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
      rawTrigger: "lab.results_verified",
      payload: {
        order_id: "lab-order-1",
        patient_id: "patient-1",
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

    expect(labCreated.eventName).toBe("order.created");
    expect(labCreated.sourceRecordId).toBe("lab-order-1");
    expect(labCreated.patientId).toBe("patient-1");
    expect(labCreated.missingPayloadKeys).toEqual([]);

    expect(labCompleted.eventName).toBe("lab.order.completed");
    expect(labCompleted.sourceRecordId).toBe("lab-order-1");
    expect(labCompleted.patientId).toBe("patient-1");
    expect(labCompleted.missingPayloadKeys).toEqual([]);

    expect(radiologyCreated.eventName).toBe("order.created");
    expect(radiologyCreated.sourceRecordId).toBe("radiology-order-1");
    expect(radiologyCreated.patientId).toBe("patient-1");
    expect(radiologyCreated.missingPayloadKeys).toEqual([]);

    expect(radiologyCompleted.eventName).toBe("radiology.order.completed");
    expect(radiologyCompleted.sourceRecordId).toBe("radiology-order-1");
    expect(radiologyCompleted.patientId).toBe("patient-1");
    expect(radiologyCompleted.missingPayloadKeys).toEqual([]);
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
});
