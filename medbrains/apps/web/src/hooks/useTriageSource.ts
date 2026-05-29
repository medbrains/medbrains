/**
 * useTriageSource — ED triage log (T2 append-only).
 *
 * REST path: /emergency/visits/{visit_id}/triage-entries (existing
 * routes shape — exact paths may differ; the hook hides the
 * difference from consumers).
 */

import { type CrdtConnectionStatus, useAppendOnlyCrdtList } from "@medbrains/crdt";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTenantConfig } from "@/providers/TenantConfigProvider";
import { clinicalSourcesService } from "@/services/clinicalSources.service";

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
  const useCrdt = config.mode === "crdt";
  const rest = useTriageRest(visitId, config.authorName, !useCrdt);
  const crdt = useTriageCrdt(visitId, { ...config, enabled: useCrdt });
  return useCrdt ? crdt : rest;
}

function useTriageRest(visitId: string, _authorName: string, enabled: boolean): TriageSourceResult {
  const qc = useQueryClient();
  const query = useQuery<TriageEntry[]>({
    queryKey: ["triage", visitId],
    queryFn: () => clinicalSourcesService.listTriageEntries(visitId),
    enabled: enabled && !!visitId,
  });
  const mutation = useMutation({
    mutationFn: async (e: TriageEntryInput) => {
      return clinicalSourcesService.createTriageEntry(visitId, e);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["triage", visitId] }),
  });
  const append = useCallback((e: TriageEntryInput) => mutation.mutate(e), [mutation]);
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
  config: {
    edgeUrl: string;
    tenantId: string;
    deviceId: string;
    authorName: string;
    enabled: boolean;
  },
): TriageSourceResult {
  const list = useAppendOnlyCrdtList<TriageEntry>(`triage/${visitId}`, {
    edgeUrl: config.edgeUrl,
    tenantId: config.tenantId,
    deviceId: config.deviceId,
    enabled: config.enabled,
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
