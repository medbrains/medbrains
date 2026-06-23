import { Card, Center, Container, Group, Loader, Stack, Text, Title } from "@mantine/core";
import type { HealthResponse } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Alert, Badge } from "@/components/ui";
import { sessionService } from "@/services/session.service";

function StatusBadge({ label, status }: { label: string; status: string }) {
  const isConnected = status === "connected" || status === "ok";
  return (
    <Group gap="sm">
      <Badge size="lg" variant="dot" tone={isConnected ? "success" : "danger"}>
        {label}
      </Badge>
      <Text size="sm" c="dimmed">
        {status}
      </Text>
    </Group>
  );
}

export function IndexPage() {
  const { data, isLoading, error } = useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: sessionService.health,
    refetchInterval: 10_000,
  });

  return (
    <Center h="100vh">
      <Container size="xs">
        <Stack gap="lg" align="center">
          <Stack gap={4} align="center">
            <Title order={1}>MedBrains</Title>
            <Text size="sm" c="dimmed">
              Hospital Management System
            </Text>
          </Stack>

          <Card withBorder shadow="sm" radius="md" w="100%" padding="lg">
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="md">
              System Health
            </Text>

            {isLoading && (
              <Center>
                <Loader size="sm" />
              </Center>
            )}

            {error && (
              <Alert tone="danger">Unable to reach API server. Is the backend running?</Alert>
            )}

            {data && (
              <Stack gap="sm">
                <StatusBadge label="Overall" status={data.status} />
                <StatusBadge label="PostgreSQL" status={data.postgres} />
              </Stack>
            )}
          </Card>

          <Text size="xs" c="dimmed">
            v0.1.0 &middot; Alagappa Group of Institutions
          </Text>
        </Stack>
      </Container>
    </Center>
  );
}
