// PATIENT ImagingTab — split from patient-detail.tsx (pure move).

import { Group, Loader, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { RadiologyDicomStudy } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconEye } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { RadiologyReportList } from "@/components/Radiology/RadiologyReportList";
import { Badge, Button, Table } from "@/components/ui";
import { patientDetailService } from "@/services/patientDetail.service";

export function ImagingTab({ patientId }: { patientId: string }) {
  // Prior DICOM studies are `radiology.orders.list`. An empty study list on an
  // imaging tab reads as "this patient has had no imaging", so it is gated.
  const canListRadiologyOrders = useHasPermission(P.RADIOLOGY.ORDERS_LIST);
  const { data: studies = [], isLoading } = useQuery({
    queryKey: ["patient-dicom-studies", patientId],
    queryFn: () => patientDetailService.getPriorRadiologyDicomStudies(patientId),
    enabled: canListRadiologyOrders,
  });

  if (isLoading) return <Loader size="sm" />;

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Text fw={600} size="sm">
          Reports
        </Text>
        <RadiologyReportList patientId={patientId} />
      </Stack>
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
