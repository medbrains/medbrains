/**
 * Shared types for the mobile shell — Module contract, app variant,
 * and tenant identity. Each generated app composes a `Shell` with a
 * variant + module list; modules drive nav rendering, permission
 * gating, and offline-doc registration.
 */

import type { ComponentType } from "react";

export type ShellVariant = "staff" | "patient" | "tv" | "vendor";

export interface TenantIdentity {
  tenantId: string;
  userId: string;
  jwt: string;
  role: string | null;
  permissions: ReadonlyArray<string>;
  departmentIds: ReadonlyArray<string>;
}

export interface ModuleBadge {
  count: number;
  intent?: "info" | "warn" | "alert";
}

export interface Module {
  id: string;
  displayName: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  requiredPermissions: ReadonlyArray<string>;
  navigator: ComponentType;
  offlineDocTypes?: ReadonlyArray<string>;
  badge?: () => ModuleBadge | null;
}

export type ModuleList = ReadonlyArray<Module>;

export function userHasModuleAccess(
  module: Module,
  identity: TenantIdentity | null,
): boolean {
  if (!identity) {
    return false;
  }
  if (module.requiredPermissions.length === 0) {
    return true;
  }
  if (identity.role === "super_admin" || identity.role === "hospital_admin") {
    return true;
  }
  const owned = new Set(identity.permissions);
  return module.requiredPermissions.every((p) => owned.has(p));
}

export function filterAccessibleModules(
  modules: ModuleList,
  identity: TenantIdentity | null,
): ModuleList {
  return modules.filter((m) => userHasModuleAccess(m, identity));
}
