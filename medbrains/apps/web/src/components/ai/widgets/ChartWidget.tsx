import { Stack, Text } from "@mantine/core";
import { TrendChart } from "@/components/dashboard/TrendChart";
import type { AiWidget } from "../transport/types";
import { formatValue } from "./format";
import { TableWidget } from "./TableWidget";

type ChartData = Extract<AiWidget, { kind: "chart" }>;

/**
 * The dashboard's TrendChart (zero-based), one per series, with the numbers
 * as a table beside it — never chart-only.
 */
export function ChartWidget({ widget, full = false }: { widget: ChartData; full?: boolean }) {
  const data = widget.rows.map((r) => ({
    ...r,
    ...Object.fromEntries(widget.series.map((s) => [s.key, Number(r[s.key])])),
  }));
  return (
    <Stack gap="xs">
      {widget.series.map((s) => (
        <TrendChart
          key={s.key}
          data={data}
          xKey={widget.x.key}
          yKey={s.key}
          yLabel={s.label}
          money={s.money}
          kind="bar"
          h={full ? 420 : 200}
        />
      ))}
      {widget.peaks?.map((p) => {
        const s = widget.series.find((c) => c.key === p.series);
        return (
          <Text key={p.series} size="sm" data-testid="chart-peaks">
            {s?.label}: highest {formatValue(p.high, s?.money)} on {formatValue(p.high_x)}; lowest{" "}
            {formatValue(p.low, s?.money)} on {formatValue(p.low_x)}.
          </Text>
        );
      })}
      {full && (
        <TableWidget
          full
          widget={{
            kind: "table",
            title: widget.title,
            columns: [widget.x, ...widget.series],
            rows: widget.rows,
            total_rows: widget.rows.length,
          }}
        />
      )}
    </Stack>
  );
}
