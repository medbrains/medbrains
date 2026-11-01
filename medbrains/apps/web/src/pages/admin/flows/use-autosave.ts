/**
 * Draft autosave: each edit restarts a short timer; when it fires the
 * latest track is saved against the last revision the server returned, one
 * save at a time, so two saves never race into a stale-revision refusal.
 */
import type { FlowBuilder, FlowStation } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useUnmount } from "react-use";
import { sopFlowsService } from "@/services/sopFlows.service";

const QUIET_MS = 800;

export type SaveState = "saved" | "unsaved" | "saving" | "error";

export function builderKey(code: string) {
  return ["flows", code, "build"] as const;
}

export function useAutosave(code: string, initialRevision: number) {
  const queryClient = useQueryClient();
  const revision = useRef(initialRevision);
  const latest = useRef<FlowStation[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A ref, not the mutation's state: the timer's closure outlives a render.
  const inFlight = useRef(false);
  const [state, setState] = useState<SaveState>("saved");
  const save = useMutation({
    mutationFn: (stations: FlowStation[]) =>
      sopFlowsService.saveDraft(code, { revision: revision.current, stations }),
    onSuccess: (view: FlowBuilder, sent) => {
      revision.current = view.draft?.revision ?? 0;
      queryClient.setQueryData(builderKey(code), view);
      setState(latest.current === sent ? "saved" : "unsaved");
    },
    onError: () => setState("error"),
    onSettled: () => {
      inFlight.current = false;
    },
  });

  const flush = () => {
    timer.current = null;
    const stations = latest.current;
    if (!stations) return;
    if (inFlight.current) {
      timer.current = setTimeout(flush, QUIET_MS);
      return;
    }
    inFlight.current = true;
    setState("saving");
    save.mutate(stations);
  };

  const schedule = (stations: FlowStation[]) => {
    latest.current = stations;
    setState("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, QUIET_MS);
  };

  /** After a discard the next save starts a new draft. */
  const reset = (rev: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    latest.current = null;
    revision.current = rev;
    setState("saved");
  };

  useUnmount(() => {
    if (timer.current) clearTimeout(timer.current);
  });

  return {
    state,
    error: save.error?.message ?? null,
    schedule,
    retry: flush,
    reset,
  };
}
