import { describe, expect, it } from "vitest";
import { nhcxStatusLabel, summariseNhcxResponse } from "./nhcxSummary";

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
