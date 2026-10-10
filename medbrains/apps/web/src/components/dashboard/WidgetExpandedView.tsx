import { Stack, Table, Text, TextInput } from "@mantine/core";
import type { DashboardWidget } from "@medbrains/types";
import { useMemo, useState } from "react";
import {
  compareKpi,
  formatKpi,
  isKpiReading,
  type KpiBaseline,
  type KpiReading,
} from "./kpi-reading";
import { SeriesMetrics } from "./SeriesMetrics";
import { columnValues } from "./series-stats";
import { TrendChart, type TrendKind } from "./TrendChart";
import { cellText, field, formatValue, rows } from "./widget-data";

interface Props {
  widget: DashboardWidget;
  data: unknown;
  compare: KpiBaseline;
}

const BASELINE_LABEL: Record<KpiBaseline, string> = {
  weekday: "Usual for this weekday",
  yesterday: "Yesterday",
  week: "Last 7 days",
};

/** A widget at full size: its figure, its trend and the numbers behind them. */
export function WidgetExpandedView({ widget, data, compare }: Props) {
  if (widget.widget_type === "stat_card" && isKpiReading(data)) {
    return <KpiDetail reading={data} compare={compare} />;
  }
  if (widget.widget_type === "stat_card") {
    return (
      <Stack gap="xs">
        <Text fz={40} fw={600}>
          {formatValue(field(data, "value"), String(field(widget.config, "format") ?? ""))}
        </Text>
        <Text size="sm" c="dimmed">
          This figure is a live count; it has no recorded history to chart yet.
        </Text>
      </Stack>
    );
  }
  if (widget.widget_type === "chart") {
    const x = String(field(widget.config, "x_axis") ?? "date");
    const y = String(field(widget.config, "y_axis") ?? "value");
    const kind = String(field(widget.config, "chart_type") ?? "bar") as TrendKind;
    const series = rows(data);
    const format = String(field(widget.config, "format") ?? "");
    return (
      <Stack gap="lg">
        <SeriesMetrics
          values={columnValues(series, y)}
          format={format ? (n) => formatValue(n, format) : undefined}
        />
        <TrendChart data={series} xKey={x} yKey={y} kind={kind} h={340} />
        <RowsTable items={series} cols={[x, y]} caption={`${widget.title}, as a table`} />
      </Stack>
    );
  }
  if (widget.widget_type === "data_table" || widget.widget_type === "list") {
    const cols = (field(widget.config, "columns") as string[] | undefined) ?? [];
    const items = rows(data);
    return (
      <RowsTable
        items={items}
        cols={cols.length ? cols : Object.keys(items[0] ?? {}).filter((k) => k !== "id")}
        labels={(field(widget.config, "labels") as Record<string, string> | undefined) ?? {}}
        caption={widget.title}
        searchable
      />
    );
  }
  return (
    <Text size="sm" c="dimmed">
      This widget has no larger view.
    </Text>
  );
}

function KpiDetail({ reading, compare }: { reading: KpiReading; compare: KpiBaseline }) {
  const comparison = compareKpi(reading, compare);
  const usual = reading.baselines[compare];
  const points = reading.series.map((d) => ({ date: d.date, value: d.value }));
  return (
    <Stack gap="lg">
      <Stack gap={2}>
        <Text fz={40} fw={600} lh={1.1}>
          {formatKpi(reading.value, reading.unit)}
        </Text>
        {comparison && <Text fw={500}>{comparison.text}</Text>}
        <Text size="xs" c="dimmed">
          {reading.so_far ? "So far today" : "For the day"}, as of {reading.as_of}
        </Text>
      </Stack>
      <Table withTableBorder>
        <Table.Tbody>
          {(Object.keys(BASELINE_LABEL) as KpiBaseline[]).map((b) => (
            <Table.Tr key={b}>
              <Table.Th>{BASELINE_LABEL[b]}</Table.Th>
              <Table.Td>{formatKpi(reading.baselines[b], reading.unit)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <SeriesMetrics
        values={reading.series.map((d) => d.value)}
        format={(n) => formatKpi(n, reading.unit)}
      />
      <TrendChart
        data={points}
        xKey="date"
        yKey="value"
        yLabel={reading.unit}
        kind="area"
        h={300}
        reference={usual === null ? undefined : { value: usual, label: BASELINE_LABEL[compare] }}
      />
      <RowsTable items={points} cols={["date", "value"]} caption="Daily values" />
    </Stack>
  );
}

interface RowsTableProps {
  items: Record<string, unknown>[];
  cols: string[];
  labels?: Record<string, string>;
  caption: string;
  searchable?: boolean;
}

/** Every row, not the tile's first few; the chart's numbers as text, too. */
function RowsTable({ items, cols, labels = {}, caption, searchable = false }: RowsTableProps) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) => cols.some((c) => cellText(row[c]).toLowerCase().includes(q)));
  }, [items, cols, query]);
  if (items.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Nothing to show.
      </Text>
    );
  }
  return (
    <Stack gap="xs">
      {searchable && (
        <TextInput
          label="Search these rows"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
      )}
      <Table striped highlightOnHover stickyHeader>
        <Table.Caption>
          {caption} — {shown.length} of {items.length}
        </Table.Caption>
        <Table.Thead>
          <Table.Tr>
            {cols.map((c) => (
              <Table.Th key={c}>{labels[c] ?? c.replace(/_/g, " ")}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {shown.map((row, i) => (
            <Table.Tr key={String(row.id ?? i)}>
              {cols.map((c) => (
                <Table.Td key={c}>{cellText(row[c])}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
