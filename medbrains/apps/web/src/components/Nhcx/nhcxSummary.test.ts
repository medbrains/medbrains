import { describe, expect, it } from "vitest";
import { nhcxDecisionLabel, nhcxStatusLabel, summariseNhcxResponse } from "./nhcxSummary";

describe("summariseNhcxResponse", () => {
  it("reads the ClaimResponse outcome and disposition out of a bundle", () => {
    const bundle = {
      resourceType: "Bundle",
      entry: [
        { resource: { resourceType: "Patient" } },
        {
          resource: {
            resourceType: "ClaimResponse",
            outcome: "complete",
            disposition: "Approved less room-rent cap",
          },
        },
      ],
    };
    expect(summariseNhcxResponse(bundle)).toEqual({
      outcome: "complete",
      disposition: "Approved less room-rent cap",
      error: null,
    });
  });

  it("reads a protocol error's message", () => {
    const error = {
      "x-hcx-status": "response.error",
      "x-hcx-error_details": { code: "ERR_INVALID_PAYLOAD", message: "Policy not found" },
    };
    expect(summariseNhcxResponse(error)?.error).toBe("Policy not found");
  });

  it("says nothing for no response", () => {
    expect(summariseNhcxResponse(null)).toBeNull();
  });
});

describe("nhcxStatusLabel", () => {
  it("never calls a refused message sent", () => {
    expect(nhcxStatusLabel("send_failed").tone).toBe("danger");
    expect(nhcxStatusLabel("queued").label).toBe("Waiting to send");
  });
});

describe("an NHCX answer on screen", () => {
  it("never shows a message status as success", () => {
    for (const s of ["response.complete", "response.partial", "unknown", "request.initiated"]) {
      expect(nhcxStatusLabel(s).tone).not.toBe("success");
    }
    expect(nhcxStatusLabel("unknown").tone).toBe("warning");
    expect(nhcxStatusLabel("undelivered").tone).toBe("danger");
  });

  it("shows a query as not approved and a rejection as a rejection", () => {
    expect(nhcxDecisionLabel("queried")).toEqual({
      label: "Payer asked a question — not approved",
      tone: "warning",
    });
    expect(nhcxDecisionLabel("rejected")?.tone).toBe("danger");
    expect(nhcxDecisionLabel("approved")?.tone).toBe("success");
    expect(nhcxDecisionLabel("unknown")?.tone).toBe("warning");
    expect(nhcxDecisionLabel(null)).toBeNull();
  });
});
