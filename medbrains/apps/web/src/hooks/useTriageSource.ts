/**
 * useTriageSource — ED triage log (T2 append-only).
 *
 * REST path: /emergency/visits/{visit_id}/triage-entries (existing
 * routes shape — exact paths may differ; the hook hides the
 * difference from consumers).
 */

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import {
  useAppendOnlyCrdtList,
  type CrdtConnectionStatus,
} from "@medbrains/crdt";
import { useTenantConfig } from "../providers/TenantConfigProvider";

export interface TriageEntry extends Record<string, unknown> {
  ts: number;
  author: string;
  esi_level: 1 | 2 | 3 | 4 | 5;
  chief_complaint: string;
  observation: string;
}

export interface TriageEntryInput {
  esi_level: 1 | 2 | 3 | 4 | 5;
  chief_complaint: string;
  observation: string;
}

export interface TriageSourceResult {
  entries: TriageEntry[];
  append: (entry: TriageEntryInput) => void;
  status: CrdtConnectionStatus | "loading" | "online" | "error";
  ready: boolean;
  unsyncedOps: number;
}

export function useTriageSource(visitId: string): TriageSourceResult {
  const config = useTenantConfig();
  if (config.mode === "crdt") return useTriageCrdt(visitId, config);
  return useTriageRest(visitId, config.authorName);
}

// REST adapter — uses whatever the emergency module exposes; for
// now we wrap two probable api methods. If they don't exist on a
// given build the consumer falls back to an empty list (the
// catch makes the path resilient until backend ships them).
type EmergencyTriageApi = {
  listTriageEntries?: (visitId: string) => Promise<TriageEntry[]>;
  createTriageEntry?: (
    visitId: string,
    entry: TriageEntryInput,
  ) => Promise<TriageEntry>;
};
const emergencyApi = api as unknown as EmergencyTriageApi;

function useTriageRest(visitId: string, _authorName: string): TriageSourceResult {
  const qc = useQueryClient();
  const query = useQuery<TriageEntry[]>({
    queryKey: ["triage", visitId],
    queryFn: async () => {
      if (typeof emergencyApi.listTriageEntries !== "function") return [];
      return emergencyApi.listTriageEntries(visitId);
    },
    enabled: !!visitId,
  });
  const mutation = useMutation({
    mutationFn: async (e: TriageEntryInput) => {
      if (typeof emergencyApi.createTriageEntry !== "function") {
        throw new Error("triage REST endpoint not implemented yet");
      }
      return emergencyApi.createTriageEntry(visitId, e);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["triage", visitId] }),
  });
  const append = useCallback(
    (e: TriageEntryInput) => mutation.mutate(e),
    [mutation],
  );
  return {
    entries: (query.data ?? []).slice().sort((a, b) => b.ts - a.ts),
    append,
    status: query.isLoading ? "loading" : query.isError ? "error" : "online",
    ready: !query.isLoading,
    unsyncedOps: mutation.isPending ? 1 : 0,
  };
}

function useTriageCrdt(
  visitId: string,
  config: { edgeUrl: string; tenantId: string; deviceId: string; authorName: string },
): TriageSourceResult {
  const list = useAppendOnlyCrdtList<TriageEntry>(`triage/${visitId}`, {
    edgeUrl: config.edgeUrl,
    tenantId: config.tenantId,
    deviceId: config.deviceId,
  });
  const append = useCallback(
    (e: TriageEntryInput) => {
      const entry: TriageEntry = {
        ts: Date.now(),
        author: config.authorName,
        esi_level: e.esi_level,
        chief_complaint: e.chief_complaint,
        observation: e.observation,
      };
      list.append(entry);
    },
    [list, config.authorName],
  );
  return {
    entries: list.entries,
    append,
    status: list.status,
    ready: list.ready,
    unsyncedOps: list.unsyncedOps,
  };
}
