import { Group, Loader, Stack } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconCalendar } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { SegmentedControl } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { opdService } from "@/services/opd.service";
import { type DayRange, presetRange, type ReportPreset } from "./reports-range";
import { OpdReportResults } from "./reports-results";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom" },
];

/** OPD reports: visits, registrations, new and repeat patients for a range, inside the OPD app. */
export default function OpdReportsPage() {
  useRequirePermission(P.OPD.REPORTS_VIEW);
  const canView = useHasPermission(P.OPD.REPORTS_VIEW);
  const [preset, setPreset] = useState<ReportPreset>("today");
  const [custom, setCustom] = useState<[string | null, string | null]>([null, null]);

  const range = useMemo<DayRange | null>(() => {
    if (preset !== "custom") return presetRange(preset, new Date());
    const [from, to] = custom;
    return from && to ? { from, to } : null;
  }, [preset, custom]);

  const report = useQuery({
    queryKey: ["opd-report-summary", range?.from, range?.to],
    queryFn: () => opdService.opdReportSummary(range?.from ?? "", range?.to ?? ""),
    enabled: canView && range !== null,
  });

  return (
    <Stack gap="lg">
      <PageHeader title="OPD reports" subtitle="Counts only. No patient details are shown." />
      <Group align="flex-end">
        <SegmentedControl
          aria-label="Date range"
          data={PRESETS}
          value={preset}
          onChange={(v) => setPreset(v as ReportPreset)}
        />
        {preset === "custom" && (
          <DatePickerInput
            type="range"
            label="From – to"
            placeholder="Pick the first and last day"
            value={custom}
            onChange={(v) => setCustom(v as [string | null, string | null])}
            maxDate={new Date()}
            leftSection={<IconCalendar size={16} />}
            w={280}
          />
        )}
      </Group>

      {report.isError ? (
        <QueryError
          error={report.error}
          title="Couldn't load OPD reports"
          onRetry={() => void report.refetch()}
        />
      ) : report.data && range ? (
        <OpdReportResults summary={report.data.data} range={range} />
      ) : (
        range && <Loader aria-label="Loading OPD reports" />
      )}
    </Stack>
  );
}
