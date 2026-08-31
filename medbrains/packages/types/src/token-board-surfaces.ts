import { P } from "./permissions.js";

export type TokenBoardSurfaceId =
  | "billing"
  | "camp"
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
  | "camp_queue"
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
  module: "billing" | "camp" | "emergency" | "lab" | "opd" | "pharmacy" | "radiology";
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
  camp: {
    accent: "emerald",
    description:
      "Outreach camp board — every consultation room and service counter for one camp, with who is on duty.",
    displayMode: "token_only_public",
    id: "camp",
    module: "camp",
    privacyNotice:
      "Token-only camp display. Patient names, identifiers, Aadhaar and complaints are withheld; only the staff on duty are named.",
    readiness: {
      flow: "Camp stations",
      privacy: "Token only",
    },
    // A camp queue turns over faster than a hospital clinic: one counter can
    // feed thirteen rooms, so the board is refreshed on the fast interval.
    refreshIntervalMs: TOKEN_BOARD_FAST_REFRESH_MS,
    requiredAnyPermissions: [P.CAMP.LIST, P.CAMP.REGISTRATIONS_LIST],
    restrictedLabel: "Camp board restricted",
    standardRefs: ["NABH CHO community outreach", "IPSG.1 patient identification"],
    subtitle: "Consultation rooms and service counters for the day's camp",
    targets: {
      kioskPath: tokenBoardKioskPath("camp"),
      mobileParams: { surface: "camp" },
      mobileRoute: "TokenBoards",
      // A TV taken to a camp is a queue display. There is no "TV-Camp" in the
      // AppSurfaceCode catalog and adding a shipped app target is an org
      // decision, not a board one.
      tvAppCodes: ["TV-Queue"],
      tvDeepLink: "medbrains://tv/camp-queue",
      tvDisplayType: "camp_queue",
      webPath: tokenBoardWebPath("camp"),
    },
    title: "Camp stations",
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
  TOKEN_BOARD_SURFACES.camp,
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
  camp: "tokenBoards.surfaces.camp.flow",
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

/**
 * How long a missed token keeps its place on the board.
 *
 * Long enough that someone who stepped out to the toilet or the pharmacy walks
 * back, finds their number still on screen, and knows to go to the desk. Short
 * enough that the board is not carrying every no-show of the day by afternoon —
 * a "Missed" list forty numbers long tells nobody anything.
 *
 * Ten minutes is a starting figure, not a measured one; it is named here so a
 * site that runs busier or quieter can change it in one place.
 */
export const MISSED_TOKEN_BOARD_WINDOW_MINUTES = 10;

/**
 * What a patient sees when they follow their own token from their phone.
 *
 * No name, no identifiers: the link needs no login, so it must reveal no more
 * than the waiting-room screen shows to everyone already standing in front of
 * it.
 */
export interface PublicTokenStatus {
  token_number: string;
  department_name: string;
  status: string;
  /** How many are called first. Null once the token is no longer waiting. */
  ahead: number | null;
  estimated_wait_minutes: number | null;
}

/** The opaque handle staff hand to a patient so they can follow their token. */
export interface PublicTokenLink {
  status_token: string;
}

/** The shape needed to tell whether a token was recently missed. */
export interface MissableToken {
  status: string;
  /**
   * When the token left the queue. Missed tokens without one are not shown.
   *
   * Optional as well as nullable, because the board DTO omits it rather than
   * sending null — a narrower type here would exclude the very caller this
   * helper exists for.
   */
  completed_at?: string | null;
}

/**
 * The tokens a board should announce as missed right now.
 *
 * Only `no_show`. A `cancelled` token shares the same "blocked" phase but is a
 * deliberate act — announcing it as missed would send a patient to the desk to
 * ask about a token somebody already withdrew on purpose.
 *
 * Tokens with no `completed_at` are left out: without a time there is no way to
 * tell a call missed a minute ago from one missed at eight this morning, and
 * showing both is how the list stops meaning anything.
 */
export function recentlyMissedTokens<T extends MissableToken>(
  tokens: readonly T[],
  nowMs: number,
  windowMinutes: number = MISSED_TOKEN_BOARD_WINDOW_MINUTES,
): T[] {
  const cutoff = nowMs - windowMinutes * 60_000;
  return tokens.filter((token) => {
    if (token.status !== "no_show" || token.completed_at == null) return false;
    const missedAt = Date.parse(token.completed_at);
    return !Number.isNaN(missedAt) && missedAt >= cutoff;
  });
}

export function tokenBoardStatusLabel(status: string): string {
  return isTokenBoardStatusValue(status)
    ? TOKEN_BOARD_STATUS_LABELS[status]
    : status.replace(/_/g, " ");
}

/**
 * A doctor a member of the public may book with.
 *
 * Served to anyone holding a hospital's code, so it carries what somebody
 * needs to choose an appointment and nothing more — no contact details, no
 * employee id, no roster.
 */
export interface PublicBookableDoctor {
  doctor_id: string;
  doctor_name: string;
  department_id: string;
  department_name: string;
}

/**
 * What a booking page needs before it can render a correct form.
 *
 * `otp_required` travels with the doctor list because the page cannot show the
 * right fields without it, and a second round trip for one boolean is a second
 * thing to fail.
 */
export interface PublicBookingDirectory {
  otp_required: boolean;
  doctors: PublicBookableDoctor[];
}

/** One bookable slot in a doctor's day. Times are `HH:MM:SS`. */
export interface PublicAvailableSlot {
  start_time: string;
  end_time: string;
  booked_count: number;
  max_patients: number;
  is_available: boolean;
}

export interface PublicBookingRequest {
  tenant_code: string;
  doctor_id: string;
  department_id: string;
  appointment_date: string;
  slot_start: string;
  slot_end: string;
  patient_name: string;
  patient_phone: string;
  patient_dob?: string;
  reason?: string;
  /** Required only when the tenant turns on booking OTP. */
  otp?: string;
}

export interface PublicBookingResponse {
  appointment_id: string;
  appointment_date: string;
  slot_start: string;
  doctor_name: string;
  department_name: string;
  qr_code_data: string;
  status: string;
  message: string;
}

// ── Patient portal ──────────────────────────────────────────────────
//
// A patient signing in for their own records. Separate from staff auth
// throughout: the session token carries a patient id and nothing a staff
// route could act on.

export interface PortalSession {
  token: string;
  patient_id: string;
  tenant_id: string;
  expires_in_hours: number;
}

export interface PortalInvoice {
  id: string;
  invoice_number: string;
  status: string;
  total_amount: string;
  paid_amount: string;
  balance_due: string;
  created_at: string;
}

/**
 * One reported lab parameter.
 *
 * The server withholds unverified results and any carrying an unacknowledged
 * critical alert, so anything arriving here is safe for a patient to read
 * unaccompanied.
 */
export interface PortalLabReport {
  order_id: string;
  test_name: string;
  parameter_name: string;
  value: string;
  unit: string | null;
  normal_range: string | null;
  flag: string | null;
  reported_at: string;
}

export interface PortalPrescriptionItem {
  prescription_id: string;
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  prescribed_at: string;
}

export interface PortalAppointment {
  id: string;
  appointment_date: string;
  status: string;
  department_name: string | null;
}

/** A token as a door display needs to read it. */
export interface RoomToken {
  status: string;
  counter_label?: string | null;
  called_at?: string | null;
}

/** Rooms are typed by people; match on meaning, not on whitespace and case. */
function sameRoom(label: string | null | undefined, room: string): boolean {
  return (label ?? "").trim().toLowerCase() === room.trim().toLowerCase();
}

/**
 * The token a consulting-room door should show, or null for "please wait".
 *
 * A door display answers one question — may I go in? — so it shows exactly one
 * token and only while that patient is being seen. `called` and `serving` both
 * qualify: the first means walk in, the second means somebody already has.
 *
 * `room` is matched against `counter_label`, which is the room a token was
 * called to. Omit it where a department has a single consulting room, and the
 * department's current token is the room's current token. Passing a room that
 * nothing has been called to yields null rather than the department's token:
 * showing a neighbouring room's number on this door sends the patient into the
 * wrong consultation, which is worse than showing nothing.
 *
 * Where several qualify, the most recently called wins — a door that keeps
 * displaying the previous patient is a door people knock on.
 */
export function currentRoomToken<T extends RoomToken>(
  tokens: ReadonlyArray<T>,
  room?: string | null,
): T | null {
  const inRoom = tokens.filter((token) => {
    if (token.status !== "called" && token.status !== "serving") return false;
    if (room == null || room.trim() === "") return true;
    return sameRoom(token.counter_label, room);
  });
  if (inRoom.length === 0) return null;
  return inRoom.reduce((latest, token) => {
    // Undated calls sort oldest: a token with no time cannot be shown to be
    // newer than one that has a time, and guessing in the other direction
    // would let a stale row take over the door.
    const a = latest.called_at ? Date.parse(latest.called_at) : Number.NEGATIVE_INFINITY;
    const b = token.called_at ? Date.parse(token.called_at) : Number.NEGATIVE_INFINITY;
    return b > a ? token : latest;
  });
}

/**
 * The token priority vocabulary, in the order the queue sorts them.
 *
 * Mirrors `public.token_priority_weight` (migration 1004). Lower sorts first.
 * Keep the two in step: the board orders by the SQL function, so a label here
 * that the function does not know sorts last rather than where it reads.
 */
export const TOKEN_PRIORITY_ORDER = [
  "stat",
  "urgent",
  "emergency_referral",
  "elderly",
  "disabled",
  "pregnant",
  "carried_over",
  "vip",
  "normal",
] as const;

export type TokenPriority = (typeof TOKEN_PRIORITY_ORDER)[number];

/** Human labels. A queue badge reading "carried_over" is a database value. */
export const TOKEN_PRIORITY_LABEL: Record<string, string> = {
  stat: "STAT",
  urgent: "Urgent",
  emergency_referral: "Emergency referral",
  elderly: "Elderly",
  disabled: "Disabled",
  pregnant: "Pregnant",
  carried_over: "Carried over",
  vip: "VIP",
  normal: "Normal",
};

/**
 * Why a token carries its priority, for a tooltip beside the badge.
 *
 * "Carried over" in particular needs saying out loud: a patient ahead of the
 * queue for a reason nobody at the desk witnessed will otherwise look like a
 * queue-jump, and the desk is the party who has to defend it.
 */
export const TOKEN_PRIORITY_REASON: Record<string, string> = {
  stat: "A clinical emergency.",
  urgent: "Clinically ahead of the routine list.",
  emergency_referral: "Sent here by another facility, still waiting.",
  elderly: "Vulnerability category.",
  disabled: "Vulnerability category.",
  pregnant: "Vulnerability category.",
  carried_over: "Waited on an earlier day and was not seen before the day ended.",
  vip: "A courtesy — behind every clinical and vulnerability reason.",
  normal: "No priority claim.",
};
