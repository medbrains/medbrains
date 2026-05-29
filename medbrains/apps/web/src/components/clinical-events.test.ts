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
});
