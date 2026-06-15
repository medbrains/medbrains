import type { FieldAccessLevel } from "@medbrains/types";
import type { ReactNode } from "react";
import type { PermissionedFieldKind } from "./PermissionedFieldValue";

export type DataTableDensity = "compact" | "default" | "comfortable";

export interface ColumnAccessState {
  permissionsAllowed: boolean;
  fieldAccess: FieldAccessLevel;
  isMasked: boolean;
  isHidden: boolean;
}

export interface Column<T> {
  key: string;
  label: string;
  icon?: ReactNode;
  // ── Permission / field access (existing) ──────────────────────
  requiredPermissions?: readonly string[];
  permissionMode?: "all" | "any";
  hideWhenDenied?: boolean;
  fieldAccessKey?: string;
  fieldAccessKeys?: readonly string[];
  hideWhenFieldHidden?: boolean;
  accessor?: (row: T) => number | string | null | undefined;
  fieldKind?: PermissionedFieldKind;
  hiddenLabel?: string;
  render: (row: T, access: ColumnAccessState) => ReactNode;
  // ── Sorting (opt-in) ──────────────────────────────────────────
  /** Make this column's header clickable to sort. */
  sortable?: boolean;
  /** Value used for client-side sort; falls back to `accessor`. */
  sortValue?: (row: T) => number | string | null | undefined;
  // ── Column visibility (opt-in) ────────────────────────────────
  /** Allow the user to hide/show this column via the columns menu. */
  hideable?: boolean;
  /** Start hidden (still toggleable). */
  defaultHidden?: boolean;
  // ── CSV export (opt-in) ───────────────────────────────────────
  /** Value used for CSV export; falls back to `accessor`. */
  exportValue?: (row: T) => number | string | null | undefined;
}
