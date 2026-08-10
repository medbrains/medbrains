// IPD QueueDashboardTab — split from front-office.tsx (pure move).

import { Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { QueueStatsResponse } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { frontOfficeService } from "@/services/frontOffice.service";
import { CameBackPanel } from "./came-back-panel";

export function QueueDashboardTab() {
  const { data: stats, isLoading } = useQuery<QueueStatsResponse[]>({
    queryKey: ["front-office", "queue-stats"],
    queryFn: () => frontOfficeService.getQueueStats(),
  });

  return (
    <Stack gap="md">
      {/* Above the statistics: somebody may be standing at the desk right now. */}
      <CameBackPanel />
      <Text size="sm" c="dimmed">
        Real-time queue statistics across departments (today)
      </Text>
      {isLoading && <Text size="sm">Loading...</Text>}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
        {stats?.map((s) => (
          <Card key={s.department_id ?? "all"} withBorder padding="md">
            <Text fw={600} size="sm">
              {s.department_id ?? "All Departments"}
            </Text>
            <Group mt="xs" gap="lg">
              <div>
                <Text size="xl" fw={700} c="primary">
                  {s.waiting_count}
                </Text>
                <Text size="xs" c="dimmed">
                  Waiting
                </Text>
              </div>
              <div>
                <Text size="xl" fw={700} c="orange">
                  {s.avg_wait_minutes != null ? `${Math.round(s.avg_wait_minutes)} min` : "—"}
                </Text>
                <Text size="xs" c="dimmed">
                  Avg Wait
                </Text>
              </div>
            </Group>
          </Card>
        ))}
        {stats?.length === 0 && (
          <Text size="sm" c="dimmed">
            No queue data for today
          </Text>
        )}
      </SimpleGrid>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 3 — Token Boards
// ══════════════════════════════════════════════════════════
