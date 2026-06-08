export type PharmacyRxSignalShape = "diamond" | "pill" | "token";
export type PharmacyRxSignalTone = "active" | "blocked" | "neutral" | "ready" | "risk";
export type PharmacyRxStatusPhase =
  | "approved"
  | "blocked"
  | "cancelled"
  | "dispensed"
  | "dispensing"
  | "pending_review"
  | "rejected";
export type PharmacyRxPriorityPhase = "normal" | "safety_priority" | "urgent";
export type PharmacyRxSourcePhase = "care_area" | "direct_sale" | "emergency";

export interface PharmacyRxSignal {
  phase: PharmacyRxPriorityPhase | PharmacyRxSourcePhase | PharmacyRxStatusPhase;
  shape: PharmacyRxSignalShape;
  tone: PharmacyRxSignalTone;
}

export const PHARMACY_RX_STATUS_VALUES = [
  "pending_review",
  "approved",
  "rejected",
  "on_hold",
  "dispensing",
  "dispensed",
  "partially_dispensed",
  "cancelled",
] as const;

const PHARMACY_RX_DEFAULT_SIGNAL = {
  phase: "pending_review",
  shape: "pill",
  tone: "neutral",
} as const satisfies PharmacyRxSignal;

const PHARMACY_RX_STATUS_SIGNALS: Readonly<Record<string, PharmacyRxSignal>> = {
  approved: {
    phase: "approved",
    shape: "pill",
    tone: "ready",
  },
  cancelled: {
    phase: "cancelled",
    shape: "diamond",
    tone: "risk",
  },
  dispensed: {
    phase: "dispensed",
    shape: "pill",
    tone: "ready",
  },
  dispensing: {
    phase: "dispensing",
    shape: "token",
    tone: "active",
  },
  on_hold: {
    phase: "blocked",
    shape: "diamond",
    tone: "blocked",
  },
  partially_dispensed: {
    phase: "dispensing",
    shape: "token",
    tone: "active",
  },
  pending_review: {
    phase: "pending_review",
    shape: "diamond",
    tone: "blocked",
  },
  rejected: {
    phase: "rejected",
    shape: "diamond",
    tone: "risk",
  },
};

const PHARMACY_RX_PRIORITY_SIGNALS: Readonly<Record<string, PharmacyRxSignal>> = {
  high: {
    phase: "safety_priority",
    shape: "diamond",
    tone: "blocked",
  },
  urgent: {
    phase: "urgent",
    shape: "diamond",
    tone: "risk",
  },
};

const PHARMACY_RX_SOURCE_SIGNALS: Readonly<Record<string, PharmacyRxSignal>> = {
  emergency: {
    phase: "emergency",
    shape: "diamond",
    tone: "risk",
  },
  ipd: {
    phase: "care_area",
    shape: "token",
    tone: "active",
  },
  opd: {
    phase: "care_area",
    shape: "token",
    tone: "active",
  },
};

export function pharmacyRxStatusSignal(status: string): PharmacyRxSignal {
  return PHARMACY_RX_STATUS_SIGNALS[status] ?? PHARMACY_RX_DEFAULT_SIGNAL;
}

export function pharmacyRxPrioritySignal(priority: string): PharmacyRxSignal {
  return (
    PHARMACY_RX_PRIORITY_SIGNALS[priority] ?? {
      phase: "normal",
      shape: "pill",
      tone: "neutral",
    }
  );
}

export function pharmacyRxSourceSignal(source: string): PharmacyRxSignal {
  return (
    PHARMACY_RX_SOURCE_SIGNALS[source] ?? {
      phase: "direct_sale",
      shape: "token",
      tone: "neutral",
    }
  );
}
