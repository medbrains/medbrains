import { P } from "./permissions.js";

export type TokenBoardSurfaceId =
  | "billing"
  | "emergency"
  | "lab"
  | "opd"
  | "pharmacy"
  | "radiology";
export type TokenBoardDisplayMode = "token_only_public";
export type TokenBoardReadinessTone = "danger" | "info" | "success" | "warning";
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

export const TOKEN_BOARD_PUBLIC_PRIVACY_NOTICE =
  "Token-only display mode. Patient names, identifiers, diagnoses, test names, imaging details, drug names and bill amounts stay hidden.";

export const TOKEN_BOARD_FAST_REFRESH_MS = 5_000;
export const TOKEN_BOARD_STANDARD_REFRESH_MS = 10_000;

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
