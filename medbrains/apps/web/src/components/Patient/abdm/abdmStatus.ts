import type { AbdmLinkStatus } from "@medbrains/types";
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
