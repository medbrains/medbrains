// @vitest-environment node

import { describe, expect, it } from "vitest";
import { buildClinicalEventTrace, normalizeClinicalEventName } from "./clinical-events";

describe("clinical event normalization", () => {
  it("keeps canonical event names unchanged", () => {
    expect(normalizeClinicalEventName("billing.payment.received")).toBe("billing.payment.received");
  });

  it("maps UI trigger aliases to canonical cross-module events", () => {
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
        patient_id: "patient-1",
        visit_id: "visit-1",
      },
    });

    expect(event.eventName).toBe("emergency.visit.created");
    expect(event.sourceModule).toBe("emergency");
    expect(event.patientId).toBe("patient-1");
    expect(event.sourceRecordId).toBe("visit-1");
    expect(event.missingPayloadKeys).toEqual([]);
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
});
