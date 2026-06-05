import { P } from "./permissions.js";

export type TokenBoardSurfaceId = "billing" | "emergency" | "opd" | "pharmacy";
export type TokenBoardDisplayMode = "token_only_public";
export type TokenBoardTvAppCode =
  | "Desktop-Kiosk"
  | "TV-Billing"
  | "TV-DoctorRoom"
  | "TV-Emergency"
  | "TV-Pharmacy"
  | "TV-Queue";

export interface TokenBoardLaunchTargets {
  mobileRoute: "TokenBoards";
  tvAppCodes: readonly TokenBoardTvAppCode[];
  tvDeepLink: string;
  webPath: string;
}

export interface TokenBoardSurfaceDefinition {
  id: TokenBoardSurfaceId;
  accent: "brand" | "copper" | "emerald" | "red";
  description: string;
  displayMode: TokenBoardDisplayMode;
  module: "billing" | "emergency" | "opd" | "pharmacy";
  privacyNotice: string;
  requiredAnyPermissions: readonly string[];
  restrictedLabel: string;
  standardRefs: readonly string[];
  subtitle: string;
  title: string;
  targets: TokenBoardLaunchTargets;
}

export const TOKEN_BOARD_PUBLIC_PRIVACY_NOTICE =
  "Token-only display mode. Patient names, identifiers, diagnoses, drug names and bill amounts stay hidden.";

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
    requiredAnyPermissions: [P.BILLING.INVOICES_LIST],
    restrictedLabel: "Billing board restricted",
    standardRefs: ["IPSG.1 patient identification", "NABH PRE patient rights"],
    subtitle: "OPD, IPD discharge, advance and insurance desks",
    targets: {
      mobileRoute: "TokenBoards",
      tvAppCodes: ["TV-Billing"],
      tvDeepLink: "medbrains://tv/billing-queue",
      webPath: "/front-office#token-boards",
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
    requiredAnyPermissions: [P.EMERGENCY.VISITS_LIST, P.EMERGENCY.TRIAGE_LIST],
    restrictedLabel: "Emergency board restricted",
    standardRefs: ["IPSG.2 effective communication", "NABH emergency care continuity"],
    subtitle: "Color-coded triage targets",
    targets: {
      mobileRoute: "TokenBoards",
      tvAppCodes: ["TV-Emergency"],
      tvDeepLink: "medbrains://tv/emergency-triage",
      webPath: "/front-office#token-boards",
    },
    title: "Emergency triage",
  },
  opd: {
    accent: "copper",
    description: "OPD waiting-hall queue display for called and next outpatient tokens.",
    displayMode: "token_only_public",
    id: "opd",
    module: "opd",
    privacyNotice:
      "Token-only public display. Patient names, identifiers, diagnoses and contact details are withheld.",
    requiredAnyPermissions: [P.OPD.QUEUE_LIST, P.OPD.QUEUE_VIEW],
    restrictedLabel: "OPD board restricted",
    standardRefs: ["IPSG.1 patient identification", "NABH access, assessment and continuity"],
    subtitle: "Token calls across outpatient departments",
    targets: {
      mobileRoute: "TokenBoards",
      tvAppCodes: ["TV-Queue", "TV-DoctorRoom", "Desktop-Kiosk"],
      tvDeepLink: "medbrains://tv/queue",
      webPath: "/front-office#token-boards",
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
    requiredAnyPermissions: [P.PHARMACY.PRESCRIPTIONS_LIST, P.PHARMACY.PRESCRIPTIONS_VIEW],
    restrictedLabel: "Pharmacy board restricted",
    standardRefs: ["IPSG.3 medication safety", "NABH medication management"],
    subtitle: "Prescription preparation and handover",
    targets: {
      mobileRoute: "TokenBoards",
      tvAppCodes: ["TV-Pharmacy"],
      tvDeepLink: "medbrains://tv/pharmacy-queue",
      webPath: "/front-office#token-boards",
    },
    title: "Pharmacy pickup",
  },
};

export const TOKEN_BOARD_SURFACE_LIST = [
  TOKEN_BOARD_SURFACES.opd,
  TOKEN_BOARD_SURFACES.emergency,
  TOKEN_BOARD_SURFACES.pharmacy,
  TOKEN_BOARD_SURFACES.billing,
] as const satisfies ReadonlyArray<TokenBoardSurfaceDefinition>;

export function getTokenBoardSurface(id: TokenBoardSurfaceId): TokenBoardSurfaceDefinition {
  return TOKEN_BOARD_SURFACES[id];
}
