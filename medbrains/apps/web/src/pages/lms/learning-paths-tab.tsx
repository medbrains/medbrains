// Lms LearningPathsTab — split from lms.tsx (pure move).

import { Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { LmsLearningPath } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button } from "@/components/ui";
import { lmsService } from "@/services/lms.service";
import { EmptyState } from "./empty-state";

export function LearningPathsTab() {
  const canCreate = useHasPermission(P.LMS.PATHS_CREATE);
  const { data: paths = [], isLoading } = useQuery<LmsLearningPath[]>({
    queryKey: ["lms-paths"],
    queryFn: () => lmsService.listPaths(),
  });

  return (
    <Stack gap="md">
      {canCreate && (
        <Group justify="flex-end">
          <Button tone="primary" leftSection={<IconPlus size={16} />} size="sm">
            Create Path
          </Button>
        </Group>
      )}
      {isLoading ? (
        <EmptyState message="Loading learning paths..." />
      ) : paths.length === 0 ? (
        <EmptyState message="No learning paths defined yet." />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {paths.map((p: LmsLearningPath) => (
            <Card key={p.id} shadow="xs" radius="md" padding="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text fw={600} size="sm" lineClamp={1}>
                  {p.title}
                </Text>
                {p.is_mandatory && (
                  <Badge size="xs" tone="danger">
                    Mandatory
                  </Badge>
                )}
              </Group>
              <Text size="xs" c="dimmed" lineClamp={2} mb="sm">
                {p.description ?? "No description"}
              </Text>
              <Group gap="xs">
                <Badge size="xs" variant="outline" tone="neutral">
                  {p.code}
                </Badge>
                <Badge size="xs" variant="dot" tone={p.is_active ? "success" : "neutral"}>
                  {p.is_active ? "Active" : "Inactive"}
                </Badge>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}

// ── Compliance Tab ─────────────────────────────────────
