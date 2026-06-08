import type { WorkflowSignalShape, WorkflowSignalTone } from "./workflow-signal-shapes.js";

export type BedBoardStatus =
  | "blocked"
  | "maintenance"
  | "occupied"
  | "occupied_transfer_pending"
  | "reserved"
  | "vacant_clean"
  | "vacant_dirty";
export type BedBoardSignalStatus = BedBoardStatus | "waiting";

export type BedBoardSignalPhase =
  | "active_care"
  | "assignable"
  | "blocked"
  | "held"
  | "maintenance"
  | "transfer_pending"
  | "turnover"
  | "waiting";
export type BedBoardSignalShape = WorkflowSignalShape;
export type BedBoardSignalTone = Extract<
  WorkflowSignalTone,
  "active" | "blocked" | "neutral" | "ready" | "risk"
>;

export interface BedBoardStatusSignal {
  assignment: "assignable" | "blocked" | "occupied";
  phase: BedBoardSignalPhase;
  shape: BedBoardSignalShape;
  tone: BedBoardSignalTone;
}

export const BED_BOARD_STATUS_VALUES = [
  "vacant_clean",
  "vacant_dirty",
  "occupied",
  "occupied_transfer_pending",
  "reserved",
  "maintenance",
  "blocked",
] as const satisfies ReadonlyArray<BedBoardStatus>;

export const BED_BOARD_SIGNAL_STATUS_VALUES = [
  ...BED_BOARD_STATUS_VALUES,
  "waiting",
] as const satisfies ReadonlyArray<BedBoardSignalStatus>;

export const BED_BOARD_MUTABLE_STATUS_VALUES = [
  "vacant_clean",
  "vacant_dirty",
  "maintenance",
  "blocked",
] as const satisfies ReadonlyArray<BedBoardStatus>;

const BED_BOARD_DEFAULT_STATUS_SIGNAL = {
  assignment: "blocked",
  phase: "blocked",
  shape: "pill",
  tone: "neutral",
} as const satisfies BedBoardStatusSignal;

const BED_BOARD_SIGNAL_STATUS_VALUE_SET: ReadonlySet<string> = new Set(
  BED_BOARD_SIGNAL_STATUS_VALUES,
);

const BED_BOARD_STATUS_SIGNALS = {
  blocked: {
    assignment: "blocked",
    phase: "blocked",
    shape: "diamond",
    tone: "risk",
  },
  maintenance: {
    assignment: "blocked",
    phase: "maintenance",
    shape: "token",
    tone: "neutral",
  },
  occupied: {
    assignment: "occupied",
    phase: "active_care",
    shape: "bed",
    tone: "active",
  },
  occupied_transfer_pending: {
    assignment: "occupied",
    phase: "transfer_pending",
    shape: "diamond",
    tone: "blocked",
  },
  reserved: {
    assignment: "blocked",
    phase: "held",
    shape: "token",
    tone: "blocked",
  },
  vacant_clean: {
    assignment: "assignable",
    phase: "assignable",
    shape: "bed",
    tone: "ready",
  },
  vacant_dirty: {
    assignment: "blocked",
    phase: "turnover",
    shape: "diamond",
    tone: "blocked",
  },
  waiting: {
    assignment: "blocked",
    phase: "waiting",
    shape: "token",
    tone: "blocked",
  },
} as const satisfies Readonly<Record<BedBoardSignalStatus, BedBoardStatusSignal>>;

const BED_BOARD_STATUS_LABEL_KEYS = {
  blocked: "bedDashboard.status.blocked",
  maintenance: "bedDashboard.status.maintenance",
  occupied: "bedDashboard.status.occupied",
  occupied_transfer_pending: "bedDashboard.status.occupied_transfer_pending",
  reserved: "bedDashboard.status.reserved",
  vacant_clean: "bedDashboard.status.vacant_clean",
  vacant_dirty: "bedDashboard.status.vacant_dirty",
  waiting: "bedDashboard.status.waiting",
} as const satisfies Readonly<Record<BedBoardSignalStatus, string>>;

const BED_BOARD_STATUS_LABELS = {
  blocked: "Blocked",
  maintenance: "Maintenance",
  occupied: "Occupied",
  occupied_transfer_pending: "Transfer pending",
  reserved: "Reserved",
  vacant_clean: "Vacant clean",
  vacant_dirty: "Vacant dirty",
  waiting: "Waiting",
} as const satisfies Readonly<Record<BedBoardSignalStatus, string>>;

const BED_BOARD_SIGNAL_LABEL_KEYS = {
  blocked: "bedDashboard.signal.blocked",
  maintenance: "bedDashboard.signal.maintenance",
  occupied: "bedDashboard.signal.occupied",
  occupied_transfer_pending: "bedDashboard.signal.occupied_transfer_pending",
  reserved: "bedDashboard.signal.reserved",
  vacant_clean: "bedDashboard.signal.vacant_clean",
  vacant_dirty: "bedDashboard.signal.vacant_dirty",
  waiting: "bedDashboard.signal.waiting",
} as const satisfies Readonly<Record<BedBoardSignalStatus, string>>;

const BED_BOARD_SIGNAL_LABELS = {
  blocked: "Blocked",
  maintenance: "Maintenance",
  occupied: "Active care",
  occupied_transfer_pending: "Transfer pending",
  reserved: "Reserved hold",
  vacant_clean: "Assignment ready",
  vacant_dirty: "Turnover needed",
  waiting: "Waiting list",
} as const satisfies Readonly<Record<BedBoardSignalStatus, string>>;

function bedBoardFallbackLabel(value: string): string {
  return value.replace(/_/g, " ");
}

export function isBedBoardSignalStatus(status: string): status is BedBoardSignalStatus {
  return BED_BOARD_SIGNAL_STATUS_VALUE_SET.has(status);
}

export function bedBoardStatusSignal(status: string): BedBoardStatusSignal {
  return isBedBoardSignalStatus(status)
    ? BED_BOARD_STATUS_SIGNALS[status]
    : BED_BOARD_DEFAULT_STATUS_SIGNAL;
}

export function bedBoardStatusIsAssignable(status: string): boolean {
  return bedBoardStatusSignal(status).assignment === "assignable";
}

export function bedBoardStatusLabelKey(status: string): string | null {
  return isBedBoardSignalStatus(status) ? BED_BOARD_STATUS_LABEL_KEYS[status] : null;
}

export function bedBoardStatusLabel(status: string): string {
  return isBedBoardSignalStatus(status)
    ? BED_BOARD_STATUS_LABELS[status]
    : bedBoardFallbackLabel(status);
}

export function bedBoardSignalLabelKey(status: string): string | null {
  return isBedBoardSignalStatus(status) ? BED_BOARD_SIGNAL_LABEL_KEYS[status] : null;
}

export function bedBoardSignalLabel(status: string): string {
  return isBedBoardSignalStatus(status)
    ? BED_BOARD_SIGNAL_LABELS[status]
    : bedBoardStatusLabel(status);
}
