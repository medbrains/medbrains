/**
 * useNursingNotesSource — nursing shift narrative (T3 text).
 * Same shape as useNotesSource but keyed by shift_id instead of
 * patient_id.
 */

import { type CrdtConnectionStatus, useCrdtText } from "@medbrains/crdt";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTenantConfig } from "@/providers/TenantConfigProvider";
import { clinicalSourcesService } from "@/services/clinicalSources.service";

export interface NursingNotesResult {
  text: string;
  setText: (next: string) => void;
  lastAuthor: string | null;
  lastEditedAt: number | null;
  status: CrdtConnectionStatus | "loading" | "online" | "error";
  ready: boolean;
  unsyncedOps: number;
}

export function useNursingNotesSource(shiftId: string): NursingNotesResult {
  const config = useTenantConfig();
  const useCrdt = config.mode === "crdt";
  const rest = useNursingNotesRest(shiftId, !useCrdt);
  const crdt = useNursingNotesCrdt(shiftId, { ...config, enabled: useCrdt });
  return useCrdt ? crdt : rest;
}

function useNursingNotesRest(shiftId: string, enabled: boolean): NursingNotesResult {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["nursing-notes", shiftId],
    queryFn: () => clinicalSourcesService.getNursingNotes(shiftId),
    enabled: enabled && !!shiftId,
  });
  const mutation = useMutation({
    mutationFn: async (text: string) => {
      return clinicalSourcesService.updateNursingNotes(shiftId, text);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nursing-notes", shiftId] }),
  });
  const setText = useCallback((next: string) => mutation.mutate(next), [mutation]);
  return {
    text: query.data?.text ?? "",
    setText,
    lastAuthor: query.data?.last_author ?? null,
    lastEditedAt: query.data?.last_edited_at ? Date.parse(query.data.last_edited_at) : null,
    status: query.isLoading ? "loading" : query.isError ? "error" : "online",
    ready: !query.isLoading,
    unsyncedOps: mutation.isPending ? 1 : 0,
  };
}

function useNursingNotesCrdt(
  shiftId: string,
  config: {
    edgeUrl: string;
    tenantId: string;
    deviceId: string;
    authorName: string;
    enabled: boolean;
  },
): NursingNotesResult {
  const t = useCrdtText(`nursing-notes/${shiftId}`, {
    edgeUrl: config.edgeUrl,
    tenantId: config.tenantId,
    deviceId: config.deviceId,
    authorName: config.authorName,
    enabled: config.enabled,
  });
  return {
    text: t.text,
    setText: t.setText,
    lastAuthor: t.lastAuthor,
    lastEditedAt: t.lastEditedAt,
    status: t.status,
    ready: t.ready,
    unsyncedOps: t.unsyncedOps,
  };
}
