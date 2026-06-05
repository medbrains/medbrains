import { api } from "@medbrains/api";
import type {
  BillingQueueDisplay,
  ErQueueDisplay,
  PharmacyQueueDisplay,
  QueueToken,
} from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";

const TOKEN_BOARD_QUERY_KEY = ["token-boards"] as const;
const STANDARD_REFRESH_MS = 10_000;
const ER_REFRESH_MS = 5_000;
const OPD_REFRESH_MS = 5_000;

export function useOpdTokenBoardQuery(options?: { enabled?: boolean }) {
  return useQuery<QueueToken[]>({
    queryKey: [...TOKEN_BOARD_QUERY_KEY, "opd"],
    queryFn: () => api.listQueueTokens(),
    enabled: options?.enabled ?? true,
    refetchInterval: OPD_REFRESH_MS,
  });
}

export function useBillingTokenBoardQuery(options?: { enabled?: boolean }) {
  return useQuery<BillingQueueDisplay>({
    queryKey: [...TOKEN_BOARD_QUERY_KEY, "billing"],
    queryFn: api.getBillingQueueDisplay,
    enabled: options?.enabled ?? true,
    refetchInterval: STANDARD_REFRESH_MS,
  });
}

export function useErTokenBoardQuery(options?: { enabled?: boolean }) {
  return useQuery<ErQueueDisplay>({
    queryKey: [...TOKEN_BOARD_QUERY_KEY, "er"],
    queryFn: api.getErQueueDisplay,
    enabled: options?.enabled ?? true,
    refetchInterval: ER_REFRESH_MS,
  });
}

export function usePharmacyTokenBoardQuery(options?: { enabled?: boolean }) {
  return useQuery<PharmacyQueueDisplay>({
    queryKey: [...TOKEN_BOARD_QUERY_KEY, "pharmacy"],
    queryFn: api.getPharmacyQueueDisplay,
    enabled: options?.enabled ?? true,
    refetchInterval: STANDARD_REFRESH_MS,
  });
}
