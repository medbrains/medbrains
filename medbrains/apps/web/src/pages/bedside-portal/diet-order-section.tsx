// Bedside-portal DietOrderSection — split from bedside-portal.tsx (pure move).

import { Card, Group, Loader, Stack, Text, Title } from "@mantine/core";
import type { BedsideDietOrderItem } from "@medbrains/types";
import { Badge } from "@/components/ui";

export function DietOrderSection({
  orders,
  loading,
}: {
  orders: BedsideDietOrderItem[];
  loading: boolean;
}) {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Title order={4} mb="md">
        Diet & Meals
      </Title>
      {loading && <Loader size="sm" />}
      {!loading && orders.length === 0 && (
        <Text c="dimmed" size="sm">
          No active diet order.
        </Text>
      )}
      <Stack gap="xs">
        {orders.map((order) => (
          <Card key={order.id} padding="sm" radius="sm" withBorder>
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text size="sm" fw={600}>
                  {order.diet_type ?? "Diet order"}
                </Text>
                <Text size="xs" c="dimmed">
                  {[order.meal_type, order.instructions].filter(Boolean).join(" | ") || "—"}
                </Text>
              </Stack>
              <Badge tone="neutral" variant="light">
                {order.status ?? "active"}
              </Badge>
            </Group>
          </Card>
        ))}
      </Stack>
    </Card>
  );
}
