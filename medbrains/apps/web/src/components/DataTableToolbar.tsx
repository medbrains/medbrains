import { Box, Divider, Group } from "@mantine/core";
import { IconSearch, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Button, Input, Select } from "@/components/ui";
import styles from "./data-table.module.scss";
import type { DataTableFilter } from "./data-table-types";

interface DataTableToolbarProps<T> {
  toolbar?: ReactNode;
  /** Right-aligned actions (table actions + export/columns built-ins). */
  actions?: ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  query: string;
  onQueryChange: (value: string) => void;
  filters?: DataTableFilter<T>[];
  filterValues: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  activeFilterCount: number;
  onClearFilters: () => void;
}

/** The table toolbar: search + extensible filters + a free slot on the left,
 *  actions on the right. Renders nothing if there is nothing to show. */
export function DataTableToolbar<T>({
  toolbar,
  actions,
  searchable,
  searchPlaceholder,
  query,
  onQueryChange,
  filters,
  filterValues,
  onFilterChange,
  activeFilterCount,
  onClearFilters,
}: DataTableToolbarProps<T>) {
  const hasFilterUi = Boolean(searchable) || (filters?.length ?? 0) > 0;
  if (!toolbar && !actions && !hasFilterUi) {
    return null;
  }

  return (
    <>
      <Box px="md" py="sm" className={styles.toolbar}>
        <Group justify="space-between" align="center" gap="sm" wrap="wrap">
          <Group gap="xs" align="center" wrap="wrap" className={styles.toolbarContent}>
            {searchable && (
              <Input
                value={query}
                onChange={(event) => onQueryChange(event.currentTarget.value)}
                placeholder={searchPlaceholder ?? "Search"}
                leftSection={<IconSearch size={14} />}
                size="xs"
                w={210}
                aria-label="Search table"
              />
            )}
            {filters?.map((filter) =>
              filter.render ? (
                <span key={filter.key}>
                  {filter.render(filterValues[filter.key] ?? "", (value) =>
                    onFilterChange(filter.key, value),
                  )}
                </span>
              ) : (
                <Select
                  key={filter.key}
                  data={filter.options ?? []}
                  value={filterValues[filter.key] || null}
                  onChange={(value) => onFilterChange(filter.key, value ?? "")}
                  placeholder={filter.placeholder ?? filter.label}
                  aria-label={filter.label}
                  clearable
                  size="xs"
                  w={170}
                />
              ),
            )}
            {activeFilterCount > 0 && (
              <Button
                tone="ghost"
                size="xs"
                leftSection={<IconX size={13} />}
                onClick={onClearFilters}
              >
                Clear
              </Button>
            )}
            {toolbar}
          </Group>
          {actions && (
            <Group gap="xs" className={styles.tableActions}>
              {actions}
            </Group>
          )}
        </Group>
      </Box>
      <Divider />
    </>
  );
}
