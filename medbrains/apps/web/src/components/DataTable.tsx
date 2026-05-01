import { Box, Card, Divider, Group, Pagination, Skeleton, Table, Text } from "@mantine/core";
import type { CSSProperties, ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import styles from "./data-table.module.scss";

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

  if (loading) {
    return (
      <Card padding={0}>
        {toolbar && (
          <>
            <Box px="md" py="sm">
              {toolbar}
            </Box>
            <Divider />
          </>
        )}
        <Table>
          {headerRow}
          <Table.Tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <Table.Tr key={`skeleton-${i}`}>
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
      <Card padding={0}>
        {toolbar && (
          <>
            <Box px="md" py="sm">
              {toolbar}
            </Box>
            <Divider />
          </>
        )}
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
    <Card padding={0}>
      {toolbar && (
        <>
          <Box px="md" py="sm">
            {toolbar}
          </Box>
          <Divider />
        </>
      )}
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
                : "0 items"
              }
            </Text>
            {totalPages && totalPages > 1 && onPageChange && (
              <Pagination
                total={totalPages}
                value={page}
                onChange={onPageChange}
                size="sm"
              />
            )}
          </Group>
        </>
      )}
    </Card>
  );
}
