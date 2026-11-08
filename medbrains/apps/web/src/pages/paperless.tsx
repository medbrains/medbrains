/**
 * Analytics → Paperless meter. How paperless the hospital is, measured: the
 * share of clinical documents made in the system, signed digitally, and
 * legally signed, by department and day, and the paper still in use.
 *
 * A failed read is "unknown" with a retry, never 0%; a range never counted
 * says so; the legally-signed share is shown at 0% with its reason.
 */
import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconRefresh } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components";
import { Alert, Button, SegmentedControl, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { formatDateTime } from "@/lib/date-utils";
import { DepartmentsCard } from "./paperless/departments-card";
import { Headline } from "./paperless/headline";
import { RANGE_OPTIONS } from "./paperless/labels";
import { PaperCard } from "./paperless/paper-card";
import { TrendCard } from "./paperless/trend-card";

/** The paperless meter screen: shares, trend, departments and paper, for `analytics.paperless.view`. */
export function PaperlessPage() {
  useRequirePermission(P.ANALYTICS.PAPERLESS.VIEW);
  const canView = useHasPermission(P.ANALYTICS.PAPERLESS.VIEW);
  const canRefresh = useHasPermission(P.ANALYTICS.PAPERLESS.REFRESH);
  const [days, setDays] = useState("30");
  const queryClient = useQueryClient();
  const meter = useQuery({
    queryKey: ["paperless", days],
    queryFn: () => api.getPaperless({ days: Number(days) }),
    enabled: canView,
  });
  const recount = useMutation({
    mutationFn: () => api.refreshPaperless(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["paperless"] });
      toast.success("The last 7 days were recounted");
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const data = meter.data;

  return (
    <Stack gap="md">
      <PageHeader
        title="Paperless meter"
        subtitle="Clinical documents made and signed in the system, and the paper still in use"
        actions={
          canRefresh ? (
            <Button
              tone="secondary"
              leftSection={<IconRefresh size={16} />}
              loading={recount.isPending}
              onClick={() => recount.mutate()}
            >
              Recount last 7 days
            </Button>
          ) : undefined
        }
      />
      <Group justify="space-between">
        <SegmentedControl
          aria-label="Days shown"
          value={days}
          onChange={setDays}
          data={RANGE_OPTIONS}
        />
        {data && (
          <Text size="xs" c="dimmed" data-testid="paperless-counted">
            {data.last_counted_at
              ? `${data.measured_days} of ${data.days} days counted, last at ${formatDateTime(data.last_counted_at)}`
              : "No day in this range has been counted yet"}
          </Text>
        )}
      </Group>
      {meter.isLoading && (
        <Text size="sm" c="dimmed" data-testid="paperless-loading">
          Loading the paperless meter…
        </Text>
      )}
      {meter.isError && (
        <Alert
          tone="danger"
          title="The paperless meter is unavailable"
          data-testid="paperless-error"
        >
          <Group justify="space-between" align="center">
            <Text size="sm">
              The server did not answer, so these shares are unknown. This does not mean 0%.
            </Text>
            <Button tone="secondary" onClick={() => void meter.refetch()}>
              Try again
            </Button>
          </Group>
        </Alert>
      )}
      {data && (
        <>
          <Text data-testid="paperless-summary">{data.summary}</Text>
          <Headline report={data} />
          <TrendCard series={data.series} />
          <DepartmentsCard departments={data.departments} />
          <PaperCard report={data} />
        </>
      )}
    </Stack>
  );
}
