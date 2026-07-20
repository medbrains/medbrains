// Bedside-portal LabResultsSection — split from bedside-portal.tsx (pure move).

import { Group, Loader, Stack, Text } from "@mantine/core";
import { IconFlask } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { bedsideService } from "@/services/bedside.service";

export function LabResultsSection({ admissionId }: { admissionId: string }) {
  const labQ = useQuery({
    queryKey: ["bedside", "lab-results", admissionId],
    queryFn: () => bedsideService.getBedsideLabResults(admissionId),
    enabled: admissionId.length > 0,
  });

  if (labQ.isLoading) return <Loader size="sm" />;
  if (!labQ.data || labQ.data.length === 0)
    return (
      <Text c="dimmed" size="sm">
        No lab results available.
      </Text>
    );

  return (
    <Stack gap="xs">
      {labQ.data.map((r) => (
        <Group key={r.id} justify="space-between">
          <Group gap="xs">
            <IconFlask size={16} color="var(--mantine-color-violet-6)" />
            <Text size="sm" fw={500}>
              {r.test_name ?? "Test"}
            </Text>
          </Group>
          <Group gap="xs">
            <Text size="sm" fw={700} c={r.is_abnormal ? "red" : undefined}>
              {r.result_value ?? "-"} {r.unit ?? ""}
            </Text>
            {r.reference_range && (
              <Text size="xs" c="dimmed">
                ({r.reference_range})
              </Text>
            )}
          </Group>
        </Group>
      ))}
    </Stack>
  );
}
