import type {
  BillingQueueToken,
  LabQueueToken,
  ModuleToken,
  PharmacyQueueToken,
  RadiologyQueueToken,
  TokenBoardStatusSignal,
  TokenBoardSurfaceFilter,
} from "@medbrains/types";
import { tokenBoardStatusSignal, tokenBoardSurfaceFilterFromParam } from "@medbrains/types";

export interface DisplayToken {
  meta: string;
  signal: TokenBoardStatusSignal;
  status: string;
  tokenNumber: string;
}

export const TOKEN_BOARD_QUERY_PARAM = "board";
export const TOKEN_BOARD_DISPLAY_QUERY_PARAM = "display";
export const TOKEN_BOARD_HASH = "token-boards";
export type TokenBoardFilter = TokenBoardSurfaceFilter;
export type TokenBoardRouteDisplayMode = "workspace" | "kiosk";

export interface TokenBoardFilterRoute {
  hash: typeof TOKEN_BOARD_HASH;
  pathname: string;
  search: string;
}

export function tokenBoardFilterFromSearchParams(searchParams: URLSearchParams): TokenBoardFilter {
  return tokenBoardSurfaceFilterFromParam(searchParams.get(TOKEN_BOARD_QUERY_PARAM));
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

function priorityLabel(value: string) {
  return value.replace(/_/g, " ");
}

/**
 * Token, status and priority — never who the patient is.
 *
 * `ModuleToken` carries `patient_name`, unlike the `QueueToken` this used to
 * take. The board it feeds hangs in a waiting room, so the field is dropped
 * here and `expectPublicTokenOnly` in the tests holds it dropped.
 */
export function opdDisplayToken(token: ModuleToken): DisplayToken {
  return {
    meta: token.priority === "normal" ? "Standard priority" : priorityLabel(token.priority),
    signal: tokenBoardStatusSignal(token.status),
    status: token.status,
    tokenNumber: token.number,
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
    signal: tokenBoardStatusSignal(token.status),
    status: token.status,
    tokenNumber: token.token_number,
  };
}

export function radiologyDisplayToken(token: RadiologyQueueToken): DisplayToken {
  return {
    meta: [token.modality, token.room_number]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
    signal: tokenBoardStatusSignal(token.status),
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
    signal: tokenBoardStatusSignal(token.status),
    status: token.status,
    tokenNumber: token.token_number,
  };
}

export function billingDisplayToken(token: BillingQueueToken): DisplayToken {
  return {
    meta: [token.queue_type, token.counter !== null ? `Counter ${token.counter}` : null]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
    signal: tokenBoardStatusSignal(token.status),
    status: token.status,
    tokenNumber: token.token_number,
  };
}
