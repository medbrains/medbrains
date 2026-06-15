import { Table as MantineTable, type TableProps } from "@mantine/core";
import styles from "./table.module.scss";

/**
 * Standard ad-hoc table — tinted console header, hairline rows, hover
 * highlight, dense spacing, no vertical column borders (per the layout
 * rules). Keeps Mantine's compound API unchanged: <Table.Thead>,
 * <Table.Tr>, <Table.Th>, etc.
 *
 * For data grids with columns/loading/empty states, use the higher-level
 * `DataTable` component instead — this is for bespoke layouts.
 */
function TableRoot({
  className,
  highlightOnHover = true,
  verticalSpacing = "sm",
  horizontalSpacing = "md",
  ...rest
}: TableProps) {
  return (
    <MantineTable
      className={className ? `${styles.table} ${className}` : styles.table}
      highlightOnHover={highlightOnHover}
      verticalSpacing={verticalSpacing}
      horizontalSpacing={horizontalSpacing}
      {...rest}
    />
  );
}

export const Table = Object.assign(TableRoot, {
  Thead: MantineTable.Thead,
  Tbody: MantineTable.Tbody,
  Tfoot: MantineTable.Tfoot,
  Tr: MantineTable.Tr,
  Th: MantineTable.Th,
  Td: MantineTable.Td,
  Caption: MantineTable.Caption,
  ScrollContainer: MantineTable.ScrollContainer,
  DataRenderer: MantineTable.DataRenderer,
});
