/**
 * React hook to consume a Loro CRDT doc. The store is module-singleton
 * per (edgeUrl, tenantId, deviceId) tuple — multiple components on
 * the same page reuse the same WebSocket and IndexedDB connection.
 */

import { LoroDoc } from "loro-crdt";
import { useEffect, useState, useSyncExternalStore } from "react";
import { CrdtStore } from "./store";
import type { CrdtConnectionStatus, UseCrdtDocOptions, UseCrdtDocResult } from "./types";

const stores = new Map<string, CrdtStore>();

function storeFor(opts: UseCrdtDocOptions): CrdtStore {
  const key = `${opts.edgeUrl}|${opts.tenantId}|${opts.deviceId}`;
  let s = stores.get(key);
  if (!s) {
    s = new CrdtStore(opts);
    stores.set(key, s);
  }
  return s;
}

export function useCrdtDoc(docId: string, opts: UseCrdtDocOptions): UseCrdtDocResult {
  const enabled = opts.enabled ?? true;
  const store = enabled ? storeFor(opts) : null;
  const [doc, setDoc] = useState<LoroDoc | null>(null);

  useEffect(() => {
    if (!store) {
      setDoc(null);
      return;
    }
    let cancelled = false;
    void store.loadDoc(docId).then((d) => {
      if (!cancelled) setDoc(d);
    });
    return () => {
      cancelled = true;
    };
  }, [store, docId]);

  const status = useSyncExternalStore<CrdtConnectionStatus>(
    (cb) => (store ? store.onStatus(() => cb()) : () => undefined),
    () => store?.getStatus() ?? "offline",
    () => "offline",
  );

  const unsyncedOps = useSyncExternalStore<number>(
    (cb) => (store ? store.onUnsynced(() => cb()) : () => undefined),
    () => store?.getUnsyncedOps() ?? 0,
    () => 0,
  );

  return {
    doc: doc ?? emptyDoc(),
    ready: doc !== null,
    status,
    unsyncedOps,
  };
}

function emptyDoc(): LoroDoc {
  return new LoroDoc();
}
