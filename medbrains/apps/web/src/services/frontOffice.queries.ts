import type {
  BillingQueueDisplay,
  ErQueueDisplay,
  LabQueueDisplay,
  PharmacyQueueDisplay,
  QueueToken,
  RadiologyQueueDisplay,
} from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { frontOfficeService } from "./frontOffice.service";

const TOKEN_BOARD_REFRESH_MS = 10_000;
const ER_TOKEN_BOARD_REFRESH_MS = 5_000;

interface FrontOfficeTokenBoardQueryOptions {
  enabled: boolean;
}

export function useFrontOfficeOpdTokenBoardQuery({ enabled }: FrontOfficeTokenBoardQueryOptions) {
  return useQuery<QueueToken[]>({
    queryKey: ["front-office", "token-board", "opd"],
    queryFn: () => frontOfficeService.listQueueTokens(),
    enabled,
    refetchInterval: ER_TOKEN_BOARD_REFRESH_MS,
  });
}

export function useFrontOfficeLabTokenBoardQuery({ enabled }: FrontOfficeTokenBoardQueryOptions) {
  return useQuery<LabQueueDisplay>({
    queryKey: ["front-office", "token-board", "lab"],
    queryFn: () => frontOfficeService.getLabQueueDisplay(),
    enabled,
    refetchInterval: TOKEN_BOARD_REFRESH_MS,
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
    refetchInterval: TOKEN_BOARD_REFRESH_MS,
  });
}

export function useFrontOfficeEmergencyTokenBoardQuery({
  enabled,
}: FrontOfficeTokenBoardQueryOptions) {
  return useQuery<ErQueueDisplay>({
    queryKey: ["front-office", "token-board", "er"],
    queryFn: () => frontOfficeService.getErQueueDisplay(),
    enabled,
    refetchInterval: ER_TOKEN_BOARD_REFRESH_MS,
  });
}

export function useFrontOfficePharmacyTokenBoardQuery({
  enabled,
}: FrontOfficeTokenBoardQueryOptions) {
  return useQuery<PharmacyQueueDisplay>({
    queryKey: ["front-office", "token-board", "pharmacy"],
    queryFn: () => frontOfficeService.getPharmacyQueueDisplay(),
    enabled,
    refetchInterval: TOKEN_BOARD_REFRESH_MS,
  });
}

export function useFrontOfficeBillingTokenBoardQuery({
  enabled,
}: FrontOfficeTokenBoardQueryOptions) {
  return useQuery<BillingQueueDisplay>({
    queryKey: ["front-office", "token-board", "billing"],
    queryFn: () => frontOfficeService.getBillingQueueDisplay(),
    enabled,
    refetchInterval: TOKEN_BOARD_REFRESH_MS,
  });
}
