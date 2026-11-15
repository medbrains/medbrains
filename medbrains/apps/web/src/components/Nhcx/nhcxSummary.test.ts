import type { NhcxParticipant, NhcxPatientPolicy } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  canSendTo,
  directoryCertLabel,
  lastSynced,
  nhcxDecisionLabel,
  nhcxStatusLabel,
  routedTo,
  summariseNhcxResponse,
} from "./nhcxSummary";

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

const payer = (over: Partial<NhcxParticipant>): NhcxParticipant => ({
  id: "p",
  participant_code: "1518@hcx",
  participant_name: "Payer",
  role: "PAYER",
  is_active: true,
  has_encryption_cert: false,
  source: "manual",
  entity_type: null,
  synced_at: null,
  ...over,
});

describe("the payer directory", () => {
  it("lets a registry payer be chosen before its certificate is fetched, never a bare manual one", () => {
    expect(canSendTo(payer({ source: "registry" }))).toBe(true);
    expect(canSendTo(payer({ has_encryption_cert: true }))).toBe(true);
    expect(canSendTo(payer({}))).toBe(false);
    expect(canSendTo(undefined)).toBe(false);
    expect(directoryCertLabel(payer({ source: "registry" })).tone).toBe("info");
    expect(directoryCertLabel(payer({})).tone).toBe("warning");
  });

  it("names the latest registry listing, or none", () => {
    const rows = [
      payer({ synced_at: "2026-11-14T10:00:00Z" }),
      payer({ synced_at: "2026-11-15T09:00:00Z" }),
      payer({}),
    ];
    expect(lastSynced(rows)).toBe("2026-11-15T09:00:00Z");
    expect(lastSynced([payer({})])).toBeNull();
  });
});

describe("routedTo", () => {
  const policy: NhcxPatientPolicy = {
    id: "x",
    identifier_type: "AbhaNumber",
    payer_id: "1518@hcx",
    payer_name: null,
    processing_id: "1000000109@hcx",
    processor_name: null,
    member_id: null,
    product_id: null,
    product_name: null,
    fetched_at: "2026-11-15T09:00:00Z",
  };
  it("sends to the policy's processor, not the insurer picked", () => {
    expect(routedTo([policy], "1518@hcx")).toBe("1000000109@hcx");
    expect(routedTo([policy], "9999@hcx")).toBe("9999@hcx");
    expect(routedTo([], "1518@hcx")).toBe("1518@hcx");
  });
});
