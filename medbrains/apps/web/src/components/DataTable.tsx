import { Box, Card, Divider, Group, Pagination, Skeleton, Table, Text } from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import type { FieldAccessLevel } from "@medbrains/types";
import {
  type CSSProperties,
  type ReactNode,
  type UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./data-table.module.scss";
import { resolveDataTableVirtualWindow } from "./data-table-virtualization";
import { EmptyState } from "./EmptyState";
import { type PermissionedFieldKind, PermissionedFieldValue } from "./PermissionedFieldValue";

const SKELETON_ROW_KEYS = ["skeleton-a", "skeleton-b", "skeleton-c", "skeleton-d", "skeleton-e"];
const DEFAULT_VIRTUALIZE_AT = 80;
const DEFAULT_VIRTUAL_ROW_HEIGHT = 56;
const DEFAULT_VIRTUAL_OVERSCAN = 8;

export interface Column<T> {
  key: string;
  label: string;
  icon?: ReactNode;
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
}

export interface ColumnAccessState {
  permissionsAllowed: boolean;
  fieldAccess: FieldAccessLevel;
  isMasked: boolean;
  isHidden: boolean;
}

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
  virtualized?: boolean | "auto";
  virtualizeAt?: number;
  virtualRowHeight?: number;
  virtualOverscan?: number;
  tableMaxHeight?: CSSProperties["maxHeight"];
}

const accessRank: Record<FieldAccessLevel, number> = {
  edit: 0,
  view: 1,
  mask: 2,
  hidden: 3,
};

function normalizeFieldCodes<T>(column: Column<T>) {
  const codes = new Set<string>();
  if (column.fieldAccessKey) {
    codes.add(column.fieldAccessKey);
  }
  for (const code of column.fieldAccessKeys ?? []) {
    codes.add(code);
  }
  return [...codes];
}

function mostRestrictedAccess(accessLevels: FieldAccessLevel[]): FieldAccessLevel {
  return accessLevels.reduce<FieldAccessLevel>((current, next) => {
    return accessRank[next] > accessRank[current] ? next : current;
  }, "edit");
}

function resolveColumnAccess<T>(
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
      ? mostRestrictedAccess(fieldCodes.map((fieldCode) => getFieldAccess(fieldCode)))
      : "edit";

  return {
    permissionsAllowed,
    fieldAccess,
    isMasked: fieldAccess === "mask",
    isHidden: !permissionsAllowed || fieldAccess === "hidden",
  };
}

