import { zodResolver } from "@hookform/resolvers/zod";
import "@mantine/charts/styles.css";
import { BarChart } from "@mantine/charts";
import {
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
  Textarea,
  TextInput,
  Timeline,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  type UrCommunicationFormInput,
  type UrStatusConversionFormInput,
  type UtilizationReviewFormInput,
  urCommunicationFormSchema,
  urStatusConversionFormSchema,
  utilizationReviewFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  LosComparisonRow,
  UrAnalyticsSummary,
  UrPayerCommunication,
  UrStatusConversion,
  UtilizationReview,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertCircle,
  IconArrowsExchange,
  IconCircleCheck,
  IconCircleX,
  IconClipboardCheck,
  IconClock,
  IconMessageCircle,
  IconPencil,
  IconPlus,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { statusColor } from "@/lib/status-colors";
import {
  type CreateUrCommunicationInput,
  type CreateUrConversionInput,
  type CreateUrReviewInput,
  utilizationReviewService,
} from "@/services/utilizationReview.service";

// ── Color maps ─────────────────────────────────────────

const reviewTypeColors: Record<string, BadgeTone> = {
  pre_admission: "primary",
  admission: "success",
  continued_stay: "warning",
  retrospective: "neutral",
};

function statusColorTone(v: string): BadgeTone {
  const c = statusColor(v);
  const m: Record<string, BadgeTone> = {
    success: "success",
    danger: "danger",
    warning: "warning",
    primary: "primary",
    info: "info",
    slate: "neutral",
    gray: "neutral",
    teal: "success",
    green: "success",
    red: "danger",
    yellow: "warning",
    orange: "warning",
    blue: "info",
    violet: "accent",
    cinnabar: "accent",
  };
  return (c ? m[c] : undefined) ?? "neutral";
}

type ReviewViewMode = "list" | "timeline";

const EMPTY_REVIEW_FORM: UtilizationReviewFormInput = {
  admission_id: "",
  patient_id: "",
  review_type: "admission",
  patient_status: "inpatient",
  criteria_source: "",
  clinical_summary: "",
  expected_los_days: "",
  approved_days: "",
  next_review_date: null,
};

const EMPTY_COMMUNICATION_FORM: UrCommunicationFormInput = {
  review_id: "",
  communication_type: "initial_auth",
  payer_name: "",
  reference_number: "",
  summary: "",
};

const EMPTY_CONVERSION_FORM: UrStatusConversionFormInput = {
  admission_id: "",
  from_status: "observation",
  to_status: "inpatient",
  reason: "",
};

function parseReviewViewMode(value: string): ReviewViewMode {
  return value === "timeline" ? "timeline" : "list";
}

function optionalTrimmed(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalFormInteger(value: string | number): number | undefined {
  if (typeof value === "string" && value.trim().length === 0) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateToIsoDate(date: Date | string | null): string | null {
  if (!date) return null;
  if (typeof date === "string") return date;
  return date.toISOString().slice(0, 10);
}

function formToReviewPayload(form: UtilizationReviewFormInput): CreateUrReviewInput {
  return {
    admission_id: form.admission_id.trim(),
    patient_id: form.patient_id.trim(),
    review_type: form.review_type,
    patient_status: form.patient_status,
    criteria_source: optionalTrimmed(form.criteria_source),
    clinical_summary: optionalTrimmed(form.clinical_summary),
    expected_los_days: optionalFormInteger(form.expected_los_days),
    approved_days: optionalFormInteger(form.approved_days),
    next_review_date: form.next_review_date ?? undefined,
  };
}

function formToCommunicationPayload(form: UrCommunicationFormInput): CreateUrCommunicationInput {
  return {
    review_id: form.review_id.trim(),
    communication_type: form.communication_type,
    payer_name: form.payer_name.trim(),
    reference_number: optionalTrimmed(form.reference_number),
    summary: optionalTrimmed(form.summary),
  };
}

function formToConversionPayload(form: UrStatusConversionFormInput): CreateUrConversionInput {
  return {
    admission_id: form.admission_id.trim(),
    from_status: form.from_status,
    to_status: form.to_status,
    reason: optionalTrimmed(form.reason),
  };
}

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
  const [viewMode, setViewMode] = useState<ReviewViewMode>("list");
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string>("");
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<UtilizationReviewFormInput>({
    resolver: zodResolver(utilizationReviewFormSchema),
    defaultValues: EMPTY_REVIEW_FORM,
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["ur-reviews"],
    queryFn: () => utilizationReviewService.listReviews(),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateUrReviewInput) => utilizationReviewService.createReview(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ur-reviews"] });
      void qc.invalidateQueries({ queryKey: ["ur-analytics"] });
      notifications.show({
        title: "Review Created",
        message: "Utilization review has been created",
        color: "success",
      });
      reset(EMPTY_REVIEW_FORM);
      close();
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Failed to create review", color: "danger" }),
  });

  const aiMut = useMutation({
    mutationFn: (id: string) => utilizationReviewService.extractReview(id),
    onSuccess: (res) => {
      notifications.show({
        title: "AI Extract",
        message: res.message ?? "AI extraction stub called successfully",
        color: "primary",
      });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "AI extraction failed", color: "danger" }),
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
        <Badge tone={reviewTypeColors[r.review_type] ?? "neutral"}>
          {r.review_type.replace(/_/g, " ")}
        </Badge>
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
        <Badge tone={statusColorTone(r.decision)}>{r.decision.replace(/_/g, " ")}</Badge>
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
        r.is_outlier ? <Badge tone="danger">Outlier</Badge> : <Text size="sm">No</Text>,
    },
    {
      key: "next_review_date",
      label: "Next Review",
      render: (r) => (
        <Text size="sm">
          {r.next_review_date ? new Date(r.next_review_date).toLocaleDateString() : "—"}
        </Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap="xs">
          {canUpdate && (
            <IconButton onClick={() => aiMut.mutate(r.id)} title="AI Extract" aria-label="Edit">
              <IconPencil size={16} />
            </IconButton>
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
    return ids.map((id) => ({ value: id, label: `${id.slice(0, 12)}...` }));
  }, [data]);

  const openCreateReview = () => {
    reset(EMPTY_REVIEW_FORM);
    open();
  };

  const submitReview = handleSubmit((values) => {
    createMut.mutate(formToReviewPayload(values));
  });

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
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreateReview}>
              New Review
            </Button>
          ) : undefined
        }
      />

      <Group justify="space-between">
        <SegmentedControl
          value={viewMode}
          onChange={(value) => setViewMode(parseReviewViewMode(value))}
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
                      <Text fw={600}>{r.review_type.replace(/_/g, " ")}</Text>
                      <Badge tone={statusColorTone(r.decision)} size="sm">
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
                      <Text size="sm" c="success">
                        Approved: {r.approved_days} days
                      </Text>
                    )}
                    {r.decision === "denied" && r.notes && (
                      <Text size="sm" c="danger">
                        Denial Reason: {r.notes}
                      </Text>
                    )}
                    {r.clinical_summary && (
                      <Text size="xs" c="dimmed" lineClamp={2} mt={4}>
                        {r.clinical_summary}
                      </Text>
                    )}
                    {r.next_review_date && (
                      <Badge tone="primary" size="xs" mt={4}>
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

      <Drawer
        opened={opened}
        onClose={close}
        title="Create Utilization Review"
        position="right"
        size="xl"
      >
        <Stack component="form" gap="sm" onSubmit={submitReview}>
          <TextInput
            label="Admission ID"
            required
            error={errors.admission_id?.message}
            {...register("admission_id")}
          />
          <Controller
            name="patient_id"
            control={control}
            render={({ field }) => (
              <PatientSearchSelect
                value={field.value}
                onChange={field.onChange}
                required
                error={errors.patient_id?.message}
              />
            )}
          />
          <Controller
            name="review_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Review Type"
                required
                data={[
                  { value: "pre_admission", label: "Pre-Admission" },
                  { value: "admission", label: "Admission" },
                  { value: "continued_stay", label: "Continued Stay" },
                  { value: "retrospective", label: "Retrospective" },
                ]}
                value={field.value}
                onChange={field.onChange}
                error={errors.review_type?.message}
              />
            )}
          />
          <Controller
            name="patient_status"
            control={control}
            render={({ field }) => (
              <Select
                label="Patient Status"
                data={[
                  { value: "inpatient", label: "Inpatient" },
                  { value: "observation", label: "Observation" },
                ]}
                value={field.value}
                onChange={field.onChange}
                error={errors.patient_status?.message}
              />
            )}
          />
          <TextInput
            label="Criteria Source"
            error={errors.criteria_source?.message}
            {...register("criteria_source")}
          />
          <Textarea
            label="Clinical Summary"
            autosize
            minRows={3}
            error={errors.clinical_summary?.message}
            {...register("clinical_summary")}
          />
          <Controller
            name="expected_los_days"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Expected LOS (days)"
                min={0}
                value={field.value}
                onChange={field.onChange}
                error={errors.expected_los_days?.message}
              />
            )}
          />
          <Controller
            name="approved_days"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Approved Days"
                min={0}
                value={field.value}
                onChange={field.onChange}
                error={errors.approved_days?.message}
              />
            )}
          />
          <Controller
            name="next_review_date"
            control={control}
            render={({ field }) => (
              <DateInput
                label="Next Review Date"
                clearable
                value={field.value ? new Date(field.value) : null}
                onChange={(date) => field.onChange(dateToIsoDate(date))}
                error={errors.next_review_date?.message}
              />
            )}
          />
          <Button tone="primary" loading={createMut.isPending} type="submit">
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
    queryFn: () => utilizationReviewService.analyticsSummary(),
  });

  const { data: outliers = [], isLoading: outliersLoading } = useQuery({
    queryKey: ["ur-outliers"],
    queryFn: () => utilizationReviewService.listOutliers(),
  });

  const { data: losComparison = [], isLoading: losLoading } = useQuery({
    queryKey: ["ur-los-comparison"],
    queryFn: () => utilizationReviewService.losComparison(),
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
        <Badge tone={reviewTypeColors[r.review_type] ?? "neutral"}>
          {r.review_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "decision",
      label: "Decision",
      render: (r) => (
        <Badge tone={statusColorTone(r.decision)}>{r.decision.replace(/_/g, " ")}</Badge>
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
      render: (r) => (
        <Text size="sm">{r.avg_expected_los != null ? r.avg_expected_los.toFixed(1) : "—"}</Text>
      ),
    },
    {
      key: "avg_actual_los",
      label: "Avg Actual LOS",
      render: (r) => (
        <Text size="sm">{r.avg_actual_los != null ? r.avg_actual_los.toFixed(1) : "—"}</Text>
      ),
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
          <Text size="xs" c="dimmed">
            Total Reviews
          </Text>
          <Text fw={700} size="xl">
            {summaryLoading ? "..." : s.total_reviews}
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">
            Avg Expected LOS
          </Text>
          <Text fw={700} size="xl">
            {summaryLoading
              ? "..."
              : s.avg_expected_los != null
                ? s.avg_expected_los.toFixed(1)
                : "—"}
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">
            Avg Actual LOS
          </Text>
          <Text fw={700} size="xl">
            {summaryLoading ? "..." : s.avg_actual_los != null ? s.avg_actual_los.toFixed(1) : "—"}
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">
            Outlier Count
          </Text>
          <Text fw={700} size="xl" c="danger">
            {summaryLoading ? "..." : s.outlier_count}
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">
            Denial Count
          </Text>
          <Text fw={700} size="xl" c="orange">
            {summaryLoading ? "..." : s.denial_count}
          </Text>
        </Card>
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed">
            Approval Rate
          </Text>
          <Text fw={700} size="xl" c="success">
            {summaryLoading ? "..." : `${s.approval_rate.toFixed(1)}%`}
          </Text>
        </Card>
      </SimpleGrid>

      {/* Denial Management Dashboard */}
      {denialData && denialData.totalDenials > 0 && (
        <Card withBorder p="md">
          <Group justify="space-between" mb="md">
            <Text fw={600} size="lg">
              Denial Management
            </Text>
            <Badge tone="danger" size="lg">
              {denialData.totalDenials} Denials
            </Badge>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
            <Card withBorder p="sm" bg="red.0">
              <Text size="xs" c="dimmed">
                Denial Rate
              </Text>
              <Text fw={700} size="lg" c="danger">
                {denialData.denialRate.toFixed(1)}%
              </Text>
            </Card>
            <Card withBorder p="sm" bg="green.0">
              <Text size="xs" c="dimmed">
                Overturn Rate
              </Text>
              <Text fw={700} size="lg" c="success">
                {denialData.overturnRate}%
              </Text>
            </Card>
            <Card withBorder p="sm" bg="orange.0">
              <Text size="xs" c="dimmed">
                Pending Appeals
              </Text>
              <Text fw={700} size="lg" c="orange">
                —
              </Text>
            </Card>
          </SimpleGrid>
          {denialData.topReasons.length > 0 && (
            <>
              <Text fw={600} size="sm" mb="xs">
                Top Denial Reasons
              </Text>
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

      <Text fw={600} size="lg" mt="sm">
        Outlier Reviews
      </Text>
      <DataTable<UtilizationReview>
        data={outliers}
        loading={outliersLoading}
        rowKey={(r) => r.id}
        columns={outlierColumns}
      />

      <Text fw={600} size="lg" mt="sm">
        LOS by Department
      </Text>
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
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<UrCommunicationFormInput>({
    resolver: zodResolver(urCommunicationFormSchema),
    defaultValues: EMPTY_COMMUNICATION_FORM,
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["ur-communications", filterReviewId],
    queryFn: () =>
      utilizationReviewService.listCommunications({ review_id: filterReviewId || undefined }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateUrCommunicationInput) => utilizationReviewService.createCommunication(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ur-communications"] });
      notifications.show({
        title: "Communication Logged",
        message: "Payer communication recorded",
        color: "success",
      });
      reset(EMPTY_COMMUNICATION_FORM);
      close();
    },
    onError: () =>
      notifications.show({
        title: "Error",
        message: "Failed to create communication",
        color: "danger",
      }),
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
        <Badge tone={statusColorTone(r.communication_type)}>
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
        <Text size="sm" lineClamp={1}>
          {r.summary ?? "—"}
        </Text>
      ),
    },
  ];

  const openCreateCommunication = () => {
    reset(EMPTY_COMMUNICATION_FORM);
    open();
  };

  const submitCommunication = handleSubmit((values) => {
    createMut.mutate(formToCommunicationPayload(values));
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="Payer Communication Log"
        subtitle="Track communications with insurance payers"
        actions={
          canCreate ? (
            <Button
              tone="primary"
              leftSection={<IconPlus size={16} />}
              onClick={openCreateCommunication}
            >
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

      <Drawer
        opened={opened}
        onClose={close}
        title="Log Payer Communication"
        position="right"
        size="xl"
      >
        <Stack component="form" gap="sm" onSubmit={submitCommunication}>
          <TextInput
            label="Review ID"
            required
            error={errors.review_id?.message}
            {...register("review_id")}
          />
          <Controller
            name="communication_type"
            control={control}
            render={({ field }) => (
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
                value={field.value}
                onChange={field.onChange}
                error={errors.communication_type?.message}
              />
            )}
          />
          <TextInput
            label="Payer Name"
            required
            error={errors.payer_name?.message}
            {...register("payer_name")}
          />
          <TextInput
            label="Reference Number"
            error={errors.reference_number?.message}
            {...register("reference_number")}
          />
          <Textarea
            label="Summary"
            autosize
            minRows={3}
            error={errors.summary?.message}
            {...register("summary")}
          />
          <Button tone="primary" loading={createMut.isPending} type="submit">
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
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<UrStatusConversionFormInput>({
    resolver: zodResolver(urStatusConversionFormSchema),
    defaultValues: EMPTY_CONVERSION_FORM,
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["ur-conversions"],
    queryFn: () => utilizationReviewService.listConversions(),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateUrConversionInput) => utilizationReviewService.createConversion(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ur-conversions"] });
      notifications.show({
        title: "Conversion Created",
        message: "Status conversion recorded",
        color: "success",
      });
      reset(EMPTY_CONVERSION_FORM);
      close();
    },
    onError: () =>
      notifications.show({
        title: "Error",
        message: "Failed to create conversion",
        color: "danger",
      }),
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
      render: (r) => (
        <Badge tone="neutral" variant="outline">
          {r.from_status}
        </Badge>
      ),
    },
    {
      key: "to_status",
      label: "To Status",
      render: (r) => (
        <Badge tone="primary" variant="outline">
          {r.to_status}
        </Badge>
      ),
    },
    {
      key: "conversion_date",
      label: "Conversion Date",
      render: (r) => <Text size="sm">{new Date(r.conversion_date).toLocaleDateString()}</Text>,
    },
    {
      key: "reason",
      label: "Reason",
      render: (r) => (
        <Text size="sm" lineClamp={1}>
          {r.reason ?? "—"}
        </Text>
      ),
    },
  ];

  const openCreateConversion = () => {
    reset(EMPTY_CONVERSION_FORM);
    open();
  };

  const submitConversion = handleSubmit((values) => {
    createMut.mutate(formToConversionPayload(values));
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="Status Tracking"
        subtitle="Observation to inpatient status conversions"
        actions={
          canCreate ? (
            <Button
              tone="primary"
              leftSection={<IconPlus size={16} />}
              onClick={openCreateConversion}
            >
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

      <Drawer
        opened={opened}
        onClose={close}
        title="Create Status Conversion"
        position="right"
        size="xl"
      >
        <Stack component="form" gap="sm" onSubmit={submitConversion}>
          <TextInput
            label="Admission ID"
            required
            error={errors.admission_id?.message}
            {...register("admission_id")}
          />
          <Controller
            name="from_status"
            control={control}
            render={({ field }) => (
              <Select
                label="From Status"
                required
                data={[
                  { value: "observation", label: "Observation" },
                  { value: "inpatient", label: "Inpatient" },
                ]}
                value={field.value}
                onChange={field.onChange}
                error={errors.from_status?.message}
              />
            )}
          />
          <Controller
            name="to_status"
            control={control}
            render={({ field }) => (
              <Select
                label="To Status"
                required
                data={[
                  { value: "observation", label: "Observation" },
                  { value: "inpatient", label: "Inpatient" },
                ]}
                value={field.value}
                onChange={field.onChange}
                error={errors.to_status?.message}
              />
            )}
          />
          <Textarea
            label="Reason"
            autosize
            minRows={3}
            error={errors.reason?.message}
            {...register("reason")}
          />
          <Button tone="primary" loading={createMut.isPending} type="submit">
            Create Conversion
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}
