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
import { useCallback, useMemo } from "react";
import { Checkbox, IconButton, Input } from "@/components/ui";
import { DataTableBulkBar } from "./DataTableBulkBar";
import { DataTableColumnsMenu } from "./DataTableColumnsMenu";
import { DataTableHeader } from "./DataTableHeader";
import { DataTableToolbar } from "./DataTableToolbar";
import styles from "./data-table.module.scss";
import { isColumnVisible, resolveColumnAccess } from "./data-table-access";
import { buildCsv, downloadCsv } from "./data-table-features";
import type {
  Column,
  ColumnAccessState,
  DataTableDensity,
  DataTableFilter,
  DataTableProps,
} from "./data-table-types";
import { EmptyState } from "./EmptyState";
import { PermissionedFieldValue } from "./PermissionedFieldValue";
import { useDataTableFilter } from "./use-data-table-filter";
import { useDataTableState } from "./use-data-table-state";
import { useDataTableVirtual } from "./use-data-table-virtual";

export type { SortState } from "./data-table-features";
export type {
  Column,
  ColumnAccessState,
  DataTableDensity,
  DataTableFilter,
  DataTableProps,
} from "./data-table-types";

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

/** Build toolbar filters automatically from columns that declare `filter`. */
function deriveAutoFilters<T>(columns: Column<T>[]): DataTableFilter<T>[] {
  const out: DataTableFilter<T>[] = [];
  for (const column of columns) {
    if (!column.filter) continue;
    const get = column.filterValue ?? column.accessor;
    const { type, options, placeholder } = column.filter;
    const label = placeholder ?? column.label;
    if (type === "select") {
      out.push({
        key: column.key,
        label: column.label,
        options,
        placeholder: label,
        matches: (row, value) => String(get?.(row) ?? "").toLowerCase() === value.toLowerCase(),
      });
      continue;
    }
    const isNumber = type === "number";
    out.push({
      key: column.key,
      label: column.label,
      placeholder: label,
      render: (value, onChange) => (
        <Input
          size="xs"
          type={isNumber ? "number" : "text"}
          value={value}
          placeholder={label}
          aria-label={column.label}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      ),
      matches: (row, value) => {
        const raw = String(get?.(row) ?? "").toLowerCase();
        const needle = value.toLowerCase();
        return isNumber ? raw === needle : raw.includes(needle);
      },
    });
  }
  return out;
}

/** Auto filters + explicit `filters`; an explicit filter wins on key clash. */
function mergeFilters<T>(
  auto: DataTableFilter<T>[],
  explicit?: DataTableFilter<T>[],
): DataTableFilter<T>[] {
  if (!explicit?.length) return auto;
  const taken = new Set(explicit.map((filter) => filter.key));
  return [...auto.filter((filter) => !taken.has(filter.key)), ...explicit];
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
  searchable,
  searchPlaceholder,
  filters,
}: DataTableProps<T>) {
  const hasAllPermissions = usePermissionStore((state) => state.hasAllPermissions);
  const hasAnyPermission = usePermissionStore((state) => state.hasAnyPermission);
  const getFieldAccess = usePermissionStore((state) => state.getFieldAccess);

  // Auto basic filters from column `filter` configs, merged with explicit ones.
  const allFilters = useMemo(() => mergeFilters(deriveAutoFilters(columns), filters), [columns, filters]);

  const {
    query,
    setQuery,
    filterValues,
    setFilterValue,
    clearFilters,
    filteredData,
    activeFilterCount,
  } = useDataTableFilter({ data, columns, searchable, filters: allFilters });

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
    data: filteredData,
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

  const headerToolbar = (
    <DataTableToolbar
      toolbar={toolbar}
      actions={
        tableActions || builtInActions ? (
          <>
            {tableActions}
            {builtInActions}
          </>
        ) : null
      }
      searchable={searchable}
      searchPlaceholder={searchPlaceholder}
      query={query}
      onQueryChange={setQuery}
      filters={allFilters}
      filterValues={filterValues}
      onFilterChange={setFilterValue}
      activeFilterCount={activeFilterCount}
      onClearFilters={clearFilters}
    />
  );

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
