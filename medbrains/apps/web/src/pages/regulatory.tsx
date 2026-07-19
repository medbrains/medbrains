import "@mantine/charts/styles.css";
import { BarChart } from "@mantine/charts";
import {
  Box,
  Drawer,
  Grid,
  Group,
  NumberInput,
  Paper,
  RingProgress,
  SegmentedControl,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  ComplianceCalendarEvent,
  ComplianceChecklist,
  ComplianceDashboard,
  ComplianceGap,
  ComplianceStatusType,
  CreateCalendarEventRequest,
  CreateChecklistRequest,
  CreateRegulatorySubmissionRequest,
  QualityAccreditationCompliance,
  QualityAccreditationStandard,
  RegulatorySubmission,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconCalendarEvent,
  IconChecklist,
  IconDashboard,
  IconDownload,
  IconFileAlert,
  IconFlask,
  IconLicense,
  IconPlus,
  IconScale,
  IconUpload,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { Badge, type BadgeTone, Button, IconButton, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { regulatoryService } from "@/services/regulatory.service";
import { AdrTab } from "./regulatory/adr-tab";
import { LicenseDashboardTab } from "./regulatory/license-dashboard-tab";
import { MockSurveysTab } from "./regulatory/mock-surveys-tab";
import { NablDocumentsTab } from "./regulatory/nabl-documents-tab";
import { PcpndtTab } from "./regulatory/pcpndt-tab";
import { checklistStatusColors } from "./regulatory/shared";
import { StaffCredentialsTab } from "./regulatory/staff-credentials-tab";

const calendarStatusColors: Record<string, BadgeTone> = {
  upcoming: "primary",
  overdue: "danger",
  completed: "success",
  cancelled: "neutral",
};

export function RegulatoryPage() {
  useRequirePermission(P.REGULATORY.DASHBOARD_VIEW);

  return (
    <Tabs defaultValue="dashboard">
      <Tabs.List>
        <Tabs.Tab value="dashboard" leftSection={<IconDashboard size={16} />}>
          Dashboard
        </Tabs.Tab>
        <Tabs.Tab value="checklists" leftSection={<IconChecklist size={16} />}>
          Checklists
        </Tabs.Tab>
        <Tabs.Tab value="adr" leftSection={<IconFileAlert size={16} />}>
          ADR & Device Reports
        </Tabs.Tab>
        <Tabs.Tab value="pcpndt" leftSection={<IconScale size={16} />}>
          PCPNDT Forms
        </Tabs.Tab>
        <Tabs.Tab value="calendar" leftSection={<IconCalendarEvent size={16} />}>
          Compliance Calendar
        </Tabs.Tab>
        <Tabs.Tab value="submissions" leftSection={<IconUpload size={16} />}>
          Submissions
        </Tabs.Tab>
        <Tabs.Tab value="mock-surveys" leftSection={<IconChecklist size={16} />}>
          Mock Surveys
        </Tabs.Tab>
        <Tabs.Tab value="staff-credentials" leftSection={<IconUsers size={16} />}>
          Staff Credentials
        </Tabs.Tab>
        <Tabs.Tab value="licenses" leftSection={<IconLicense size={16} />}>
          License Dashboard
        </Tabs.Tab>
        <Tabs.Tab value="nabl" leftSection={<IconFlask size={16} />}>
          NABL Documents
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="dashboard" pt="md">
        <DashboardTab />
      </Tabs.Panel>
      <Tabs.Panel value="checklists" pt="md">
        <ChecklistsTab />
      </Tabs.Panel>
      <Tabs.Panel value="adr" pt="md">
        <AdrTab />
      </Tabs.Panel>
      <Tabs.Panel value="pcpndt" pt="md">
        <PcpndtTab />
      </Tabs.Panel>
      <Tabs.Panel value="calendar" pt="md">
        <CalendarTab />
      </Tabs.Panel>
      <Tabs.Panel value="submissions" pt="md">
        <SubmissionsTab />
      </Tabs.Panel>
      <Tabs.Panel value="mock-surveys" pt="md">
        <MockSurveysTab />
      </Tabs.Panel>
      <Tabs.Panel value="staff-credentials" pt="md">
        <StaffCredentialsTab />
      </Tabs.Panel>
      <Tabs.Panel value="licenses" pt="md">
        <LicenseDashboardTab />
      </Tabs.Panel>
      <Tabs.Panel value="nabl" pt="md">
        <NablDocumentsTab />
      </Tabs.Panel>
    </Tabs>
  );
}

// ══════════════════════════════════════════════════════════
//  Dashboard Tab
// ══════════════════════════════════════════════════════════

function DashboardTab() {
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

// ══════════════════════════════════════════════════════════
//  Checklists Tab
// ══════════════════════════════════════════════════════════

function ChecklistsTab() {
  const [checklistView, setChecklistView] = useState("list");
  const canCreate = useHasPermission(P.REGULATORY.CHECKLISTS_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [bodyFilter, setBodyFilter] = useState<string | null>(null);

  const { data: checklists = [], isLoading } = useQuery<ComplianceChecklist[]>({
    queryKey: ["regulatory-checklists", bodyFilter],
    queryFn: () =>
      regulatoryService.listChecklists(bodyFilter ? { accreditation_body: bodyFilter } : undefined),
  });

  const [form, setForm] = useState<CreateChecklistRequest>({
    accreditation_body: "nabh",
    standard_code: "",
    name: "",
    assessment_period_start: "",
    assessment_period_end: "",
  });

  const createMut = useMutation({
    mutationFn: (data: CreateChecklistRequest) => regulatoryService.createChecklist(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["regulatory-checklists"] });
      toast.success("", { title: "Checklist created" });
      close();
    },
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="Compliance Checklists"
        subtitle="Department-wise regulatory compliance assessments"
        actions={
          canCreate ? (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
              New Checklist
            </Button>
          ) : undefined
        }
      />

      <SegmentedControl
        value={checklistView}
        onChange={setChecklistView}
        data={[
          { value: "list", label: "Checklist List" },
          { value: "gap-analysis", label: "Gap Analysis" },
        ]}
      />

      {checklistView === "list" ? (
        <ChecklistListView
          checklists={checklists}
          isLoading={isLoading}
          bodyFilter={bodyFilter}
          setBodyFilter={setBodyFilter}
        />
      ) : (
        <GapAnalysisView checklists={checklists} isLoading={isLoading} />
      )}

      <Drawer
        opened={opened}
        onClose={close}
        title="New Compliance Checklist"
        position="right"
        size="xl"
      >
        <Stack gap="sm">
          <TextInput
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
          />
          <Select
            label="Accreditation Body"
            required
            value={form.accreditation_body}
            onChange={(v) => setForm({ ...form, accreditation_body: v ?? "nabh" })}
            data={[
              { value: "nabh", label: "NABH" },
              { value: "nmc", label: "NMC" },
              { value: "nabl", label: "NABL" },
              { value: "jci", label: "JCI" },
              { value: "abdm", label: "ABDM" },
              { value: "other", label: "Other" },
            ]}
          />
          <TextInput
            label="Standard Code"
            required
            value={form.standard_code}
            onChange={(e) => setForm({ ...form, standard_code: e.currentTarget.value })}
          />
          <Textarea
            label="Description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
          />
          <DateInput
            label="Assessment Start"
            required
            value={form.assessment_period_start ? new Date(form.assessment_period_start) : null}
            onChange={(d) =>
              setForm({
                ...form,
                assessment_period_start: d ? new Date(d).toISOString().slice(0, 10) : "",
              })
            }
          />
          <DateInput
            label="Assessment End"
            required
            value={form.assessment_period_end ? new Date(form.assessment_period_end) : null}
            onChange={(d) =>
              setForm({
                ...form,
                assessment_period_end: d ? new Date(d).toISOString().slice(0, 10) : "",
              })
            }
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate(form)}
            loading={createMut.isPending}
          >
            Create Checklist
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

function ChecklistListView({
  checklists,
  isLoading,
  bodyFilter,
  setBodyFilter,
}: {
  checklists: ComplianceChecklist[];
  isLoading: boolean;
  bodyFilter: string | null;
  setBodyFilter: (v: string | null) => void;
}) {
  const canUpdate = useHasPermission(P.REGULATORY.CHECKLISTS_UPDATE);
  const qc = useQueryClient();

  const autoPopulateMut = useMutation({
    mutationFn: (id: string) => regulatoryService.autoPopulateChecklist(id),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["regulatory-checklists"] });
      toast.success(`${result.updated} item(s) updated`, { title: "Auto-populated" });
    },
    onError: () => {
      toast.error("Could not auto-populate checklist", { title: "Auto-populate failed" });
    },
  });

  return (
    <Stack gap="md">
      <Group>
        <Select
          placeholder="Filter by body"
          clearable
          value={bodyFilter}
          onChange={setBodyFilter}
          data={[
            { value: "nabh", label: "NABH" },
            { value: "nmc", label: "NMC" },
            { value: "nabl", label: "NABL" },
            { value: "jci", label: "JCI" },
            { value: "abdm", label: "ABDM" },
          ]}
        />
      </Group>

      <DataTable
        data={checklists}
        rowKey={(r) => r.id}
        loading={isLoading}
        columns={[
          {
            key: "name",
            label: "Name",
            render: (r) => (
              <Text size="sm" fw={500}>
                {r.name}
              </Text>
            ),
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
            key: "standard_code",
            label: "Standard",
            render: (r) => <Text size="sm">{r.standard_code}</Text>,
          },
          {
            key: "overall_status",
            label: "Status",
            render: (r) => (
              <Badge tone={checklistStatusColors[r.overall_status]}>
                {r.overall_status.replace(/_/g, " ")}
              </Badge>
            ),
          },
          {
            key: "compliance_score",
            label: "Score",
            render: (r) =>
              r.compliance_score != null ? (
                <Badge
                  tone={
                    r.compliance_score >= 80
                      ? "success"
                      : r.compliance_score >= 60
                        ? "warning"
                        : "danger"
                  }
                >
                  {r.compliance_score}%
                </Badge>
              ) : (
                <Text size="sm" c="dimmed">
                  -
                </Text>
              ),
          },
          {
            key: "items",
            label: "Items",
            render: (r) => (
              <Text size="sm">
                {r.compliant_items}/{r.total_items}
              </Text>
            ),
          },
          {
            key: "period",
            label: "Period",
            render: (r) => (
              <Text size="sm">
                {r.assessment_period_start} — {r.assessment_period_end}
              </Text>
            ),
          },
          {
            key: "actions",
            label: "Actions",
            render: (r) =>
              canUpdate ? (
                <Tooltip label="Auto-populate from system data">
                  <Button
                    tone="secondary"
                    size="compact-xs"
                    loading={autoPopulateMut.isPending}
                    onClick={() => autoPopulateMut.mutate(r.id)}
                  >
                    Auto-Populate
                  </Button>
                </Tooltip>
              ) : null,
          },
        ]}
      />
    </Stack>
  );
}

function GapAnalysisView({
  checklists,
  isLoading,
}: {
  checklists: ComplianceChecklist[];
  isLoading: boolean;
}) {
  const chartData = useMemo(() => {
    return checklists.map((c) => {
      const partialItems = c.total_items - c.compliant_items - c.non_compliant_items;
      return {
        name: c.name.length > 30 ? `${c.name.slice(0, 27)}...` : c.name,
        met: c.compliant_items,
        partial: partialItems,
        unmet: c.non_compliant_items,
      };
    });
  }, [checklists]);

  const summaryData = useMemo(() => {
    return checklists.map((c) => {
      const partialItems = c.total_items - c.compliant_items - c.non_compliant_items;
      const metPercent =
        c.total_items > 0 ? Math.round((c.compliant_items / c.total_items) * 100) : 0;
      const partialPercent =
        c.total_items > 0 ? Math.round((partialItems / c.total_items) * 100) : 0;
      const unmetPercent =
        c.total_items > 0 ? Math.round((c.non_compliant_items / c.total_items) * 100) : 0;

      return {
        id: c.id,
        name: c.name,
        body: c.accreditation_body,
        total: c.total_items,
        met: c.compliant_items,
        partial: partialItems,
        unmet: c.non_compliant_items,
        metPercent,
        partialPercent,
        unmetPercent,
      };
    });
  }, [checklists]);

  if (isLoading) {
    return <Text>Loading gap analysis...</Text>;
  }

  return (
    <Stack gap="lg">
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text fw={600}>Gap Analysis Visual Report</Text>
          <Button tone="secondary" leftSection={<IconDownload size={16} />} size="sm">
            Export Report
          </Button>
        </Group>

        {chartData.length > 0 ? (
          <BarChart
            h={400}
            data={chartData}
            dataKey="name"
            series={[
              { name: "met", label: "Met", color: "success" },
              { name: "partial", label: "Partial", color: "warning" },
              { name: "unmet", label: "Unmet", color: "danger" },
            ]}
            type="stacked"
            orientation="horizontal"
          />
        ) : (
          <Text c="dimmed">No checklists available for analysis</Text>
        )}
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={600} mb="md">
          Detailed Gap Breakdown
        </Text>
        <DataTable
          data={summaryData}
          rowKey={(r) => r.id}
          loading={false}
          columns={[
            {
              key: "name",
              label: "Checklist",
              render: (r) => (
                <Text size="sm" fw={500}>
                  {r.name}
                </Text>
              ),
            },
            {
              key: "body",
              label: "Body",
              render: (r) => (
                <Badge tone="neutral" size="sm" tt="uppercase">
                  {r.body}
                </Badge>
              ),
            },
            { key: "total", label: "Total", render: (r) => <Text size="sm">{r.total}</Text> },
            {
              key: "met",
              label: "Met",
              render: (r) => (
                <Group gap={4}>
                  <Text size="sm" c="success" fw={600}>
                    {r.met}
                  </Text>
                  <Text size="xs" c="dimmed">
                    ({r.metPercent}%)
                  </Text>
                </Group>
              ),
            },
            {
              key: "partial",
              label: "Partial",
              render: (r) => (
                <Group gap={4}>
                  <Text size="sm" c="warning" fw={600}>
                    {r.partial}
                  </Text>
                  <Text size="xs" c="dimmed">
                    ({r.partialPercent}%)
                  </Text>
                </Group>
              ),
            },
            {
              key: "unmet",
              label: "Unmet",
              render: (r) => (
                <Group gap={4}>
                  <Text size="sm" c="danger" fw={600}>
                    {r.unmet}
                  </Text>
                  <Text size="xs" c="dimmed">
                    ({r.unmetPercent}%)
                  </Text>
                </Group>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (r) => (
                <Badge
                  tone={r.metPercent >= 80 ? "success" : r.metPercent >= 50 ? "warning" : "danger"}
                >
                  {r.metPercent >= 80 ? "Good" : r.metPercent >= 50 ? "Fair" : "Critical"}
                </Badge>
              ),
            },
          ]}
        />
      </Paper>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  ADR & Device Reports Tab
// ══════════════════════════════════════════════════════════

function CalendarTab() {
  const [calendarView, setCalendarView] = useState("list");
  const canManage = useHasPermission(P.REGULATORY.CALENDAR_MANAGE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: events = [], isLoading } = useQuery<ComplianceCalendarEvent[]>({
    queryKey: ["regulatory-calendar", statusFilter],
    queryFn: () =>
      regulatoryService.listCalendarEvents(statusFilter ? { status: statusFilter } : undefined),
  });

  const { data: overdue = [] } = useQuery<ComplianceCalendarEvent[]>({
    queryKey: ["regulatory-calendar-overdue"],
    queryFn: () => regulatoryService.getOverdueCalendarEvents(),
  });

  const { data: dashboard } = useQuery<ComplianceDashboard>({
    queryKey: ["regulatory-dashboard"],
    queryFn: () => regulatoryService.getRegulatoryDashboard(),
  });

  const [form, setForm] = useState<CreateCalendarEventRequest>({
    title: "",
    event_type: "custom",
    due_date: "",
  });

  const createMut = useMutation({
    mutationFn: (data: CreateCalendarEventRequest) => regulatoryService.createCalendarEvent(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["regulatory-calendar"] });
      toast.success("", { title: "Calendar event created" });
      close();
    },
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => regulatoryService.updateCalendarEvent(id, { status: "completed" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["regulatory-calendar"] });
      toast.success("", { title: "Marked complete" });
    },
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="Compliance Calendar"
        subtitle="Unified regulatory deadline tracking"
        actions={
          canManage ? (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
              New Event
            </Button>
          ) : undefined
        }
      />

      <SegmentedControl
        value={calendarView}
        onChange={setCalendarView}
        data={[
          { value: "list", label: "Calendar List" },
          { value: "license-alerts", label: "License Alerts" },
          { value: "timeline", label: "Timeline View" },
        ]}
      />

      {calendarView === "list" ? (
        <CalendarListView
          events={events}
          overdue={overdue}
          isLoading={isLoading}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          completeMut={completeMut}
          canManage={canManage}
        />
      ) : calendarView === "license-alerts" ? (
        <LicenseAlertsView dashboard={dashboard} />
      ) : (
        <TimelineView events={events} isLoading={isLoading} />
      )}

      <Drawer opened={opened} onClose={close} title="New Calendar Event" position="right" size="xl">
        <Stack gap="sm">
          <TextInput
            label="Title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.currentTarget.value })}
          />
          <Textarea
            label="Description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
          />
          <Select
            label="Event Type"
            required
            value={form.event_type}
            onChange={(v) => setForm({ ...form, event_type: v ?? "custom" })}
            data={[
              { value: "license_renewal", label: "License Renewal" },
              { value: "inspection", label: "Inspection" },
              { value: "audit", label: "Audit" },
              { value: "report_due", label: "Report Due" },
              { value: "training", label: "Training" },
              { value: "review", label: "Review" },
              { value: "custom", label: "Custom" },
            ]}
          />
          <DateInput
            label="Due Date"
            required
            value={form.due_date ? new Date(form.due_date) : null}
            onChange={(d) =>
              setForm({ ...form, due_date: d ? new Date(d).toISOString().slice(0, 10) : "" })
            }
          />
          <Select
            label="Recurrence"
            value={form.recurrence ?? "once"}
            onChange={(v) => setForm({ ...form, recurrence: v ?? "once" })}
            data={[
              { value: "once", label: "One-time" },
              { value: "monthly", label: "Monthly" },
              { value: "quarterly", label: "Quarterly" },
              { value: "semi_annual", label: "Semi-Annual" },
              { value: "annual", label: "Annual" },
            ]}
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate(form)}
            loading={createMut.isPending}
          >
            Create Event
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

function CalendarListView({
  events,
  overdue,
  isLoading,
  statusFilter,
  setStatusFilter,
  completeMut,
  canManage,
}: {
  events: ComplianceCalendarEvent[];
  overdue: ComplianceCalendarEvent[];
  isLoading: boolean;
  statusFilter: string | null;
  setStatusFilter: (v: string | null) => void;
  completeMut: { mutate: (id: string) => void };
  canManage: boolean;
}) {
  return (
    <Stack gap="md">
      {overdue.length > 0 && (
        <Paper p="sm" withBorder bg="red.0">
          <Text size="sm" c="red.8" fw={600}>
            {overdue.length} overdue compliance deadline(s) require immediate attention
          </Text>
        </Paper>
      )}

      <Group>
        <Select
          placeholder="Filter by status"
          clearable
          value={statusFilter}
          onChange={setStatusFilter}
          data={[
            { value: "upcoming", label: "Upcoming" },
            { value: "overdue", label: "Overdue" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
      </Group>

      <DataTable
        data={events}
        rowKey={(r) => r.id}
        loading={isLoading}
        columns={[
          {
            key: "title",
            label: "Title",
            render: (r) => (
              <Text size="sm" fw={500}>
                {r.title}
              </Text>
            ),
          },
          {
            key: "event_type",
            label: "Type",
            render: (r) => (
              <Badge tone="neutral" size="sm">
                {r.event_type.replace(/_/g, " ")}
              </Badge>
            ),
          },
          {
            key: "due_date",
            label: "Due Date",
            render: (r) => (
              <Text
                size="sm"
                c={r.status === "overdue" ? "danger" : undefined}
                fw={r.status === "overdue" ? 600 : undefined}
              >
                {r.due_date}
              </Text>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r) => <Badge tone={calendarStatusColors[r.status]}>{r.status}</Badge>,
          },
          {
            key: "recurrence",
            label: "Recurrence",
            render: (r) => (
              <Text size="sm" tt="capitalize">
                {r.recurrence}
              </Text>
            ),
          },
          {
            key: "actions",
            label: "Actions",
            render: (r) =>
              r.status !== "completed" && canManage ? (
                <Group gap={4}>
                  <IconButton
                    tone="success"
                    onClick={() => completeMut.mutate(r.id)}
                    title="Mark complete"
                    aria-label="Checklist"
                  >
                    <IconChecklist size={14} />
                  </IconButton>
                </Group>
              ) : null,
          },
        ]}
      />
    </Stack>
  );
}

function LicenseAlertsView({ dashboard }: { dashboard?: ComplianceDashboard }) {
  if (!dashboard) {
    return <Text>Loading license data...</Text>;
  }

  const getDaysUntilExpiry = (dueDate: string): number => {
    const due = new Date(dueDate);
    const now = new Date();
    const diff = due.getTime() - now.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const getLicenseColor = (days: number): string => {
    if (days < 0) return "danger";
    if (days < 30) return "danger";
    if (days < 60) return "orange";
    if (days < 90) return "warning";
    return "success";
  };

  const licenseTone = (days: number): BadgeTone => {
    const c = getLicenseColor(days);
    return c === "orange" ? "warning" : (c as BadgeTone);
  };

  const licenseRenewalEvents = dashboard.upcoming_deadlines.filter(
    (e) => e.event_type === "license_renewal",
  );

  return (
    <Stack gap="lg">
      <Paper p="md" withBorder>
        <Group justify="space-between">
          <div>
            <Text fw={600} size="lg">
              License Renewal Tracking
            </Text>
            <Text size="sm" c="dimmed">
              Licenses expiring within 90 days
            </Text>
          </div>
          <Paper
            p="md"
            withBorder
            bg={dashboard.license_expiring_soon > 0 ? "orange.0" : "green.0"}
          >
            <Text size="xs" c="dimmed">
              Expiring Soon
            </Text>
            <Title order={2} c={dashboard.license_expiring_soon > 0 ? "orange" : "success"}>
              {dashboard.license_expiring_soon}
            </Title>
          </Paper>
        </Group>
      </Paper>

      {licenseRenewalEvents.length > 0 ? (
        <Paper p="md" withBorder>
          <Text fw={600} mb="md">
            License Renewal Schedule
          </Text>
          <DataTable
            data={licenseRenewalEvents}
            rowKey={(r) => r.id}
            loading={false}
            columns={[
              {
                key: "title",
                label: "License",
                render: (r) => (
                  <Text size="sm" fw={500}>
                    {r.title}
                  </Text>
                ),
              },
              {
                key: "description",
                label: "Description",
                render: (r) => (
                  <Text size="sm" lineClamp={1}>
                    {r.description || "-"}
                  </Text>
                ),
              },
              {
                key: "due_date",
                label: "Expiry Date",
                render: (r) => {
                  const days = getDaysUntilExpiry(r.due_date);
                  return (
                    <div>
                      <Text size="sm" c={getLicenseColor(days)} fw={600}>
                        {r.due_date}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {days >= 0 ? `${days} days left` : `${Math.abs(days)} days overdue`}
                      </Text>
                    </div>
                  );
                },
              },
              {
                key: "urgency",
                label: "Urgency",
                render: (r) => {
                  const days = getDaysUntilExpiry(r.due_date);
                  return (
                    <Badge tone={licenseTone(days)} size="lg">
                      {days < 0
                        ? "EXPIRED"
                        : days < 30
                          ? "CRITICAL"
                          : days < 60
                            ? "HIGH"
                            : days < 90
                              ? "MEDIUM"
                              : "LOW"}
                    </Badge>
                  );
                },
              },
              {
                key: "status",
                label: "Status",
                render: (r) => <Badge tone={calendarStatusColors[r.status]}>{r.status}</Badge>,
              },
            ]}
          />
        </Paper>
      ) : (
        <Paper p="xl" withBorder>
          <Stack align="center" gap="xs">
            <Text size="lg" c="dimmed">
              No license renewals due within 90 days
            </Text>
            <Text size="sm" c="success">
              All licenses are current
            </Text>
          </Stack>
        </Paper>
      )}

      <Paper p="md" withBorder bg="blue.0">
        <Text size="sm" fw={600} mb="xs">
          Alert Thresholds
        </Text>
        <Grid>
          <Grid.Col span={3}>
            <Badge tone="danger" size="lg" fullWidth>
              Critical: Less than 30 days
            </Badge>
          </Grid.Col>
          <Grid.Col span={3}>
            <Badge tone="warning" size="lg" fullWidth>
              High: 30-60 days
            </Badge>
          </Grid.Col>
          <Grid.Col span={3}>
            <Badge tone="warning" size="lg" fullWidth>
              Medium: 60-90 days
            </Badge>
          </Grid.Col>
          <Grid.Col span={3}>
            <Badge tone="success" size="lg" fullWidth>
              Low: More than 90 days
            </Badge>
          </Grid.Col>
        </Grid>
      </Paper>
    </Stack>
  );
}

function TimelineView({
  events,
  isLoading,
}: {
  events: ComplianceCalendarEvent[];
  isLoading: boolean;
}) {
  const timelineData = useMemo(() => {
    const monthsMap: Record<string, ComplianceCalendarEvent[]> = {};

    events.forEach((event) => {
      const eventDate = new Date(event.due_date);
      const monthKey = eventDate.toLocaleDateString("en-US", { year: "numeric", month: "short" });

      if (!monthsMap[monthKey]) {
        monthsMap[monthKey] = [];
      }
      monthsMap[monthKey].push(event);
    });

    return Object.entries(monthsMap)
      .sort((a, b) => {
        const aFirstEvent = a[1][0];
        const bFirstEvent = b[1][0];
        if (!aFirstEvent || !bFirstEvent) return 0;
        return new Date(aFirstEvent.due_date).getTime() - new Date(bFirstEvent.due_date).getTime();
      })
      .map(([month, evts]) => ({ month, events: evts }));
  }, [events]);

  if (isLoading) {
    return <Text>Loading timeline...</Text>;
  }

  return (
    <Stack gap="lg">
      <Paper p="md" withBorder>
        <Text fw={600} mb="md">
          Compliance Calendar Timeline
        </Text>
        <Text size="sm" c="dimmed" mb="lg">
          Horizontal view of all compliance deadlines grouped by month
        </Text>

        {timelineData.length > 0 ? (
          <Stack gap="xl">
            {timelineData.map(({ month, events: monthEvents }) => (
              <div key={month}>
                <Text fw={600} size="sm" mb="xs" c="primary">
                  {month}
                </Text>
                <Stack gap="xs">
                  {monthEvents.map((event) => {
                    const startDate = new Date(event.due_date);
                    startDate.setDate(startDate.getDate() - 14);
                    const daysFromStart = Math.max(
                      0,
                      Math.floor(
                        (new Date(event.due_date).getTime() - startDate.getTime()) /
                          (1000 * 60 * 60 * 24),
                      ),
                    );
                    const barColor =
                      event.status === "overdue"
                        ? "danger"
                        : event.status === "completed"
                          ? "success"
                          : "warning";

                    return (
                      <Box key={event.id} pos="relative">
                        <Group gap="xs" wrap="nowrap">
                          <Box
                            style={{
                              width: "100%",
                              height: "32px",
                              background: `linear-gradient(to right, transparent ${daysFromStart * 3}%, var(--mantine-color-${barColor}-4) ${daysFromStart * 3}%, var(--mantine-color-${barColor}-4) 100%)`,
                              borderRadius: "0",
                              border: `1px solid var(--mantine-color-${barColor}-6)`,
                              display: "flex",
                              alignItems: "center",
                              paddingLeft: "8px",
                            }}
                          >
                            <Text size="xs" fw={600} c={barColor === "warning" ? "dark" : "white"}>
                              {event.title.length > 50
                                ? `${event.title.slice(0, 47)}...`
                                : event.title}
                            </Text>
                          </Box>
                          <Badge tone={barColor} size="sm" style={{ minWidth: "80px" }}>
                            {event.due_date}
                          </Badge>
                        </Group>
                      </Box>
                    );
                  })}
                </Stack>
              </div>
            ))}
          </Stack>
        ) : (
          <Text c="dimmed">No events to display on timeline</Text>
        )}
      </Paper>

      <Paper p="md" withBorder bg="gray.0">
        <Text size="sm" fw={600} mb="xs">
          Timeline Legend
        </Text>
        <Group gap="md">
          <Group gap="xs">
            <Box w={20} h={20} bg="green.4" style={{ borderRadius: 0 }} />
            <Text size="sm">Completed</Text>
          </Group>
          <Group gap="xs">
            <Box w={20} h={20} bg="yellow.4" style={{ borderRadius: 0 }} />
            <Text size="sm">Upcoming</Text>
          </Group>
          <Group gap="xs">
            <Box w={20} h={20} bg="red.4" style={{ borderRadius: 0 }} />
            <Text size="sm">Overdue</Text>
          </Group>
        </Group>
      </Paper>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Submissions Tab
// ══════════════════════════════════════════════════════════

function SubmissionsTab() {
  const canManage = useHasPermission(P.REGULATORY.CALENDAR_MANAGE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["regulatory-submissions"],
    queryFn: () => regulatoryService.listRegulatorySubmissions(),
  });

  const [form, setForm] = useState<CreateRegulatorySubmissionRequest>({
    submission_type: "",
    submitted_to: "",
    submitted_at: new Date().toISOString().slice(0, 10),
  });

  const createMut = useMutation({
    mutationFn: (data: CreateRegulatorySubmissionRequest) =>
      regulatoryService.createRegulatorySubmission(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["regulatory-submissions"] });
      toast.success("", { title: "Submission recorded" });
      close();
      setForm({
        submission_type: "",
        submitted_to: "",
        submitted_at: new Date().toISOString().slice(0, 10),
      });
    },
  });

  const submissionStatusColors: Record<string, BadgeTone> = {
    pending: "warning",
    submitted: "primary",
    acknowledged: "success",
    rejected: "danger",
  };

  return (
    <Stack gap="md">
      <PageHeader
        title="Regulatory Submissions"
        subtitle="Track submissions to regulatory bodies"
        actions={
          canManage ? (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
              New Submission
            </Button>
          ) : undefined
        }
      />

      <DataTable
        data={submissions}
        rowKey={(r) => r.id}
        loading={isLoading}
        columns={[
          {
            key: "submission_type",
            label: "Type",
            render: (r: RegulatorySubmission) => <Badge tone="neutral">{r.submission_type}</Badge>,
          },
          {
            key: "submitted_to",
            label: "Submitted To",
            render: (r: RegulatorySubmission) => (
              <Text size="sm" fw={500}>
                {r.submitted_to}
              </Text>
            ),
          },
          {
            key: "reference_number",
            label: "Reference #",
            render: (r: RegulatorySubmission) => (
              <Text size="sm">{r.reference_number ?? "---"}</Text>
            ),
          },
          {
            key: "submitted_at",
            label: "Date",
            render: (r: RegulatorySubmission) => (
              <Text size="sm">{r.submitted_at.slice(0, 10)}</Text>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r: RegulatorySubmission) => (
              <Badge tone={submissionStatusColors[r.status] ?? "neutral"}>{r.status}</Badge>
            ),
          },
          {
            key: "notes",
            label: "Notes",
            render: (r: RegulatorySubmission) => (
              <Text size="sm" lineClamp={1}>
                {r.notes ?? "---"}
              </Text>
            ),
          },
        ]}
      />

      <Drawer
        opened={opened}
        onClose={close}
        title="New Regulatory Submission"
        position="right"
        size="xl"
      >
        <Stack gap="sm">
          <Select
            label="Submission Type"
            required
            data={[
              "annual_report",
              "quarterly_report",
              "incident_report",
              "license_application",
              "renewal",
              "notification",
              "other",
            ]}
            value={form.submission_type || null}
            onChange={(v) => setForm({ ...form, submission_type: v ?? "" })}
          />
          <TextInput
            label="Submitted To"
            required
            placeholder="e.g., NABH, State Health Dept"
            value={form.submitted_to}
            onChange={(e) => setForm({ ...form, submitted_to: e.currentTarget.value })}
          />
          <TextInput
            label="Reference Number"
            value={form.reference_number ?? ""}
            onChange={(e) =>
              setForm({ ...form, reference_number: e.currentTarget.value || undefined })
            }
          />
          <DateInput
            label="Submission Date"
            required
            value={form.submitted_at ? new Date(form.submitted_at) : null}
            onChange={(d) =>
              setForm({ ...form, submitted_at: d ? new Date(d).toISOString().slice(0, 10) : "" })
            }
          />
          <Select
            label="Status"
            data={["pending", "submitted", "acknowledged", "rejected"]}
            value={form.status ?? "submitted"}
            onChange={(v) => setForm({ ...form, status: v ?? undefined })}
          />
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })}
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate(form)}
            loading={createMut.isPending}
          >
            Save Submission
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Mock Surveys Tab
// ══════════════════════════════════════════════════════════
