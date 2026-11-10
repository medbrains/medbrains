import { Group, Stack, Text } from "@mantine/core";
import type { CheckStatus } from "@medbrains/types";
import { Alert, Badge } from "@/components/ui";
import { relativeTime } from "@/lib/date-utils";
import { checkLabel, troubledChecks } from "./labels";

interface ChecksLineProps {
  checks: CheckStatus[];
}

/** Watch the watchers: a stopped job or feed is an alert, never silence. */
export function ChecksLine({ checks }: ChecksLineProps) {
  const troubled = troubledChecks(checks);
  if (troubled.length === 0) {
    return (
      <Text size="sm" c="dimmed" data-testid="health-intel-checks">
        All {checks.length} feeds and recomputes are running.
      </Text>
    );
  }
  return (
    <Alert
      tone="warning"
      title={`${troubled.length} of ${checks.length} feeds or recomputes need attention`}
      data-testid="health-intel-checks"
    >
      <Stack gap={4}>
        {troubled.map((c) => {
          const state = checkLabel(c.state);
          return (
            <Group key={c.name} gap="xs" wrap="nowrap">
              <Badge tone={state.tone}>{state.label}</Badge>
              <Text size="sm">
                {c.label}
                {c.last_ok_at ? ` — last worked ${relativeTime(c.last_ok_at)}` : ""}
                {c.last_error ? ` (${c.last_error})` : ""}
              </Text>
            </Group>
          );
        })}
      </Stack>
    </Alert>
  );
}
