/**
 * Shared types for the mobile shell — Module contract, app variant,
 * and tenant identity. Each generated app composes a `Shell` with a
 * variant + module list; modules drive nav rendering, permission
 * gating, and offline-doc registration.
 */

import type { ComponentType } from "react";
import type { AppSurfaceCode } from "./app-surfaces.js";

export type ShellVariant = "staff" | "patient" | "tv" | "vendor" | "camp";

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
  requiredAnyPermissions?: ReadonlyArray<string>;
  navigator: ComponentType;
  appCodes?: ReadonlyArray<AppSurfaceCode>;
  tags?: ReadonlyArray<string>;
  offlineDocTypes?: ReadonlyArray<string>;
  badge?: () => ModuleBadge | null;
}

export type ModuleList = ReadonlyArray<Module>;

export function userHasModuleAccess(module: Module, identity: TenantIdentity | null): boolean {
  if (!identity) {
    return false;
  }
  const requiredAnyPermissions = module.requiredAnyPermissions ?? [];
  if (module.requiredPermissions.length === 0 && requiredAnyPermissions.length === 0) {
    return true;
  }
  if (identity.role === "super_admin" || identity.role === "hospital_admin") {
    return true;
  }
  const owned = new Set(identity.permissions);
  const hasRequiredPermissions = module.requiredPermissions.every((p) => owned.has(p));
  const hasRequiredAnyPermission =
    requiredAnyPermissions.length === 0 || requiredAnyPermissions.some((p) => owned.has(p));
  return hasRequiredPermissions && hasRequiredAnyPermission;
}

export function filterAccessibleModules(
  modules: ModuleList,
  identity: TenantIdentity | null,
): ModuleList {
  return modules.filter((m) => userHasModuleAccess(m, identity));
}

export function filterModulesForApp(modules: ModuleList, appCode: AppSurfaceCode): ModuleList {
  return modules.filter((module) => !module.appCodes?.length || module.appCodes.includes(appCode));
}
