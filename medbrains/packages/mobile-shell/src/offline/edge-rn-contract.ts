/**
 * TypeScript contract for the `@medbrains/edge-rn-bindings` package
 * that the `@medbrains/uniffi-rn-plugin` Expo config plugin emits at
 * host-app prebuild time.
 *
 * The plugin runs `uniffi-bindgen-react-native` which writes a real
 * implementation; this file declares the *shape* we depend on so
 * `mobile-shell` typechecks standalone. Keep it in lockstep with
 * `crates/medbrains-edge-rn/src/edge_rn.udl`.
 */

export interface JwtClaims {
  sub: string;
  tenantId: string;
  iat: number;
  exp: number;
  departmentIds: ReadonlyArray<string>;
  permissions: ReadonlyArray<string>;
  role: string | null;
}

export type JwtOutcome =
  | { tag: "Valid"; claims: JwtClaims }
  | { tag: "Expired" }
  | { tag: "NotYetValid" }
  | { tag: "InvalidSignature" }
  | { tag: "Malformed"; reason: string };

export interface CacheKey {
  tenantId: string;
  userId: string;
  objectType: string;
  objectId: string;
  action: string;
}

export type CacheSourceKind =
  | "CloudFresh"
  | "CloudCached"
  | "JwtFallback"
  | "OnlineRequiredDeny";

export type DenyReasonKind =
  | "CacheMissStrict"
  | "JwtLacksPermission"
  | "OnlineRequired"
  | "Expired";

export type CheckOutcome =
  | { tag: "Allow"; source: CacheSourceKind }
  | { tag: "Deny"; reason: DenyReasonKind };

export type OfflinePolicyKind = "CacheOnly" | "CacheThenJwt" | "OnlineRequired";

export interface AuthzCacheHandle {
  checkOffline(
    key: CacheKey,
    jwtPermissions: ReadonlyArray<string>,
    policy: OfflinePolicyKind,
  ): CheckOutcome;
  record(key: CacheKey, allowed: boolean, source: CacheSourceKind): void;
  invalidate(keys: ReadonlyArray<CacheKey>): void;
}

export interface RevocationCacheHandle {
  recordRevocation(userId: string, revokedAtUnix: number): void;
  isRevoked(userId: string, jwtIatUnix: number): boolean;
  pullWindowMax(): number;
  forget(userId: string): void;
  len(): number;
}

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
