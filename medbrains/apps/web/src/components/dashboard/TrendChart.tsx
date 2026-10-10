import { AreaChart, BarChart, LineChart } from "@mantine/charts";

export type TrendKind = "line" | "bar" | "area";

interface TrendChartProps {
  data: Record<string, unknown>[];
  /** The category or date column. */
  xKey: string;
  /** The value column. */
  yKey: string;
  /** What the value is, for the axis and the tooltip. */
  yLabel?: string;
  kind?: TrendKind;
  h?: number;
  /** A level to read the line against — "a usual Friday" — drawn dashed. */
  reference?: { value: number; label: string };
  /** The tile's version: no axes or grid, just the shape. */
  bare?: boolean;
}

/**
 * One chart for a dashboard tile, its expanded view and a report page, so a
 * figure reads the same wherever it is shown. Zero-based axes (Carbon data
 * viz rules); the numbers themselves are always offered beside it as text.
 */
export function TrendChart({
  data,
  xKey,
  yKey,
  yLabel,
  kind = "line",
  h = 160,
  reference,
  bare = false,
}: TrendChartProps) {
  const common = {
    h,
    data,
    dataKey: xKey,
    series: [{ name: yKey, label: yLabel ?? yKey.replace(/_/g, " "), color: "primary.6" }],
    withXAxis: !bare,
    withYAxis: !bare,
    gridAxis: bare ? ("none" as const) : ("x" as const),
    yAxisProps: { domain: [0, "auto"] as [number, string] },
    referenceLines: reference
      ? [{ y: reference.value, label: reference.label, color: "gray.6", strokeDasharray: "4 4" }]
      : undefined,
  };
  if (kind === "bar") return <BarChart {...common} />;
  if (kind === "area") return <AreaChart {...common} curveType="linear" connectNulls />;
  return <LineChart {...common} curveType="linear" connectNulls />;
}
