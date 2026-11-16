import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "./auth-store.js";
import { useModuleStore } from "./module-store.js";
import { usePermissionStore } from "./permission-store.js";

export interface QueryClientCallbacks {
  /**
   * Surface a failed mutation to the user (e.g. a toast). Called only
   * for mutations that did NOT define their own onError — pages with
   * tailored error handling are left alone.
   */
  onMutationError?: (error: Error) => void;
}

/**
 * An expired session signs the user out. The app and permission stores go with it, so the next
 * person to sign in on this workstation never sees this session's apps or rights while theirs load.
 */
function handleGlobalError(error: Error): void {
  if (error.message === "session_expired") {
    useAuthStore.getState().clearAuth();
    useModuleStore.getState().clearModules();
    usePermissionStore.getState().clearPermissions();
  }
}

export function createQueryClient(callbacks: QueryClientCallbacks = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          // Don't retry on session expiry
          if (error instanceof Error && error.message === "session_expired") {
            return false;
          }
          return failureCount < 1;
        },
      },
    },
    queryCache: new QueryCache({
      onError: (error) => handleGlobalError(error as Error),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        handleGlobalError(error as Error);
        // A mutation failure must never be silent: if the call site has
        // no onError of its own, fall back to the app-level handler.
        if (!mutation.options.onError && (error as Error).message !== "session_expired") {
          callbacks.onMutationError?.(error as Error);
        }
      },
    }),
  });
}
