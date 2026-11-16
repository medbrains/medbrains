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
