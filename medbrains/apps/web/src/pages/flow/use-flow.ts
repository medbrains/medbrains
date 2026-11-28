import { flowApi } from "@medbrains/api/modules/flow";
import type { FlowDecision } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** The aggregator writes once a minute; reading twice as often is plenty. */
const LIVE_REFRESH_MS = 30_000;

export const flowKeys = {
  floors: ["flow", "floors"] as const,
  live: (floorId: string) => ["flow", "live", floorId] as const,
  history: (floorId: string) => ["flow", "history", floorId] as const,
  forecast: (floorId: string) => ["flow", "forecast", floorId] as const,
  zone: (zoneId: string) => ["flow", "zone", zoneId] as const,
  configFloors: ["flow", "config", "floors"] as const,
  setup: (floorId: string) => ["flow", "config", "setup", floorId] as const,
};

/** Each read is gated: a screen without the permission never issues the fetch. */
export function useFlowFloors(enabled: boolean) {
  return useQuery({ queryKey: flowKeys.floors, queryFn: flowApi.listFlowFloors, enabled });
}

export function useFlowLive(floorId: string | null) {
  return useQuery({
    queryKey: flowKeys.live(floorId ?? ""),
    queryFn: () => flowApi.getFlowFloorLive(floorId as string),
    enabled: Boolean(floorId),
    refetchInterval: LIVE_REFRESH_MS,
  });
}

export function useFlowHistory(floorId: string | null, allowed: boolean) {
  return useQuery({
    queryKey: flowKeys.history(floorId ?? ""),
    queryFn: () => flowApi.getFlowFloorHistory(floorId as string),
    enabled: Boolean(floorId) && allowed,
    refetchInterval: 5 * 60_000,
  });
}

export function useFlowForecast(floorId: string | null) {
  return useQuery({
    queryKey: flowKeys.forecast(floorId ?? ""),
    queryFn: () => flowApi.getFlowFloorForecast(floorId as string, 4),
    enabled: Boolean(floorId),
    refetchInterval: 5 * 60_000,
  });
}

export function useFlowZone(zoneId: string | null) {
  return useQuery({
    queryKey: flowKeys.zone(zoneId ?? ""),
    queryFn: () => flowApi.getFlowZone(zoneId as string),
    enabled: Boolean(zoneId),
    refetchInterval: LIVE_REFRESH_MS,
  });
}

/** Accept, snooze or dismiss: records the decision and nothing else. */
export function useDecideRecommendation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: FlowDecision }) =>
      flowApi.decideFlowRecommendation(id, { decision }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["flow"] }),
  });
}

export function useAckAlert() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => flowApi.ackFlowAlert(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ["flow"] }),
  });
}
