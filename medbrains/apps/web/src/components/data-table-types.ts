import type { FieldAccessLevel } from "@medbrains/types";
import type { CSSProperties, ReactNode } from "react";
import type { SortState } from "./data-table-features";
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
  // ── Search (opt-in) ───────────────────────────────────────────
  /** Include this column in the global search box. */
  searchable?: boolean;
  /** Value matched by global search; falls back to `accessor`. */
  searchValue?: (row: T) => number | string | null | undefined;
  // ── Auto filter (opt-in) ──────────────────────────────────────
  /**
   * Declare a basic filter for this column and DataTable renders it in the
   * toolbar automatically (text = contains, select = exact from `options`,
   * number = equals). Matching uses `filterValue` ?? `accessor`.
   */
  filter?: {
    type: "text" | "select" | "number";
    options?: { value: string; label: string }[];
    placeholder?: string;
  };
  /** Value used for the auto filter; falls back to `accessor`. */
  filterValue?: (row: T) => number | string | null | undefined;
}

/**
 * An extensible toolbar filter. Provide `options` for the built-in Select,
 * or `render` for a fully custom control — either way `matches` is the
 * predicate that decides which rows survive. New filter kinds need only a
 * `render` + `matches`; DataTable stays unchanged.
 */
export interface DataTableFilter<T> {
  key: string;
  label: string;
  /** Options for the default Select control (ignored if `render` is given). */
  options?: { value: string; label: string }[];
  /** Placeholder for the default Select. */
  placeholder?: string;
  /** Custom control — receives the current value + setter; overrides the Select. */
  render?: (value: string, onChange: (value: string) => void) => ReactNode;
  /** Keep `row` when it matches the selected `value` (value is "" when cleared). */
  matches: (row: T, value: string) => boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  total?: number;
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };
  page?: number;
  totalPages?: number;
  perPage?: number;
  onPageChange?: (page: number) => void;
  rowKey: (row: T) => string;
  toolbar?: ReactNode;
  tableActions?: ReactNode;
  rowStyle?: (row: T) => CSSProperties | undefined;
  onRowClick?: (row: T) => void;
  caption?: ReactNode;
  captionVisuallyHidden?: boolean;
  density?: DataTableDensity;
  virtualized?: boolean | "auto";
  virtualizeAt?: number;
  virtualRowHeight?: number;
  virtualOverscan?: number;
  tableMaxHeight?: CSSProperties["maxHeight"];
  // ── Sorting (opt-in) ──────────────────────────────────────────
  defaultSort?: SortState;
  /** Controlled sort (server-side). Provide with `onSortChange`. */
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  // ── Row selection (opt-in) ────────────────────────────────────
  selectable?: boolean;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[], rows: T[]) => void;
  /** Rendered in the bulk bar when rows are selected. */
  bulkActions?: (rows: T[], clear: () => void) => ReactNode;
  // ── Column visibility + export (opt-in) ───────────────────────
  /** Persistence key for hideable-column state (localStorage). */
  storageKey?: string;
  exportable?: boolean;
  exportFileName?: string;
  // ── Search + filters (opt-in, client-side) ────────────────────
  /** Show a global search box (scans columns marked `searchable`, else all). */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Extensible toolbar filters — descriptor with options/render + matches. */
  filters?: DataTableFilter<T>[];
  /** Opt in to the advanced multi-condition (AND/OR) filter builder. */
  advancedFilter?: boolean;
}
