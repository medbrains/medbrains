import type { NhcxDecision } from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";

interface Label {
  label: string;
  tone: BadgeTone;
}

/** Where the latest NHCX message stands, in the desk's words. This is the
 * message's journey, never the payer's decision — that is
 * {@link nhcxDecisionLabel} — so no status here reads as success. */
export function nhcxStatusLabel(status: string | null): Label {
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
      return { label: "Not sent — NHCX refused it or stopped trying", tone: "danger" };
    case "undelivered":
      return { label: "NHCX could not deliver it to the payer", tone: "danger" };
    case "response.complete":
      return { label: "Payer sent its final answer", tone: "info" };
    case "response.partial":
      return { label: "Payer sent an interim answer", tone: "info" };
    case "request.initiated":
      return { label: "Payer sent a request", tone: "info" };
    case "response.error":
      return { label: "Payer returned an error", tone: "danger" };
    case "unknown":
      return { label: "Payer's message did not say where it stands", tone: "warning" };
    default:
      return { label: status, tone: "neutral" };
  }
}

const DECISIONS: Record<NhcxDecision, Label> = {
  received: { label: "Payer received it — under review", tone: "info" },
  approved: { label: "Approved by the payer", tone: "success" },
  partially_approved: { label: "Partly approved by the payer", tone: "warning" },
  rejected: { label: "Rejected by the payer", tone: "danger" },
  queried: { label: "Payer asked a question — not approved", tone: "warning" },
  cancelled: { label: "Cancelled by the payer", tone: "neutral" },
  error: { label: "Payer could not process it", tone: "danger" },
  unknown: { label: "Payer's answer could not be read — check it", tone: "warning" },
};

/** What the payer decided; `null` while it has not answered. */
export function nhcxDecisionLabel(decision: NhcxDecision | null): Label | null {
  return decision ? DECISIONS[decision] : null;
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