function isColumnVisible<T>(column: Column<T>, access: ColumnAccessState) {
  if (!access.permissionsAllowed && (column.hideWhenDenied ?? true)) {
    return false;
  }
  if (access.fieldAccess === "hidden" && (column.hideWhenFieldHidden ?? true)) {
    return false;
  }
  return true;
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
  virtualized = "auto",
  virtualizeAt = DEFAULT_VIRTUALIZE_AT,
  virtualRowHeight = DEFAULT_VIRTUAL_ROW_HEIGHT,
  virtualOverscan = DEFAULT_VIRTUAL_OVERSCAN,
  tableMaxHeight,
}: DataTableProps<T>) {
  const permissionState = usePermissionStore();
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const pendingScrollPositionRef = useRef({ scrollTop: 0, viewportHeight: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const startItem = (page - 1) * perPage + 1;
  const endItem = Math.min(page * perPage, total ?? data.length);
  const totalItems = total ?? data.length;
  const shouldVirtualize =
    !loading && (virtualized === true || (virtualized === "auto" && data.length >= virtualizeAt));
  const columnsWithAccess = useMemo(
    () =>
      columns
        .map((column) => ({
          access: resolveColumnAccess(
            column,
            permissionState.hasAllPermissions,
            permissionState.hasAnyPermission,
            permissionState.getFieldAccess,
          ),
          column,
        }))
        .filter(({ access, column }) => isColumnVisible(column, access)),
    [columns, permissionState],
  );
  const visibleColumnCount = columnsWithAccess.length;
  const virtualWindow = useMemo(() => {
    return resolveDataTableVirtualWindow({
      data,
      enabled: shouldVirtualize,
      overscan: virtualOverscan,
      rowHeight: virtualRowHeight,
      scrollTop,
      viewportHeight,
    });
  }, [data, scrollTop, shouldVirtualize, viewportHeight, virtualOverscan, virtualRowHeight]);
  const setTableWrapperRef = useCallback((node: HTMLDivElement | null) => {
    tableWrapperRef.current = node;
    if (node) {
      setViewportHeight(node.clientHeight);
    }
  }, []);
  const flushPendingScrollPosition = useCallback(() => {
    scrollFrameRef.current = null;
    setScrollTop(pendingScrollPositionRef.current.scrollTop);
    setViewportHeight(pendingScrollPositionRef.current.viewportHeight);
  }, []);
  const handleTableScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      pendingScrollPositionRef.current = {
        scrollTop: event.currentTarget.scrollTop,
        viewportHeight: event.currentTarget.clientHeight,
      };

      if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
        flushPendingScrollPosition();
        return;
      }

      if (scrollFrameRef.current === null) {
        scrollFrameRef.current = window.requestAnimationFrame(flushPendingScrollPosition);
      }
    },
    [flushPendingScrollPosition],
  );
  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);
  const tableWrapperStyle = tableMaxHeight ? { maxHeight: tableMaxHeight } : undefined;

  useEffect(() => {
    const node = tableWrapperRef.current;
    if (!node) {
      return undefined;
    }

    setViewportHeight(node.clientHeight);
    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      setViewportHeight(node.clientHeight);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const headerRow = useMemo(
    () => (
      <Table.Thead className={styles.stickyHead}>
        <Table.Tr>
          {columnsWithAccess.map(({ column: col }) => (
            <Table.Th key={col.key}>
              {col.icon ? (
                <span className={styles.columnHeader}>
                  <span className={styles.columnIcon}>{col.icon}</span>
                  {col.label}
                </span>
              ) : (
                col.label
              )}
            </Table.Th>
          ))}
        </Table.Tr>
      </Table.Thead>
    ),
    [columnsWithAccess],
  );

  const headerToolbar = useMemo(
    () =>
      toolbar || tableActions ? (
        <>
          <Box px="md" py="sm" className={styles.toolbar}>
            <Group justify="space-between" align="center" gap="sm" wrap="wrap">
              {toolbar && <Box className={styles.toolbarContent}>{toolbar}</Box>}
              {tableActions && (
                <Group gap="xs" className={styles.tableActions}>
                  {tableActions}
                </Group>
              )}
            </Group>
          </Box>
          <Divider />
        </>
      ) : null,
    [tableActions, toolbar],
  );

  if (columnsWithAccess.length === 0) {
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
        <Table aria-busy={loading ? "true" : undefined}>
          {headerRow}
          <Table.Tbody>
            {SKELETON_ROW_KEYS.map((key) => (
              <Table.Tr key={key}>
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

  if (data.length === 0 && emptyIcon) {
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
      <div
        className={styles.tableWrapper}
        ref={setTableWrapperRef}
        onScroll={shouldVirtualize ? handleTableScroll : undefined}
        style={tableWrapperStyle}
        data-virtualized={shouldVirtualize ? "true" : undefined}
      >
        <Table aria-rowcount={totalItems}>
          {headerRow}
          <Table.Tbody>
            {spacerRow(virtualWindow.topSpacerHeight, visibleColumnCount, "virtual-top-spacer")}
            {virtualWindow.rows.map((row, visibleIndex) => {
              const rowIndex = virtualWindow.startIndex + visibleIndex;
              const globalRowIndex = (page - 1) * perPage + rowIndex + 1;

              return (
                <Table.Tr
                  key={rowKey(row)}
                  aria-rowindex={globalRowIndex}
                  className={shouldVirtualize ? styles.virtualRow : undefined}
                  data-clickable={onRowClick ? "true" : undefined}
                  style={{
                    height: shouldVirtualize ? virtualRowHeight : undefined,
                    ...rowStyle?.(row),
                    cursor: onRowClick ? "pointer" : undefined,
                  }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columnsWithAccess.map(({ access, column }) => (
                    <Table.Td key={column.key}>{renderCell(row, column, access)}</Table.Td>
                  ))}
                </Table.Tr>
              );
            })}
            {spacerRow(
              virtualWindow.bottomSpacerHeight,
              visibleColumnCount,
              "virtual-bottom-spacer",
            )}
          </Table.Tbody>
        </Table>
      </div>

      {(totalPages ?? 0) > 0 && (
        <>
          <Divider />
          <Group justify="space-between" px="md" py="sm">
            <Text size="xs" c="var(--mb-text-secondary)" className={styles.footerCount}>
              {totalItems > 0
                ? `Showing ${startItem}\u2013${endItem} of ${totalItems.toLocaleString()} items`
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
