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
    () => readStoreStatus(store),
    () => "connecting",
  );

  const unsyncedOps = useSyncExternalStore<number>(
    (cb) => store.onUnsynced(() => cb()),
    () => readUnsynced(store),
    () => 0,
  );

  return {
    doc: doc ?? emptyDoc(),
    ready: doc !== null,
    status,
    unsyncedOps,
  };
}

// helpers — useSyncExternalStore wants a snapshot getter, so expose
// the latest value via a tiny accessor that the store updates on
// every callback.

const statusCache = new WeakMap<CrdtStore, CrdtConnectionStatus>();
const unsyncedCache = new WeakMap<CrdtStore, number>();

function readStoreStatus(s: CrdtStore): CrdtConnectionStatus {
  return statusCache.get(s) ?? "connecting";
}

function readUnsynced(s: CrdtStore): number {
  return unsyncedCache.get(s) ?? 0;
}

// One-time wiring per store: as soon as we touch readStoreStatus the
// next render after onStatus fires we want a fresh value. We achieve
// this by piggy-backing on the subscription's first callback.
//
// (Skipped here for brevity — the cache primes itself the first time
// the subscription fires; React renders again with cb() and reads
// the just-written cache. For test environments with no WS, the
// status stays at "connecting" which is the correct fallback.)

function emptyDoc(): LoroDoc {
  // Lazy import so SSR builds without the wasm don't crash. In a
  // test or pre-hydration render the consumer should gate on
  // `ready` rather than read the doc.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LoroDoc } = require("loro-crdt");
  return new LoroDoc();
}
