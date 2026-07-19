// REGULATORY DashboardTab — split from regulatory.tsx (pure move).

import {
  Box,
  Grid,
  Group,
  NumberInput,
  Paper,
  RingProgress,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type {
  ComplianceDashboard,
  ComplianceGap,
  ComplianceStatusType,
  QualityAccreditationCompliance,
  QualityAccreditationStandard,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { Badge, Button, toast } from "@/components/ui";
import { regulatoryService } from "@/services/regulatory.service";

function getScoreFromCompliance(compliance: string): number {
  switch (compliance) {
    case "compliant":
      return 100;
    case "partially_compliant":
      return 60;
    case "non_compliant":
      return 20;
    default:
      return 0;
  }
}

function DashboardOverview({
  dashboard,
  gaps,
}: {
  dashboard: ComplianceDashboard;
  gaps: ComplianceGap[];
}) {
  const upcomingDeadlines = dashboard.upcoming_deadlines ?? [];
  const accreditationScores = dashboard.accreditation_scores ?? [];
  const departmentScores = dashboard.department_scores ?? [];

  return (
    <Stack gap="lg">
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper p="md" withBorder>
            <Text size="sm" c="dimmed">
              Total Checklists
            </Text>
            <Title order={2}>{dashboard.total_checklists}</Title>
            <Text size="xs" c="success">
              {dashboard.compliant_checklists} compliant
            </Text>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper p="md" withBorder>
            <Text size="sm" c="dimmed">
              Overdue Items
            </Text>
            <Title order={2} c={dashboard.overdue_items > 0 ? "danger" : undefined}>
              {dashboard.overdue_items}
            </Title>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper p="md" withBorder>
            <Text size="sm" c="dimmed">
              Licenses Expiring (90d)
            </Text>
            <Title order={2} c={dashboard.license_expiring_soon > 0 ? "orange" : undefined}>
              {dashboard.license_expiring_soon}
            </Title>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper p="md" withBorder>
            <Text size="sm" c="dimmed">
              Upcoming Deadlines
            </Text>
            <Title order={2}>{upcomingDeadlines.length}</Title>
          </Paper>
        </Grid.Col>
      </Grid>

      {accreditationScores.length > 0 && (
        <Paper p="md" withBorder>
          <Text fw={600} mb="sm">
            Accreditation Scores
          </Text>
          <Grid>
            {accreditationScores.map((s) => (
              <Grid.Col key={s.body} span={{ base: 6, md: 3 }}>
                <Group>
                  <RingProgress
                    size={80}
                    thickness={8}
                    roundCaps
                    sections={[
                      {
                        value: s.score_percent,
                        color:
                          s.score_percent >= 80
                            ? "success"
                            : s.score_percent >= 60
                              ? "warning"
                              : "danger",
                      },
                    ]}
                    label={
                      <Text ta="center" size="xs" fw={700}>
                        {Math.round(s.score_percent)}%
                      </Text>
                    }
                  />
                  <div>
                    <Text size="sm" fw={600} tt="uppercase">
                      {s.body}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {s.compliant}/{s.total_standards} compliant
                    </Text>
                  </div>
                </Group>
              </Grid.Col>
            ))}
          </Grid>
        </Paper>
      )}

      {departmentScores.length > 0 && (
        <Paper p="md" withBorder>
          <Text fw={600} mb="sm">
            Department Compliance Scores
          </Text>
          <DataTable
            data={departmentScores}
            rowKey={(r) => r.department_id}
            loading={false}
            columns={[
              {
                key: "department_name",
                label: "Department",
                render: (r) => <Text size="sm">{r.department_name}</Text>,
              },
              {
                key: "avg_score",
                label: "Avg Score",
                render: (r) => (
                  <Badge
                    tone={r.avg_score >= 80 ? "success" : r.avg_score >= 60 ? "warning" : "danger"}
                  >
                    {r.avg_score.toFixed(1)}%
                  </Badge>
                ),
              },
              {
                key: "checklist_count",
                label: "Checklists",
                render: (r) => <Text size="sm">{r.checklist_count}</Text>,
              },
            ]}
          />
        </Paper>
      )}

      {gaps.length > 0 && (
        <Paper p="md" withBorder>
          <Text fw={600} mb="sm">
            Top Compliance Gaps
          </Text>
          <DataTable
            data={gaps}
            rowKey={(r) => r.checklist_id}
            loading={false}
            columns={[
              {
                key: "checklist_name",
                label: "Checklist",
                render: (r) => <Text size="sm">{r.checklist_name}</Text>,
              },
              {
                key: "department_name",
                label: "Department",
                render: (r) => <Text size="sm">{r.department_name ?? "Org-wide"}</Text>,
              },
              {
                key: "accreditation_body",
                label: "Body",
                render: (r) => (
                  <Badge tone="neutral" size="sm" tt="uppercase">
                    {r.accreditation_body}
                  </Badge>
                ),
              },
              {
                key: "non_compliant_items",
                label: "Gaps",
                render: (r) => <Badge tone="danger">{r.non_compliant_items}</Badge>,
              },
            ]}
          />
        </Paper>
      )}
    </Stack>
  );
}

function SelfAssessmentView() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.REGULATORY.CHECKLISTS_CREATE);

  const { data: standards = [], isLoading: standardsLoading } = useQuery({
    queryKey: ["accreditation-standards"],
    queryFn: () => regulatoryService.listAccreditationStandards(),
  });

  const { data: compliance = [], isLoading: complianceLoading } = useQuery({
    queryKey: ["accreditation-compliance"],
    queryFn: () => regulatoryService.listAccreditationCompliance(),
  });

  const [scores, setScores] = useState<Record<string, { score: number; notes: string }>>({});

  const updateMut = useMutation({
    mutationFn: (data: {
      standard_id: string;
      compliance: ComplianceStatusType;
      evidence_summary?: string;
    }) => regulatoryService.updateAccreditationCompliance(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["accreditation-compliance"] });
      void qc.invalidateQueries({ queryKey: ["regulatory-dashboard"] });
      toast.success("", { title: "Assessment updated" });
    },
  });

  const handleSave = (standardId: string) => {
    const data = scores[standardId];
    if (!data) return;

    const complianceStatus: ComplianceStatusType =
      data.score >= 80 ? "compliant" : data.score >= 50 ? "partially_compliant" : "non_compliant";
    updateMut.mutate({
      standard_id: standardId,
      compliance: complianceStatus,
      evidence_summary: data.notes,
    });
  };

  const chapterScores = useMemo(() => {
    const byChapter: Record<string, { total: number; sum: number; count: number }> = {};

    standards.forEach((std: QualityAccreditationStandard) => {
      const chapter = std.chapter || "General";
      const currentCompliance = compliance.find(
        (c: QualityAccreditationCompliance) => c.standard_id === std.id,
      );
      const score =
        scores[std.id]?.score ??
        (currentCompliance ? getScoreFromCompliance(currentCompliance.compliance) : 0);

      if (!byChapter[chapter]) {
        byChapter[chapter] = { total: 0, sum: 0, count: 0 };
      }

      byChapter[chapter].sum += score;
      byChapter[chapter].count += 1;
    });

    return Object.entries(byChapter).map(([chapter, data]) => ({
      chapter,
      avg: data.count > 0 ? Math.round(data.sum / data.count) : 0,
    }));
  }, [standards, compliance, scores]);

  if (standardsLoading || complianceLoading) {
    return <Text>Loading standards...</Text>;
  }

  return (
    <Stack gap="lg">
      <Paper p="md" withBorder>
        <Text fw={600} mb="md">
          Chapter-wise Compliance
        </Text>
        <Grid>
          {chapterScores.map((ch) => (
            <Grid.Col key={ch.chapter} span={{ base: 6, md: 4 }}>
              <Paper
                p="sm"
                withBorder
                bg={ch.avg >= 80 ? "green.0" : ch.avg >= 50 ? "yellow.0" : "red.0"}
              >
                <Text size="sm" fw={600}>
                  {ch.chapter}
                </Text>
                <Text size="xl" fw={700}>
                  {ch.avg}%
                </Text>
              </Paper>
            </Grid.Col>
          ))}
        </Grid>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={600} mb="md">
          Standard-wise Self Assessment
        </Text>
        <Stack gap="md">
          {standards.map((std: QualityAccreditationStandard) => {
            const currentCompliance = compliance.find(
              (c: QualityAccreditationCompliance) => c.standard_id === std.id,
            );
            const currentScore =
              scores[std.id]?.score ??
              (currentCompliance ? getScoreFromCompliance(currentCompliance.compliance) : 0);
            const currentNotes =
              scores[std.id]?.notes ?? (currentCompliance?.evidence_summary || "");

            return (
              <Paper key={std.id} p="md" withBorder>
                <Group justify="space-between" mb="sm">
                  <div>
                    <Text size="sm" fw={600}>
                      {std.standard_code}: {std.standard_name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {std.chapter || "General"}
                    </Text>
                  </div>
                  <Badge
                    tone={
                      currentScore >= 80 ? "success" : currentScore >= 50 ? "warning" : "danger"
                    }
                  >
                    Current: {currentScore}%
                  </Badge>
                </Group>
                <Grid>
                  <Grid.Col span={{ base: 12, md: 3 }}>
                    <NumberInput
                      label="Self-Assessment Score"
                      min={0}
                      max={100}
                      value={scores[std.id]?.score ?? currentScore}
                      onChange={(val) =>
                        setScores({
                          ...scores,
                          [std.id]: {
                            ...scores[std.id],
                            score: typeof val === "number" ? val : 0,
                            notes: scores[std.id]?.notes ?? currentNotes,
                          },
                        })
                      }
                      disabled={!canManage}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 7 }}>
                    <Textarea
                      label="Notes / Evidence"
                      placeholder="Document assessment findings..."
                      value={scores[std.id]?.notes ?? currentNotes}
                      onChange={(e) =>
                        setScores({
                          ...scores,
                          [std.id]: {
                            score: scores[std.id]?.score ?? currentScore,
                            notes: e.currentTarget.value,
                          },
                        })
                      }
                      disabled={!canManage}
                      minRows={2}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 2 }}>
                    <Box mt={24}>
                      <Button
                        tone="primary"
                        fullWidth
                        onClick={() => handleSave(std.id)}
                        loading={updateMut.isPending}
                        disabled={!canManage || !scores[std.id]}
                      >
                        Save
                      </Button>
                    </Box>
                  </Grid.Col>
                </Grid>
              </Paper>
            );
          })}
        </Stack>
      </Paper>
    </Stack>
  );
}

export function DashboardTab() {
  const [dashboardView, setDashboardView] = useState("overview");
  const { data: dashboard, isLoading } = useQuery<ComplianceDashboard>({
    queryKey: ["regulatory-dashboard"],
    queryFn: () => regulatoryService.getRegulatoryDashboard(),
  });

  const { data: gaps = [] } = useQuery<ComplianceGap[]>({
    queryKey: ["regulatory-gaps"],
    queryFn: () => regulatoryService.getComplianceGaps(),
  });

  if (isLoading || !dashboard) {
    return <Text>Loading compliance dashboard...</Text>;
  }

  return (
    <Stack gap="lg">
      <PageHeader
        title="Compliance Dashboard"
        subtitle="Aggregated compliance status across all modules"
      />

      <SegmentedControl
        value={dashboardView}
        onChange={setDashboardView}
        data={[
          { value: "overview", label: "Overview" },
          { value: "self-assessment", label: "Self Assessment" },
        ]}
      />

      {dashboardView === "overview" ? (
        <DashboardOverview dashboard={dashboard} gaps={gaps} />
      ) : (
        <SelfAssessmentView />
      )}
    </Stack>
  );
}
