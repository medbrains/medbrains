/**
 * CrdtStore — IndexedDB persistence + WebSocket sync to medbrains-edge.
 *
 * Per-doc lifecycle:
 *   1. constructor returns immediately
 *   2. `init(docId)` loads the snapshot from IndexedDB if present
 *   3. background WS connection opens; sends Hello + PullSince
 *   4. local mutations call `markDirty(docId)` which schedules a
 *      debounced write to IndexedDB AND a Push frame to the edge
 *   5. WS reconnects exponentially when the edge is unreachable
 */

import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import { LoroDoc, VersionVector } from "loro-crdt";
import type { CrdtConnectionStatus, CrdtStoreOptions } from "./types";

interface MedbrainsCrdtSchema extends DBSchema {
  snapshots: {
    key: string; // tenantId + "/" + docId
    value: {
      key: string;
      bytes: Uint8Array;
      updatedAt: number;
    };
  };
  outbox: {
    key: number;
    value: {
      docId: string;
      updateBytes: Uint8Array;
      enqueuedAt: number;
    };
    indexes: { docId: string };
  };
}

interface ServerFrame {
  kind: string;
  doc_id?: string;
  update_b64?: string;
  vv_b64?: string;
  chain_tip?: string;
  message?: string;
  protocol?: number;
}

const PROTOCOL_VERSION = 1;
const MAX_BACKOFF_MS = 30_000;

export class CrdtStore {
  private db: IDBPDatabase<MedbrainsCrdtSchema> | null = null;
  private docs = new Map<string, LoroDoc>();
  private ws: WebSocket | null = null;
  private wsBackoff = 1000;
  private statusListeners = new Set<(s: CrdtConnectionStatus) => void>();
  private status: CrdtConnectionStatus = "connecting";
  private unsyncedOps = 0;
  private unsyncedListeners = new Set<(n: number) => void>();
  private opts: CrdtStoreOptions;

  constructor(opts: CrdtStoreOptions) {
    this.opts = opts;
    void this.openDb().then(() => this.connectWs());
  }

