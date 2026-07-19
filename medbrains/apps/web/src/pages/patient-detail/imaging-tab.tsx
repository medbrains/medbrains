// PATIENT ImagingTab — split from patient-detail.tsx (pure move).

import { Card, Group, Loader, Stack, Text } from "@mantine/core";
import type { RadiologyDicomStudy } from "@medbrains/types";
import { IconEye } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Table, toast } from "@/components/ui";
import { patientDetailService } from "@/services/patientDetail.service";

export function ImagingTab({ patientId }: { patientId: string }) {
  const imagingQueryClient = useQueryClient();
  const { data: studies = [], isLoading } = useQuery({
    queryKey: ["patient-dicom-studies", patientId],
    queryFn: () => patientDetailService.getPriorRadiologyDicomStudies(patientId),
  });
  const { data: reports = [] } = useQuery({
    queryKey: ["patient-radiology-reports", patientId],
    queryFn: () => patientDetailService.listRadiologyReports(patientId),
  });
  const acknowledgeAlert = useMutation({
    mutationFn: (alertId: string) =>
      patientDetailService.acknowledgeRadiologyCriticalAlert(alertId),
    onSuccess: () => {
      toast.success("Critical finding acknowledged.", { title: "Acknowledged" });
      void imagingQueryClient.invalidateQueries({
        queryKey: ["patient-radiology-reports", patientId],
      });
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not acknowledge" }),
  });

  if (isLoading) return <Loader size="sm" />;

  if (studies.length === 0 && reports.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No imaging studies or reports found.
      </Text>
    );
  }

  return (
    <Stack gap="lg">
      {reports.length > 0 && (
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Reports
          </Text>
          {reports.map((report) => (
            <Card key={report.report_id} withBorder p="sm">
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs">
                  <Text size="sm" fw={600}>
                    {report.modality ?? "Imaging report"}
                  </Text>
                  {report.is_critical && <Badge tone="danger">Critical</Badge>}
                  <Badge tone={report.verified_at ? "success" : "neutral"} size="sm">
                    {report.verified_at ? "Verified" : report.status}
                  </Badge>
                  {report.is_critical &&
                    report.alert_id &&
                    (report.alert_acknowledged_at ? (
                      <Badge tone="success" size="sm">
                        Acknowledged
                      </Badge>
                    ) : (
                      <Button
                        size="xs"
                        tone="danger"
                        loading={acknowledgeAlert.isPending}
                        onClick={() => report.alert_id && acknowledgeAlert.mutate(report.alert_id)}
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
          ))}
        </Stack>
      )}
      {studies.length > 0 && (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Study</Table.Th>
              <Table.Th>Modality</Table.Th>
              <Table.Th>Instances</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Viewer</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {studies.map((study: RadiologyDicomStudy) => (
              <Table.Tr key={study.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {study.study_description ?? "DICOM Study"}
                  </Text>
                  <Text size="xs" c="dimmed" ff="monospace">
                    {study.study_instance_uid}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm">{study.modality}</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {study.series_count} series / {study.instance_count} images
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {study.study_date ? new Date(study.study_date).toLocaleDateString() : "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {study.viewer_url || study.pacs_url ? (
                    <Group gap="xs" wrap="nowrap">
                      {study.viewer_url ? (
                        <Button
                          tone="secondary"
                          component="a"
                          href={study.viewer_url}
                          target="_blank"
                          rel="noreferrer"
                          size="xs"
                          leftSection={<IconEye size={14} />}
                        >
                          Viewer
                        </Button>
                      ) : null}
                      {study.pacs_url ? (
                        <Button
                          tone="ghost"
                          component="a"
                          href={study.pacs_url}
                          target="_blank"
                          rel="noreferrer"
                          size="xs"
                        >
                          DICOM
                        </Button>
                      ) : null}
                    </Group>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Not linked
                    </Text>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

// ── Billing Tab ────────────────────────────────────────────
