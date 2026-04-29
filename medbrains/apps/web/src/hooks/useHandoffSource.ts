/**
 * useHandoffSource — nursing shift handoff log (T2 append-only).
 * Same shape as useVitalsSource: REST when offline_mode is off,
 * CRDT-backed via medbrains-edge when on.
 *
 * Backend endpoints expected (REST path):
 *   GET  /nurse-handoff/shifts/{shift_id}/entries
 *   POST /nurse-handoff/shifts/{shift_id}/entries
 *
 * Until the REST endpoints exist, this hook keeps the unified
 * surface but the REST path returns an empty list + posts will fail.
 * Pages can render the offline path immediately by setting
 * tenant.offline_mode=true; the REST path lights up when nurse
 * handoff routes ship.
 */

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useAppendOnlyCrdtList,
  type CrdtConnectionStatus,
} from "@medbrains/crdt";
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

// ── REST (placeholder; activates when /nurse-handoff routes ship) ──

interface HandoffApi {
  list: (shiftId: string) => Promise<HandoffEntry[]>;
  create: (shiftId: string, entry: HandoffEntryInput) => Promise<HandoffEntry>;
}


const handoffApiStub: HandoffApi = {
  list: async () => [],
  create: async (_id, e) =>
    ({ ts: Date.now(), author: "stub", ...e } as HandoffEntry),
};

function useHandoffRest(shiftId: string, _authorName: string): HandoffSourceResult {
  const qc = useQueryClient();
  const query = useQuery<HandoffEntry[]>({
    queryKey: ["handoff", shiftId],
    queryFn: () => handoffApiStub.list(shiftId),
    enabled: !!shiftId,
  });
  const mutation = useMutation({
    mutationFn: (e: HandoffEntryInput) =>
      handoffApiStub.create(shiftId, e),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["handoff", shiftId] }),
  });
  const append = useCallback(
    (e: HandoffEntryInput) => mutation.mutate(e),
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
