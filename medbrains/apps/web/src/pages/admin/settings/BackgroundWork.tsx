import { Stack, Text } from "@mantine/core";
import type { BackgroundJobStatus } from "@medbrains/types";
import { Badge } from "@/components/ui";

interface BackgroundWorkProps {
  jobs: readonly BackgroundJobStatus[];
}

/** "running", "stopped" or "2 of 3 running": a job another switched-on app needs keeps running. */
function describeState(running: number, total: number): string {
  if (running === total) {
    return "running";
  }
  return running === 0 ? "stopped" : `${running} of ${total} running`;
}

/** Whether a brick's background jobs run on this server; nothing for a brick that has none. */
export function BackgroundWork({ jobs }: BackgroundWorkProps) {
  if (jobs.length === 0) {
    return null;
  }
  const running = jobs.filter((job) => job.running).length;
  const state = describeState(running, jobs.length);

  return (
    <Stack gap={4} align="flex-start">
      <Badge tone={running > 0 ? "success" : "neutral"} size="sm">
        Background work {state}
      </Badge>
      <Text size="xs" c="dimmed">
        {jobs.map((job) => job.label).join(", ")}
      </Text>
    </Stack>
  );
}
