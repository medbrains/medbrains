/**
 * useHandoffSource — nursing shift handoff log (T2 append-only).
 * Same shape as useVitalsSource: REST when offline_mode is off,
 * CRDT-backed via medbrains-edge when on.
 *
 * Backend endpoints expected (REST path):
 *   GET  /clinical/handoff-entries/shifts/{shift_id}
 *   POST /clinical/handoff-entries/shifts/{shift_id}
 *
 */

import { type CrdtConnectionStatus, useAppendOnlyCrdtList } from "@medbrains/crdt";
import { api } from "@medbrains/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTenantConfig } from "../providers/TenantConfigProvider";

export interface HandoffEntry extends Record<string, unknown> {
  ts: number;
  author: string;
  note: string;
  category: "alert" | "info" | "task";
}

export interface HandoffEntryInput {
  note: string;
  category: "alert" | "info" | "task";
}

export interface HandoffSourceResult {
  entries: HandoffEntry[];
  append: (entry: HandoffEntryInput) => void;
  status: CrdtConnectionStatus | "loading" | "online" | "error";
  ready: boolean;
  unsyncedOps: number;
}

export function useHandoffSource(shiftId: string): HandoffSourceResult {
  const config = useTenantConfig();
  if (config.mode === "crdt") return useHandoffCrdt(shiftId, config);
  return useHandoffRest(shiftId, config.authorName);
}

function useHandoffRest(shiftId: string, _authorName: string): HandoffSourceResult {
  const qc = useQueryClient();
  const query = useQuery<HandoffEntry[]>({
    queryKey: ["handoff", shiftId],
    queryFn: async () => (await api.listClinicalHandoffEntries(shiftId)).map(toHandoffEntry),
    enabled: !!shiftId,
  });
  const mutation = useMutation({
    mutationFn: async (entry: HandoffEntryInput) =>
      toHandoffEntry(await api.createClinicalHandoffEntry(shiftId, entry)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["handoff", shiftId] }),
  });
  const append = useCallback((e: HandoffEntryInput) => mutation.mutate(e), [mutation]);
  return {
    entries: (query.data ?? []).slice().sort((a, b) => b.ts - a.ts),
    append,
    status: query.isLoading ? "loading" : query.isError ? "error" : "online",
    ready: !query.isLoading,
    unsyncedOps: mutation.isPending ? 1 : 0,
  };
}

type ClinicalHandoffEntry = Awaited<ReturnType<typeof api.listClinicalHandoffEntries>>[number];

function toHandoffEntry(entry: ClinicalHandoffEntry): HandoffEntry {
  return {
    id: entry.id,
    shift_id: entry.shift_id,
    author_user_id: entry.author_user_id,
    authored_at: entry.authored_at,
    ts: new Date(entry.authored_at).getTime(),
    author: entry.author_name,
    note: entry.note,
    category: entry.category,
  };
}

// ── CRDT ───────────────────────────────────────────────────────────

function useHandoffCrdt(
  shiftId: string,
  config: { edgeUrl: string; tenantId: string; deviceId: string; authorName: string },
): HandoffSourceResult {
  const list = useAppendOnlyCrdtList<HandoffEntry>(`handoff/${shiftId}`, {
    edgeUrl: config.edgeUrl,
    tenantId: config.tenantId,
    deviceId: config.deviceId,
  });
  const append = useCallback(
    (e: HandoffEntryInput) => {
      const entry: HandoffEntry = {
        ts: Date.now(),
        author: config.authorName,
        note: e.note,
        category: e.category,
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
