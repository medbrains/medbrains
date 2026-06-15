import {
  Box,
  Card,
  Divider,
  Group,
  Pagination,
  Skeleton,
  Table,
  Text,
  VisuallyHidden,
} from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import { IconDownload } from "@tabler/icons-react";
import { type CSSProperties, type ReactNode, useCallback, useMemo } from "react";
import { Checkbox, IconButton } from "@/components/ui";
import { DataTableBulkBar } from "./DataTableBulkBar";
import { DataTableColumnsMenu } from "./DataTableColumnsMenu";
import { DataTableHeader } from "./DataTableHeader";
import styles from "./data-table.module.scss";
import { isColumnVisible, resolveColumnAccess } from "./data-table-access";
import { buildCsv, downloadCsv, type SortState } from "./data-table-features";
import type { Column, ColumnAccessState, DataTableDensity } from "./data-table-types";
import { EmptyState } from "./EmptyState";
import { PermissionedFieldValue } from "./PermissionedFieldValue";
import { useDataTableState } from "./use-data-table-state";
import { useDataTableVirtual } from "./use-data-table-virtual";

export type { SortState } from "./data-table-features";
export type { Column, ColumnAccessState, DataTableDensity } from "./data-table-types";

const SKELETON_ROW_KEYS = ["skeleton-a", "skeleton-b", "skeleton-c", "skeleton-d", "skeleton-e"];
const DEFAULT_VIRTUALIZE_AT = 80;
const DEFAULT_VIRTUAL_OVERSCAN = 8;

const VIRTUAL_ROW_HEIGHT_BY_DENSITY: Record<DataTableDensity, number> = {
  compact: 44,
  default: 56,
  comfortable: 64,
};

const TABLE_VERTICAL_SPACING_BY_DENSITY: Record<DataTableDensity, number> = {
  compact: 5,
  default: 7,
  comfortable: 10,
};

interface DataTableProps<T> {
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
}

function renderCell<T>(row: T, column: Column<T>, access: ColumnAccessState) {
  if (!access.permissionsAllowed) {
    return (
      <Text size="sm" c="var(--mb-text-muted)">
        {column.hiddenLabel ?? "Restricted"}
      </Text>
    );
  }

  if (column.accessor && (access.isMasked || access.fieldAccess === "hidden")) {
    return (
      <PermissionedFieldValue
        fieldCode={column.fieldAccessKey}
        fieldCodes={column.fieldAccessKeys}
        value={column.accessor(row)}
        kind={column.fieldKind ?? "text"}
        hiddenLabel={column.hiddenLabel}
        size="sm"
      />
    );
  }

  return column.render(row, access);
}

function spacerRow(height: number, columnCount: number, key: string) {
  if (height <= 0) {
    return null;
  }

  return (
    <Table.Tr key={key} aria-hidden="true">
      <Table.Td colSpan={columnCount} className={styles.virtualSpacerCell} style={{ height }} />
    </Table.Tr>
  );
}

