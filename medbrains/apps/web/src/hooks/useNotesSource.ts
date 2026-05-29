/**
 * useNotesSource — patient clinical notes (T3 free-form text with
 * concurrent-edit merging).
 *
 * REST path uses the existing patient-notes endpoint. CRDT path
 * uses Loro's text CRDT — concurrent edits from two devices merge
 * deterministically; every keystroke is captured in the edge
 * Merkle audit chain.
 */

import { type CrdtConnectionStatus, useCrdtText } from "@medbrains/crdt";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTenantConfig } from "@/providers/TenantConfigProvider";
import { clinicalSourcesService } from "@/services/clinicalSources.service";

export interface NotesSourceResult {
  text: string;
  setText: (next: string) => void;
  /** Latest author name; null until at least one edit has been made. */
  lastAuthor: string | null;
  /** Epoch ms of last edit; null until at least one edit. */
  lastEditedAt: number | null;
  status: CrdtConnectionStatus | "loading" | "online" | "error";
  ready: boolean;
  unsyncedOps: number;
}

export function useNotesSource(patientId: string): NotesSourceResult {
  const config = useTenantConfig();
  const useCrdt = config.mode === "crdt";
  const rest = useNotesRest(patientId, config.authorName, !useCrdt);
  const crdt = useNotesCrdt(patientId, { ...config, enabled: useCrdt });
  return useCrdt ? crdt : rest;
}

function useNotesRest(patientId: string, _authorName: string, enabled: boolean): NotesSourceResult {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["patient-notes", patientId],
    queryFn: () => clinicalSourcesService.getPatientNotes(patientId),
    enabled: enabled && !!patientId,
  });
  const mutation = useMutation({
    mutationFn: async (text: string) => {
      return clinicalSourcesService.updatePatientNotes(patientId, text);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patient-notes", patientId] }),
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

function useNotesCrdt(
  patientId: string,
  config: {
    edgeUrl: string;
    tenantId: string;
    deviceId: string;
    authorName: string;
    enabled: boolean;
  },
): NotesSourceResult {
  const t = useCrdtText(`notes/${patientId}`, {
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
