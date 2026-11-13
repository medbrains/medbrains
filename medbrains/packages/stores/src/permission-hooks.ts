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
 * Returns true if the current user's token carries `code` by name.
 *
 * For the few rights a bypass role does not hold implicitly (giving or
 * witnessing a high-alert dose): `super_admin` / `hospital_admin` are not
 * waved through, so the control matches what the server will accept.
 */
export function useHasGrantedPermission(code: string): boolean {
  return usePermissionStore((s) => s.userPermissions.has(code));
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
