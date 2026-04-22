import { useMemo } from "react";
import { Tooltip } from "@mantine/core";
import { LineChart } from "@mantine/charts";

interface VitalDataPoint {
  timestamp: string;
  value: number;
}

interface VitalSparklineProps {
  data: VitalDataPoint[];
  /** Normal range — values outside are danger-colored */
  normalMin?: number;
  normalMax?: number;
  /** Chart dimensions */
  width?: number;
  height?: number;
  /** Color override (defaults to auto based on latest value vs range) */
  color?: string;
}

function getRangeColor(value: number, min?: number, max?: number): string {
  if (min === undefined || max === undefined) return "var(--mantine-color-primary-5)";
  if (value < min || value > max) return "var(--mantine-color-danger-5)";

  // Check borderline (within 10% of boundary)
  const range = max - min;
  const margin = range * 0.1;
  if (value < min + margin || value > max - margin) return "var(--mantine-color-warning-5)";

  return "var(--mantine-color-success-5)";
}

export function VitalSparkline({
  data,
  normalMin,
  normalMax,
  width = 80,
  height = 32,
  color,
}: VitalSparklineProps) {
  const chartData = useMemo(() => {
    return data.map((d, i) => ({
      index: i,
      value: d.value,
      time: new Date(d.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }));
  }, [data]);

  if (data.length < 2) return null;

  const latest = data[data.length - 1];
  const latestValue = latest?.value ?? 0;
  const lineColor = color ?? getRangeColor(latestValue, normalMin, normalMax);

  // Calculate delta from previous reading
  const prev = data.length >= 2 ? data[data.length - 2] : undefined;
  const prevValue = prev?.value ?? null;
  const delta = prevValue !== null ? latestValue - prevValue : null;
  const deltaStr = delta !== null
    ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`
    : "";

  const tooltipLabel = `Latest: ${latestValue}${deltaStr ? ` (${deltaStr})` : ""}`;

  return (
    <Tooltip label={tooltipLabel} position="top" withArrow>
      <div style={{ width, height, cursor: "default" }}>
        <LineChart
          h={height}
          w={width}
          data={chartData}
          dataKey="index"
          series={[{ name: "value", color: lineColor }]}
          withDots={false}
          withXAxis={false}
          withYAxis={false}
          withTooltip={false}
          gridAxis="none"
          curveType="monotone"
          strokeWidth={1.5}
          referenceLines={[
            ...(normalMin !== undefined
              ? [{ y: normalMin, color: "var(--mb-border)", label: "" }]
              : []),
            ...(normalMax !== undefined
              ? [{ y: normalMax, color: "var(--mb-border)", label: "" }]
              : []),
          ]}
          style={{ overflow: "visible" }}
        />
      </div>
    </Tooltip>
  );
}
