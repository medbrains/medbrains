import { P } from "./permissions.js";

export type TokenBoardSurfaceId =
  | "billing"
  | "emergency"
  | "lab"
  | "opd"
  | "pharmacy"
  | "radiology";
export type TokenBoardSurfaceFilter = "all" | TokenBoardSurfaceId;
export type TokenBoardDisplayMode = "token_only_public";
export type TokenBoardReadinessTone = "danger" | "info" | "success" | "warning";
export type TokenBoardStatusTone = TokenBoardReadinessTone | "neutral";
export type TokenBoardStatusPhase =
  | "blocked"
  | "done"
  | "in_progress"
  | "ready"
  | "serving"
  | "waiting";
export type TokenBoardStatusShape = "circle" | "diamond" | "pill" | "ring" | "square";
export type TokenBoardTvDisplayType =
  | "billing_queue"
  | "emergency_triage"
  | "lab_queue"
  | "opd_queue"
  | "pharmacy_queue"
  | "radiology_queue";
export type TokenBoardTvAppCode =
  | "Desktop-Kiosk"
  | "TV-Billing"
  | "TV-DoctorRoom"
  | "TV-Emergency"
  | "TV-Lab"
  | "TV-Pharmacy"
  | "TV-Radiology"
  | "TV-Queue";
export type BillingQueueLaneKey =
  | "opd_billing"
  | "ipd_discharge"
  | "advance_deposit"
  | "insurance_desk";

export interface BillingQueueLaneDefinition {
  emptyLabel: string;
  key: BillingQueueLaneKey;
  summaryLabel: string;
  title: string;
}

export interface TokenBoardLaunchTargets {
  kioskPath: string;
  mobileParams: {
    surface: TokenBoardSurfaceId;
  };
  mobileRoute: "TokenBoards";
  tvAppCodes: readonly TokenBoardTvAppCode[];
  tvDeepLink: string;
  tvDisplayType: TokenBoardTvDisplayType;
  webPath: string;
}

export interface TokenBoardSurfaceDefinition {
  id: TokenBoardSurfaceId;
  accent: "brand" | "copper" | "emerald" | "red" | "violet";
  description: string;
  displayMode: TokenBoardDisplayMode;
  module: "billing" | "emergency" | "lab" | "opd" | "pharmacy" | "radiology";
  privacyNotice: string;
  readiness: {
    flow: string;
    privacy: string;
  };
  refreshIntervalMs: number;
  requiredAnyPermissions: readonly string[];
  restrictedLabel: string;
  standardRefs: readonly string[];
  subtitle: string;
  title: string;
  targets: TokenBoardLaunchTargets;
}

export interface TokenBoardReadinessItem {
  label: string;
  tone: TokenBoardReadinessTone;
  value: string;
}

export interface TokenBoardStatusSignal {
  emphasis: "high" | "low" | "medium";
  phase: TokenBoardStatusPhase;
  shape: TokenBoardStatusShape;
  tone: TokenBoardStatusTone;
}

export const TOKEN_BOARD_STATUS_VALUES = [
  "active",
  "called",
  "cancelled",
  "collected",
  "collection_in_progress",
  "completed",
  "dispensed",
  "in_progress",
  "issued",
  "no_show",
  "on_hold",
  "paid",
  "partially_paid",
  "preparing",
  "ready",
  "scheduled",
  "settled",
  "waiting",
] as const;

export type TokenBoardStatusValue = (typeof TOKEN_BOARD_STATUS_VALUES)[number];

const TOKEN_BOARD_STATUS_VALUE_SET: ReadonlySet<string> = new Set(TOKEN_BOARD_STATUS_VALUES);

export const TOKEN_BOARD_PUBLIC_PRIVACY_NOTICE =
  "Token-only display mode. Patient names, identifiers, diagnoses, test names, imaging details, drug names and bill amounts stay hidden.";

export const TOKEN_BOARD_FAST_REFRESH_MS = 5_000;
export const TOKEN_BOARD_STANDARD_REFRESH_MS = 10_000;

