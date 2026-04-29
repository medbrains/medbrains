/**
 * @medbrains/crdt — Web-side offline-first store backed by Loro CRDT.
 *
 * Sprint D foundation. Mirrors the wire protocol from the Rust
 * `medbrains-edge` crate so a browser tab can join the same LAN sync
 * mesh as native desktop apps. IndexedDB persists the doc locally so
 * a page reload doesn't lose offline writes.
 *
 * Usage (the `useCrdtDoc` React hook):
 *
 * ```tsx
 * import { useCrdtDoc } from "@medbrains/crdt";
 *
 * function VitalsCard({ encounterId }: { encounterId: string }) {
 *   const { doc, ready, status } = useCrdtDoc(`vitals/${encounterId}`, {
 *     edgeUrl: "ws://medbrains-edge.local:7811",
 *     tenantId: "...",
 *     deviceId: "...",
 *   });
 *   if (!ready) return <Spinner />;
 *   return (
 *     <button onClick={() => doc.getMap("root").set("hr", 80)}>
 *       Record HR
 *     </button>
 *   );
 * }
 * ```
 *
 * Status reflects sync health — `online` (connected to edge),
 * `offline` (queueing locally), `syncing`, `error`.
 */

export { CrdtStore } from "./store";
export { useCrdtDoc } from "./use-crdt-doc";
export type {
  CrdtConnectionStatus,
  CrdtStoreOptions,
  UseCrdtDocOptions,
  UseCrdtDocResult,
} from "./types";
