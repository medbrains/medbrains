import type { FieldAccessLevel } from "@medbrains/types";
import { usePermissionStore } from "./permission-store.js";

/**
 * Returns true if the current user has the given permission.
 * super_admin / hospital_admin always return true.
 */
export function useHasPermission(code: string): boolean {
  return usePermissionStore((s) => s.hasPermission(code));
}

/**
 * Returns true if the current user has ALL of the given permissions.
 */
export function useHasAllPermissions(codes: readonly string[]): boolean {
  return usePermissionStore((s) => s.hasAllPermissions(codes));
}

/**
 * Returns true if the current user has ANY of the given permissions.
 */
export function useHasAnyPermission(codes: readonly string[]): boolean {
  return usePermissionStore((s) => s.hasAnyPermission(codes));
}

/**
 * Returns the field access level for a given `module.field_code` key.
 * Bypass roles always return "edit".
 * Missing keys default to "edit".
 */
export function useFieldAccess(moduleFieldCode: string): FieldAccessLevel {
  return usePermissionStore((s) => s.getFieldAccess(moduleFieldCode));
}