export const BILLING_QUEUE_LANES = [
  {
    emptyLabel: "No OPD bills waiting",
    key: "opd_billing",
    summaryLabel: "OPD",
    title: "OPD billing",
  },
  {
    emptyLabel: "No IPD discharge bills",
    key: "ipd_discharge",
    summaryLabel: "IPD",
    title: "IPD discharge",
  },
  {
    emptyLabel: "No advance deposit tokens",
    key: "advance_deposit",
    summaryLabel: "Advance",
    title: "Advance deposit",
  },
  {
    emptyLabel: "No insurance desk tokens",
    key: "insurance_desk",
    summaryLabel: "Insurance",
    title: "Insurance desk",
  },
] as const satisfies ReadonlyArray<BillingQueueLaneDefinition>;

function tokenBoardWebPath(surface: TokenBoardSurfaceId): string {
  return `/front-office?board=${surface}#token-boards`;
}

function tokenBoardKioskPath(surface: TokenBoardSurfaceId): string {
  return `/front-office?board=${surface}&display=kiosk#token-boards`;
}

export const TOKEN_BOARD_SURFACES: Readonly<
  Record<TokenBoardSurfaceId, TokenBoardSurfaceDefinition>
> = {
  billing: {
    accent: "brand",
    description:
      "Billing counter queue for OPD bills, IPD discharge bills, advances and insurance.",
    displayMode: "token_only_public",
    id: "billing",
    module: "billing",
    privacyNotice:
      "Token-only counter display. Patient names, identifiers, bill amounts and payer details are withheld.",
    readiness: {
      flow: "Billing",
      privacy: "Token only",
    },
    refreshIntervalMs: TOKEN_BOARD_STANDARD_REFRESH_MS,
    requiredAnyPermissions: [P.BILLING.INVOICES_LIST],
    restrictedLabel: "Billing board restricted",
    standardRefs: ["IPSG.1 patient identification", "NABH PRE patient rights"],
    subtitle: "OPD, IPD discharge, advance and insurance desks",
    targets: {
      kioskPath: tokenBoardKioskPath("billing"),
      mobileParams: { surface: "billing" },
      mobileRoute: "TokenBoards",
      tvAppCodes: ["TV-Billing"],
      tvDeepLink: "medbrains://tv/billing-queue",
      tvDisplayType: "billing_queue",
      webPath: tokenBoardWebPath("billing"),
    },
    title: "Billing counters",
  },
  emergency: {
    accent: "red",
    description:
      "Emergency triage display for live color-coded waiting tokens and overdue targets.",
    displayMode: "token_only_public",
    id: "emergency",
    module: "emergency",
    privacyNotice:
      "Token-only triage display. Patient names, identifiers, injuries and clinical notes are withheld.",
    readiness: {
      flow: "Triage",
      privacy: "Token only",
    },
    refreshIntervalMs: TOKEN_BOARD_FAST_REFRESH_MS,
    requiredAnyPermissions: [P.EMERGENCY.VISITS_LIST, P.EMERGENCY.TRIAGE_LIST],
    restrictedLabel: "Emergency board restricted",
    standardRefs: ["IPSG.2 effective communication", "NABH emergency care continuity"],
    subtitle: "Color-coded triage targets",
    targets: {
      kioskPath: tokenBoardKioskPath("emergency"),
      mobileParams: { surface: "emergency" },
      mobileRoute: "TokenBoards",
      tvAppCodes: ["TV-Emergency"],
      tvDeepLink: "medbrains://tv/emergency-triage",
      tvDisplayType: "emergency_triage",
      webPath: tokenBoardWebPath("emergency"),
    },
    title: "Emergency triage",
  },
  lab: {
    accent: "violet",
    description: "Lab sample collection display for waiting, collecting and in-progress tokens.",
    displayMode: "token_only_public",
    id: "lab",
    module: "lab",
    privacyNotice:
      "Token-only sample collection display. Patient names, identifiers, test names and results are withheld.",
    readiness: {
      flow: "Samples",
      privacy: "Token only",
    },
    refreshIntervalMs: TOKEN_BOARD_STANDARD_REFRESH_MS,
    requiredAnyPermissions: [
      P.LAB.PHLEBOTOMY_LIST,
      P.LAB.SAMPLES_LIST,
      P.LAB.ORDERS_LIST,
      P.LAB.REPORTS_VIEW,
    ],
    restrictedLabel: "Lab board restricted",
    standardRefs: ["NABL sample collection traceability", "LOINC laboratory interoperability"],
    subtitle: "Sample collection and in-progress test queue",
    targets: {
      kioskPath: tokenBoardKioskPath("lab"),
      mobileParams: { surface: "lab" },
      mobileRoute: "TokenBoards",
      tvAppCodes: ["TV-Lab"],
      tvDeepLink: "medbrains://tv/lab-status",
      tvDisplayType: "lab_queue",
      webPath: tokenBoardWebPath("lab"),
    },
    title: "Lab collection",
  },
  radiology: {
    accent: "brand",
    description: "Radiology modality waiting display for called and queued imaging tokens.",
    displayMode: "token_only_public",
    id: "radiology",
    module: "radiology",
    privacyNotice:
      "Token-only imaging display. Patient names, identifiers, body parts, indications, preparation instructions and reports are withheld.",
    readiness: {
      flow: "Modality",
      privacy: "Token only",
    },
    refreshIntervalMs: TOKEN_BOARD_STANDARD_REFRESH_MS,
    requiredAnyPermissions: [P.RADIOLOGY.ORDERS_LIST, P.RADIOLOGY.ORDERS_VIEW],
    restrictedLabel: "Radiology board restricted",
    standardRefs: [
      "DICOM imaging interoperability",
      "AERB radiation safety",
      "PCPNDT sensitivity safeguards",
    ],
    subtitle: "Modality room and scan waiting tokens",
    targets: {
      kioskPath: tokenBoardKioskPath("radiology"),
      mobileParams: { surface: "radiology" },
      mobileRoute: "TokenBoards",
      tvAppCodes: ["TV-Radiology"],
      tvDeepLink: "medbrains://tv/radiology-queue?modality=xray",
      tvDisplayType: "radiology_queue",
      webPath: tokenBoardWebPath("radiology"),
    },
    title: "Radiology queue",
  },
  opd: {
    accent: "copper",
    description: "OPD waiting-hall queue display for called and next outpatient tokens.",
    displayMode: "token_only_public",
    id: "opd",
    module: "opd",
    privacyNotice:
      "Token-only public display. Patient names, identifiers, diagnoses and contact details are withheld.",
    readiness: {
      flow: "OPD",
      privacy: "Token only",
    },
    refreshIntervalMs: TOKEN_BOARD_FAST_REFRESH_MS,
    requiredAnyPermissions: [P.OPD.QUEUE_LIST, P.OPD.QUEUE_VIEW],
    restrictedLabel: "OPD board restricted",
    standardRefs: ["IPSG.1 patient identification", "NABH access, assessment and continuity"],
    subtitle: "Token calls across outpatient departments",
    targets: {
      kioskPath: tokenBoardKioskPath("opd"),
      mobileParams: { surface: "opd" },
      mobileRoute: "TokenBoards",
      tvAppCodes: ["TV-Queue", "TV-DoctorRoom", "Desktop-Kiosk"],
      tvDeepLink: "medbrains://tv/queue",
      tvDisplayType: "opd_queue",
      webPath: tokenBoardWebPath("opd"),
    },
    title: "OPD queue",
  },
  pharmacy: {
    accent: "emerald",
    description: "Pharmacy pickup display for prescription preparation and handover tokens.",
    displayMode: "token_only_public",
    id: "pharmacy",
    module: "pharmacy",
    privacyNotice:
      "Token-only pickup display. Patient names, identifiers, drug names and prescription notes are withheld.",
    readiness: {
      flow: "Dispensing",
      privacy: "Token only",
    },
    refreshIntervalMs: TOKEN_BOARD_STANDARD_REFRESH_MS,
    requiredAnyPermissions: [P.PHARMACY.PRESCRIPTIONS_LIST, P.PHARMACY.PRESCRIPTIONS_VIEW],
    restrictedLabel: "Pharmacy board restricted",
    standardRefs: ["IPSG.3 medication safety", "NABH medication management"],
    subtitle: "Prescription preparation and handover",
    targets: {
      kioskPath: tokenBoardKioskPath("pharmacy"),
      mobileParams: { surface: "pharmacy" },
      mobileRoute: "TokenBoards",
      tvAppCodes: ["TV-Pharmacy"],
      tvDeepLink: "medbrains://tv/pharmacy-queue",
      tvDisplayType: "pharmacy_queue",
      webPath: tokenBoardWebPath("pharmacy"),
    },
    title: "Pharmacy pickup",
  },
};

