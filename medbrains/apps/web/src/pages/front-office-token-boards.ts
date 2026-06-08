import type {
  BillingQueueToken,
  LabQueueToken,
  PharmacyQueueToken,
  QueuePriority,
  QueueToken,
  RadiologyQueueToken,
  TokenBoardSurfaceId,
} from "@medbrains/types";
import { TOKEN_BOARD_SURFACES } from "@medbrains/types";

export interface DisplayToken {
  meta: string;
  status: string;
  tokenNumber: string;
}

export const TOKEN_BOARD_QUERY_PARAM = "board";
export const TOKEN_BOARD_DISPLAY_QUERY_PARAM = "display";
export const TOKEN_BOARD_HASH = "token-boards";
export type TokenBoardFilter = "all" | TokenBoardSurfaceId;
export type TokenBoardRouteDisplayMode = "workspace" | "kiosk";

export interface TokenBoardFilterRoute {
  hash: typeof TOKEN_BOARD_HASH;
  pathname: string;
  search: string;
}

const TOKEN_BOARD_SURFACE_IDS = new Set(Object.keys(TOKEN_BOARD_SURFACES));

export function isTokenBoardSurfaceId(value: string | null): value is TokenBoardSurfaceId {
  return value != null && TOKEN_BOARD_SURFACE_IDS.has(value);
}

export function tokenBoardFilterFromSearchParams(searchParams: URLSearchParams): TokenBoardFilter {
  const board = searchParams.get(TOKEN_BOARD_QUERY_PARAM);
  return isTokenBoardSurfaceId(board) ? board : "all";
}

export function tokenBoardDisplayModeFromSearchParams(
  searchParams: URLSearchParams,
): TokenBoardRouteDisplayMode {
  return searchParams.get(TOKEN_BOARD_DISPLAY_QUERY_PARAM) === "kiosk" ? "kiosk" : "workspace";
}

export function updateTokenBoardFilterSearchParams(
  searchParams: URLSearchParams,
  filter: TokenBoardFilter,
): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);

  if (filter === "all") {
    nextSearchParams.delete(TOKEN_BOARD_QUERY_PARAM);
  } else {
    nextSearchParams.set(TOKEN_BOARD_QUERY_PARAM, filter);
  }

  return nextSearchParams;
}

export function tokenBoardFilterRoute(
  pathname: string,
  searchParams: URLSearchParams,
  filter: TokenBoardFilter,
): TokenBoardFilterRoute {
  return {
    hash: TOKEN_BOARD_HASH,
    pathname,
    search: updateTokenBoardFilterSearchParams(searchParams, filter).toString(),
  };
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
