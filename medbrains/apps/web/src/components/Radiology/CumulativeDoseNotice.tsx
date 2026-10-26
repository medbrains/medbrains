/**
 * The patient's recorded CT dose so far, shown wherever more ionising imaging
 * is being decided: on a new imaging order and in the chart. Quiet when there
 * is little, a warning approaching the review level, and a danger past it.
 * A failed load says so — "no dose on record" must never be a guess.
 */
import { Text } from "@mantine/core";
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

const plural = (n: number) => `${n} CT stud${n === 1 ? "y" : "ies"}`;

function title(dose: CumulativeDoseResult) {
  return `Cumulative radiation ≈ ${Math.round(dose.estimated_effective_msv)} mSv over ${plural(dose.study_count)}`;
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
  if (!d || d.study_count === 0) return null;
  if (!d.near_threshold)
    return (
      <Text size="sm" c="dimmed">
        Recorded CT dose: ≈ {d.estimated_effective_msv.toFixed(1)} mSv over {plural(d.study_count)}{" "}
        (DLP {Math.round(d.cumulative_dlp)} mGy·cm).
      </Text>
    );
  return (
    <Alert tone={d.over_threshold ? "danger" : "warning"} title={title(d)}>
      {d.over_threshold
        ? `Estimated cumulative effective dose has reached the ${d.review_threshold_msv} mSv review level — justify further imaging and consider a non-ionising alternative (US/MRI).`
        : "Approaching the cumulative-dose review level — justify further ionising imaging and consider alternatives."}
    </Alert>
  );
}