export const TOKEN_BOARD_SURFACE_LIST = [
  TOKEN_BOARD_SURFACES.opd,
  TOKEN_BOARD_SURFACES.lab,
  TOKEN_BOARD_SURFACES.radiology,
  TOKEN_BOARD_SURFACES.emergency,
  TOKEN_BOARD_SURFACES.pharmacy,
  TOKEN_BOARD_SURFACES.billing,
] as const satisfies ReadonlyArray<TokenBoardSurfaceDefinition>;

export function isTokenBoardSurfaceId(value: unknown): value is TokenBoardSurfaceId {
  return (
    typeof value === "string" && TOKEN_BOARD_SURFACE_LIST.some((surface) => surface.id === value)
  );
}

export function tokenBoardSurfaceFilterFromParam(value: unknown): TokenBoardSurfaceFilter {
  return isTokenBoardSurfaceId(value) ? value : "all";
}

export function tokenBoardMobileRouteParams(
  filter: TokenBoardSurfaceFilter,
): TokenBoardLaunchTargets["mobileParams"] | undefined {
  return filter === "all" ? undefined : TOKEN_BOARD_SURFACES[filter].targets.mobileParams;
}

export function getTokenBoardSurface(id: TokenBoardSurfaceId): TokenBoardSurfaceDefinition {
  return TOKEN_BOARD_SURFACES[id];
}

