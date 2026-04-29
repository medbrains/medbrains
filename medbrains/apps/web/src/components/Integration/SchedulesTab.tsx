import { Stack, Text, ThemeIcon } from "@mantine/core";
import { IconClock } from "@tabler/icons-react";

export function SchedulesTab() {
  return (
    <Stack align="center" gap="md" py="xl">
      <ThemeIcon size="xl" variant="light" color="gray">
        <IconClock size={24} />
      </ThemeIcon>
      <Text fw={600}>Scheduled Jobs</Text>
      <Text size="sm" c="dimmed" maw={400} ta="center">
        Cron-based job scheduling is coming in Sprint 2. You will be able to
        configure recurring pipeline triggers, periodic data syncs, and timed
        report generation from this tab.
      </Text>
    </Stack>
  );
}
