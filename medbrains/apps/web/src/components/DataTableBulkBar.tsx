import { Group, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { Button } from "@/components/ui";
import styles from "./data-table.module.scss";

interface DataTableBulkBarProps {
  count: number;
  onClear: () => void;
  actions?: ReactNode;
}

/** Selection action strip — appears above the table when rows are selected. */
export function DataTableBulkBar({ count, onClear, actions }: DataTableBulkBarProps) {
  return (
    <div className={styles.bulkBar}>
      <Group justify="space-between" align="center" px="md" py="xs" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <Text size="sm" fw={600} className={styles.bulkCount}>
            {count.toLocaleString()} selected
          </Text>
          <Button tone="ghost" size="xs" onClick={onClear}>
            Clear
          </Button>
        </Group>
        {actions && (
          <Group gap="xs" wrap="nowrap">
            {actions}
          </Group>
        )}
      </Group>
    </div>
  );
}