export function tokenBoardRefreshLabel(surface: TokenBoardSurfaceDefinition): string {
  return `${surface.refreshIntervalMs / 1_000}s`;
}

export function tokenBoardFeedIsStale(
  updatedAt: number,
  refreshIntervalMs: number,
  nowMs = Date.now(),
): boolean {
  if (updatedAt <= 0) return false;
  return nowMs - updatedAt > refreshIntervalMs * 3;
}

export function tokenBoardFeedReadiness({
  isError,
  nowMs,
  refreshIntervalMs,
  updatedAt,
}: {
  isError: boolean;
  nowMs?: number;
  refreshIntervalMs: number;
  updatedAt: number;
}): TokenBoardReadinessItem {
  if (isError) {
    return { label: "Feed", tone: "danger", value: "Degraded" };
  }

  if (tokenBoardFeedIsStale(updatedAt, refreshIntervalMs, nowMs)) {
    return { label: "Feed", tone: "warning", value: "Stale" };
  }

  if (updatedAt <= 0) {
    return { label: "Feed", tone: "warning", value: "Waiting" };
  }

  return { label: "Feed", tone: "success", value: "Live" };
}

export function tokenBoardOperationalReadinessItems({
  isError,
  nowMs,
  surface,
  updatedAt,
}: {
  isError: boolean;
  nowMs?: number;
  surface: TokenBoardSurfaceDefinition;
  updatedAt: number;
}): TokenBoardReadinessItem[] {
  return [
    { label: "Privacy", tone: "success", value: surface.readiness.privacy },
    tokenBoardFeedReadiness({
      isError,
      nowMs,
      refreshIntervalMs: surface.refreshIntervalMs,
      updatedAt,
    }),
    { label: "Refresh", tone: "info", value: tokenBoardRefreshLabel(surface) },
    {
      label: "Flow",
      tone: surface.id === "emergency" ? "danger" : "info",
      value: surface.readiness.flow,
    },
  ];
}