export function DataTable<T>({
  columns,
  data,
  loading,
  total,
  emptyIcon,
  emptyTitle = "No data found",
  emptyDescription,
  emptyAction,
  page = 1,
  totalPages,
  perPage = 20,
  onPageChange,
  rowKey,
  toolbar,
  tableActions,
  rowStyle,
  onRowClick,
  caption,
  captionVisuallyHidden = true,
  density = "default",
  virtualized = "auto",
  virtualizeAt = DEFAULT_VIRTUALIZE_AT,
  virtualRowHeight,
  virtualOverscan = DEFAULT_VIRTUAL_OVERSCAN,
  tableMaxHeight,
  defaultSort,
  sort,
  onSortChange,
  selectable,
  selectedKeys,
  onSelectionChange,
  bulkActions,
  storageKey,
  exportable,
  exportFileName,
}: DataTableProps<T>) {
  const hasAllPermissions = usePermissionStore((state) => state.hasAllPermissions);
  const hasAnyPermission = usePermissionStore((state) => state.hasAnyPermission);
  const getFieldAccess = usePermissionStore((state) => state.getFieldAccess);

  const {
    activeSort,
    handleSort,
    sortedData,
    selectedSet,
    toggleRow,
    toggleAll,
    clearSelection,
    allSelected,
    someSelected,
    selectedRows,
    hidden,
    toggleColumn,
  } = useDataTableState({
    columns,
    data,
    rowKey,
    sort,
    defaultSort,
    onSortChange,
    selectedKeys,
    onSelectionChange,
    storageKey,
  });

  const resolvedVirtualRowHeight = virtualRowHeight ?? VIRTUAL_ROW_HEIGHT_BY_DENSITY[density];
  const startItem = (page - 1) * perPage + 1;
  const totalItems = total ?? sortedData.length;
  const endItem = Math.min(page * perPage, totalItems);
  const shouldVirtualize =
    !loading &&
    (virtualized === true || (virtualized === "auto" && sortedData.length >= virtualizeAt));

  const columnsWithAccess = useMemo(
    () =>
      columns
        .map((column) => ({
          access: resolveColumnAccess(column, hasAllPermissions, hasAnyPermission, getFieldAccess),
          column,
        }))
        .filter(({ access, column }) => isColumnVisible(column, access) && !hidden.has(column.key)),
    [columns, getFieldAccess, hasAllPermissions, hasAnyPermission, hidden],
  );
  const dataColumnCount = columnsWithAccess.length;
  const totalColumnCount = dataColumnCount + (selectable ? 1 : 0);

  const columnMenuItems = useMemo(
    () =>
      columns
        .filter((column) => column.hideable)
        .map((column) => ({
          key: column.key,
          label: column.label,
          hidden: hidden.has(column.key),
        })),
    [columns, hidden],
  );

  const handleExport = useCallback(() => {
    const headers = columnsWithAccess.map(({ column }) => column.label);
    const rows = sortedData.map((row) =>
      columnsWithAccess.map(({ access, column }) => {
        if (!access.permissionsAllowed || access.isHidden || access.isMasked) return "";
        const getValue = column.exportValue ?? column.accessor;
        return getValue ? (getValue(row) ?? "") : "";
      }),
    );
    downloadCsv(exportFileName ?? "export", buildCsv(headers, rows));
  }, [columnsWithAccess, sortedData, exportFileName]);

  const { virtualWindow, setTableWrapperRef, handleTableScroll } = useDataTableVirtual({
    data: sortedData,
    enabled: shouldVirtualize,
    rowHeight: resolvedVirtualRowHeight,
    overscan: virtualOverscan,
  });

  const tableCaption = caption ? (
    <Table.Caption>
      {captionVisuallyHidden ? <VisuallyHidden>{caption}</VisuallyHidden> : caption}
    </Table.Caption>
  ) : null;

  const header = (
    <DataTableHeader
      columns={columnsWithAccess}
      selectable={selectable}
      allSelected={allSelected}
      someSelected={someSelected}
      onToggleAll={toggleAll}
      activeSort={activeSort}
      onSort={handleSort}
    />
  );

  const builtInActions =
    exportable || columnMenuItems.length > 0 ? (
      <>
        {exportable && (
          <IconButton aria-label="Export CSV" tone="default" onClick={handleExport}>
            <IconDownload size={16} />
          </IconButton>
        )}
        <DataTableColumnsMenu items={columnMenuItems} onToggle={toggleColumn} />
      </>
    ) : null;

  const headerToolbar =
    toolbar || tableActions || builtInActions ? (
      <>
        <Box px="md" py="sm" className={styles.toolbar}>
          <Group justify="space-between" align="center" gap="sm" wrap="wrap">
            {toolbar && <Box className={styles.toolbarContent}>{toolbar}</Box>}
            <Group gap="xs" className={styles.tableActions}>
              {tableActions}
              {builtInActions}
            </Group>
          </Group>
        </Box>
        <Divider />
      </>
    ) : null;

  const bulkBar =
    selectable && selectedRows.length > 0 ? (
      <DataTableBulkBar
        count={selectedRows.length}
        onClear={clearSelection}
        actions={bulkActions?.(selectedRows, clearSelection)}
      />
    ) : null;

  if (dataColumnCount === 0) {
    return (
      <Card padding={0} className={styles.card}>
        {headerToolbar}
        <Box py="xl" px="md">
          <Text size="sm" c="var(--mb-text-secondary)" ta="center">
            No visible columns for your access policy.
          </Text>
        </Box>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card padding={0} className={styles.card}>
        {headerToolbar}
        <Table aria-busy="true" verticalSpacing={TABLE_VERTICAL_SPACING_BY_DENSITY[density]}>
          {tableCaption}
          {header}
          <Table.Tbody>
            {SKELETON_ROW_KEYS.map((key) => (
              <Table.Tr key={key}>
                {selectable && <Table.Td className={styles.selectCell} />}
                {columnsWithAccess.map(({ column: col }) => (
                  <Table.Td key={col.key}>
                    <Skeleton height={20} radius="sm" />
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    );
  }

  if (sortedData.length === 0 && emptyIcon) {
    return (
      <Card padding={0} className={styles.card}>
        {headerToolbar}
        <Box py="xl" px="md">
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle}
            description={emptyDescription}
            action={emptyAction}
          />
        </Box>
      </Card>
    );
  }

  return (
    <Card padding={0} className={styles.card}>
      {headerToolbar}
      {bulkBar}
      <Box
        className={styles.tableWrapper}
        ref={setTableWrapperRef}
        onScroll={shouldVirtualize ? handleTableScroll : undefined}
        style={tableMaxHeight ? { maxHeight: tableMaxHeight } : undefined}
        data-density={density}
        data-virtual-rendered={shouldVirtualize ? virtualWindow.renderedCount : undefined}
        data-virtualized={shouldVirtualize ? "true" : undefined}
      >
        <Table
          aria-colcount={totalColumnCount}
          aria-rowcount={totalItems}
          verticalSpacing={TABLE_VERTICAL_SPACING_BY_DENSITY[density]}
        >
          {tableCaption}
          {header}
          <Table.Tbody>
            {spacerRow(virtualWindow.topSpacerHeight, totalColumnCount, "virtual-top-spacer")}
            {virtualWindow.rows.map((row, visibleIndex) => {
              const rowIndex = virtualWindow.startIndex + visibleIndex;
              const globalRowIndex = (page - 1) * perPage + rowIndex + 1;
              const isSelected = selectable && selectedSet.has(rowKey(row));

              return (
                <Table.Tr
                  key={rowKey(row)}
                  aria-rowindex={globalRowIndex}
                  className={shouldVirtualize ? styles.virtualRow : undefined}
                  data-clickable={onRowClick ? "true" : undefined}
                  data-selected={isSelected || undefined}
                  style={{
                    height: shouldVirtualize ? resolvedVirtualRowHeight : undefined,
                    ...rowStyle?.(row),
                    cursor: onRowClick ? "pointer" : undefined,
                  }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selectable && (
                    <Table.Td
                      className={styles.selectCell}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        aria-label="Select row"
                        checked={!!isSelected}
                        onChange={() => toggleRow(row)}
                        size="xs"
                      />
                    </Table.Td>
                  )}
                  {columnsWithAccess.map(({ access, column }) => (
                    <Table.Td key={column.key}>{renderCell(row, column, access)}</Table.Td>
                  ))}
                </Table.Tr>
              );
            })}
            {spacerRow(virtualWindow.bottomSpacerHeight, totalColumnCount, "virtual-bottom-spacer")}
          </Table.Tbody>
        </Table>
      </Box>

      {(totalPages ?? 0) > 0 && (
        <>
          <Divider />
          <Group justify="space-between" px="md" py="sm">
            <Text size="xs" c="var(--mb-text-secondary)" className={styles.footerCount}>
              {totalItems > 0
                ? `Showing ${startItem}–${endItem} of ${totalItems.toLocaleString()} items`
                : "0 items"}
            </Text>
            {totalPages && totalPages > 1 && onPageChange && (
              <Pagination total={totalPages} value={page} onChange={onPageChange} size="sm" />
            )}
          </Group>
        </>
      )}
    </Card>
  );
}
