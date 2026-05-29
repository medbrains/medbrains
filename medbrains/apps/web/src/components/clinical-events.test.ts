// @vitest-environment node

import { describe, expect, it } from "vitest";
import { buildClinicalEventTrace, normalizeClinicalEventName } from "./clinical-events";

describe("clinical event normalization", () => {
  it("keeps canonical event names unchanged", () => {
    expect(normalizeClinicalEventName("billing.payment.received")).toBe("billing.payment.received");
  });

  it("maps UI trigger aliases to canonical cross-module events", () => {
    expect(normalizeClinicalEventName("invoice.created")).toBe("billing.invoice.created");
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
});
