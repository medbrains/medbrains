/**
 * A DataTable column holding the row's print menu, for tables whose file has
 * no room left to spell the column out.
 */
import type { Column } from "@/components/DataTable";
import type { PrintDocumentIdKind } from "@/lib/print/print-registry";
import { PrintDocumentIconMenu } from "./PrintDocumentIconMenu";

export function printColumn<T extends { id: string }>(
  idKind: PrintDocumentIdKind,
  options: { label?: (row: T) => string | undefined; when?: (row: T) => boolean } = {},
): Column<T> {
  return {
    key: "print",
    label: "",
    render: (row) =>
      options.when && !options.when(row) ? null : (
        <PrintDocumentIconMenu
          idKind={idKind}
          recordId={row.id}
          recordLabel={options.label?.(row)}
        />
      ),
  };
}
