import { Anchor, Box, Group, Stack, Text } from "@mantine/core";
import { useAuthStore } from "@medbrains/stores";
import type {
  CertInSeverity,
  FindingStatus,
  SecurityCheckStatus,
  Vulnerability,
} from "@medbrains/types";
import { Link } from "react-router";
import { type Column, DataTable } from "@/components";
import { Badge, Button, Panel, Select } from "@/components/ui";
import {
  ago,
  emptyFindingsMessage,
  SEVERITY_ORDER,
  STATUS_LABEL,
  severityView,
} from "./intel-status";

export interface FindingsFilter {
  severity: CertInSeverity | null;
  status: FindingStatus | null;
}

interface FindingsTableProps {
  findings: Vulnerability[];
  checks: SecurityCheckStatus[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  filter: FindingsFilter;
  onFilterChange: (filter: FindingsFilter) => void;
  canManage: boolean;
  canOpenIncident: boolean;
  canSeeIncidents: boolean;
  onUpdate: (id: string, body: { remediation_status?: FindingStatus; owner_id?: string }) => void;
  onOpenIncident: (id: string) => void;
  busyId: string | null;
  now: Date;
}

const SEVERITY_OPTIONS = SEVERITY_ORDER.map((s) => ({ value: s, label: severityView(s).label }));
const STATUS_OPTIONS = (Object.keys(STATUS_LABEL) as FindingStatus[]).map((s) => ({
  value: s,
  label: STATUS_LABEL[s],
}));

function SeverityBadge({ severity }: { severity: CertInSeverity }) {
  const v = severityView(severity);
  const SeverityIcon = v.icon;
  return (
    <Box miw={104}>
      <Badge tone={v.tone} leftSection={<SeverityIcon size={14} aria-hidden="true" />}>
        {v.label}
      </Badge>
    </Box>
  );
}

/** Findings: severity in words and icon, asset, how to fix, first/last seen, owner, status. */
export function FindingsTable(props: FindingsTableProps) {
  const { canManage, canOpenIncident, canSeeIncidents, onUpdate, onOpenIncident, busyId, now } =
    props;
  const me = useAuthStore((s) => s.user?.id ?? null);
  const filtered = props.filter.severity !== null || props.filter.status !== null;
  const empty = filtered
    ? { title: "No findings match these filters", description: "Clear a filter to see more." }
    : emptyFindingsMessage(props.checks, now);

  const columns: Column<Vulnerability>[] = [
    { key: "severity", label: "Severity", render: (f) => <SeverityBadge severity={f.severity} /> },
    {
      key: "title",
      label: "Finding",
      render: (f) => (
        <Stack gap={2}>
          <Text size="sm" fw={600}>
            {f.title}
          </Text>
          <Text size="xs" c="dimmed">
            {f.affected_component}
          </Text>
          {f.how_to_fix && <Text size="xs">How to fix: {f.how_to_fix}</Text>}
        </Stack>
      ),
    },
    {
      key: "seen",
      label: "First / last seen",
      render: (f) => (
        <Text size="sm">
          {ago(f.discovered_at, now)} / {ago(f.last_seen_at, now)}
          {f.occurrences > 1 ? ` · ${f.occurrences}×` : ""}
          {f.reopened_count > 0 ? " · re-opened" : ""}
        </Text>
      ),
    },
    {
      key: "owner",
      label: "Owner",
      render: (f) => {
        if (f.owner_id) return <Text size="sm">{f.owner_id === me ? "You" : "Assigned"}</Text>;
        if (!canManage || !me) return <Text size="sm">Unassigned</Text>;
        return (
          <Button
            tone="tertiary"
            size="xs"
            loading={busyId === f.id}
            onClick={() => onUpdate(f.id, { owner_id: me })}
          >
            Take ownership
          </Button>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (f) => {
        const status = f.remediation_status ?? "open";
        if (!canManage) return <Badge tone="neutral">{STATUS_LABEL[status]}</Badge>;
        return (
          <Select
            aria-label={`Status of ${f.title}`}
            miw={136}
            size="xs"
            data={STATUS_OPTIONS}
            value={status}
            allowDeselect={false}
            onChange={(v) => v && onUpdate(f.id, { remediation_status: v as FindingStatus })}
          />
        );
      },
    },
    {
      key: "incident",
      label: "Incident",
      render: (f) => {
        if (f.incident_id) {
          return canSeeIncidents ? (
            <Anchor component={Link} to="/security" size="sm">
              Incident opened — see Security → Incidents
            </Anchor>
          ) : (
            <Badge tone="info">Incident opened</Badge>
          );
        }
        const urgent = f.severity === "critical" || f.severity === "high";
        if (!urgent || !canOpenIncident) return <Text size="sm">—</Text>;
        return (
          <Button
            tone={f.severity === "critical" ? "danger" : "secondary"}
            size="xs"
            loading={busyId === f.id}
            onClick={() => onOpenIncident(f.id)}
          >
            Open incident
          </Button>
        );
      },
    },
  ];

  const filters = (
    <Group gap="sm">
      <Select
        label="Severity"
        placeholder="Any severity"
        size="xs"
        clearable
        data={SEVERITY_OPTIONS}
        value={props.filter.severity}
        onChange={(v) =>
          props.onFilterChange({ ...props.filter, severity: v as CertInSeverity | null })
        }
      />
      <Select
        label="Status"
        placeholder="Any status"
        size="xs"
        clearable
        data={STATUS_OPTIONS}
        value={props.filter.status}
        onChange={(v) =>
          props.onFilterChange({ ...props.filter, status: v as FindingStatus | null })
        }
      />
    </Group>
  );

  return (
    <Panel title="Findings">
      <DataTable
        columns={columns}
        data={props.findings}
        loading={props.isLoading}
        error={props.error}
        onRetry={props.onRetry}
        rowKey={(f) => f.id}
        toolbar={filters}
        emptyTitle={empty.title}
        emptyDescription={empty.description}
        caption="Security findings"
        captionVisuallyHidden
      />
    </Panel>
  );
}
