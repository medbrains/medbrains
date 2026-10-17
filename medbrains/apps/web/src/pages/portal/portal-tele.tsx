/**
 * The patient's video consultations: who with, when, and a button to join.
 * Shown only when there is one; a patient with none sees nothing extra.
 */
import { Group, Stack, Text } from "@mantine/core";
import type { PortalTeleconsult } from "@medbrains/types";
import { IconVideo } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { QueryError } from "@/components/QueryError";
import { Badge, Button, Card } from "@/components/ui";
import { formatDateTime } from "@/lib/date-utils";
import { portalService } from "@/services/portal.service";

const STATUS: Record<PortalTeleconsult["status"], string> = {
  scheduled: "Scheduled",
  waiting: "Doctor is waiting",
  in_progress: "In progress",
};

export function PortalTeleconsults({ token }: { token: string }) {
  const query = useQuery({
    queryKey: ["portal-teleconsults"],
    queryFn: () => portalService.getPortalTeleconsults(token),
    retry: false,
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const rows = query.data ?? [];
  if (rows.length === 0) return null;
  return (
    <Stack gap="sm" aria-label="Video consultations" role="region">
      <Text fw={600}>Video consultations</Text>
      {rows.map((row) => (
        <Card key={row.id}>
          <Group justify="space-between" p="md" wrap="nowrap">
            <Stack gap={2}>
              <Text fw={600}>{row.doctor_name ? `Dr ${row.doctor_name}` : "Your doctor"}</Text>
              <Text size="sm" c="dimmed">
                {row.scheduled_at ? formatDateTime(row.scheduled_at) : "Time to be confirmed"}
              </Text>
              <Badge tone={row.status === "scheduled" ? "neutral" : "success"}>
                {STATUS[row.status]}
              </Badge>
            </Stack>
            <Button
              tone="primary"
              component="a"
              href={row.join_url}
              target="_blank"
              rel="noopener noreferrer"
              leftSection={<IconVideo size={16} />}
            >
              Join
            </Button>
          </Group>
        </Card>
      ))}
    </Stack>
  );
}
