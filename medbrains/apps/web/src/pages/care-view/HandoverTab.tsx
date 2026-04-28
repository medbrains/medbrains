import { Badge, Button, Card, Group, Select, Stack, Text } from "@mantine/core";
import { IconClipboardList, IconPrinter } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@medbrains/api";
import { SHIFTS } from "./shared";

export function HandoverTab({ wardId }: { wardId: string | null }) {
  const [shift, setShift] = useState<string | null>(null);
  const [triggered, setTriggered] = useState(false);

  const effectiveWard = wardId ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["care-view", "handover", effectiveWard, shift],
    queryFn: () => api.handoverSummary(effectiveWard, shift ?? "morning"),
    enabled: triggered && !!effectiveWard && !!shift,
  });

  return (
    <Stack gap="md">
      <Group>
        <Select placeholder="Select shift" data={SHIFTS} value={shift} onChange={setShift} w={200} />
        <Button
          leftSection={<IconClipboardList size={16} />}
          disabled={!effectiveWard || !shift}
          loading={isLoading}
          onClick={() => setTriggered(true)}
        >
          Generate Summary
        </Button>
        {data && (
          <Button variant="light" leftSection={<IconPrinter size={16} />} onClick={() => window.print()}>
            Print
          </Button>
        )}
      </Group>

      {!effectiveWard && <Text c="dimmed">Please select a ward to generate handover summary.</Text>}

      {data && (
        <Stack gap="md">
          <Group gap="xl">
            <Text fw={600}>
              {data.ward_name} — {data.shift} shift
            </Text>
            <Badge color="primary" size="lg">
              {data.total_patients} patients
            </Badge>
            <Badge color="danger" size="lg">
              {data.critical_count} critical
            </Badge>
          </Group>

          {data.patients.map((patient) => (
            <Card key={patient.admission_id} shadow="xs" padding="sm" withBorder>
              <Group justify="space-between" mb={4}>
                <Group gap={8}>
                  <Text fw={600} size="sm">
                    {patient.patient_name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {patient.bed_name}
                  </Text>
                </Group>
                <Group gap={4}>
                  {patient.is_critical && (
                    <Badge size="xs" color="danger">
                      Critical
                    </Badge>
                  )}
                  {patient.isolation_required && (
                    <Badge size="xs" color="orange">
                      Isolation
                    </Badge>
                  )}
                </Group>
              </Group>

              {patient.provisional_diagnosis && (
                <Text size="xs" c="dimmed" mb={4}>
                  Dx: {patient.provisional_diagnosis}
                </Text>
              )}

              <BulletList title="Pending Tasks:" items={patient.pending_tasks} prefix={`${patient.admission_id}-task`} />
              <BulletList title="Pending Meds:" items={patient.pending_meds} prefix={`${patient.admission_id}-med`} />
              <BulletList
                title="Active Clinical Docs:"
                items={patient.active_clinical_docs}
                prefix={`${patient.admission_id}-doc`}
              />
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function BulletList({ title, items, prefix }: { title: string; items: string[]; prefix: string }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <Text size="xs" fw={600}>
        {title}
      </Text>
      {items.map((item) => (
        <Text key={`${prefix}-${item}`} size="xs" c="dimmed" pl="sm">
          &bull; {item}
        </Text>
      ))}
    </div>
  );
}
