import type { WorkflowSignalShape, WorkflowSignalTone } from "./workflow-signal-shapes.js";

export type BedBoardStatus =
  | "blocked"
  | "maintenance"
  | "occupied"
  | "occupied_transfer_pending"
  | "reserved"
  | "vacant_clean"
  | "vacant_dirty";

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

const BED_BOARD_STATUS_SIGNALS: Readonly<Record<string, BedBoardStatusSignal>> = {
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
};

export function bedBoardStatusSignal(status: string): BedBoardStatusSignal {
  return BED_BOARD_STATUS_SIGNALS[status] ?? BED_BOARD_DEFAULT_STATUS_SIGNAL;
}

export function bedBoardStatusIsAssignable(status: string): boolean {
  return bedBoardStatusSignal(status).assignment === "assignable";
}
