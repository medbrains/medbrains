/**
 * React hook to consume a Loro CRDT doc. The store is module-singleton
 * per (edgeUrl, tenantId, deviceId) tuple — multiple components on
 * the same page reuse the same WebSocket and IndexedDB connection.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import type { LoroDoc } from "loro-crdt";
import { CrdtStore } from "./store";
import type {
  CrdtConnectionStatus,
  UseCrdtDocOptions,
  UseCrdtDocResult,
} from "./types";

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

export function useCrdtDoc(
  docId: string,
  opts: UseCrdtDocOptions,
): UseCrdtDocResult {
  const store = storeFor(opts);
  const [doc, setDoc] = useState<LoroDoc | null>(null);

  useEffect(() => {
    let cancelled = false;
    void store.loadDoc(docId).then((d) => {
      if (!cancelled) setDoc(d);
    });
    return () => {
      cancelled = true;
    };
  }, [store, docId]);

  const status = useSyncExternalStore<CrdtConnectionStatus>(
    (cb) => store.onStatus(() => cb()),
    () => store.getStatus(),
    () => "connecting",
  );

  const unsyncedOps = useSyncExternalStore<number>(
    (cb) => store.onUnsynced(() => cb()),
    () => store.getUnsyncedOps(),
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
  // Lazy import so SSR builds without the wasm don't crash. In a
  // test or pre-hydration render the consumer should gate on
  // `ready` rather than read the doc.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LoroDoc } = require("loro-crdt");
  return new LoroDoc();
}
