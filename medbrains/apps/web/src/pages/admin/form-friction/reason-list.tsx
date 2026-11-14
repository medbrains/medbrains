import { Stack, Text } from "@mantine/core";
import type { FrictionRoute } from "@medbrains/types";

interface ReasonListProps {
  route: FrictionRoute;
}

/** A route's top reasons with their counts and the roles that met them. */
export function ReasonList({ route }: ReasonListProps) {
  if (route.messages.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        None this period
      </Text>
    );
  }
  return (
    <Stack gap={4}>
      {route.messages.map((m) => (
        <Text key={m.message} size="sm">
          {m.message}{" "}
          <Text span size="xs" c="dimmed">
            ×{m.count.toLocaleString("en-IN")} · {m.roles.join(", ")}
          </Text>
        </Text>
      ))}
    </Stack>
  );
}
