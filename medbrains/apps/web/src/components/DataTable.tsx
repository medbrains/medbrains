import { Box, Card, Divider, Group, Pagination, Skeleton, Table, Text } from "@mantine/core";
import type { CSSProperties, ReactNode } from "react";
import styles from "./data-table.module.scss";
import { EmptyState } from "./EmptyState";

const SKELETON_ROW_KEYS = ["skeleton-a", "skeleton-b", "skeleton-c", "skeleton-d", "skeleton-e"];

export interface Column<T> {
  key: string;
  label: string;
  icon?: ReactNode;
  render: (row: T) => ReactNode;
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
}: DataTableProps<T>) {
  const startItem = (page - 1) * perPage + 1;
  const endItem = Math.min(page * perPage, total ?? data.length);
  const totalItems = total ?? data.length;

  const headerRow = (
    <Table.Thead className={styles.stickyHead}>
      <Table.Tr>
        {columns.map((col) => (
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
  );

  const headerToolbar =
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
    ) : null;

  if (loading) {
    return (
      <Card padding={0} className={styles.card}>
        {headerToolbar}
        <Table>
          {headerRow}
          <Table.Tbody>
            {SKELETON_ROW_KEYS.map((key) => (
              <Table.Tr key={key}>
                {columns.map((col) => (
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
      <div className={styles.tableWrapper}>
        <Table>
          {headerRow}
          <Table.Tbody>
            {data.map((row) => (
              <Table.Tr
                key={rowKey(row)}
                style={{
                  ...rowStyle?.(row),
                  cursor: onRowClick ? "pointer" : undefined,
                }}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <Table.Td key={col.key}>{col.render(row)}</Table.Td>
                ))}
              </Table.Tr>
            ))}
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
