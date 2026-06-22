import { Group, Stack, Text, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconChevronRight, IconEye } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Card } from "@/components/ui";
import { patientDetailService } from "@/services/patientDetail.service";

const ACCESS_LABEL: Record<string, string> = {
  documents_viewed: "Documents viewed",
  document_downloaded: "Document downloaded",
  chart_viewed: "Chart viewed",
  exported: "Record exported",
};

/**
 * Read-access trail — who has viewed/downloaded this patient's records
 * (DPDP/HIPAA transparency). Collapsed by default to keep the documents view
 * clean.
 */
export function PatientAccessLogSection({ patientId }: { patientId: string }) {
  const [open, { toggle }] = useDisclosure(false);

  const { data: log = [] } = useQuery({
    queryKey: ["patient-access-log", patientId],
    queryFn: () => patientDetailService.listPatientAccessLog(patientId),
    enabled: open,
  });

  return (
    <Card withBorder padding="sm">
      <UnstyledButton onClick={toggle} w="100%">
        <Group justify="space-between">
          <Group gap="xs">
            <IconEye size={16} />
            <Text fw={600} size="sm">
              Record access log
            </Text>
          </Group>
          <IconChevronRight
            size={16}
            style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 150ms" }}
          />
        </Group>
      </UnstyledButton>
      {open && (
        <Stack gap={4} mt="xs">
          {log.length === 0 && (
            <Text size="sm" c="dimmed">
              No record access logged yet.
            </Text>
          )}
          {log.map((entry) => (
            <Group key={entry.id} justify="space-between" wrap="nowrap">
              <Badge tone="info" size="sm">
                {ACCESS_LABEL[entry.access_type] ?? entry.access_type}
              </Badge>
              <Text size="xs" c="dimmed">
                {new Date(entry.accessed_at).toLocaleString()}
              </Text>
            </Group>
          ))}
        </Stack>
      )}
    </Card>
  );
}
