/**
 * `OfflineProvider` opens the Rust-backed AuthzCache + RevocationCache
 * once per app and exposes them via context. Offline support is optional
 * at shell startup: online-first app navigation must still render when
 * native edge bindings are unavailable in a dev build.
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
type OfflineProviderState =
  | { status: "loading"; handles: null }
  | { status: "ready"; handles: OfflineHandles }
  | { status: "unavailable"; handles: null };

export function OfflineProvider(props: OfflineProviderProps): ReactNode {
  const {
    cachePath,
    authzCapacity = 1024,
    authzDefaultTtlSecs = 3600,
    revocationCapacity = 4096,
    fallback = null,
    children,
  } = props;
  const [state, setState] = useState<OfflineProviderState>({
    status: "loading",
    handles: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", handles: null });
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
        setState({ status: "ready", handles: { bindings, authz, revocations } });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "unavailable", handles: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cachePath, authzCapacity, authzDefaultTtlSecs, revocationCapacity]);

  const value = useMemo(() => state.handles, [state.handles]);
  if (state.status === "loading") {
    return fallback;
  }
  if (state.status === "unavailable" || !value) {
    return <>{children}</>;
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
