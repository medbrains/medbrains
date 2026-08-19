// QUALITY AnalyticsReviewsTab — split from quality.tsx (pure move).

import { Card, Grid, Group, SegmentedControl, Stack, Text, Tooltip } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useHasPermission } from "@medbrains/stores";
import type {
  DepartmentScorecard,
  PatientSafetyIndicator,
  QualityCapa,
  QualityIncident,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge } from "@/components/ui";
import { qualityService } from "@/services/quality.service";
import { capaStatusColors, incidentStatusColors } from "./shared";

export function AnalyticsReviewsTab() {
  // The tab rides on `quality.indicators.list`, which opens the quality page.
  // Its three sub-views each want a different code, and each one returning
  // empty is a claim: no overdue CAPAs, no sentinel events, no committee
  // activity. On a quality dashboard those are exactly the numbers somebody
  // reports upward.
  const canListCapas = useHasPermission(P.QUALITY.CAPA_LIST);
  const canListCommittees = useHasPermission(P.QUALITY.COMMITTEES_LIST);
  const canListIncidents = useHasPermission(P.QUALITY.INCIDENTS_LIST);
  const [subView, setSubView] = useState<string>("psi");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const dateParams = {
    from: from ? from.slice(0, 10) : undefined,
    to: to ? to.slice(0, 10) : undefined,
  };

  const { data: psiData = [], isLoading: psiLoading } = useQuery({
    queryKey: ["quality-psi", dateParams],
    queryFn: () => qualityService.patientSafetyIndicators(dateParams),
    enabled: subView === "psi",
  });

  const { data: scorecardData = [], isLoading: scorecardLoading } = useQuery({
    queryKey: ["quality-scorecard", dateParams],
    queryFn: () => qualityService.departmentScorecard(),
    enabled: subView === "scorecard",
  });

  const { data: overdueCapas = [], isLoading: overdueLoading } = useQuery({
    queryKey: ["quality-overdue-capas"],
    queryFn: () => qualityService.listOverdueCapas(),
    enabled: subView === "overdue-capas" && canListCapas,
  });

  const { data: committeeDash, isLoading: cdLoading } = useQuery({
    queryKey: ["quality-committee-dashboard"],
    queryFn: () => qualityService.committeeDashboard(),
    enabled: subView === "committee-dashboard" && canListCommittees,
  });

  const { data: sentinelEvents = [], isLoading: seLoading } = useQuery({
    queryKey: ["quality-sentinel-events"],
    queryFn: () => qualityService.listSentinelEvents(),
    enabled: subView === "sentinel" && canListIncidents,
  });

  const psiColumns = [
    {
      key: "indicator_name" as const,
      label: "Indicator",
      render: (r: PatientSafetyIndicator) => <Text fw={500}>{r.indicator_name}</Text>,
    },
    {
      key: "event_count" as const,
      label: "Events",
      render: (r: PatientSafetyIndicator) => String(r.event_count),
    },
    {
      key: "patient_days" as const,
      label: "Patient Days",
      render: (r: PatientSafetyIndicator) => String(r.patient_days),
    },
    {
      key: "rate_per_1000" as const,
      label: "Rate/1000",
      render: (r: PatientSafetyIndicator) => r.rate_per_1000.toFixed(2),
    },
    {
      key: "benchmark" as const,
      label: "Benchmark",
      render: (r: PatientSafetyIndicator) => (r.benchmark != null ? r.benchmark.toFixed(2) : "---"),
    },
    {
      key: "status" as const,
      label: "Status",
      render: (r: PatientSafetyIndicator) => {
        if (r.benchmark == null) return <Badge tone="neutral">N/A</Badge>;
        return r.rate_per_1000 <= r.benchmark ? (
          <Badge tone="success">Within</Badge>
        ) : (
          <Badge tone="danger">Exceeded</Badge>
        );
      },
    },
  ];

  const scorecardColumns = [
    {
      key: "department_name" as const,
      label: "Department",
      render: (r: DepartmentScorecard) => <Text fw={500}>{r.department_name}</Text>,
    },
    {
      key: "overall_score" as const,
      label: "Overall Score",
      render: (r: DepartmentScorecard) => (
        <Badge
          tone={r.overall_score >= 80 ? "success" : r.overall_score >= 60 ? "warning" : "danger"}
          size="lg"
        >
          {r.overall_score.toFixed(1)}%
        </Badge>
      ),
    },
    {
      key: "indicators" as const,
      label: "Indicator Scores",
      render: (r: DepartmentScorecard) => (
        <Group gap="xs">
          {Object.entries(r.indicator_scores)
            .slice(0, 4)
            .map(([name, score]) => (
              <Tooltip key={name} label={name}>
                <Badge
                  size="sm"
                  tone={score >= 80 ? "success" : score >= 60 ? "warning" : "danger"}
                >
                  {score.toFixed(0)}%
                </Badge>
              </Tooltip>
            ))}
          {Object.keys(r.indicator_scores).length > 4 && (
            <Text size="xs" c="dimmed">
              +{Object.keys(r.indicator_scores).length - 4} more
            </Text>
          )}
        </Group>
      ),
    },
  ];

  const overdueCapaColumns = [
    {
      key: "capa_number" as const,
      label: "CAPA #",
      render: (r: QualityCapa) => <Text fw={500}>{r.capa_number}</Text>,
    },
    {
      key: "capa_type" as const,
      label: "Type",
      render: (r: QualityCapa) => <Badge tone="neutral">{r.capa_type}</Badge>,
    },
    {
      key: "description" as const,
      label: "Description",
      render: (r: QualityCapa) => (
        <Text size="sm" lineClamp={1}>
          {r.description ?? "---"}
        </Text>
      ),
    },
    {
      key: "due_date" as const,
      label: "Due Date",
      render: (r: QualityCapa) => {
        const daysOverdue = Math.floor(
          (Date.now() - new Date(r.due_date).getTime()) / (1000 * 60 * 60 * 24),
        );
        return (
          <Group gap="xs">
            <Text size="sm" c="danger">
              {new Date(r.due_date).toLocaleDateString()}
            </Text>
            <Badge tone="danger" size="sm">
              {daysOverdue}d overdue
            </Badge>
          </Group>
        );
      },
    },
    {
      key: "status" as const,
      label: "Status",
      render: (r: QualityCapa) => (
        <Badge tone={capaStatusColors[r.status] ?? "neutral"}>{r.status.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "escalation" as const,
      label: "Escalation",
      render: (r: QualityCapa) => {
        const daysOverdue = Math.floor(
          (Date.now() - new Date(r.due_date).getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysOverdue > 30)
          return (
            <Badge tone="danger" size="sm">
              Critical
            </Badge>
          );
        if (daysOverdue > 14)
          return (
            <Badge tone="warning" size="sm">
              High
            </Badge>
          );
        return (
          <Badge tone="warning" size="sm">
            Standard
          </Badge>
        );
      },
    },
  ];

  const sentinelColumns = [
    {
      key: "incident_number" as const,
      label: "Incident #",
      render: (r: QualityIncident) => <Text fw={500}>{r.incident_number}</Text>,
    },
    { key: "title" as const, label: "Title", render: (r: QualityIncident) => r.title },
    {
      key: "incident_type" as const,
      label: "Type",
      render: (r: QualityIncident) => r.incident_type,
    },
    {
      key: "severity" as const,
      label: "Severity",
      render: (r: QualityIncident) => <Badge tone="danger">{r.severity.replace(/_/g, " ")}</Badge>,
    },
    {
      key: "status" as const,
      label: "Status",
      render: (r: QualityIncident) => (
        <Badge tone={incidentStatusColors[r.status] ?? "neutral"}>
          {r.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "incident_date" as const,
      label: "Date",
      render: (r: QualityIncident) => new Date(r.incident_date).toLocaleDateString(),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <SegmentedControl
          value={subView}
          onChange={setSubView}
          data={[
            { value: "psi", label: "PSI" },
            { value: "scorecard", label: "Scorecard" },
            { value: "overdue-capas", label: "Overdue CAPAs" },
            { value: "committee-dashboard", label: "Committee Dashboard" },
            { value: "sentinel", label: "Sentinel Events" },
          ]}
        />
        {(subView === "psi" || subView === "scorecard") && (
          <Group>
            <DateInput
              value={from}
              onChange={(d) => setFrom(d)}
              placeholder="From"
              clearable
              w={140}
            />
            <DateInput value={to} onChange={(d) => setTo(d)} placeholder="To" clearable w={140} />
          </Group>
        )}
      </Group>

      {subView === "psi" && (
        <DataTable
          columns={psiColumns}
          data={psiData}
          loading={psiLoading}
          rowKey={(r) => r.indicator_name}
          emptyTitle="No patient safety indicator data"
        />
      )}

      {subView === "scorecard" && (
        <DataTable
          columns={scorecardColumns}
          data={scorecardData}
          loading={scorecardLoading}
          rowKey={(r) => r.department_id}
          emptyTitle="No department scorecard data"
        />
      )}

      {subView === "overdue-capas" && (
        <DataTable
          columns={overdueCapaColumns}
          data={overdueCapas}
          loading={overdueLoading}
          rowKey={(r) => r.id}
          emptyTitle="No overdue CAPAs"
        />
      )}

      {subView === "committee-dashboard" &&
        (cdLoading ? (
          <Text c="dimmed">Loading committee dashboard...</Text>
        ) : committeeDash ? (
          <Grid>
            <Grid.Col span={{ base: 6, md: 3 }}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Meetings Scheduled
                </Text>
                <Text size="xl" fw={600}>
                  {committeeDash.total_meetings_scheduled}
                </Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 6, md: 3 }}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Meetings Held
                </Text>
                <Text size="xl" fw={600} c="teal">
                  {committeeDash.meetings_held}
                </Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 6, md: 3 }}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Actions Open
                </Text>
                <Text size="xl" fw={600} c="orange">
                  {committeeDash.action_items_open}
                </Text>
                {committeeDash.action_items_overdue > 0 && (
                  <Badge tone="danger" size="sm" mt={4}>
                    {committeeDash.action_items_overdue} overdue
                  </Badge>
                )}
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 6, md: 3 }}>
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Actions Closed
                </Text>
                <Text size="xl" fw={600} c="success">
                  {committeeDash.action_items_closed}
                </Text>
              </Card>
            </Grid.Col>
          </Grid>
        ) : (
          <Text c="dimmed">No committee data</Text>
        ))}

      {subView === "sentinel" && (
        <DataTable
          columns={sentinelColumns}
          data={sentinelEvents}
          loading={seLoading}
          rowKey={(r) => r.id}
          emptyTitle="No sentinel events"
        />
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Main Quality Page
// ══════════════════════════════════════════════════════════
