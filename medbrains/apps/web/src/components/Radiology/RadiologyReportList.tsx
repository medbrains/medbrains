import { Card, Group, Loader, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { PatientRadiologyReport } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle, IconCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, toast } from "@/components/ui";
import { patientDetailService } from "@/services/patientDetail.service";

function ReportCard({
  report,
  canVerify,
  onAcknowledge,
  isAcknowledging,
}: {
  report: PatientRadiologyReport;
  canVerify: boolean;
  onAcknowledge: (alertId: string) => void;
  isAcknowledging: boolean;
}) {
  const alertId = report.alert_id;
  return (
    <Card withBorder p="sm">
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs">
          <Text size="sm" fw={600}>
            {report.modality ?? "Imaging report"}
          </Text>
          {report.is_critical && (
            <Badge tone="danger" leftSection={<IconAlertTriangle size={12} />}>
              Critical
            </Badge>
          )}
          <Badge
            tone={report.verified_at ? "success" : "neutral"}
            size="sm"
            leftSection={report.verified_at ? <IconCheck size={12} /> : undefined}
          >
            {report.verified_at ? "Verified" : `Report ${report.status}`}
          </Badge>
          {report.is_critical &&
            alertId &&
            (report.alert_acknowledged_at || !canVerify ? (
              <Badge tone={report.alert_acknowledged_at ? "success" : "warning"} size="sm">
                {report.alert_acknowledged_at ? "Acknowledged" : "Unacknowledged"}
              </Badge>
            ) : (
              <Button
                size="xs"
                tone="danger"
                loading={isAcknowledging}
                onClick={() => onAcknowledge(alertId)}
              >
                Acknowledge
              </Button>
            ))}
        </Group>
        <Text size="xs" c="dimmed">
          {new Date(report.ordered_at).toLocaleDateString()}
        </Text>
      </Group>
      <Text size="sm" mt={6} style={{ whiteSpace: "pre-wrap" }}>
        {report.findings}
      </Text>
      {report.impression && (
        <Text size="sm" mt={6}>
          <Text span fw={600}>
            Impression:{" "}
          </Text>
          {report.impression}
        </Text>
      )}
    </Card>
  );
}

/**
 * Every radiology report on a patient — findings, impression, critical flag —
 * including orders placed directly at the radiology desk with no visit.
 * Shared by the patient Imaging tab and the OPD Investigations tab.
 */
export function RadiologyReportList({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  // The server answers `radiology.orders.list`; without it the query is not
  // issued, and the screen says so instead of rendering "no reports".
  const canList = useHasPermission(P.RADIOLOGY.ORDERS_LIST);
  const canVerify = useHasPermission(P.RADIOLOGY.REPORTS_VERIFY);
  const {
    data: reports = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["patient-radiology-reports", patientId],
    queryFn: () => patientDetailService.listRadiologyReports(patientId),
    enabled: canList,
  });
  const acknowledge = useMutation({
    mutationFn: (alertId: string) =>
      patientDetailService.acknowledgeRadiologyCriticalAlert(alertId),
    onSuccess: () => {
      toast.success("Critical finding acknowledged.", { title: "Acknowledged" });
      void queryClient.invalidateQueries({ queryKey: ["patient-radiology-reports", patientId] });
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not acknowledge" }),
  });

  if (!canList) {
    return (
      <Text size="sm" c="dimmed">
        You do not have permission to see this patient's radiology reports. This is not the same as
        having none.
      </Text>
    );
  }
  if (isLoading) return <Loader size="sm" />;
  if (isError) {
    return (
      <Alert tone="danger" title="Radiology reports could not be loaded">
        This does not mean the patient has none. Try again in a moment.
      </Alert>
    );
  }
  if (reports.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No radiology reports yet.
      </Text>
    );
  }

  return (
    <Stack gap="xs">
      {reports.map((report) => (
        <ReportCard
          key={report.report_id}
          report={report}
          canVerify={canVerify}
          onAcknowledge={acknowledge.mutate}
          isAcknowledging={acknowledge.isPending}
        />
      ))}
    </Stack>
  );
}
