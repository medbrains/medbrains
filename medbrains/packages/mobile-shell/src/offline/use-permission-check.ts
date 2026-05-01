import { useCallback } from "react";
import { useOfflineHandles } from "./offline-provider.js";
import { useAuthzCache } from "./use-authz-cache.js";
import type { CacheKey, CheckOutcome, OfflinePolicyKind } from "./edge-rn-contract.js";

/**
 * Composite check used by clinical-write screens: combines the
 * online-required denylist (cheap string check, no I/O) with the
 * offline AuthzCache lookup. Returns an `Allow` outcome if either
 * the cache or the JWT-fallback allows.
 */
export function usePermissionCheck(): {
  check: (
    key: CacheKey,
    jwtPermissions: ReadonlyArray<string>,
    policy?: OfflinePolicyKind,
  ) => CheckOutcome;
} {
  const { bindings } = useOfflineHandles();
  const { check: authzCheck } = useAuthzCache();

  const check = useCallback(
    (
      key: CacheKey,
      jwtPermissions: ReadonlyArray<string>,
      policy: OfflinePolicyKind = "CacheThenJwt",
    ): CheckOutcome => {
      if (bindings.isActionOfflineRequired(key.objectType, key.action)) {
        return { tag: "Deny", reason: "OnlineRequired" };
      }
      return authzCheck(key, jwtPermissions, policy);
    },
    [bindings, authzCheck],
  );

  return { check };
}
