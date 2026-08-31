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

import { api } from "@medbrains/api";
import { type CrdtConnectionStatus, useAppendOnlyCrdtList } from "@medbrains/crdt";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTenantConfig } from "@/providers/TenantConfigProvider";

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
  const isCrdt = config.mode === "crdt";

  // Both are called on every render, and the inactive one is switched off
  // rather than skipped. Branching on `config.mode` around the call meant a
  // crdt render ran a different set of hooks from a rest render, so React
  // threw "rendered more hooks than during the previous render" the moment
  // the mode changed — and the handoff screen went down rather than
  // degrading. `useCrdtDoc` already takes `enabled` for exactly this:
  // "Disable storage and WebSocket work while still preserving hook call
  // order." Nothing was passing it.
  const crdt = useHandoffCrdt(shiftId, config, isCrdt);
  const rest = useHandoffRest(shiftId, config.authorName, !isCrdt);
  return isCrdt ? crdt : rest;
}

function useHandoffRest(
  shiftId: string,
  _authorName: string,
  enabled: boolean,
): HandoffSourceResult {
  const qc = useQueryClient();
  const query = useQuery<HandoffEntry[]>({
    queryKey: ["handoff", shiftId],
    queryFn: async () => (await api.listClinicalHandoffEntries(shiftId)).map(toHandoffEntry),
    enabled: enabled && !!shiftId,
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
  enabled: boolean,
): HandoffSourceResult {
  const list = useAppendOnlyCrdtList<HandoffEntry>(`handoff/${shiftId}`, {
    edgeUrl: config.edgeUrl,
    tenantId: config.tenantId,
    deviceId: config.deviceId,
    enabled,
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
