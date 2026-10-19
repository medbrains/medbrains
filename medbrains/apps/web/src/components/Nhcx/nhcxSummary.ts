import type { BadgeTone } from "@/components/ui";

/** Where the claim's latest NHCX message stands, in the desk's words. */
export function nhcxStatusLabel(status: string | null): { label: string; tone: BadgeTone } {
  switch (status) {
    case null:
      return { label: "Not sent to NHCX", tone: "neutral" };
    case "queued":
      return { label: "Waiting to send", tone: "info" };
    case "sent":
    case "request.queued":
    case "request.dispatched":
      return { label: "Sent — waiting for the payer", tone: "info" };
    case "send_failed":
      return { label: "Not sent — NHCX refused it", tone: "danger" };
    case "response.complete":
      return { label: "Payer answered", tone: "success" };
    case "response.partial":
      return { label: "Payer answered in part", tone: "warning" };
    case "response.error":
      return { label: "Payer returned an error", tone: "danger" };
    default:
      return { label: status, tone: "neutral" };
  }
}

export interface NhcxResponseSummary {
  /** FHIR outcome: complete | partial | error | queued. */
  outcome: string | null;
  /** The payer's own words about the decision. */
  disposition: string | null;
  /** A protocol error's message, when the payer or gateway sent one. */
  error: string | null;
}

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null;
const asText = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

function responseResource(payload: Json): Json | null {
  const isResponse = (r: Json) =>
    r.resourceType === "ClaimResponse" || r.resourceType === "CoverageEligibilityResponse";
  if (isResponse(payload)) return payload;
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    if (isObject(entry) && isObject(entry.resource) && isResponse(entry.resource)) {
      return entry.resource;
    }
  }
  return null;
}

/** Read the payer's answer out of the stored response — bundle or protocol error. */
export function summariseNhcxResponse(payload: unknown): NhcxResponseSummary | null {
  if (!isObject(payload)) return null;
  const resource = responseResource(payload);
  const errorDetails = payload["x-hcx-error_details"];
  return {
    outcome: asText(resource?.outcome),
    disposition: asText(resource?.disposition),
    error: isObject(errorDetails) ? asText(errorDetails.message) : null,
  };
}
