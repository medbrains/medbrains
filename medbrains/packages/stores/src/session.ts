import type { QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "./auth-store.js";
import { useModuleStore } from "./module-store.js";
import { usePermissionStore } from "./permission-store.js";

/**
 * Sign the user out of every store at once: auth, switched-off apps and permissions. The next
 * person on this workstation may belong to another hospital, so they must never see this
 * session's apps or rights while their own load.
 */
export function clearSession(): void {
  useAuthStore.getState().clearAuth();
  useModuleStore.getState().clearModules();
  usePermissionStore.getState().clearPermissions();
}

/**
 * End the session on this device: stop every query in flight, sign out of every store (which
 * unmounts the signed-in screens, their polls and the notifications socket), then drop the cache,
 * which holds this session's patient data. Used on sign-out and when the server refuses a refresh.
 */
export function endClientSession(queryClient: QueryClient): void {
  void queryClient.cancelQueries();
  clearSession();
  queryClient.clear();
}
