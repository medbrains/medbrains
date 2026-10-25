import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui";
import type { AiRow, AiWidget } from "../transport/types";
import { DrillPatients } from "./DrillPatients";
import { formatValue, sortKey } from "./format";

type TableData = Extract<AiWidget, { kind: "table" }>;
type Row = AiRow & { __row: string };

/** Columns shown in the narrow chat panel; the full-screen view shows all. */
const COMPACT_COLUMNS = 4;

/**
 * Rows from the record on the app's own DataTable (sort, search, export).
 * A row about a patient opens that patient's chart.
 */
export function TableWidget({ widget, full = false }: { widget: TableData; full?: boolean }) {
  const navigate = useNavigate();
  const data: Row[] = useMemo(
    () => widget.rows.map((r, i) => ({ ...r, __row: String(i) })),
    [widget.rows],
  );
  const columns = widget.columns.map((c, i) => ({
    key: c.key,
    label: c.label,
    sortable: true,
    sortValue: (row: Row) => sortKey(row[c.key]),
    defaultHidden: !full && i >= COMPACT_COLUMNS,
    hideable: true,
    render: (row: Row) => formatValue(row[c.key], c.money),
  }));
  const canList = useHasPermission(P.PATIENTS.LIST);
  const drill = canList ? widget.drill : undefined;
  const [open, setOpen] = useState<{ value: string; label: string } | null>(null);
  const drillColumn = drill
    ? [
        {
          key: "__patients",
          label: "Patients",
          render: (row: Row) => {
            const value = String(row[drill.key] ?? "");
            return (
              <Button
                tone="tertiary"
                size="compact-xs"
                onClick={() => setOpen({ value: value.toLowerCase(), label: value })}
              >
                View patients
              </Button>
            );
          },
        },
      ]
    : [];
  return (
    <>
      {drill && (
        <DrillPatients
          drill={drill}
          value={open?.value ?? null}
          label={open?.label ?? ""}
          onClose={() => setOpen(null)}
        />
      )}
      <DataTable
        columns={[...columns, ...drillColumn]}
        data={data}
        rowKey={(row) => row.__row}
        density="compact"
        caption={
          widget.total_rows > widget.rows.length
            ? `${widget.title}: showing ${widget.rows.length} of ${widget.total_rows} rows`
            : widget.title
        }
        tableMaxHeight={full ? undefined : 320}
        searchable={full}
        exportable={full}
        exportFileName={full ? widget.title : undefined}
        onRowClick={(row) => {
          if (typeof row.patient_id === "string") navigate(`/patients/${row.patient_id}`);
        }}
      />
    </>
  );
}
