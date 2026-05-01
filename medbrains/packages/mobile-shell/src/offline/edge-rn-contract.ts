/**
 * Re-exports from `@medbrains/edge-rn-bindings`. The bindings
 * package is a placeholder workspace package whose `lib/` is
 * overwritten at host-app prebuild by `@medbrains/uniffi-rn-plugin`
 * (running `uniffi-bindgen-react-native`). Consumers depend on the
 * package, not this file — this re-export exists so internal
 * mobile-shell modules import from one place.
 *
 * Source of truth for the wire format:
 *   crates/medbrains-edge-rn/src/edge_rn.udl
 */

export type {
  AuthzCacheHandle,
  CacheKey,
  CacheSourceKind,
  CheckOutcome,
  DenyReasonKind,
  JwtClaims,
  JwtOutcome,
  OfflinePolicyKind,
  RevocationCacheHandle,
} from "@medbrains/edge-rn-bindings";

import type {
  AuthzCacheHandle,
  CacheKey,
  CacheSourceKind,
  CheckOutcome,
  JwtOutcome,
  OfflinePolicyKind,
  RevocationCacheHandle,
} from "@medbrains/edge-rn-bindings";

export interface EdgeRnBindings {
  verifyJwt(
    token: string,
    publicKeyBytes: Uint8Array,
    nowUnix: number,
    clockSkewSecs: number,
  ): JwtOutcome;

  isActionOfflineRequired(objectType: string, action: string): boolean;

  AuthzCacheHandle: new (
    path: string,
    capacity: number,
    defaultTtlSecs: number,
  ) => AuthzCacheHandle;

  RevocationCacheHandle: new (
    path: string,
    capacity: number,
  ) => RevocationCacheHandle;
}

// Helper imports re-exported as values for downstream code that
// wants to construct cache keys etc. without a transitive dep on
// the bindings package directly.
export type {
  CacheKey as ExportedCacheKey,
  CheckOutcome as ExportedCheckOutcome,
  CacheSourceKind as ExportedCacheSourceKind,
  OfflinePolicyKind as ExportedOfflinePolicyKind,
};
