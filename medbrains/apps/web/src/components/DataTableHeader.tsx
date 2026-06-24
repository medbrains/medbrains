import { Table, UnstyledButton } from "@mantine/core";
import { IconArrowDown, IconArrowsSort, IconArrowUp } from "@tabler/icons-react";
import { Checkbox } from "@/components/ui";
import styles from "./data-table.module.scss";
import type { SortDir, SortState } from "./data-table-features";
import type { Column } from "./data-table-types";

function SortIndicator({ active, dir }: { active: boolean; dir?: SortDir }) {
  if (!active) {
    return <IconArrowsSort size={13} className={styles.sortIconIdle} aria-hidden="true" />;
  }
  const Icon = dir === "desc" ? IconArrowDown : IconArrowUp;
  return <Icon size={13} className={styles.sortIconActive} aria-hidden="true" />;
}

interface DataTableHeaderProps<T> {
  columns: Array<{ column: Column<T> }>;
  selectable?: boolean;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  activeSort: SortState | null;
  onSort: (key: string) => void;
}

/** Sticky table head with optional select-all checkbox + sortable headers. */
export function DataTableHeader<T>({
  columns,
  selectable,
  allSelected,
  someSelected,
  onToggleAll,
  activeSort,
  onSort,
}: DataTableHeaderProps<T>) {
  return (
    <Table.Thead className={styles.stickyHead}>
      <Table.Tr>
        {selectable && (
          <Table.Th scope="col" className={styles.selectCell}>
            <Checkbox
              aria-label="Select all rows"
              checked={allSelected}
              indeterminate={someSelected}
              onChange={onToggleAll}
              size="xs"
            />
          </Table.Th>
        )}
        {columns.map(({ column: col }) => {
          const isSorted = activeSort?.key === col.key;
          return (
            <Table.Th
              key={col.key}
              scope="col"
              aria-sort={
                isSorted ? (activeSort?.dir === "asc" ? "ascending" : "descending") : undefined
              }
              data-sortable={col.sortable || undefined}
              className={col.sortable ? styles.sortableHeader : undefined}
            >
              {col.sortable ? (
                // Keyboard-operable sort control (Enter/Space) — a native button,
                // not an onClick on the <th>. aria-sort lives on the <th> above.
                <UnstyledButton
                  className={styles.sortButton}
                  onClick={() => onSort(col.key)}
                  aria-label={
                    typeof col.label === "string" ? `Sort by ${col.label}` : "Sort column"
                  }
                >
                  <span className={styles.columnHeader}>
                    {col.icon && <span className={styles.columnIcon}>{col.icon}</span>}
                    {col.label}
                    <SortIndicator active={!!isSorted} dir={activeSort?.dir} />
                  </span>
                </UnstyledButton>
              ) : (
                <span className={styles.columnHeader}>
                  {col.icon && <span className={styles.columnIcon}>{col.icon}</span>}
                  {col.label}
                </span>
              )}
            </Table.Th>
          );
        })}
      </Table.Tr>
    </Table.Thead>
  );
}
