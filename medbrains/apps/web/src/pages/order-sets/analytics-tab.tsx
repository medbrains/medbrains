// Order-sets AnalyticsTab — split from order-sets.tsx (pure move).

import { Card, SimpleGrid, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { orderSetsService } from "@/services/order-sets.service";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card withBorder p="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="xl" fw={700} mt={4}>
        {value}
      </Text>
    </Card>
  );
}

export function AnalyticsTab() {
  const { data: summary } = useQuery({
    queryKey: ["order-set-analytics"],
    queryFn: () => orderSetsService.getOrderSetAnalytics(),
  });

  return (
    <Stack>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
        <StatCard label="Active Templates" value={summary?.total_templates ?? 0} />
        <StatCard label="Total Activations" value={summary?.total_activations ?? 0} />
        <StatCard label="Unique Doctors" value={summary?.unique_doctors ?? 0} />
        <StatCard
          label="Avg Completion Rate"
          value={`${Number(summary?.avg_completion_rate ?? 0).toFixed(1)}%`}
        />
      </SimpleGrid>
    </Stack>
  );
}