  private async openDb() {
    this.db = await openDB<MedbrainsCrdtSchema>(this.opts.dbName ?? "medbrains-crdt", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("snapshots")) {
          db.createObjectStore("snapshots", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("outbox")) {
          const ob = db.createObjectStore("outbox", { keyPath: undefined, autoIncrement: true });
          ob.createIndex("docId", "docId");
        }
      },
    });
  }

  /**
   * Load (or create) a doc by id. The doc reference is stable —
   * subsequent calls return the same LoroDoc instance.
   */
  async loadDoc(docId: string): Promise<LoroDoc> {
    if (this.docs.has(docId)) return this.docs.get(docId)!;
    if (!this.db) await this.openDb();
    const key = `${this.opts.tenantId}/${docId}`;
    const row = await this.db!.get("snapshots", key);
    const doc = new LoroDoc();
    if (row?.bytes) doc.import(row.bytes);
    this.docs.set(docId, doc);
    // Subscribe so every local mutation triggers persist + push
    doc.subscribe((event) => {
      // event.by === "local" — only locally-originated changes need
      // pushing; remote ones came from the edge and don't need echo.
      if (event.by === "local") {
        void this.handleLocalChange(docId, doc);
      }
    });
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendPullSince(docId, doc);
    }
    return doc;
  }

  private async handleLocalChange(docId: string, doc: LoroDoc) {
    // Persist a fresh snapshot (debounce via IndexedDB transaction
    // queueing — micro-debouncing in browsers is generally OK)
    const snap = doc.export({ mode: "snapshot" });
    const key = `${this.opts.tenantId}/${docId}`;
    if (this.db) {
      await this.db.put("snapshots", { key, bytes: snap, updatedAt: Date.now() });
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendPush(docId, snap);
    } else {
      // Offline — queue in outbox
      if (this.db) {
        await this.db.add("outbox", {
          docId,
          updateBytes: snap,
          enqueuedAt: Date.now(),
        });
        this.unsyncedOps++;
        this.notifyUnsynced();
      }
    }
  }

  private connectWs() {
    if (typeof WebSocket === "undefined") {
      // SSR or test environment — don't try to connect
      return;
    }
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.opts.edgeUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    this.setStatus("connecting");

    ws.addEventListener("open", () => {
      this.wsBackoff = 1000;
      this.setStatus("online");
      ws.send(
        JSON.stringify({
          kind: "hello",
          protocol: PROTOCOL_VERSION,
          device_id: this.opts.deviceId,
          tenant_id: this.opts.tenantId,
        }),
      );
      // Drain outbox first
      void this.drainOutbox();
      // Re-pull every loaded doc
      for (const [docId, doc] of this.docs) {
        this.sendPullSince(docId, doc);
      }
    });

    ws.addEventListener("message", (ev) => {
      try {
        const frame: ServerFrame = JSON.parse(ev.data as string);
        this.handleFrame(frame);
      } catch {
        // ignore malformed; server-side already alerts on error
        // frames it sends back. Bad JSON from a healthy server
        // shouldn't happen.
      }
    });

    ws.addEventListener("close", () => {
      this.setStatus("offline");
      this.scheduleReconnect();
    });

    ws.addEventListener("error", () => {
      this.setStatus("error");
    });
  }

  private scheduleReconnect() {
    setTimeout(() => this.connectWs(), this.wsBackoff);
    this.wsBackoff = Math.min(this.wsBackoff * 2, MAX_BACKOFF_MS);
  }

  private handleFrame(frame: ServerFrame) {
    if (frame.kind === "pull_response" && frame.doc_id && frame.update_b64) {
      const doc = this.docs.get(frame.doc_id);
      if (doc) {
        doc.import(b64decode(frame.update_b64));
      }
    } else if (frame.kind === "ack" && frame.doc_id) {
      // Edge accepted; nothing to do client-side beyond unsynced
      // counter decrement (we already optimistically marked it sent
      // when we wrote to outbox).
    } else if (frame.kind === "error") {
      // Surface to console; UI can subscribe via status() if needed.
      // eslint-disable-next-line no-console
      console.warn("[crdt] edge error:", frame.message);
    }
  }

  private sendPush(docId: string, updateBytes: Uint8Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        kind: "push",
        doc_id: docId,
        update_b64: b64encode(updateBytes),
      }),
    );
  }

  private sendPullSince(docId: string, doc: LoroDoc) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const vv: VersionVector = doc.frontiersToVV(doc.frontiers());
    const vvBytes = vv.encode();
    this.ws.send(
      JSON.stringify({
        kind: "pull_since",
        doc_id: docId,
        vv_b64: b64encode(vvBytes),
      }),
    );
  }

  private async drainOutbox() {
    if (!this.db) return;
    const tx = this.db.transaction("outbox", "readwrite");
    const store = tx.store;
    let cursor = await store.openCursor();
    while (cursor) {
      this.sendPush(cursor.value.docId, cursor.value.updateBytes);
      await cursor.delete();
      this.unsyncedOps = Math.max(0, this.unsyncedOps - 1);
      cursor = await cursor.continue();
    }
    await tx.done;
    this.notifyUnsynced();
  }

  // ── status subscription ─────────────────────────────────────────

  onStatus(cb: (s: CrdtConnectionStatus) => void): () => void {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  onUnsynced(cb: (n: number) => void): () => void {
    this.unsyncedListeners.add(cb);
    cb(this.unsyncedOps);
    return () => this.unsyncedListeners.delete(cb);
  }

  private setStatus(s: CrdtConnectionStatus) {
    this.status = s;
    for (const l of this.statusListeners) l(s);
  }

  private notifyUnsynced() {
    for (const l of this.unsyncedListeners) l(this.unsyncedOps);
  }
}

// ── tiny base64 helpers (no dep) ───────────────────────────────────

function b64encode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] ?? 0;
    bin += String.fromCharCode(b);
  }
  return btoa(bin);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
