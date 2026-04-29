/**
 * useNursingNotesSource — nursing shift narrative (T3 text).
 * Same shape as useNotesSource but keyed by shift_id instead of
 * patient_id.
 */

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import {
  useCrdtText,
  type CrdtConnectionStatus,
} from "@medbrains/crdt";
import { useTenantConfig } from "../providers/TenantConfigProvider";

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
  if (config.mode === "crdt") return useNursingNotesCrdt(shiftId, config);
  return useNursingNotesRest(shiftId);
}

// REST stub — same defensive pattern as useNotesSource.
type NursingApi = {
  getNursingNotes?: (shiftId: string) => Promise<{
    text: string;
    last_author?: string;
    last_edited_at?: string;
  }>;
  updateNursingNotes?: (shiftId: string, text: string) => Promise<unknown>;
};
const nursingApi = api as unknown as NursingApi;

function useNursingNotesRest(shiftId: string): NursingNotesResult {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["nursing-notes", shiftId],
    queryFn: async () => {
      if (typeof nursingApi.getNursingNotes !== "function") {
        return { text: "", last_author: undefined, last_edited_at: undefined };
      }
      return nursingApi.getNursingNotes(shiftId);
    },
    enabled: !!shiftId,
  });
  const mutation = useMutation({
    mutationFn: async (text: string) => {
      if (typeof nursingApi.updateNursingNotes !== "function") {
        throw new Error("nursing-notes REST endpoint not implemented yet");
      }
      return nursingApi.updateNursingNotes(shiftId, text);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nursing-notes", shiftId] }),
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

function useNursingNotesCrdt(
  shiftId: string,
  config: { edgeUrl: string; tenantId: string; deviceId: string; authorName: string },
): NursingNotesResult {
  const t = useCrdtText(`nursing-notes/${shiftId}`, {
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
