// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  billingAdmissionFilterFromSearchParams,
  billingEncounterFilterFromSearchParams,
  billingHandoffActionFromSearchParams,
  billingInvoiceActionFromSearchParams,
  billingInvoicePaymentRoute,
  billingInvoiceWorkspaceRoute,
} from "./billing-workspace";

describe("billing workspace routing", () => {
  it("parses patient-flow billing handoff actions from search params", () => {
    expect(billingHandoffActionFromSearchParams(new URLSearchParams("action=payment"))).toBe(
      "payment",
    );
    expect(billingHandoffActionFromSearchParams(new URLSearchParams("action=discharge_bill"))).toBe(
      "discharge_bill",
    );
    expect(billingHandoffActionFromSearchParams(new URLSearchParams("source=ipd_discharge"))).toBe(
      "discharge_bill",
    );
    expect(billingHandoffActionFromSearchParams(new URLSearchParams("action=refund"))).toBeNull();
  });

  it("parses admission filters from IPD discharge billing handoffs", () => {
    expect(
      billingAdmissionFilterFromSearchParams(
        new URLSearchParams("patient_id=patient-1&admission_id=admission-1"),
      ),
    ).toBe("admission-1");
    expect(
      billingAdmissionFilterFromSearchParams(new URLSearchParams("patient_id=patient-1")),
    ).toBe(null);
  });

  it("parses encounter filters from OPD billing handoffs", () => {
    expect(
      billingEncounterFilterFromSearchParams(
        new URLSearchParams("patient_id=patient-1&encounter_id=encounter-1"),
      ),
    ).toBe("encounter-1");
    expect(
      billingEncounterFilterFromSearchParams(new URLSearchParams("patient_id=patient-1")),
    ).toBe(null);
  });

  it("parses invoice-detail actions without accepting list-level handoffs", () => {
    expect(billingInvoiceActionFromSearchParams(new URLSearchParams("action=payment"))).toBe(
      "payment",
    );
    expect(
      billingInvoiceActionFromSearchParams(new URLSearchParams("action=discharge_bill")),
    ).toBeNull();
    expect(billingInvoiceActionFromSearchParams(new URLSearchParams("source=ipd_discharge"))).toBe(
      null,
    );
  });

  it("keeps payment collection route-addressable from the active invoice", () => {
    expect(billingInvoiceWorkspaceRoute("invoice-1")).toBe("/billing/invoices/invoice-1");
    expect(billingInvoicePaymentRoute("invoice-1")).toBe(
      "/billing/invoices/invoice-1?action=payment",
    );
  });
});
