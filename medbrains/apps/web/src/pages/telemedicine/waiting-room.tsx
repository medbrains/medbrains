// Telemedicine WaitingRoom — split from telemedicine.tsx (pure move).

import { Card, Group, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui";
import { telemedicineService } from "@/services/telemedicine.service";

export function WaitingRoom() {
  const { data = [] } = useQuery({
    queryKey: ["tele-waiting-room"],
    queryFn: () => telemedicineService.getTeleWaitingRoom(),
    refetchInterval: 15_000,
  });
  if (data.length === 0) return null;
  return (
    <Card withBorder padding="md">
      <Text fw={600} size="sm" mb="xs">
        Waiting room ({data.length})
      </Text>
      <Stack gap="xs">
        {data.map((w) => (
          <Group key={w.id} gap="sm">
            <Badge tone="info" size="sm">
              #{w.position}
            </Badge>
            {w.acuity && (
              <Badge
                tone={
                  w.acuity === "emergent" ? "danger" : w.acuity === "urgent" ? "warning" : "neutral"
                }
                size="sm"
              >
                {w.acuity}
                {w.red_flags && w.red_flags.length > 0 ? ` · ${w.red_flags.length}🚩` : ""}
              </Badge>
            )}
            <Text size="sm">{w.patient_name ?? "Patient"}</Text>
            <Text size="xs" c="dimmed">
              {w.scheduled_at ? new Date(w.scheduled_at).toLocaleTimeString() : ""}
            </Text>
          </Group>
        ))}
      </Stack>
    </Card>
  );
}