const TOKEN_BOARD_READINESS_LABEL_KEYS: Readonly<Record<string, string>> = {
  Feed: "tokenBoards.readiness.labels.feed",
  Flow: "tokenBoards.readiness.labels.flow",
  Privacy: "tokenBoards.readiness.labels.privacy",
  Refresh: "tokenBoards.readiness.labels.refresh",
};

const TOKEN_BOARD_READINESS_LABELS: Readonly<Record<string, string>> = {
  Feed: "Feed",
  Flow: "Flow",
  Privacy: "Privacy",
  Refresh: "Refresh",
};

const TOKEN_BOARD_READINESS_VALUE_KEYS: Readonly<Record<string, string>> = {
  Degraded: "tokenBoards.readiness.values.degraded",
  Live: "tokenBoards.readiness.values.live",
  Stale: "tokenBoards.readiness.values.stale",
  "Token only": "tokenBoards.readiness.values.tokenOnly",
  Waiting: "tokenBoards.readiness.values.waiting",
};

const TOKEN_BOARD_READINESS_VALUES: Readonly<Record<string, string>> = {
  Degraded: "Degraded",
  Live: "Live",
  Stale: "Stale",
  "Token only": "Token only",
  Waiting: "Waiting",
};

const TOKEN_BOARD_REFRESH_VALUE_KEY = "tokenBoards.readiness.values.refreshSeconds";

const TOKEN_BOARD_SURFACE_FLOW_LABEL_KEYS: Readonly<Record<TokenBoardSurfaceId, string>> = {
  billing: "tokenBoards.surfaces.billing.flow",
  emergency: "tokenBoards.surfaces.emergency.flow",
  lab: "tokenBoards.surfaces.lab.flow",
  opd: "tokenBoards.surfaces.opd.flow",
  pharmacy: "tokenBoards.surfaces.pharmacy.flow",
  radiology: "tokenBoards.surfaces.radiology.flow",
};

export function tokenBoardReadinessLabelKey(label: string): string | null {
  return TOKEN_BOARD_READINESS_LABEL_KEYS[label] ?? null;
}

export function tokenBoardReadinessLabel(label: string): string {
  return TOKEN_BOARD_READINESS_LABELS[label] ?? label;
}

export function tokenBoardReadinessValueKey(value: string): string | null {
  return TOKEN_BOARD_READINESS_VALUE_KEYS[value] ?? null;
}

export function tokenBoardReadinessValue(value: string): string {
  return TOKEN_BOARD_READINESS_VALUES[value] ?? value;
}

export function tokenBoardRefreshValueKey(): string {
  return TOKEN_BOARD_REFRESH_VALUE_KEY;
}

export function tokenBoardSurfaceFlowLabelKey(surfaceId: TokenBoardSurfaceId): string {
  return TOKEN_BOARD_SURFACE_FLOW_LABEL_KEYS[surfaceId];
}

const TOKEN_BOARD_DEFAULT_STATUS_SIGNAL = {
  emphasis: "low",
  phase: "waiting",
  shape: "ring",
  tone: "neutral",
} as const satisfies TokenBoardStatusSignal;

