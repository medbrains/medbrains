import { LineChart } from "@mantine/charts";
import { Group, Select, Stack, Text } from "@mantine/core";
import type { VitalHistoryPoint } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { opdService } from "@/services/opd.service";
import { LoadFailed } from "./load-failed";

const WHAT = "Vitals history";

/** Each chartable metric: its picker label and the lines it draws. One table, so they can't drift. */
const METRICS = [
  {
    value: "bp",
    label: "Blood Pressure",
    series: [
      { name: "Systolic", color: "red.6" },
      { name: "Diastolic", color: "blue.6" },
    ],
  },
  { value: "pulse", label: "Pulse", series: [{ name: "Pulse", color: "pink.6" }] },
  { value: "temp", label: "Temperature", series: [{ name: "Temp", color: "orange.6" }] },
  { value: "spo2", label: "SpO2", series: [{ name: "SpO2", color: "teal.6" }] },
  {
    value: "weight",
    label: "Weight & BMI",
    series: [
      { name: "Weight", color: "primary.4" },
      { name: "BMI", color: "violet.6" },
    ],
  },
] as const;
const PICKER = METRICS.map(({ value, label }) => ({ value, label }));

/** One recorded set of vitals as a chart row, keyed by the series names above. */
function toChartRow(p: VitalHistoryPoint) {
  return {
    date: new Date(p.recorded_at).toLocaleDateString(),
    Systolic: p.systolic_bp,
    Diastolic: p.diastolic_bp,
    Pulse: p.pulse,
    Temp: p.temperature ? Number(p.temperature) : null,
    SpO2: p.spo2,
    RR: p.respiratory_rate,
    Weight: p.weight_kg ? Number(p.weight_kg) : null,
    BMI: p.bmi ? Number(p.bmi) : null,
  };
}

/**
 * Trends of the patient's recorded vitals, one metric at a time, so a doctor sees whether blood
 * pressure or weight is moving across visits. A failed read is a fault, never "no vitals".
 */
export function ChartsTab({ patientId }: { patientId: string }) {
  const { data, error, isLoadingError, isRefetchError, refetch } = useQuery({
    queryKey: ["patient-vitals-history", patientId],
    queryFn: () => opdService.listPatientVitalsHistory(patientId),
  });
  const rows = useMemo(() => (data as VitalHistoryPoint[] | undefined)?.map(toChartRow), [data]);
  // Held here, not in VitalsTrend, so the doctor's choice survives a refetch that briefly empties.
  const [metric, setMetric] = useState<string | null>("bp");

  if (isLoadingError) {
    return <LoadFailed what={WHAT} error={error} onRetry={refetch} />;
  }
  // No rows and no error means the first read is still in flight; never a stand-in empty list.
  if (rows === undefined) {
    return (
      <Text size="sm" c="dimmed">
        Loading vitals history...
      </Text>
    );
  }
  return (
    <Stack gap="sm">
      {isRefetchError && <LoadFailed what={WHAT} error={error} onRetry={refetch} stale />}
      {rows.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No vitals history available for trend charts.
        </Text>
      ) : (
        <VitalsTrend rows={rows} metric={metric} onMetric={setMetric} />
      )}
    </Stack>
  );
}

interface VitalsTrendProps {
  rows: ReturnType<typeof toChartRow>[];
  metric: string | null;
  onMetric: (metric: string | null) => void;
}

/** The metric picker and the trend line for the chosen metric. */
function VitalsTrend({ rows, metric, onMetric }: VitalsTrendProps) {
  /** The chosen metric's lines; an unknown or cleared choice falls back to blood pressure. */
  const series = (METRICS.find((m) => m.value === metric) ?? METRICS[0]).series;
  return (
    <>
      <Group>
        <Select value={metric} onChange={onMetric} data={PICKER} w={200} size="sm" />
      </Group>
      <LineChart
        h={300}
        data={rows}
        dataKey="date"
        series={[...series]}
        curveType="monotone"
        connectNulls
        withLegend
        withTooltip
        tooltipAnimationDuration={200}
      />
    </>
  );
}
