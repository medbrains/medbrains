/**
 * useCrdtText — for T3 tier doc shapes (free-form text with
 * deterministic concurrent-edit merging via Loro's text CRDT).
 *
 * Returns the current `text` plus `setText` that does a naive
 * replace-all on the underlying LoroText. Tracks last_author +
 * last_edited_at metadata in a sibling Loro map for the eventual
 * commit-gate UI.
 */

import { useCallback, useEffect, useState } from "react";
import { useCrdtDoc } from "./use-crdt-doc";
import type { CrdtConnectionStatus, UseCrdtDocOptions } from "./types";

export interface CrdtTextResult {
  text: string;
  setText: (next: string) => void;
  ready: boolean;
  status: CrdtConnectionStatus;
  unsyncedOps: number;
  lastAuthor: string | null;
  lastEditedAt: number | null;
}

export function useCrdtText(
  docId: string,
  opts: UseCrdtDocOptions & {
    authorName: string;
    /** Loro container key for the editable text. Default `"body"`. */
    textKey?: string;
    /** Loro container key for author metadata. Default `"meta"`. */
    metaKey?: string;
  },
): CrdtTextResult {
  const textKey = opts.textKey ?? "body";
  const metaKey = opts.metaKey ?? "meta";
  const { doc, ready, status, unsyncedOps } = useCrdtDoc(docId, opts);
  const [text, setLocalText] = useState<string>("");

  useEffect(() => {
    if (!ready) return;
    const lt = doc.getText(textKey);
    setLocalText(lt.toString());
    const unsubscribe = doc.subscribe(() => {
      setLocalText(lt.toString());
    });
    return () => {
      unsubscribe();
    };
  }, [doc, ready, textKey]);

  const setText = useCallback(
    (next: string) => {
      if (!ready) return;
      doc.getText(textKey).update(next);
      doc.getMap(metaKey).set("last_author", opts.authorName);
      doc.getMap(metaKey).set("last_edited_at", Date.now());
    },
    [doc, ready, textKey, metaKey, opts.authorName],
  );

  const meta = ready ? doc.getMap(metaKey) : null;
  const lastAuthor = meta?.get("last_author");
  const lastEditedAt = meta?.get("last_edited_at");

  return {
    text,
    setText,
    ready,
    status,
    unsyncedOps,
    lastAuthor: typeof lastAuthor === "string" ? lastAuthor : null,
    lastEditedAt: typeof lastEditedAt === "number" ? lastEditedAt : null,
  };
}
