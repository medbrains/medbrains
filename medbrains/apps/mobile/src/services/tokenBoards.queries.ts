import { api } from "@medbrains/api";
import type {
  BillingQueueDisplay,
  ErQueueDisplay,
  LabQueueDisplay,
  ModuleToken,
  PharmacyQueueDisplay,
  RadiologyQueueDisplay,
} from "@medbrains/types";
import { TOKEN_BOARD_SURFACES } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";

const TOKEN_BOARD_QUERY_KEY = ["token-boards"] as const;

/**
 * The OPD board, from the unified `tokens` table.
 *
 * It used to read `queue_tokens`, which nothing advances — the doctor calls
 * the next patient on the unified queue, so the old board showed a number that
 * could not change. `include_finished` keeps the token just called and recent
 * no-shows on screen; a board is not a work queue.
 */
export function useOpdTokenBoardQuery(options?: { enabled?: boolean }) {
  return useQuery<ModuleToken[]>({
    queryKey: [...TOKEN_BOARD_QUERY_KEY, "opd"],
    queryFn: () => api.listTokenBoard({ include_finished: true, module: "opd" }),
    enabled: options?.enabled ?? true,
    refetchInterval: TOKEN_BOARD_SURFACES.opd.refreshIntervalMs,
  });
}

export function useBillingTokenBoardQuery(options?: { enabled?: boolean }) {
  return useQuery<BillingQueueDisplay>({
    queryKey: [...TOKEN_BOARD_QUERY_KEY, "billing"],
    queryFn: api.getBillingQueueDisplay,
    enabled: options?.enabled ?? true,
    refetchInterval: TOKEN_BOARD_SURFACES.billing.refreshIntervalMs,
  });
}

export function useErTokenBoardQuery(options?: { enabled?: boolean }) {
  return useQuery<ErQueueDisplay>({
    queryKey: [...TOKEN_BOARD_QUERY_KEY, "er"],
    queryFn: api.getErQueueDisplay,
    enabled: options?.enabled ?? true,
    refetchInterval: TOKEN_BOARD_SURFACES.emergency.refreshIntervalMs,
  });
}

export function useLabTokenBoardQuery(options?: { enabled?: boolean }) {
  return useQuery<LabQueueDisplay>({
    queryKey: [...TOKEN_BOARD_QUERY_KEY, "lab"],
    queryFn: api.getLabQueueDisplay,
    enabled: options?.enabled ?? true,
    refetchInterval: TOKEN_BOARD_SURFACES.lab.refreshIntervalMs,
  });
}

export function useRadiologyTokenBoardQuery(modality = "xray", options?: { enabled?: boolean }) {
  return useQuery<RadiologyQueueDisplay>({
    queryKey: [...TOKEN_BOARD_QUERY_KEY, "radiology", modality],
    queryFn: () => api.getRadiologyQueueDisplay(modality),
    enabled: options?.enabled ?? true,
    refetchInterval: TOKEN_BOARD_SURFACES.radiology.refreshIntervalMs,
  });
}

export function usePharmacyTokenBoardQuery(options?: { enabled?: boolean }) {
  return useQuery<PharmacyQueueDisplay>({
    queryKey: [...TOKEN_BOARD_QUERY_KEY, "pharmacy"],
    queryFn: api.getPharmacyQueueDisplay,
    enabled: options?.enabled ?? true,
    refetchInterval: TOKEN_BOARD_SURFACES.pharmacy.refreshIntervalMs,
  });
}
