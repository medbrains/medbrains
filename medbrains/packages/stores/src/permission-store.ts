import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { FieldAccessLevel } from "@medbrains/types";

/** Bypass roles — these skip all permission checks */
const BYPASS_ROLES = new Set(["super_admin", "hospital_admin"]);

interface PermissionState {
  userPermissions: Set<string>;
  userRole: string | null;
  fieldAccess: Record<string, FieldAccessLevel>;
  permVersion: number;
  setPermissions: (
    role: string,
    permissions: string[],
    fieldAccess?: Record<string, FieldAccessLevel>,
    permVersion?: number,
  ) => void;
  clearPermissions: () => void;
  hasPermission: (code: string) => boolean;
  hasAllPermissions: (codes: string[]) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
  getFieldAccess: (moduleFieldCode: string) => FieldAccessLevel;
}

/**
 * Permissions live in **sessionStorage** — auto-cleared on tab close
 * for safety, persists across page reloads within the tab.
 *
 * Sets are not JSON-serializable; we serialize as arrays via the
 * partialize/onRehydrate hooks.
 *
 * `permVersion` is checked on app boot — if the server's value bumped
 * (admin changed the role's permissions, deactivated the user), we
 * discard the cache and refetch from `/api/auth/me`.
 */
export const usePermissionStore = create<PermissionState>()(
  persist(
    (set, get) => ({
      userPermissions: new Set<string>(),
      userRole: null,
      fieldAccess: {},
      permVersion: 0,

      setPermissions: (role, permissions, fieldAccess, permVersion) =>
        set({
          userRole: role,
          userPermissions: new Set(permissions),
          fieldAccess: fieldAccess ?? {},
          permVersion: permVersion ?? 0,
        }),

      clearPermissions: () =>
        set({
          userRole: null,
          userPermissions: new Set(),
          fieldAccess: {},
          permVersion: 0,
        }),

      hasPermission: (code) => {
        const { userRole, userPermissions } = get();
        if (userRole && BYPASS_ROLES.has(userRole)) return true;
        return userPermissions.has(code);
      },

      hasAllPermissions: (codes) => {
        const { userRole, userPermissions } = get();
        if (userRole && BYPASS_ROLES.has(userRole)) return true;
        return codes.every((c) => userPermissions.has(c));
      },

      hasAnyPermission: (codes) => {
        const { userRole, userPermissions } = get();
        if (userRole && BYPASS_ROLES.has(userRole)) return true;
        return codes.some((c) => userPermissions.has(c));
      },

      getFieldAccess: (moduleFieldCode) => {
        const { userRole, fieldAccess } = get();
        // Bypass roles always get edit
        if (userRole && BYPASS_ROLES.has(userRole)) return "edit";
        return fieldAccess[moduleFieldCode] ?? "edit";
      },
    }),
    {
      name: "perm-cache",
      storage: createJSONStorage(() => sessionStorage, {
        // Serialize Set<string> as array
        replacer: (_key, value) =>
          value instanceof Set ? Array.from(value) : value,
        // Rehydrate stored array back into a Set
        reviver: (key, value) =>
          key === "userPermissions" && Array.isArray(value)
            ? new Set(value as string[])
            : value,
      }),
      partialize: (state) => ({
        userPermissions: state.userPermissions,
        userRole: state.userRole,
        fieldAccess: state.fieldAccess,
        permVersion: state.permVersion,
      }),
    },
  ),
);
