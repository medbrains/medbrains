import {
  TOKEN_BOARD_SURFACE_LIST,
  type TokenBoardSurfaceDefinition,
  type TokenBoardSurfaceId,
  type TokenBoardTvAppCode,
  type TokenBoardTvDisplayType,
} from "@medbrains/types";

export interface TokenBoardTvModuleRegistryEntry {
  appCodes: readonly TokenBoardTvAppCode[];
  deepLink: string;
  displayType: TokenBoardTvDisplayType;
  moduleId: string;
  surfaceId: TokenBoardSurfaceId;
}

export const TOKEN_BOARD_TV_MODULE_IDS_BY_DISPLAY = {
  billing_queue: "billing-queue",
  emergency_triage: "emergency-triage",
  lab_queue: "lab-status",
  opd_queue: "queue",
  pharmacy_queue: "pharmacy-queue",
  radiology_queue: "radiology-queue",
} satisfies Record<TokenBoardTvDisplayType, string>;

export function tokenBoardTvRegistryEntry(
  surface: TokenBoardSurfaceDefinition,
): TokenBoardTvModuleRegistryEntry {
  return {
    appCodes: surface.targets.tvAppCodes,
    deepLink: surface.targets.tvDeepLink,
    displayType: surface.targets.tvDisplayType,
    moduleId: TOKEN_BOARD_TV_MODULE_IDS_BY_DISPLAY[surface.targets.tvDisplayType],
    surfaceId: surface.id,
  };
}

export const TOKEN_BOARD_TV_MODULE_REGISTRY =
  TOKEN_BOARD_SURFACE_LIST.map(tokenBoardTvRegistryEntry);
