import { userSchema } from "@medbrains/schemas";
import {
  clearSession,
  endClientSession,
  useAuthStore,
  useLocaleStore,
  useModuleStore,
  usePermissionStore,
} from "@medbrains/stores";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Navigate } from "react-router";
import { sessionService } from "@/services/session.service";
import { PageSkeleton } from "./PageSkeleton";
import { QueryError } from "./QueryError";

/** Subscribe to Zustand persist hydration state without polling */
function useHasHydrated(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => useAuthStore.persist.onFinishHydration(onStoreChange),
    () => useAuthStore.persist.hasHydrated(),
    () => false,
  );
}

/**
 * The failure to keep when `/auth/me` could not answer: with no permissions cached from this tab,
 * nobody can know which apps this person has, so it must read as "couldn't check", never as an
 * empty launcher. `null` when cached permissions can stand in.
 */
function unknownAccessAfter(err: unknown): unknown {
  return usePermissionStore.getState().userRole ? null : err;
}

/** What the signed-in app shows while access is unknown: the error, and a reload to retry. */
function AccessUncheckedError({ error }: { error: unknown }) {
  return (
    <QueryError
      error={error}
      title="We couldn't check your access"
      onRetry={() => window.location.reload()}
    />
  );
}

/** Proactive token refresh interval — refresh 2 minutes before the 15-min access token expires */
const REFRESH_INTERVAL_MS = 13 * 60 * 1000; // 13 minutes

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const hasHydrated = useHasHydrated();
  const user = useAuthStore((s) => s.user);
  const setPermissions = usePermissionStore((s) => s.setPermissions);
  const setDisabledModules = useModuleStore((s) => s.setDisabledModules);
  const setRestrictCopy = useModuleStore((s) => s.setRestrictCopy);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [accessUnknown, setAccessUnknown] = useState<unknown>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [mfaEnrollmentRequired, setMfaEnrollmentRequired] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const queryClient = useQueryClient();

  // ── Initial session verification ──
  useEffect(() => {
    if (!hasHydrated) return;

    let cancelled = false;
    sessionService
      .me()
      .then((resp) => {
        if (cancelled) return;
        // The HttpOnly cookie is the source of truth. Hydrate the store on a cold
        // load when it's empty — SSO lands via a full-page redirect that sets the
        // cookie but never populates the store (password login does). Without this,
        // a valid SSO session bounces straight back to /login.
        if (!useAuthStore.getState().user) {
          useAuthStore.getState().setAuth(
            userSchema.parse({
              id: resp.id,
              tenant_id: resp.tenant_id,
              username: resp.username,
              email: resp.email,
              full_name: resp.full_name,
              role: resp.role,
              access_matrix: {},
              is_active: true,
              created_at: "",
              updated_at: "",
            }),
          );
        }
        setMustChangePassword(resp.must_change_password);
        setMfaEnrollmentRequired(resp.mfa_enrollment_required);
        setPermissions(resp.role, resp.permissions, resp.field_access);
        setDisabledModules(resp.disabled_modules ?? []);
        setRestrictCopy(resp.restrict_copy === true);

        // The locale profile rides on /auth/me (one round trip). `null` is a
        // failed resolution: the shell says so and renders neutrally.
        useLocaleStore.getState().setProfile(resp.locale_profile ?? null);

        if (!cancelled) {
          setVerified(true);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // "session_expired" = refresh was already attempted and failed → truly expired
        const msg = err instanceof Error ? err.message : "";
        if (msg === "session_expired") {
          clearSession();
          setVerified(false);
          return;
        }
        // Check HTTP status — only clear auth on 401
        const status =
          (err as { status?: number }).status ??
          (err as { response?: { status?: number } }).response?.status;
        if (status === 401) {
          clearSession();
          setVerified(false);
        } else {
          // Backend unreachable (network error) — trust stored auth if present,
          // otherwise treat as unauthenticated. The profile did not load either.
          useLocaleStore.getState().setProfile(null);
          setAccessUnknown(unknownAccessAfter(err));
          setVerified(Boolean(useAuthStore.getState().user));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasHydrated, setPermissions, setDisabledModules, setRestrictCopy]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Proactive token refresh — keeps session alive during continuous work ──
  useEffect(() => {
    if (!verified || !user) return;

    // Silently refresh the access token every 13 minutes
    // (access token lasts 15 min, so this refreshes 2 min before expiry)
    refreshTimer.current = setInterval(() => {
      sessionService.refreshToken().catch(() => {
        // Refresh failed — session expired, force re-login
        endClientSession(queryClient);
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
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wait for store hydration + the /auth/me verification (which also hydrates the
  // store from the cookie on a cold SSO load) before deciding.
  if (!hasHydrated || verified === null) {
    return <PageSkeleton />;
  }

  // Signed out of the store (logout, or an expired session) unmounts every
  // signed-in screen at once, so no poll or socket outlives the session.
  if (verified === false || !user) {
    return <Navigate to="/login" replace />;
  }

  if (accessUnknown) return <AccessUncheckedError error={accessUnknown} />;

  // Seeded/provisioned credential — block the app until the password is rotated
  if (mustChangePassword) {
    return <Navigate to="/force-password-change" replace />;
  }

  // Tenant policy mandates MFA for this role — block until enrolled
  if (mfaEnrollmentRequired) {
    return <Navigate to="/mfa-enroll" replace />;
  }

  return <>{children}</>;
}
