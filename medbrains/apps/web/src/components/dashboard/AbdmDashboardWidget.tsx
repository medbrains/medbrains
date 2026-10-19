import { Group, Loader, Progress, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { Badge, Button } from "@/components/ui";
import { formatPercent, monthOptions, percentOf, thresholdProgress } from "@/lib/abdm-dashboard";
import { abdmRecordsService } from "@/services/abdmRecords.service";

/** Dashboard tile: this month's ABHA reach, DHIS threshold and failed links. */
export function AbdmDashboardWidget() {
  const canView = useHasPermission(P.ABDM.DASHBOARD.VIEW);
  const navigate = useNavigate();
  const month = useMemo(() => monthOptions(new Date(), 1)[0]?.value ?? "", []);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["abdm", "dashboard", month],
    queryFn: () => abdmRecordsService.dashboard(month),
    enabled: canView,
  });

  if (!canView) {
    return (
      <Text size="sm" c="dimmed">
        You do not have access to the ABDM dashboard.
      </Text>
    );
  }
  if (isLoading) return <Loader size="sm" />;
  // An outage must not read as a month of zeros.
  if (isError || !data) {
    return (
      <Text size="sm" c="dimmed">
        ABDM figures could not be loaded just now.
      </Text>
    );
  }
  const m = data.current;
  const e = m.estimate;
  return (
    <Stack gap="xs">
      <Text size="sm">
        OPD visits with a verified ABHA:{" "}
        <Text span fw={600}>
          {formatPercent(percentOf(m.opd_with_abha, m.opd_visits))}
        </Text>
      </Text>
      <Group justify="space-between">
        <Text size="sm">
          Counted for DHIS: {e.eligible_links} of {e.threshold}
        </Text>
        <Badge tone={e.threshold_met ? "success" : "warning"}>
          {e.threshold_met ? "Threshold passed" : "Below threshold"}
        </Badge>
      </Group>
      <Progress
        value={thresholdProgress(e.eligible_links, e.threshold)}
        aria-label={`${e.eligible_links} of ${e.threshold} records counted for DHIS`}
      />
      <Text size="sm">Failed links open: {data.failures_open}</Text>
      <Button tone="secondary" size="xs" onClick={() => navigate("/abdm/dashboard")}>
        Open the ABDM dashboard
      </Button>
    </Stack>
  );
}
