/**
 * Placeholder bindings — the real implementation is emitted at
 * host-app prebuild by `@medbrains/uniffi-rn-plugin` running
 * `uniffi-bindgen-react-native` against
 * `crates/medbrains-edge-rn/src/edge_rn.udl`. The plugin overwrites
 * this package's `lib/` directory; in dev (before any prebuild has
 * run) the placeholder throws at first use so consumers learn they
 * need to run `expo prebuild` against an app that wires the plugin.
 *
 * Type shapes mirror `crates/medbrains-edge-rn/src/edge_rn.udl`.
 * Keep them in lockstep.
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

const NOT_PREBUILT = (): never => {
  throw new Error(
    "@medbrains/edge-rn-bindings has not been prebuilt. Run `expo prebuild` " +
      "in an app that wires `@medbrains/uniffi-rn-plugin`.",
  );
};

export const verifyJwt: (
  token: string,
  publicKeyBytes: Uint8Array,
  nowUnix: number,
  clockSkewSecs: number,
) => JwtOutcome = NOT_PREBUILT;

export const isActionOfflineRequired: (
  objectType: string,
  action: string,
) => boolean = NOT_PREBUILT;

export const AuthzCacheHandle: new (
  path: string,
  capacity: number,
  defaultTtlSecs: number,
) => AuthzCacheHandle = class {
  constructor(_path: string, _capacity: number, _defaultTtlSecs: number) {
    NOT_PREBUILT();
  }
} as unknown as new (
  path: string,
  capacity: number,
  defaultTtlSecs: number,
) => AuthzCacheHandle;

export const RevocationCacheHandle: new (
  path: string,
  capacity: number,
) => RevocationCacheHandle = class {
  constructor(_path: string, _capacity: number) {
    NOT_PREBUILT();
  }
} as unknown as new (path: string, capacity: number) => RevocationCacheHandle;
