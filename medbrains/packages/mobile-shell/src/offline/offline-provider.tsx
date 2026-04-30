/**
 * `OfflineProvider` opens the Rust-backed AuthzCache + RevocationCache
 * once per app and exposes them via context. Hosts wrap their root
 * tree in this; hooks (`useAuthzCache`, `useJwtVerify`,
 * `useRevocationCache`, `usePermissionCheck`) read from context.
 */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { loadEdgeRnBindings } from "./edge-rn-loader.js";
import type {
  AuthzCacheHandle,
  EdgeRnBindings,
  RevocationCacheHandle,
} from "./edge-rn-contract.js";

export interface OfflineHandles {
  bindings: EdgeRnBindings;
  authz: AuthzCacheHandle;
  revocations: RevocationCacheHandle;
}

export interface OfflineProviderProps {
  cachePath: string;
  authzCapacity?: number;
  authzDefaultTtlSecs?: number;
  revocationCapacity?: number;
  fallback?: ReactNode;
  children: ReactNode;
}

const OfflineContext = createContext<OfflineHandles | null>(null);

export function OfflineProvider(props: OfflineProviderProps): ReactNode {
  const {
    cachePath,
    authzCapacity = 1024,
    authzDefaultTtlSecs = 3600,
    revocationCapacity = 4096,
    fallback = null,
    children,
  } = props;
  const [handles, setHandles] = useState<OfflineHandles | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadEdgeRnBindings()
      .then((bindings) => {
        if (cancelled) {
          return;
        }
        const authz = new bindings.AuthzCacheHandle(
          `${cachePath}/authz`,
          authzCapacity,
          authzDefaultTtlSecs,
        );
        const revocations = new bindings.RevocationCacheHandle(
          `${cachePath}/revocations`,
          revocationCapacity,
        );
        setHandles({ bindings, authz, revocations });
      })
      .catch(() => {
        if (!cancelled) {
          setHandles(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cachePath, authzCapacity, authzDefaultTtlSecs, revocationCapacity]);

  const value = useMemo(() => handles, [handles]);
  if (!value) {
    return fallback;
  }
  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOfflineHandles(): OfflineHandles {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    throw new Error("useOfflineHandles called outside OfflineProvider");
  }
  return ctx;
}