const TOKEN_BOARD_STATUS_SIGNALS = {
  active: {
    emphasis: "high",
    phase: "serving",
    shape: "diamond",
    tone: "warning",
  },
  called: {
    emphasis: "high",
    phase: "serving",
    shape: "diamond",
    tone: "success",
  },
  cancelled: {
    emphasis: "high",
    phase: "blocked",
    shape: "square",
    tone: "danger",
  },
  collected: {
    emphasis: "medium",
    phase: "done",
    shape: "circle",
    tone: "success",
  },
  collection_in_progress: {
    emphasis: "medium",
    phase: "in_progress",
    shape: "pill",
    tone: "warning",
  },
  completed: {
    emphasis: "low",
    phase: "done",
    shape: "circle",
    tone: "success",
  },
  dispensed: {
    emphasis: "medium",
    phase: "done",
    shape: "circle",
    tone: "success",
  },
  in_progress: {
    emphasis: "high",
    phase: "serving",
    shape: "diamond",
    tone: "success",
  },
  issued: {
    emphasis: "medium",
    phase: "in_progress",
    shape: "pill",
    tone: "warning",
  },
  no_show: {
    emphasis: "high",
    phase: "blocked",
    shape: "square",
    tone: "danger",
  },
  on_hold: {
    emphasis: "medium",
    phase: "blocked",
    shape: "square",
    tone: "warning",
  },
  paid: {
    emphasis: "medium",
    phase: "ready",
    shape: "circle",
    tone: "success",
  },
  partially_paid: {
    emphasis: "medium",
    phase: "blocked",
    shape: "square",
    tone: "warning",
  },
  preparing: {
    emphasis: "medium",
    phase: "in_progress",
    shape: "pill",
    tone: "warning",
  },
  ready: {
    emphasis: "high",
    phase: "ready",
    shape: "circle",
    tone: "success",
  },
  scheduled: {
    emphasis: "low",
    phase: "waiting",
    shape: "ring",
    tone: "info",
  },
  settled: {
    emphasis: "medium",
    phase: "ready",
    shape: "circle",
    tone: "success",
  },
  waiting: {
    emphasis: "low",
    phase: "waiting",
    shape: "ring",
    tone: "neutral",
  },
} as const satisfies Readonly<Record<TokenBoardStatusValue, TokenBoardStatusSignal>>;

const TOKEN_BOARD_STATUS_LABEL_KEYS = {
  active: "tokenBoards.status.active",
  called: "tokenBoards.status.called",
  cancelled: "tokenBoards.status.cancelled",
  collected: "tokenBoards.status.collected",
  collection_in_progress: "tokenBoards.status.collectionInProgress",
  completed: "tokenBoards.status.completed",
  dispensed: "tokenBoards.status.dispensed",
  in_progress: "tokenBoards.status.inProgress",
  issued: "tokenBoards.status.issued",
  no_show: "tokenBoards.status.noShow",
  on_hold: "tokenBoards.status.onHold",
  paid: "tokenBoards.status.paid",
  partially_paid: "tokenBoards.status.partiallyPaid",
  preparing: "tokenBoards.status.preparing",
  ready: "tokenBoards.status.ready",
  scheduled: "tokenBoards.status.scheduled",
  settled: "tokenBoards.status.settled",
  waiting: "tokenBoards.status.waiting",
} as const satisfies Readonly<Record<TokenBoardStatusValue, string>>;

const TOKEN_BOARD_STATUS_LABELS = {
  active: "Active",
  called: "Called",
  cancelled: "Cancelled",
  collected: "Collected",
  collection_in_progress: "Collection in progress",
  completed: "Completed",
  dispensed: "Dispensed",
  in_progress: "In progress",
  issued: "Issued",
  no_show: "No show",
  on_hold: "On hold",
  paid: "Paid",
  partially_paid: "Partially paid",
  preparing: "Preparing",
  ready: "Ready",
  scheduled: "Scheduled",
  settled: "Settled",
  waiting: "Waiting",
} as const satisfies Readonly<Record<TokenBoardStatusValue, string>>;

export function isTokenBoardStatusValue(status: string): status is TokenBoardStatusValue {
  return TOKEN_BOARD_STATUS_VALUE_SET.has(status);
}

export function tokenBoardStatusSignal(status: string): TokenBoardStatusSignal {
  return isTokenBoardStatusValue(status)
    ? TOKEN_BOARD_STATUS_SIGNALS[status]
    : TOKEN_BOARD_DEFAULT_STATUS_SIGNAL;
}

export function tokenBoardStatusLabelKey(status: string): string | null {
  return isTokenBoardStatusValue(status) ? TOKEN_BOARD_STATUS_LABEL_KEYS[status] : null;
}

export function tokenBoardStatusLabel(status: string): string {
  return isTokenBoardStatusValue(status)
    ? TOKEN_BOARD_STATUS_LABELS[status]
    : status.replace(/_/g, " ");
}
