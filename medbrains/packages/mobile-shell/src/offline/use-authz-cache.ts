import { useCallback } from "react";
import { useOfflineHandles } from "./offline-provider.js";
import type {
  CacheKey,
  CacheSourceKind,
  CheckOutcome,
  OfflinePolicyKind,
} from "./edge-rn-contract.js";

/**
 * Hook returning a stable AuthzCache surface. Components call
 * `check()` before queuing a clinical write and `record()` whenever
 * a fresh cloud answer arrives.
 */
export function useAuthzCache(): {
  check: (
    key: CacheKey,
    jwtPermissions: ReadonlyArray<string>,
    policy: OfflinePolicyKind,
  ) => CheckOutcome;
  record: (key: CacheKey, allowed: boolean, source: CacheSourceKind) => void;
  invalidate: (keys: ReadonlyArray<CacheKey>) => void;
} {
  const { authz } = useOfflineHandles();

  const check = useCallback(
    (key: CacheKey, perms: ReadonlyArray<string>, policy: OfflinePolicyKind) =>
      authz.checkOffline(key, perms, policy),
    [authz],
  );

  const record = useCallback(
    (key: CacheKey, allowed: boolean, source: CacheSourceKind) =>
      authz.record(key, allowed, source),
    [authz],
  );

  const invalidate = useCallback(
    (keys: ReadonlyArray<CacheKey>) => authz.invalidate(keys),
    [authz],
  );

  return { check, record, invalidate };
}
