import { useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Timeline,
} from "@mantine/core";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import { BarChart } from "@mantine/charts";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconAlertCircle,
  IconArrowsExchange,
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconClipboardCheck,
  IconMessageCircle,
  IconPencil,
  IconPlus,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateUrCommunicationRequest,
  CreateUrConversionRequest,
  CreateUrReviewRequest,
  LosComparisonRow,
  UrAnalyticsSummary,
  UrPayerCommunication,
  UrStatusConversion,
  UtilizationReview,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";
import type { Column } from "../components/DataTable";

// ── Color maps ─────────────────────────────────────────

const reviewTypeColors: Record<string, string> = {
  pre_admission: "primary",
  admission: "success",
  continued_stay: "orange",
  retrospective: "slate",
};

const decisionColors: Record<string, string> = {
  approved: "success",
  denied: "danger",
  pending_info: "warning",
  modified: "orange",
  escalated: "danger",
};

const commTypeColors: Record<string, string> = {
  initial_auth: "primary",
  continued_stay: "orange",
  denial_appeal: "danger",
  peer_review: "violet",
  info_request: "warning",
  response: "success",
};

// ── Main page ──────────────────────────────────────────

export function UtilizationReviewPage() {
  useRequirePermission(P.UR.REVIEWS_LIST);

  return (
    <Tabs defaultValue="reviews">
      <Tabs.List>
        <Tabs.Tab value="reviews" leftSection={<IconClipboardCheck size={16} />}>
          Reviews
        </Tabs.Tab>
        <Tabs.Tab value="los" leftSection={<IconAlertCircle size={16} />}>
          LOS Monitoring
        </Tabs.Tab>
        <Tabs.Tab value="payer" leftSection={<IconMessageCircle size={16} />}>
          Payer Log
        </Tabs.Tab>
        <Tabs.Tab value="status" leftSection={<IconArrowsExchange size={16} />}>
          Status Tracking
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="reviews" pt="md">
        <ReviewsTab />
      </Tabs.Panel>
      <Tabs.Panel value="los" pt="md">
        <LosMonitoringTab />
      </Tabs.Panel>
      <Tabs.Panel value="payer" pt="md">
        <PayerLogTab />
      </Tabs.Panel>
      <Tabs.Panel value="status" pt="md">
        <StatusTrackingTab />
      </Tabs.Panel>
    </Tabs>
  );
}

// ═══════════════════════════════════════════════════════
//  Tab 1 — Reviews
// ═══════════════════════════════════════════════════════

function ReviewsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.UR.REVIEWS_CREATE);
  const canUpdate = useHasPermission(P.UR.REVIEWS_UPDATE);
  const [opened, { open, close }] = useDisclosure(false);
  const [viewMode, setViewMode] = useState<"list" | "timeline">("list");
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string>("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["ur-reviews"],
    queryFn: () => api.listUrReviews(),
  });

  const emptyForm: CreateUrReviewRequest = {
    admission_id: "",
    patient_id: "",
    review_type: "admission",
    patient_status: "inpatient",
    criteria_source: "",
    clinical_summary: "",
    expected_los_days: undefined,
    approved_days: undefined,
    next_review_date: undefined,
  };

  const [form, setForm] = useState<CreateUrReviewRequest>(emptyForm);

  const createMut = useMutation({
    mutationFn: (d: CreateUrReviewRequest) => api.createUrReview(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ur-reviews"] });
      void qc.invalidateQueries({ queryKey: ["ur-analytics"] });
      notifications.show({ title: "Review Created", message: "Utilization review has been created", color: "success" });
      setForm(emptyForm);
      close();
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to create review", color: "danger" }),
  });

  const aiMut = useMutation({
    mutationFn: (id: string) => api.aiExtractStub(id),
    onSuccess: (res) => {
      notifications.show({ title: "AI Extract", message: res.message ?? "AI extraction stub called successfully", color: "primary" });
    },
    onError: () => notifications.show({ title: "Error", message: "AI extraction failed", color: "danger" }),
  });

  const columns: Column<UtilizationReview>[] = [
    {
      key: "admission_id",
      label: "Admission ID",
      render: (r) => <Text size="sm">{r.admission_id.slice(0, 8)}...</Text>,
    },
    {
      key: "review_type",
      label: "Review Type",
      render: (r) => (
        <Badge color={reviewTypeColors[r.review_type] ?? "slate"}>{r.review_type.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "review_date",
      label: "Review Date",
      render: (r) => <Text size="sm">{new Date(r.review_date).toLocaleDateString()}</Text>,
    },
    {
      key: "decision",
      label: "Decision",
      render: (r) => (
        <Badge color={decisionColors[r.decision] ?? "slate"}>{r.decision.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "expected_los_days",
      label: "Expected LOS",
      render: (r) => <Text size="sm">{r.expected_los_days ?? "—"}</Text>,
    },
    {
      key: "actual_los_days",
      label: "Actual LOS",
      render: (r) => <Text size="sm">{r.actual_los_days ?? "—"}</Text>,
    },
    {
      key: "is_outlier",
      label: "Outlier",
      render: (r) =>
        r.is_outlier ? <Badge color="danger">Outlier</Badge> : <Text size="sm">No</Text>,
    },
    {
      key: "next_review_date",
      label: "Next Review",
      render: (r) => (
        <Text size="sm">{r.next_review_date ? new Date(r.next_review_date).toLocaleDateString() : "—"}</Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap="xs">
          {canUpdate && (
            <ActionIcon variant="subtle" onClick={() => aiMut.mutate(r.id)} title="AI Extract" aria-label="Edit">
              <IconPencil size={16} />
            </ActionIcon>
          )}
        </Group>
      ),
    },
  ];

  // Filter reviews by admission for timeline view
  const timelineReviews = useMemo(() => {
    if (!selectedAdmissionId) return data;
    return data.filter((r) => r.admission_id === selectedAdmissionId);
  }, [data, selectedAdmissionId]);

  // Get unique admission IDs for filter
  const admissionIds = useMemo(() => {
    const ids = Array.from(new Set(data.map((r) => r.admission_id)));
    return ids.map((id) => ({ value: id, label: id.slice(0, 12) + "..." }));
  }, [data]);

  const getReviewIcon = (decision: string) => {
    switch (decision) {
      case "approved":
        return <IconCircleCheck size={16} />;
      case "denied":
        return <IconCircleX size={16} />;
      default:
        return <IconClock size={16} />;
    }
  };

  return (
    <Stack gap="md">
      <PageHeader
        title="Utilization Reviews"
        subtitle="Manage admission-level utilization reviews"
        actions={
          canCreate ? (
            <Button leftSection={<IconPlus size={16} />} onClick={open}>
              New Review
            </Button>
          ) : undefined
        }
      />

      <Group justify="space-between">
        <SegmentedControl
          value={viewMode}
          onChange={(v) => setViewMode(v as "list" | "timeline")}
          data={[
            { value: "list", label: "List View" },
            { value: "timeline", label: "Timeline View" },
          ]}
        />
        {viewMode === "timeline" && (
          <Select
            placeholder="Select Admission"
            data={admissionIds}
            value={selectedAdmissionId}
            onChange={(v) => setSelectedAdmissionId(v ?? "")}
            clearable
            w={300}
          />
        )}
      </Group>

      {viewMode === "list" ? (
        <DataTable<UtilizationReview>
          data={data}
          loading={isLoading}
          rowKey={(r) => r.id}
          columns={columns}
        />
      ) : (
        <Card withBorder p="md">
          {!selectedAdmissionId ? (
            <Text c="dimmed" ta="center" py="xl">
              Select an admission to view review timeline
            </Text>
          ) : timelineReviews.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              No reviews found for this admission
            </Text>
          ) : (
            <Timeline active={timelineReviews.length - 1} bulletSize={28} lineWidth={2}>
              {timelineReviews.map((r) => (
                <Timeline.Item
                  key={r.id}
                  bullet={getReviewIcon(r.decision)}
                  title={
                    <Group gap="xs">
                      <Text fw={600}>
                        {r.review_type.replace(/_/g, " ")}
                      </Text>
                      <Badge color={decisionColors[r.decision] ?? "slate"} size="sm">
                        {r.decision.replace(/_/g, " ")}
                      </Badge>
                    </Group>
                  }
                >
                  <Stack gap={4}>
                    <Text size="sm" c="dimmed">
                      Review Date: {new Date(r.review_date).toLocaleDateString()}
                    </Text>
                    {r.reviewer_id && (
                      <Text size="sm" c="dimmed">
                        Reviewer: {r.reviewer_id}
                      </Text>
                    )}
                    {r.expected_los_days && (
                      <Text size="sm">Expected LOS: {r.expected_los_days} days</Text>
                    )}
                    {r.approved_days && (
                      <Text size="sm" c="success">Approved: {r.approved_days} days</Text>
                    )}
                    {r.decision === "denied" && r.notes && (
                      <Text size="sm" c="danger">Denial Reason: {r.notes}</Text>
                    )}
                    {r.clinical_summary && (
                      <Text size="xs" c="dimmed" lineClamp={2} mt={4}>
                        {r.clinical_summary}
                      </Text>
                    )}
                    {r.next_review_date && (
                      <Badge color="primary" size="xs" mt={4}>
                        Next Review: {new Date(r.next_review_date).toLocaleDateString()}
                      </Badge>
                    )}
                  </Stack>
                </Timeline.Item>
              ))}
            </Timeline>
          )}
        </Card>
      )}

      <Drawer opened={opened} onClose={close} title="Create Utilization Review" position="right" size="xl">
        <Stack gap="sm">
          <TextInput
            label="Admission ID"
            required
            value={form.admission_id}
            onChange={(e) => setForm({ ...form, admission_id: e.currentTarget.value })}
          />
          <PatientSearchSelect value={form.patient_id} onChange={(v) => setForm({ ...form, patient_id: v })} required />
          <Select
            label="Review Type"
            required
            data={[
              { value: "pre_admission", label: "Pre-Admission" },
              { value: "admission", label: "Admission" },
              { value: "continued_stay", label: "Continued Stay" },
              { value: "retrospective", label: "Retrospective" },
            ]}
            value={form.review_type}
            onChange={(v) =>
              setForm({
                ...form,
                review_type: (v as CreateUrReviewRequest["review_type"]) ?? "admission",
              })
            }
          />
          <Select
            label="Patient Status"
            data={[
              { value: "inpatient", label: "Inpatient" },
              { value: "observation", label: "Observation" },
            ]}
            value={form.patient_status ?? "inpatient"}
            onChange={(v) => setForm({ ...form, patient_status: v ?? "inpatient" })}
          />
          <TextInput
            label="Criteria Source"
            value={form.criteria_source ?? ""}
            onChange={(e) => setForm({ ...form, criteria_source: e.currentTarget.value })}
          />
          <Textarea
            label="Clinical Summary"
            autosize
            minRows={3}
            value={form.clinical_summary ?? ""}
            onChange={(e) => setForm({ ...form, clinical_summary: e.currentTarget.value })}
          />
          <NumberInput
            label="Expected LOS (days)"
            min={0}
            value={form.expected_los_days ?? ""}
            onChange={(v) => setForm({ ...form, expected_los_days: typeof v === "number" ? v : undefined })}
          />
          <NumberInput
            label="Approved Days"
            min={0}
            value={form.approved_days ?? ""}
            onChange={(v) => setForm({ ...form, approved_days: typeof v === "number" ? v : undefined })}
          />
          <DateInput
            label="Next Review Date"
            clearable
            value={form.next_review_date ? new Date(form.next_review_date) : null}
            onChange={(d) =>
              setForm({ ...form, next_review_date: d ? new Date(d).toISOString().split("T")[0] : undefined })
            }
          />
          <Button loading={createMut.isPending} onClick={() => createMut.mutate(form)}>
            Create Review
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════
//  Tab 2 — LOS Monitoring
// ═══════════════════════════════════════════════════════

function LosMonitoringTab() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["ur-analytics"],
    queryFn: () => api.urAnalyticsSummary(),
  });

  const { data: outliers = [], isLoading: outliersLoading } = useQuery({
    queryKey: ["ur-outliers"],
    queryFn: () => api.listUrOutliers(),
  });

  const { data: losComparison = [], isLoading: losLoading } = useQuery({
    queryKey: ["ur-los-comparison"],
    queryFn: () => api.urLosComparison(),
  });

  const outlierColumns: Column<UtilizationReview>[] = [
    {
      key: "admission_id",
      label: "Admission ID",
      render: (r) => <Text size="sm">{r.admission_id.slice(0, 8)}...</Text>,
    },
    {
      key: "review_type",
      label: "Review Type",
      render: (r) => (
        <Badge color={reviewTypeColors[r.review_type] ?? "slate"}>{r.review_type.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "decision",
      label: "Decision",
      render: (r) => (
        <Badge color={decisionColors[r.decision] ?? "slate"}>{r.decision.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "expected_los_days",
      label: "Expected LOS",
      render: (r) => <Text size="sm">{r.expected_los_days ?? "—"}</Text>,
    },
    {
      key: "actual_los_days",
      label: "Actual LOS",
      render: (r) => <Text size="sm">{r.actual_los_days ?? "—"}</Text>,
    },
    {
      key: "review_date",
      label: "Review Date",
      render: (r) => <Text size="sm">{new Date(r.review_date).toLocaleDateString()}</Text>,
    },
  ];

  const losColumns: Column<LosComparisonRow>[] = [
    {
      key: "department_name",
      label: "Department",
      render: (r) => <Text size="sm">{r.department_name ?? "Unknown"}</Text>,
    },
    {
      key: "review_count",
      label: "Reviews",
      render: (r) => <Text size="sm">{r.review_count}</Text>,
    },
    {
      key: "avg_expected_los",
      label: "Avg Expected LOS",
      render: (r) => <Text size="sm">{r.avg_expected_los != null ? r.avg_expected_los.toFixed(1) : "—"}</Text>,
    },
    {
      key: "avg_actual_los",
      label: "Avg Actual LOS",
      render: (r) => <Text size="sm">{r.avg_actual_los != null ? r.avg_actual_los.toFixed(1) : "—"}</Text>,
    },
  ];

  const s: UrAnalyticsSummary = summary ?? {
    total_reviews: 0,
    avg_expected_los: undefined,
    avg_actual_los: undefined,
    outlier_count: 0,
    denial_count: 0,
    approval_rate: 0,
  };

  // Calculate denial analytics
  const denialData = useMemo(() => {
    if (!summary || !outliers) return null;
    const deniedReviews = outliers.filter((r) => r.decision === "denied");

    // Group denials by reason (use notes field)
    const reasonCounts: Record<string, number> = {};
    deniedReviews.forEach((r) => {
      const reason = r.notes || "No reason specified";
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });

    const denialReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate overturn rate (for now, use dummy data)
    const overturnRate = deniedReviews.length > 0 ? 15 : 0;
    const denialRate = s.total_reviews > 0 ? (s.denial_count / s.total_reviews) * 100 : 0;

    return {
      totalDenials: s.denial_count,
      denialRate,
      overturnRate,
      topReasons: denialReasons,
    };
  }, [summary, outliers, s]);

  return (
    <Stack gap="md">
      <PageHeader title="LOS Monitoring" subtitle="Length of stay analytics and outlier tracking" />

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }}>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">Total Reviews</Text>
          <Text fw={700} size="xl">{summaryLoading ? "..." : s.total_reviews}</Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">Avg Expected LOS</Text>
          <Text fw={700} size="xl">
            {summaryLoading ? "..." : s.avg_expected_los != null ? s.avg_expected_los.toFixed(1) : "—"}
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">Avg Actual LOS</Text>
          <Text fw={700} size="xl">
            {summaryLoading ? "..." : s.avg_actual_los != null ? s.avg_actual_los.toFixed(1) : "—"}
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">Outlier Count</Text>
          <Text fw={700} size="xl" c="danger">{summaryLoading ? "..." : s.outlier_count}</Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">Denial Count</Text>
          <Text fw={700} size="xl" c="orange">{summaryLoading ? "..." : s.denial_count}</Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">Approval Rate</Text>
          <Text fw={700} size="xl" c="success">
            {summaryLoading ? "..." : `${s.approval_rate.toFixed(1)}%`}
          </Text>
        </Card>
      </SimpleGrid>

      {/* Denial Management Dashboard */}
      {denialData && denialData.totalDenials > 0 && (
        <Card withBorder p="md">
          <Group justify="space-between" mb="md">
            <Text fw={600} size="lg">Denial Management</Text>
            <Badge color="danger" size="lg">{denialData.totalDenials} Denials</Badge>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
            <Card withBorder p="sm" bg="red.0">
              <Text size="xs" c="dimmed">Denial Rate</Text>
              <Text fw={700} size="lg" c="danger">{denialData.denialRate.toFixed(1)}%</Text>
            </Card>
            <Card withBorder p="sm" bg="green.0">
              <Text size="xs" c="dimmed">Overturn Rate</Text>
              <Text fw={700} size="lg" c="success">{denialData.overturnRate}%</Text>
            </Card>
            <Card withBorder p="sm" bg="orange.0">
              <Text size="xs" c="dimmed">Pending Appeals</Text>
              <Text fw={700} size="lg" c="orange">—</Text>
            </Card>
          </SimpleGrid>
          {denialData.topReasons.length > 0 && (
            <>
              <Text fw={600} size="sm" mb="xs">Top Denial Reasons</Text>
              <BarChart
                h={200}
                data={denialData.topReasons}
                dataKey="reason"
                series={[{ name: "count", color: "danger" }]}
                tickLine="y"
              />
            </>
          )}
        </Card>
      )}

      <Text fw={600} size="lg" mt="sm">Outlier Reviews</Text>
      <DataTable<UtilizationReview>
        data={outliers}
        loading={outliersLoading}
        rowKey={(r) => r.id}
        columns={outlierColumns}
      />

      <Text fw={600} size="lg" mt="sm">LOS by Department</Text>
      <DataTable<LosComparisonRow>
        data={losComparison}
        loading={losLoading}
        rowKey={(r) => r.department_name ?? "unknown"}
        columns={losColumns}
      />
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════
//  Tab 3 — Payer Log
// ═══════════════════════════════════════════════════════

function PayerLogTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.UR.COMMUNICATIONS_CREATE);
  const [opened, { open, close }] = useDisclosure(false);
  const [filterReviewId, setFilterReviewId] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["ur-communications", filterReviewId],
    queryFn: () => api.listUrCommunications({ review_id: filterReviewId || undefined }),
  });

  const emptyForm: CreateUrCommunicationRequest = {
    review_id: "",
    communication_type: "initial_auth",
    payer_name: "",
    reference_number: "",
    summary: "",
  };

  const [form, setForm] = useState<CreateUrCommunicationRequest>(emptyForm);

  const createMut = useMutation({
    mutationFn: (d: CreateUrCommunicationRequest) => api.createUrCommunication(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ur-communications"] });
      notifications.show({ title: "Communication Logged", message: "Payer communication recorded", color: "success" });
      setForm(emptyForm);
      close();
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to create communication", color: "danger" }),
  });

  const columns: Column<UrPayerCommunication>[] = [
    {
      key: "review_id",
      label: "Review ID",
      render: (r) => <Text size="sm">{r.review_id.slice(0, 8)}...</Text>,
    },
    {
      key: "communication_type",
      label: "Type",
      render: (r) => (
        <Badge color={commTypeColors[r.communication_type] ?? "slate"}>
          {r.communication_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "payer_name",
      label: "Payer",
      render: (r) => <Text size="sm">{r.payer_name}</Text>,
    },
    {
      key: "reference_number",
      label: "Reference #",
      render: (r) => <Text size="sm">{r.reference_number ?? "—"}</Text>,
    },
    {
      key: "communicated_at",
      label: "Date",
      render: (r) => <Text size="sm">{new Date(r.communicated_at).toLocaleDateString()}</Text>,
    },
    {
      key: "summary",
      label: "Summary",
      render: (r) => (
        <Text size="sm" lineClamp={1}>{r.summary ?? "—"}</Text>
      ),
    },
  ];

  return (
    <Stack gap="md">
      <PageHeader
        title="Payer Communication Log"
        subtitle="Track communications with insurance payers"
        actions={
          canCreate ? (
            <Button leftSection={<IconPlus size={16} />} onClick={open}>
              Log Communication
            </Button>
          ) : undefined
        }
      />

      <Group>
        <TextInput
          placeholder="Filter by Review ID"
          value={filterReviewId}
          onChange={(e) => setFilterReviewId(e.currentTarget.value)}
          w={300}
        />
      </Group>

      <DataTable<UrPayerCommunication>
        data={data}
        loading={isLoading}
        rowKey={(r) => r.id}
        columns={columns}
      />

      <Drawer opened={opened} onClose={close} title="Log Payer Communication" position="right" size="xl">
        <Stack gap="sm">
          <TextInput
            label="Review ID"
            required
            value={form.review_id}
            onChange={(e) => setForm({ ...form, review_id: e.currentTarget.value })}
          />
          <Select
            label="Communication Type"
            required
            data={[
              { value: "initial_auth", label: "Initial Authorization" },
              { value: "continued_stay", label: "Continued Stay" },
              { value: "denial_appeal", label: "Denial Appeal" },
              { value: "peer_review", label: "Peer Review" },
              { value: "info_request", label: "Information Request" },
              { value: "response", label: "Response" },
            ]}
            value={form.communication_type}
            onChange={(v) => setForm({ ...form, communication_type: v ?? "initial_auth" })}
          />
          <TextInput
            label="Payer Name"
            required
            value={form.payer_name}
            onChange={(e) => setForm({ ...form, payer_name: e.currentTarget.value })}
          />
          <TextInput
            label="Reference Number"
            value={form.reference_number ?? ""}
            onChange={(e) => setForm({ ...form, reference_number: e.currentTarget.value })}
          />
          <Textarea
            label="Summary"
            autosize
            minRows={3}
            value={form.summary ?? ""}
            onChange={(e) => setForm({ ...form, summary: e.currentTarget.value })}
          />
          <Button loading={createMut.isPending} onClick={() => createMut.mutate(form)}>
            Log Communication
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════
//  Tab 4 — Status Tracking
// ═══════════════════════════════════════════════════════

function StatusTrackingTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.UR.CONVERSIONS_CREATE);
  const [opened, { open, close }] = useDisclosure(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["ur-conversions"],
    queryFn: () => api.listUrConversions(),
  });

  const emptyForm: CreateUrConversionRequest = {
    admission_id: "",
    from_status: "observation",
    to_status: "inpatient",
    reason: "",
  };

  const [form, setForm] = useState<CreateUrConversionRequest>(emptyForm);

  const createMut = useMutation({
    mutationFn: (d: CreateUrConversionRequest) => api.createUrConversion(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ur-conversions"] });
      notifications.show({ title: "Conversion Created", message: "Status conversion recorded", color: "success" });
      setForm(emptyForm);
      close();
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to create conversion", color: "danger" }),
  });

  const columns: Column<UrStatusConversion>[] = [
    {
      key: "admission_id",
      label: "Admission ID",
      render: (r) => <Text size="sm">{r.admission_id.slice(0, 8)}...</Text>,
    },
    {
      key: "from_status",
      label: "From Status",
      render: (r) => <Badge variant="outline">{r.from_status}</Badge>,
    },
    {
      key: "to_status",
      label: "To Status",
      render: (r) => <Badge variant="outline" color="primary">{r.to_status}</Badge>,
    },
    {
      key: "conversion_date",
      label: "Conversion Date",
      render: (r) => <Text size="sm">{new Date(r.conversion_date).toLocaleDateString()}</Text>,
    },
    {
      key: "reason",
      label: "Reason",
      render: (r) => <Text size="sm" lineClamp={1}>{r.reason ?? "—"}</Text>,
    },
  ];

  return (
    <Stack gap="md">
      <PageHeader
        title="Status Tracking"
        subtitle="Observation to inpatient status conversions"
        actions={
          canCreate ? (
            <Button leftSection={<IconPlus size={16} />} onClick={open}>
              New Conversion
            </Button>
          ) : undefined
        }
      />

      <DataTable<UrStatusConversion>
        data={data}
        loading={isLoading}
        rowKey={(r) => r.id}
        columns={columns}
      />

      <Drawer opened={opened} onClose={close} title="Create Status Conversion" position="right" size="xl">
        <Stack gap="sm">
          <TextInput
            label="Admission ID"
            required
            value={form.admission_id}
            onChange={(e) => setForm({ ...form, admission_id: e.currentTarget.value })}
          />
          <Select
            label="From Status"
            required
            data={[
              { value: "observation", label: "Observation" },
              { value: "inpatient", label: "Inpatient" },
            ]}
            value={form.from_status}
            onChange={(v) => setForm({ ...form, from_status: v ?? "observation" })}
          />
          <Select
            label="To Status"
            required
            data={[
              { value: "observation", label: "Observation" },
              { value: "inpatient", label: "Inpatient" },
            ]}
            value={form.to_status}
            onChange={(v) => setForm({ ...form, to_status: v ?? "inpatient" })}
          />
          <Textarea
            label="Reason"
            autosize
            minRows={3}
            value={form.reason ?? ""}
            onChange={(e) => setForm({ ...form, reason: e.currentTarget.value })}
          />
          <Button loading={createMut.isPending} onClick={() => createMut.mutate(form)}>
            Create Conversion
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}
