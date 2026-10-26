/**
 * The patient's recorded radiation so far, shown wherever more ionising
 * imaging is being decided: on a new imaging order and in the chart.
 *
 * The figure is an ESTIMATED effective dose from CT, converted per exam by
 * body region and age, with the method shown beside it. Exams that could not
 * be estimated are named, never counted as zero, and fluoroscopy dose-area
 * product is shown unconverted. A failed load says so.
 */
import { Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { CumulativeDoseResult } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { QueryError } from "@/components/QueryError";
import { Alert } from "@/components/ui";
import { radiologyService } from "@/services/radiology.service";

interface CumulativeDoseNoticeProps {
  patientId: string;
}

const exams = (n: number) => `${n} CT exam${n === 1 ? "" : "s"}`;

function headline(d: CumulativeDoseResult) {
  return `Estimated effective dose ≈ ${d.estimated_effective_msv.toFixed(1)} mSv from ${exams(d.estimated_exam_count)}`;
}

/** What the estimate leaves out, each as its own line. */
function caveats(d: CumulativeDoseResult): string[] {
  const lines: string[] = [];
  if (d.not_estimated_region_unknown > 0)
    lines.push(
      `${exams(d.not_estimated_region_unknown)} not estimated: body region not recognised.`,
    );
  if (d.not_estimated_age_unknown > 0)
    lines.push(`${exams(d.not_estimated_age_unknown)} not estimated: date of birth not on record.`);
  if (d.dap_exam_count > 0)
    lines.push(
      `Fluoroscopy / radiographs: dose-area product ${d.dap_total_gy_cm2.toFixed(2)} Gy·cm² over ${d.dap_exam_count} exam${d.dap_exam_count === 1 ? "" : "s"} (not converted).`,
    );
  lines.push(`Total CT DLP ${Math.round(d.cumulative_dlp)} mGy·cm.`);
  return lines;
}

function Details({ d }: { d: CumulativeDoseResult }) {
  return (
    <Stack gap={2}>
      {caveats(d).map((line) => (
        <Text key={line} size="sm">
          {line}
        </Text>
      ))}
      <Text size="xs" c="dimmed">
        {d.method}
      </Text>
    </Stack>
  );
}

export function CumulativeDoseNotice({ patientId }: CumulativeDoseNoticeProps) {
  const canView = useHasPermission(P.RADIOLOGY.ORDERS_VIEW);
  const dose = useQuery({
    queryKey: ["cumulative-dose", patientId],
    queryFn: () => radiologyService.cumulativeDose(patientId),
    enabled: canView && !!patientId,
  });
  if (!canView || !patientId) return null;
  if (dose.isError)
    return (
      <QueryError
        title="Cumulative radiation dose didn't load"
        error={dose.error}
        onRetry={() => void dose.refetch()}
      />
    );
  const d = dose.data;
  if (!d || (d.ct_exam_count === 0 && d.dap_exam_count === 0)) return null;
  if (!d.near_threshold)
    return (
      <Stack gap={4}>
        <Text size="sm" fw={600}>
          {headline(d)}
        </Text>
        <Details d={d} />
      </Stack>
    );
  return (
    <Alert tone={d.over_threshold ? "danger" : "warning"} title={headline(d)}>
      <Stack gap={4}>
        <Text size="sm">
          {d.over_threshold
            ? `This has reached the ${d.review_threshold_msv} mSv review level — justify further imaging and consider a non-ionising alternative (US/MRI).`
            : "Approaching the cumulative-dose review level — justify further ionising imaging and consider alternatives."}
        </Text>
        <Details d={d} />
      </Stack>
    </Alert>
  );
}
