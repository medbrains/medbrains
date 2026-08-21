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
import { frontOfficeService } from "./frontOffice.service";

interface FrontOfficeTokenBoardQueryOptions {
  enabled: boolean;
}

/**
 * The OPD board, from the unified `tokens` table.
 *
 * `queue_tokens` was a queue nothing advanced: the doctor calls the next
 * patient on the unified queue, so a receptionist watching the old board and a
 * doctor working the clinic were looking at different days.
 */
export function useFrontOfficeOpdTokenBoardQuery({ enabled }: FrontOfficeTokenBoardQueryOptions) {
  return useQuery<ModuleToken[]>({
    queryKey: ["front-office", "token-board", "opd"],
    queryFn: () => frontOfficeService.listOpdTokenBoard(),
    enabled,
    refetchInterval: TOKEN_BOARD_SURFACES.opd.refreshIntervalMs,
  });
}

export function useFrontOfficeLabTokenBoardQuery({ enabled }: FrontOfficeTokenBoardQueryOptions) {
  return useQuery<LabQueueDisplay>({
    queryKey: ["front-office", "token-board", "lab"],
    queryFn: () => frontOfficeService.getLabQueueDisplay(),
    enabled,
    refetchInterval: TOKEN_BOARD_SURFACES.lab.refreshIntervalMs,
  });
}

export function useFrontOfficeRadiologyTokenBoardQuery(
  modality: string,
  { enabled }: FrontOfficeTokenBoardQueryOptions,
) {
  return useQuery<RadiologyQueueDisplay>({
    queryKey: ["front-office", "token-board", "radiology", modality],
    queryFn: () => frontOfficeService.getRadiologyQueueDisplay(modality),
    enabled,
    refetchInterval: TOKEN_BOARD_SURFACES.radiology.refreshIntervalMs,
  });
}

export function useFrontOfficeEmergencyTokenBoardQuery({
  enabled,
}: FrontOfficeTokenBoardQueryOptions) {
  return useQuery<ErQueueDisplay>({
    queryKey: ["front-office", "token-board", "er"],
    queryFn: () => frontOfficeService.getErQueueDisplay(),
    enabled,
    refetchInterval: TOKEN_BOARD_SURFACES.emergency.refreshIntervalMs,
  });
}

export function useFrontOfficePharmacyTokenBoardQuery({
  enabled,
}: FrontOfficeTokenBoardQueryOptions) {
  return useQuery<PharmacyQueueDisplay>({
    queryKey: ["front-office", "token-board", "pharmacy"],
    queryFn: () => frontOfficeService.getPharmacyQueueDisplay(),
    enabled,
    refetchInterval: TOKEN_BOARD_SURFACES.pharmacy.refreshIntervalMs,
  });
}

export function useFrontOfficeBillingTokenBoardQuery({
  enabled,
}: FrontOfficeTokenBoardQueryOptions) {
  return useQuery<BillingQueueDisplay>({
    queryKey: ["front-office", "token-board", "billing"],
    queryFn: () => frontOfficeService.getBillingQueueDisplay(),
    enabled,
    refetchInterval: TOKEN_BOARD_SURFACES.billing.refreshIntervalMs,
  });
}
