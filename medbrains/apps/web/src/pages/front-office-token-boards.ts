import type {
  BillingQueueToken,
  LabQueueToken,
  PharmacyQueueToken,
  QueuePriority,
  QueueToken,
  RadiologyQueueToken,
} from "@medbrains/types";

export interface DisplayToken {
  meta: string;
  status: string;
  tokenNumber: string;
}

function priorityLabel(value: QueuePriority) {
  return value.replace(/_/g, " ");
}

export function opdDisplayToken(token: QueueToken): DisplayToken {
  return {
    meta: token.priority === "normal" ? "Standard priority" : priorityLabel(token.priority),
    status: token.status,
    tokenNumber: token.token_number,
  };
}

export function labDisplayToken(token: LabQueueToken): DisplayToken {
  return {
    meta: [
      `${token.test_count} test${token.test_count === 1 ? "" : "s"}`,
      token.counter !== null ? `Counter ${token.counter}` : null,
      token.is_fasting ? "Fasting" : null,
      token.is_pediatric ? "Pediatric" : null,
    ]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
    status: token.status,
    tokenNumber: token.token_number,
  };
}

export function radiologyDisplayToken(token: RadiologyQueueToken): DisplayToken {
  return {
    meta: [token.modality, token.room_number]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
    status: token.status,
    tokenNumber: token.token_number,
  };
}

export function pharmacyDisplayToken(token: PharmacyQueueToken): DisplayToken {
  return {
    meta: [
      `${token.prescription_count} item${token.prescription_count === 1 ? "" : "s"}`,
      token.counter !== null ? `Counter ${token.counter}` : null,
      token.estimated_wait_minutes !== null ? `${token.estimated_wait_minutes} min wait` : null,
    ]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
    status: token.status,
    tokenNumber: token.token_number,
  };
}

export function billingDisplayToken(token: BillingQueueToken): DisplayToken {
  return {
    meta: [token.queue_type, token.counter !== null ? `Counter ${token.counter}` : null]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
    status: token.status,
    tokenNumber: token.token_number,
  };
}
