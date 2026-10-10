import { Group } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { SegmentedControl } from "@/components/ui";
import { KPI_BASELINES, type KpiBaseline } from "./kpi-reading";

interface KpiPeriodControlsProps {
  /** YYYY-MM-DD, or null for today. */
  asOf: string | null;
  onAsOfChange: (value: string | null) => void;
  compare: KpiBaseline;
  onCompareChange: (value: KpiBaseline) => void;
}

/** The day management KPIs are read for, and what each is set against. */
export function KpiPeriodControls({
  asOf,
  onAsOfChange,
  compare,
  onCompareChange,
}: KpiPeriodControlsProps) {
  return (
    <Group gap="sm" align="flex-end">
      <DateInput
        label="As of"
        // Only the KPI tiles are dated; the rest of the dashboard is live.
        description="For the KPI tiles"
        placeholder="Today"
        value={asOf}
        onChange={onAsOfChange}
        maxDate={new Date()}
        valueFormat="D MMM YYYY"
        clearable
        size="sm"
        w={160}
      />
      <SegmentedControl
        aria-label="Compare with"
        value={compare}
        onChange={(v) => onCompareChange(v as KpiBaseline)}
        data={KPI_BASELINES}
      />
    </Group>
  );
}
