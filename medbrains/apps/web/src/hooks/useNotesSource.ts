/**
 * useNotesSource — patient clinical notes (T3 free-form text with
 * concurrent-edit merging).
 *
 * REST path uses the existing patient-notes endpoint. CRDT path
 * uses Loro's text CRDT — concurrent edits from two devices merge
 * deterministically; every keystroke is captured in the edge
 * Merkle audit chain.
 */

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import {
  useCrdtText,
  type CrdtConnectionStatus,
} from "@medbrains/crdt";
import { useTenantConfig } from "../providers/TenantConfigProvider";

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
  if (config.mode === "crdt") return useNotesCrdt(patientId, config);
  return useNotesRest(patientId, config.authorName);
}

// REST adapter (existing api.* may not have a 1:1 method —
// stubbed if missing so the unified surface still type-checks).

type NotesApi = {
  getPatientNotes?: (patientId: string) => Promise<{
    text: string;
    last_author?: string;
    last_edited_at?: string;
  }>;
  updatePatientNotes?: (patientId: string, text: string) => Promise<unknown>;
};
const notesApi = api as unknown as NotesApi;

function useNotesRest(patientId: string, _authorName: string): NotesSourceResult {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["patient-notes", patientId],
    queryFn: async () => {
      if (typeof notesApi.getPatientNotes !== "function") {
        return { text: "", last_author: undefined, last_edited_at: undefined };
      }
      return notesApi.getPatientNotes(patientId);
    },
    enabled: !!patientId,
  });
  const mutation = useMutation({
    mutationFn: async (text: string) => {
      if (typeof notesApi.updatePatientNotes !== "function") {
        throw new Error("patient-notes REST endpoint not implemented yet");
      }
      return notesApi.updatePatientNotes(patientId, text);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patient-notes", patientId] }),
  });
  const setText = useCallback(
    (next: string) => mutation.mutate(next),
    [mutation],
  );
  return {
    text: query.data?.text ?? "",
    setText,
    lastAuthor: query.data?.last_author ?? null,
    lastEditedAt: query.data?.last_edited_at
      ? Date.parse(query.data.last_edited_at)
      : null,
    status: query.isLoading ? "loading" : query.isError ? "error" : "online",
    ready: !query.isLoading,
    unsyncedOps: mutation.isPending ? 1 : 0,
  };
}

function useNotesCrdt(
  patientId: string,
  config: { edgeUrl: string; tenantId: string; deviceId: string; authorName: string },
): NotesSourceResult {
  const t = useCrdtText(`notes/${patientId}`, {
    edgeUrl: config.edgeUrl,
    tenantId: config.tenantId,
    deviceId: config.deviceId,
    authorName: config.authorName,
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
