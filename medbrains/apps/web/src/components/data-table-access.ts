import type { FieldAccessLevel } from "@medbrains/types";
import { mostRestrictedFieldAccess } from "@medbrains/utils";
import type { Column, ColumnAccessState } from "./data-table-types";

export function normalizeFieldCodes<T>(column: Column<T>): string[] {
  const codes = new Set<string>();
  if (column.fieldAccessKey) {
    codes.add(column.fieldAccessKey);
  }
  for (const code of column.fieldAccessKeys ?? []) {
    codes.add(code);
  }
  return [...codes];
}

export function resolveColumnAccess<T>(
  column: Column<T>,
  hasAllPermissions: (codes: string[]) => boolean,
  hasAnyPermission: (codes: string[]) => boolean,
  getFieldAccess: (code: string) => FieldAccessLevel,
): ColumnAccessState {
  const requiredPermissions = [...(column.requiredPermissions ?? [])];
  const permissionsAllowed =
    requiredPermissions.length === 0
      ? true
      : column.permissionMode === "any"
        ? hasAnyPermission(requiredPermissions)
        : hasAllPermissions(requiredPermissions);
  const fieldCodes = normalizeFieldCodes(column);
  const fieldAccess =
    fieldCodes.length > 0
      ? mostRestrictedFieldAccess(fieldCodes.map((fieldCode) => getFieldAccess(fieldCode)))
      : "edit";

  return {
    permissionsAllowed,
    fieldAccess,
    isMasked: fieldAccess === "mask",
    isHidden: !permissionsAllowed || fieldAccess === "hidden",
  };
}

export function isColumnVisible<T>(column: Column<T>, access: ColumnAccessState): boolean {
  if (!access.permissionsAllowed && (column.hideWhenDenied ?? true)) {
    return false;
  }
  if (access.fieldAccess === "hidden" && (column.hideWhenFieldHidden ?? true)) {
    return false;
  }
  return true;
}
