/**
 * useAppendOnlyCrdtList — for T2 tier doc shapes (vitals, handoff,
 * triage, telemetry, audit log). Wraps useCrdtDoc + LoroList for the
 * common case of an append-only timestamped event stream.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CrdtConnectionStatus, UseCrdtDocOptions } from "./types";
import { useCrdtDoc } from "./use-crdt-doc";

export interface AppendOnlyCrdtListResult<T> {
  entries: T[];
  append: (entry: T) => void;
  ready: boolean;
  status: CrdtConnectionStatus;
  unsyncedOps: number;
}

export function useAppendOnlyCrdtList<T extends Record<string, unknown>>(
  docId: string,
  opts: UseCrdtDocOptions & {
    /** Container key under which the list lives. Default `"entries"`. */
    listKey?: string;
    /** If entries have a numeric `ts` field, sort by it desc. Default true. */
    sortByTsDesc?: boolean;
  },
): AppendOnlyCrdtListResult<T> {
  const listKey = opts.listKey ?? "entries";
  const sortByTsDesc = opts.sortByTsDesc ?? true;
  const { doc, ready, status, unsyncedOps } = useCrdtDoc(docId, opts);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!ready) return;
    const unsubscribe = doc.subscribe(() => {
      setRevision((current) => current + 1);
    });
    return () => {
      unsubscribe();
    };
  }, [doc, ready]);

  const entries = useMemo<T[]>(() => {
    if (!ready) return [];
    const list = doc.getList(listKey);
    const out: T[] = [];
    for (let i = 0; i < list.length; i++) {
      const v = list.get(i);
      if (v && typeof v === "object") out.push(v as T);
    }
    if (sortByTsDesc) {
      out.sort((a, b) => {
        const ta = typeof a.ts === "number" ? (a.ts as number) : 0;
        const tb = typeof b.ts === "number" ? (b.ts as number) : 0;
        return tb - ta;
      });
    }
    return out;
  }, [doc, ready, listKey, sortByTsDesc, revision]);

  const append = useCallback(
    (entry: T) => {
      if (!ready) return;
      const list = doc.getList(listKey);
      // Loro's `insert` excludes nested Container values from its
      // accepted union, but our T is plain Record<string, unknown>
      // (no Loro containers), which is structurally fine — cast to
      // satisfy the stricter signature.
      list.insert(list.length, entry as never);
      doc.commit({ origin: "local" });
    },
    [doc, ready, listKey],
  );

  return { entries, append, ready, status, unsyncedOps };
}
