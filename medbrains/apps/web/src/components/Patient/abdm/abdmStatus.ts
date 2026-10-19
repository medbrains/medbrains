import type { AbdmConsentRequestStatus, AbdmLinkStatus, AbdmPurposeCode } from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";

/** How each link status reads on screen — label and tone, never colour alone. */
export const LINK_STATUS: Record<AbdmLinkStatus, { label: string; tone: BadgeTone }> = {
  linked: { label: "Linked", tone: "success" },
  linking: { label: "Waiting for ABDM", tone: "info" },
  failed: { label: "Failed", tone: "danger" },
  not_linked: { label: "Not linked", tone: "neutral" },
};

/** ABDM's HI types in words staff use. */
export const HI_TYPE_LABEL: Record<string, string> = {
  OPConsultation: "OP consultation",
  Prescription: "Prescription",
  DiagnosticReport: "Diagnostic report",
  DischargeSummary: "Discharge summary",
  ImmunizationRecord: "Immunisation",
  HealthDocumentRecord: "Health document",
  WellnessRecord: "Wellness record",
  Invoice: "Invoice",
};

export const TRANSFER_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  transferred: { label: "Sent", tone: "success" },
  requested: { label: "In progress", tone: "info" },
  failed: { label: "Failed", tone: "danger" },
  refused: { label: "Refused — no consent", tone: "warning" },
};

export const CONSENT_STATUS: Record<string, BadgeTone> = {
  GRANTED: "success",
  REVOKED: "warning",
  EXPIRED: "neutral",
  DENIED: "danger",
};

/** A consent request's state, and what it means for the records. */
export const CONSENT_REQUEST_STATUS: Record<
  AbdmConsentRequestStatus,
  { label: string; tone: BadgeTone; hint: string }
> = {
  requested: { label: "Sent to ABDM", tone: "info", hint: "Waiting for ABDM to accept it." },
  awaiting_patient: {
    label: "Waiting for the patient",
    tone: "info",
    hint: "The patient approves or declines it in their ABHA app.",
  },
  granted: {
    label: "Granted",
    tone: "success",
    hint: "Records appear as each hospital sends them.",
  },
  denied: { label: "Denied", tone: "danger", hint: "The patient declined. Nothing was shared." },
  revoked: {
    label: "Revoked",
    tone: "warning",
    hint: "The patient withdrew consent. The records received were erased.",
  },
  expired: {
    label: "Expired",
    tone: "neutral",
    hint: "The consent ended. The records received were erased.",
  },
  failed: { label: "Not sent", tone: "danger", hint: "ABDM did not accept the request." },
};

/** ABDM's consent purposes in words. */
export const PURPOSE_LABEL: Record<AbdmPurposeCode, string> = {
  CAREMGT: "Care management",
  BTG: "Break the glass (emergency)",
  PUBHLTH: "Public health",
  HPAYMT: "Healthcare payment",
  DSRCH: "Disease-specific research",
  PATRQT: "Requested by the patient",
};
