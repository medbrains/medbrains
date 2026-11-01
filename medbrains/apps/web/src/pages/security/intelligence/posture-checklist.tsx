import { Group, List, Stack, Text } from "@mantine/core";
import type { PostureItem, PostureReport } from "@medbrains/types";
import { IconCircleCheck, IconCircleX, IconHelpCircle } from "@tabler/icons-react";
import { Alert, Badge, Button, Panel } from "@/components/ui";
import { ago, postureState } from "./intel-status";

interface PostureChecklistProps {
  report: PostureReport | null | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  now: Date;
}

const STATUS = {
  pass: { word: "Pass", tone: "success", icon: IconCircleCheck },
  fail: { word: "Fail", tone: "danger", icon: IconCircleX },
  unknown: { word: "Unknown", tone: "warning", icon: IconHelpCircle },
} as const;

function PostureLine({ item }: { item: PostureItem }) {
  const s = STATUS[item.status];
  const StatusIcon = s.icon;
  return (
    <List.Item icon={<StatusIcon size={20} aria-hidden="true" />}>
      <Group gap="xs" wrap="nowrap" align="baseline">
        <Badge tone={s.tone}>{s.word}</Badge>
        <Text size="sm" fw={600}>
          {item.label}
        </Text>
      </Group>
      <Text size="sm">{item.detail}</Text>
      {item.status !== "pass" && item.fix && (
        <Text size="sm" c="dimmed">
          How to fix: {item.fix}
        </Text>
      )}
    </List.Item>
  );
}

/** Posture checklist — pass/fail in words, how to fix, dated; an error is never "all clear". */
export function PostureChecklist({
  report,
  isLoading,
  isError,
  onRetry,
  now,
}: PostureChecklistProps) {
  const retry = (
    <Button tone="tertiary" size="xs" onClick={onRetry}>
      Retry
    </Button>
  );
  if (isLoading)
    return (
      <Panel title="Posture">
        <Text size="sm">Loading posture…</Text>
      </Panel>
    );
  if (isError) {
    return (
      <Panel title="Posture" actions={retry}>
        <Alert tone="danger" title="Could not load the posture">
          This is not an all-clear: the checklist could not be read. Retry, or check the server.
        </Alert>
      </Panel>
    );
  }
  const state = postureState(report ?? null, now);
  if (!report || state === "never") {
    return (
      <Panel title="Posture">
        <Alert tone="warning" title="Not checked yet">
          The hourly posture check has not run for this hospital yet. Nothing here is proven safe.
        </Alert>
      </Panel>
    );
  }
  const items = report.detail.items ?? [];
  return (
    <Panel title="Posture" description={`Last checked ${ago(report.started_at, now)}`}>
      <Stack gap="sm">
        {state === "error" && (
          <Alert tone="danger" title="The last posture check could not run">
            {report.error ?? "Unknown error"} — the items below are not current.
          </Alert>
        )}
        {state === "stale" && (
          <Alert tone="warning" title={`Last checked ${ago(report.started_at, now)} — overdue`}>
            The posture check runs hourly. See Checks for why it has not reported.
          </Alert>
        )}
        <List spacing="sm" listStyleType="none">
          {items.map((item) => (
            <PostureLine key={item.check} item={item} />
          ))}
        </List>
      </Stack>
    </Panel>
  );
}
