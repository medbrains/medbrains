import { Text } from "@mantine/core";
import type { SecurityCheckStatus } from "@medbrains/types";
import { type Column, DataTable } from "@/components";
import { Badge, Panel } from "@/components/ui";
import { ago, checkView } from "./intel-status";

interface ChecksPanelProps {
  checks: SecurityCheckStatus[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  now: Date;
}

function every(secs: number): string {
  if (secs >= 86_400) return `Every ${secs / 86_400} day`;
  if (secs >= 3_600) return `Every ${secs / 3_600} h`;
  return `Every ${secs / 60} min`;
}

/** Watch the watchers: each check's last and next run, with stale and failed marked. */
export function ChecksPanel({ checks, isLoading, error, onRetry, now }: ChecksPanelProps) {
  const columns: Column<SecurityCheckStatus>[] = [
    {
      key: "label",
      label: "Check",
      render: (c) => (
        <Text size="sm" fw={600}>
          {c.label}
        </Text>
      ),
    },
    { key: "every", label: "Cadence", render: (c) => <Text size="sm">{every(c.every_secs)}</Text> },
    {
      key: "state",
      label: "State",
      render: (c) => {
        const v = checkView(c, now);
        return <Badge tone={v.tone}>{v.label}</Badge>;
      },
    },
    {
      key: "last",
      label: "Last run",
      render: (c) => (
        <Text size="sm">
          {c.last ? `${ago(c.last.started_at, now)} · ${c.last.findings_count} found` : "—"}
        </Text>
      ),
    },
    {
      key: "next",
      label: "Next run",
      render: (c) => {
        const v = checkView(c, now);
        if (!v.nextDue) return <Text size="sm">Due now</Text>;
        return <Text size="sm">{v.nextDue <= now ? "Due now" : v.nextDue.toLocaleString()}</Text>;
      },
    },
    {
      key: "error",
      label: "Last error",
      render: (c) => (
        <Text size="sm" c={c.last?.error ? "var(--mb-support-error)" : "dimmed"}>
          {c.last?.error ?? "—"}
        </Text>
      ),
    },
  ];
  return (
    <Panel
      title="Checks"
      description="Every check reports a heartbeat; a silent or failing check is itself an alert."
    >
      <DataTable
        columns={columns}
        data={checks}
        loading={isLoading}
        error={error}
        onRetry={onRetry}
        rowKey={(c) => c.key}
        emptyTitle="No checks reported"
        caption="Security checks and their heartbeats"
        captionVisuallyHidden
      />
    </Panel>
  );
}
