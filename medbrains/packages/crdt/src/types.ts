import type { LoroDoc } from "loro-crdt";

export type CrdtConnectionStatus =
  | "connecting"
  | "online"
  | "offline"
  | "syncing"
  | "error";

export interface CrdtStoreOptions {
  /** WebSocket URL of the medbrains-edge sync hub on the hospital LAN. */
  edgeUrl: string;
  tenantId: string;
  deviceId: string;
  /** IndexedDB DB name. Defaults to `medbrains-crdt`. */
  dbName?: string;
}

export interface UseCrdtDocOptions extends CrdtStoreOptions {
  /**
   * Throttle persistence writes. If a page is mutating the doc many
   * times per second (e.g. typing), batching cuts IndexedDB churn.
   * Default 250ms.
   */
  persistDebounceMs?: number;
}

export interface UseCrdtDocResult {
  doc: LoroDoc;
  ready: boolean;
  status: CrdtConnectionStatus;
  /** Number of unsynced ops queued while offline. */
  unsyncedOps: number;
}
