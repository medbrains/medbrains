import { useAuthStore, useLocaleStore, usePermissionStore } from "@medbrains/stores";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Navigate } from "react-router";
import { sessionService } from "@/services/session.service";
import { PageSkeleton } from "./PageSkeleton";

/** Subscribe to Zustand persist hydration state without polling */
function useHasHydrated(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => useAuthStore.persist.onFinishHydration(onStoreChange),
    () => useAuthStore.persist.hasHydrated(),
    () => false,
  );
}

/** Proactive token refresh interval — refresh 2 minutes before the 15-min access token expires */
const REFRESH_INTERVAL_MS = 13 * 60 * 1000; // 13 minutes

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const hasHydrated = useHasHydrated();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const setPermissions = usePermissionStore((s) => s.setPermissions);
  const clearPermissions = usePermissionStore((s) => s.clearPermissions);
  const [verified, setVerified] = useState<boolean | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Initial session verification ──
  useEffect(() => {
    if (!hasHydrated) return;

    if (!user) {
      setVerified(false);
      return;
    }

    let cancelled = false;
    sessionService
      .me()
      .then(async (resp) => {
        if (cancelled) return;
        setPermissions(resp.role, resp.permissions, resp.field_access);

        // Load locale/units settings for the tenant
        try {
          const [unitsRows, localeRows] = await Promise.all([
            sessionService.getTenantSettings("units"),
            sessionService.getTenantSettings("locale"),
          ]);
          if (!cancelled) {
            useLocaleStore.getState().setFromTenantSettings([...unitsRows, ...localeRows]);
          }
        } catch {
          // Non-critical — defaults will be used
        }

        if (!cancelled) {
          setVerified(true);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // "session_expired" = refresh was already attempted and failed → truly expired
        const msg = err instanceof Error ? err.message : "";
        if (msg === "session_expired") {
          clearAuth();
          clearPermissions();
          setVerified(false);
          return;
        }
        // Check HTTP status — only clear auth on 401
        const status =
          (err as { status?: number }).status ??
          (err as { response?: { status?: number } }).response?.status;
        if (status === 401) {
          clearAuth();
          clearPermissions();
          setVerified(false);
        } else {
          // Backend unreachable (network error) — trust stored auth, show the app
          setVerified(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasHydrated, user, clearAuth, clearPermissions, setPermissions]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Proactive token refresh — keeps session alive during continuous work ──
  useEffect(() => {
    if (!verified || !user) return;

    // Silently refresh the access token every 13 minutes
    // (access token lasts 15 min, so this refreshes 2 min before expiry)
    refreshTimer.current = setInterval(() => {
      sessionService.refreshToken().catch(() => {
        // Refresh failed — session expired, force re-login
        clearAuth();
        clearPermissions();
        setVerified(false);
      });
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
        refreshTimer.current = null;
      }
    };
  }, [
    verified,
    user, // Refresh failed — session expired, force re-login
    clearAuth,
    clearPermissions,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasHydrated) {
    return <PageSkeleton />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (verified === false) {
    return <Navigate to="/login" replace />;
  }

  // Wait for session verification to complete and permissions to load before rendering
  if (verified === null) {
    return <PageSkeleton />;
  }

  return <>{children}</>;
}
