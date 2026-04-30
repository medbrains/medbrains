/**
 * Lazy-loads the real `@medbrains/edge-rn-bindings` Turbo Module
 * package emitted by the uniffi-rn-plugin at host prebuild. Tests
 * inject a fake via `setEdgeRnBindings(...)`.
 */

import type { EdgeRnBindings } from "./edge-rn-contract.js";

let cached: EdgeRnBindings | null = null;
let override: EdgeRnBindings | null = null;

export function setEdgeRnBindings(bindings: EdgeRnBindings | null): void {
  override = bindings;
  cached = null;
}

export async function loadEdgeRnBindings(): Promise<EdgeRnBindings> {
  if (override) {
    return override;
  }
  if (cached) {
    return cached;
  }
  const mod = await import("@medbrains/edge-rn-bindings");
  cached = mod as unknown as EdgeRnBindings;
  return cached;
}
