import type { WorkflowSignalShape, WorkflowSignalTone } from "./workflow-signal-shapes.js";

export type PatientContextSignalKind =
  | "allergy"
  | "balance_due"
  | "consent_pending"
  | "deceased"
  | "drug_allergy"
  | "insurance"
  | "medico_legal"
  | "no_known_allergies"
  | "vitals_missing"
  | "vip";
export type PatientContextSignalSeverity = "critical" | "info" | "warning";
export type PatientContextSignalShape = Extract<WorkflowSignalShape, "diamond" | "pill" | "token">;
export type PatientContextSignalTone = Extract<
  WorkflowSignalTone,
  "active" | "blocked" | "neutral" | "ready" | "risk"
>;

export interface PatientContextSignal {
  severity: PatientContextSignalSeverity;
  shape: PatientContextSignalShape;
  tone: PatientContextSignalTone;
}

const PATIENT_CONTEXT_SIGNALS: Readonly<Record<PatientContextSignalKind, PatientContextSignal>> = {
  allergy: {
    severity: "critical",
    shape: "diamond",
    tone: "risk",
  },
  balance_due: {
    severity: "critical",
    shape: "diamond",
    tone: "risk",
  },
  consent_pending: {
    severity: "warning",
    shape: "diamond",
    tone: "blocked",
  },
  deceased: {
    severity: "critical",
    shape: "diamond",
    tone: "risk",
  },
  drug_allergy: {
    severity: "critical",
    shape: "diamond",
    tone: "risk",
  },
  insurance: {
    severity: "info",
    shape: "token",
    tone: "active",
  },
  medico_legal: {
    severity: "critical",
    shape: "diamond",
    tone: "risk",
  },
  no_known_allergies: {
    severity: "info",
    shape: "pill",
    tone: "ready",
  },
  vip: {
    severity: "info",
    shape: "pill",
    tone: "active",
  },
  vitals_missing: {
    severity: "warning",
    shape: "token",
    tone: "blocked",
  },
};

export function patientContextSignal(kind: PatientContextSignalKind): PatientContextSignal {
  return PATIENT_CONTEXT_SIGNALS[kind];
}
