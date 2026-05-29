/**
 * useVitalsSource — unified data hook for vital signs that switches
 * between cloud REST flow and on-prem CRDT flow at runtime.
 *
 * Mode is read from `<TenantConfigProvider>` context by default;
 * pass `modeOverride` to force a specific path for tests / dev.
 *
 * Both paths return the same `Vital[]` shape so consumers don't
 * branch on mode. The CRDT path stringifies decimals where the
 * existing Vital type uses string for them (temperature, weight_kg,
 * height_cm) so the visual rendering in opd.tsx works either way.
 */

import { type CrdtConnectionStatus, useAppendOnlyCrdtList } from "@medbrains/crdt";
import type { CreateVitalRequest, Vital } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTenantConfig } from "@/providers/TenantConfigProvider";
import { opdService } from "@/services/opd.service";

export type VitalsSourceMode = "rest" | "crdt";

export interface UseVitalsSourceOptions {
  encounterId: string;
  /** Force a specific mode; usually leave unset and let the
   * TenantConfigProvider decide. */
  modeOverride?: VitalsSourceMode;
}

export interface VitalsSourceResult {
  records: Vital[];
  /** Submit a new reading. */
  append: (data: CreateVitalRequest) => void;
  status: CrdtConnectionStatus | "loading" | "online" | "error";
  ready: boolean;
  unsyncedOps: number;
}

export function useVitalsSource(opts: UseVitalsSourceOptions): VitalsSourceResult {
  const config = useTenantConfig();
  const mode = opts.modeOverride ?? config.mode;
  const useCrdt = mode === "crdt";
  const rest = useVitalsRest(opts.encounterId, !useCrdt);
  const crdt = useVitalsCrdt(opts.encounterId, { ...config, enabled: useCrdt });
  return useCrdt ? crdt : rest;
}

// ── REST ───────────────────────────────────────────────────────────

function useVitalsRest(encounterId: string, enabled: boolean): VitalsSourceResult {
  const qc = useQueryClient();
  const query = useQuery<Vital[]>({
    queryKey: ["vitals", encounterId],
    queryFn: () => opdService.listVitals(encounterId),
    enabled: enabled && !!encounterId,
  });
  const mutation = useMutation({
    mutationFn: (data: CreateVitalRequest) => opdService.createVital(encounterId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vitals", encounterId] });
    },
  });
  const append = useCallback((data: CreateVitalRequest) => mutation.mutate(data), [mutation]);

  let status: VitalsSourceResult["status"];
  if (query.isLoading) status = "loading";
  else if (query.isError) status = "error";
  else status = "online";

  return {
    records: query.data ?? [],
    append,
    status,
    ready: !query.isLoading,
    unsyncedOps: mutation.isPending ? 1 : 0,
  };
}

// ── CRDT ───────────────────────────────────────────────────────────

interface CrdtVitalEntry extends Record<string, unknown> {
  ts: number;
  recordedBy: string;
  temperature?: number;
  pulse?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  respiratory_rate?: number;
  spo2?: number;
  weight_kg?: number;
  height_cm?: number;
  notes?: string;
}

function useVitalsCrdt(
  encounterId: string,
  config: { edgeUrl: string; tenantId: string; deviceId: string; enabled: boolean },
): VitalsSourceResult {
  const list = useAppendOnlyCrdtList<CrdtVitalEntry>(`vitals/${encounterId}`, {
    edgeUrl: config.edgeUrl,
    tenantId: config.tenantId,
    deviceId: config.deviceId,
    enabled: config.enabled,
  });

  const append = useCallback(
    (data: CreateVitalRequest) => {
      const entry: CrdtVitalEntry = {
        ts: Date.now(),
        recordedBy: config.deviceId,
        ...data,
      };
      list.append(entry);
    },
    [list, config.deviceId],
  );

  const records: Vital[] = list.entries.map((e) => ({
    id: `${encounterId}/${e.ts}`,
    tenant_id: config.tenantId,
    encounter_id: encounterId,
    temperature: e.temperature !== undefined ? String(e.temperature) : null,
    pulse: e.pulse ?? null,
    systolic_bp: e.systolic_bp ?? null,
    diastolic_bp: e.diastolic_bp ?? null,
    respiratory_rate: e.respiratory_rate ?? null,
    spo2: e.spo2 ?? null,
    weight_kg: e.weight_kg !== undefined ? String(e.weight_kg) : null,
    height_cm: e.height_cm !== undefined ? String(e.height_cm) : null,
    bmi: null,
    notes: e.notes ?? null,
    recorded_by: e.recordedBy,
    recorded_at: new Date(e.ts).toISOString(),
    created_at: new Date(e.ts).toISOString(),
  }));

  return {
    records,
    append,
    status: list.status,
    ready: list.ready,
    unsyncedOps: list.unsyncedOps,
  };
}
