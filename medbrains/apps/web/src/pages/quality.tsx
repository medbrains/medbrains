import "@mantine/charts/styles.css";
import { LineChart } from "@mantine/charts";
import {
  Card,
  Center,
  Checkbox,
  Drawer,
  Group,
  Loader,
  Modal,
  NumberInput,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateCapaRequest,
  CreateMortalityReviewRequest,
  CreateQualityDocumentRequest,
  CreateQualityIncidentRequest,
  CreateQualityIndicatorRequest,
  IncidentSeverityType,
  IndicatorFrequencyType,
  PendingAckUser,
  QualityCapa,
  QualityDocument,
  QualityIncident,
  QualityIncidentListItem,
  QualityIndicator,
  QualityIndicatorValue,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconAward,
  IconCalculator,
  IconChartBar,
  IconChecklist,
  IconClipboardCheck,
  IconEye,
  IconFileDescription,
  IconHistory,
  IconPlus,
  IconPrinter,
  IconSearch,
  IconShieldCheck,
  IconTrendingUp,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { Icd11CodeSelect } from "@/components/Clinical/Icd11CodeSelect";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Badge, Button, IconButton, Table, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { qualityService } from "@/services/quality.service";
import { AccreditationTab } from "./quality/accreditation-tab";
import { AnalyticsReviewsTab } from "./quality/analytics-reviews-tab";
import { AuditsTab } from "./quality/audits-tab";
import { CommitteesTab } from "./quality/committees-tab";
import {
  capaStatusColors,
  docStatusColors,
  incidentStatusColors,
  statusColorTone,
} from "./quality/shared";
import classes from "./quality.module.scss";

// ── Color Maps ──────────────────────────────────────────

// Dropdown options for categorical fields
const INDICATOR_CATEGORIES = [
  { value: "patient_safety", label: "Patient Safety" },
  { value: "clinical_outcomes", label: "Clinical Outcomes" },
  { value: "infection_control", label: "Infection Control" },
  { value: "medication_safety", label: "Medication Safety" },
  { value: "surgical_safety", label: "Surgical Safety" },
  { value: "emergency_care", label: "Emergency Care" },
  { value: "diagnostic_services", label: "Diagnostic Services" },
  { value: "nursing_care", label: "Nursing Care" },
  { value: "documentation", label: "Documentation" },
  { value: "patient_experience", label: "Patient Experience" },
  { value: "operational", label: "Operational" },
  { value: "financial", label: "Financial" },
  { value: "other", label: "Other" },
];

const INDICATOR_SUB_CATEGORIES = [
  { value: "mortality", label: "Mortality" },
  { value: "morbidity", label: "Morbidity" },
  { value: "readmission", label: "Readmission" },
  { value: "complication", label: "Complication" },
  { value: "hai", label: "Hospital Acquired Infection" },
  { value: "adverse_event", label: "Adverse Event" },
  { value: "near_miss", label: "Near Miss" },
  { value: "timeliness", label: "Timeliness" },
  { value: "compliance", label: "Compliance" },
  { value: "satisfaction", label: "Satisfaction" },
  { value: "other", label: "Other" },
];

// ── Indicators Tab ──────────────────────────────────────

function IndicatorsTab() {
  const canManage = useHasPermission(P.QUALITY.INDICATORS_MANAGE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [recordOpened, { open: openRecord, close: closeRecord }] = useDisclosure(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selectedIndicator, setSelectedIndicator] = useState<QualityIndicator | null>(null);
  const [trendIndicator, setTrendIndicator] = useState<QualityIndicator | null>(null);
  const [indicatorView, setIndicatorView] = useState<"list" | "benchmarking">("list");

  const { data: indicators = [], isLoading } = useQuery({
    queryKey: ["quality-indicators", categoryFilter],
    queryFn: () =>
      qualityService.listQualityIndicators(
        categoryFilter ? { category: categoryFilter } : undefined,
      ),
  });

  const categories = [...new Set(indicators.map((i) => i.category))];

  // Fetch all indicator values for benchmarking
  const { data: allIndicatorValues = [] } = useQuery({
    queryKey: ["quality-all-indicator-values"],
    queryFn: () => qualityService.listIndicatorValues({}),
    enabled: indicatorView === "benchmarking",
  });

  // Compute latest values for each indicator
  const indicatorLatestValues = useMemo(() => {
    const valueMap = new Map<string, QualityIndicatorValue>();
    allIndicatorValues.forEach((val: QualityIndicatorValue) => {
      const existing = valueMap.get(val.indicator_id);
      if (!existing || new Date(val.period_start) > new Date(existing.period_start)) {
        valueMap.set(val.indicator_id, val);
      }
    });
    return valueMap;
  }, [allIndicatorValues]);

  const { data: trendValues = [] } = useQuery({
    queryKey: ["quality-indicator-values", trendIndicator?.id],
    queryFn: () => qualityService.listIndicatorValues({ indicator_id: trendIndicator?.id }),
    enabled: !!trendIndicator,
  });

  const trendChartData = useMemo(() => {
    if (!trendValues.length) return [];
    return [...trendValues]
      .sort((a, b) => new Date(a.period_start).getTime() - new Date(b.period_start).getTime())
      .map((v: QualityIndicatorValue) => ({
        period: new Date(v.period_start).toLocaleDateString(),
        value: v.calculated_value ?? 0,
      }));
  }, [trendValues]);

  const trendReferenceLines = useMemo(() => {
    if (!trendIndicator) return [];
    const lines: { y: number; color: string; label: string }[] = [];
    if (trendIndicator.target_value != null) {
      lines.push({ y: trendIndicator.target_value, color: "green.6", label: "Target" });
    }
    if (trendIndicator.threshold_warning != null) {
      lines.push({ y: trendIndicator.threshold_warning, color: "orange.5", label: "Warning" });
    }
    return lines;
  }, [trendIndicator]);

  const [form, setForm] = useState<CreateQualityIndicatorRequest>({
    code: "",
    name: "",
    category: "",
    frequency: "monthly",
  });

  const createMut = useMutation({
    mutationFn: (data: CreateQualityIndicatorRequest) =>
      qualityService.createQualityIndicator(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-indicators"] });
      toast.success("", { title: "Indicator created" });
      close();
      setForm({ code: "", name: "", category: "", frequency: "monthly" });
    },
  });

  const calculateMut = useMutation({
    mutationFn: (id: string) => qualityService.calculateIndicator(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-indicators"] });
      void qc.invalidateQueries({ queryKey: ["quality-indicator-values"] });
      toast.success("Value auto-computed", { title: "Indicator calculated" });
    },
    onError: () => {
      toast.error("Could not auto-calculate indicator", { title: "Calculation failed" });
    },
  });

  const [recordForm, setRecordForm] = useState({
    indicator_id: "",
    period_start: "",
    period_end: "",
    numerator_value: undefined as number | undefined,
    denominator_value: undefined as number | undefined,
    calculated_value: undefined as number | undefined,
    notes: "",
  });

  const recordMut = useMutation({
    mutationFn: () =>
      qualityService.recordIndicatorValue({
        indicator_id: recordForm.indicator_id,
        period_start: recordForm.period_start,
        period_end: recordForm.period_end,
        numerator_value: recordForm.numerator_value,
        denominator_value: recordForm.denominator_value,
        calculated_value: recordForm.calculated_value,
        notes: recordForm.notes || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-indicator-values"] });
      toast.success("", { title: "Value recorded" });
      closeRecord();
    },
  });

  const columns = [
    {
      key: "code" as const,
      label: "Code",
      render: (i: QualityIndicator) => <Text fw={500}>{i.code}</Text>,
    },
    { key: "name" as const, label: "Name", render: (i: QualityIndicator) => i.name },
    {
      key: "category" as const,
      label: "Category",
      render: (i: QualityIndicator) => <Badge tone="neutral">{i.category}</Badge>,
    },
    { key: "frequency" as const, label: "Frequency", render: (i: QualityIndicator) => i.frequency },
    {
      key: "target" as const,
      label: "Target",
      render: (i: QualityIndicator) =>
        i.target_value != null ? `${i.target_value}${i.unit ? ` ${i.unit}` : ""}` : "---",
    },
    {
      key: "status" as const,
      label: "Status",
      render: (i: QualityIndicator) =>
        i.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>,
    },
    {
      key: "actions" as const,
      label: "Actions",
      render: (i: QualityIndicator) => (
        <Group gap="xs">
          <Tooltip label="Trend Analysis">
            <IconButton
              tone="success"
              onClick={() => setTrendIndicator(trendIndicator?.id === i.id ? null : i)}
              aria-label="Trend Analysis"
            >
              <IconTrendingUp size={16} />
            </IconButton>
          </Tooltip>
          {canManage && i.auto_calculated && (
            <Tooltip label="Auto-Calculate">
              <IconButton
                tone="default"
                loading={calculateMut.isPending}
                onClick={() => calculateMut.mutate(i.id)}
                aria-label="Auto-Calculate"
              >
                <IconCalculator size={16} />
              </IconButton>
            </Tooltip>
          )}
          {canManage && (
            <Tooltip label="Record Value">
              <IconButton
                tone="primary"
                onClick={() => {
                  setSelectedIndicator(i);
                  setRecordForm({ ...recordForm, indicator_id: i.id });
                  openRecord();
                }}
                aria-label="Record Value"
              >
                <IconChartBar size={16} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <SegmentedControl
            value={indicatorView}
            onChange={(v) => setIndicatorView(v as "list" | "benchmarking")}
            data={[
              { label: "List", value: "list" },
              { label: "Benchmarking", value: "benchmarking" },
            ]}
          />
          <Select
            placeholder="Filter by category"
            data={categories}
            value={categoryFilter}
            onChange={setCategoryFilter}
            clearable
            leftSection={<IconSearch size={14} />}
            w={200}
          />
          <Text c="dimmed" size="sm">
            {indicators.length} indicator(s)
          </Text>
        </Group>
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            New Indicator
          </Button>
        )}
      </Group>

      {indicatorView === "list" && (
        <DataTable
          columns={columns}
          data={indicators}
          loading={isLoading}
          rowKey={(i) => i.id}
          emptyTitle="No quality indicators"
        />
      )}

      {indicatorView === "benchmarking" && (
        <Card withBorder shadow="sm" p="md">
          <Text fw={600} mb="md">
            Indicator Benchmarking
          </Text>
          {indicators.filter((i) => i.target_value != null).length === 0 ? (
            <Text c="dimmed" size="sm">
              No indicators with target values configured
            </Text>
          ) : (
            <DataTable
              columns={[
                {
                  key: "indicator",
                  label: "Indicator",
                  render: (i: QualityIndicator) => (
                    <div>
                      <Text fw={500} size="sm">
                        {i.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {i.code}
                      </Text>
                    </div>
                  ),
                },
                {
                  key: "current",
                  label: "Current Value",
                  render: (i: QualityIndicator) => {
                    const current = indicatorLatestValues.get(i.id)?.calculated_value ?? 0;
                    const meetsTarget = current >= (i.target_value ?? 0);
                    return (
                      <Badge tone={meetsTarget ? "success" : "danger"}>
                        {current.toFixed(2)}
                        {i.unit ? ` ${i.unit}` : ""}
                      </Badge>
                    );
                  },
                },
                {
                  key: "target",
                  label: "Target Value",
                  render: (i: QualityIndicator) => {
                    const target = i.target_value ?? 0;
                    return `${target.toFixed(2)}${i.unit ? ` ${i.unit}` : ""}`;
                  },
                },
                {
                  key: "variance",
                  label: "Variance",
                  render: (i: QualityIndicator) => {
                    const current = indicatorLatestValues.get(i.id)?.calculated_value ?? 0;
                    const target = i.target_value ?? 0;
                    const variance = target !== 0 ? ((current - target) / target) * 100 : 0;
                    return (
                      <Text c={variance >= 0 ? "success" : "danger"} fw={500}>
                        {variance > 0 ? "+" : ""}
                        {variance.toFixed(1)}%
                      </Text>
                    );
                  },
                },
                {
                  key: "progress",
                  label: "Progress",
                  render: (i: QualityIndicator) => {
                    const current = indicatorLatestValues.get(i.id)?.calculated_value ?? 0;
                    const target = i.target_value ?? 0;
                    const progress = target !== 0 ? Math.min(100, (current / target) * 100) : 0;
                    const meetsTarget = current >= target;
                    return (
                      <Progress
                        value={progress}
                        color={meetsTarget ? "success" : "danger"}
                        size="lg"
                      />
                    );
                  },
                },
              ]}
              data={indicators.filter((i) => i.target_value != null)}
              rowKey={(i) => i.id}
            />
          )}
        </Card>
      )}

      {trendIndicator && (
        <Card withBorder shadow="sm" p="md" mt="md">
          <Stack>
            <Group justify="space-between">
              <Text fw={600}>Trend Analysis: {trendIndicator.name}</Text>
              <Button tone="ghost" size="compact-sm" onClick={() => setTrendIndicator(null)}>
                Close
              </Button>
            </Group>
            {trendChartData.length > 0 ? (
              <LineChart
                h={300}
                data={trendChartData}
                dataKey="period"
                series={[{ name: "value", color: "teal.6" }]}
                curveType="monotone"
                connectNulls
                withLegend
                withTooltip
                tooltipAnimationDuration={200}
                referenceLines={trendReferenceLines.length > 0 ? trendReferenceLines : undefined}
              />
            ) : (
              <Text c="dimmed" ta="center" py="xl">
                No recorded values for this indicator yet.
              </Text>
            )}
            {trendIndicator.target_value != null && (
              <Group gap="lg">
                <Badge tone="success" variant="dot" size="lg">
                  Target: {trendIndicator.target_value}
                  {trendIndicator.unit ? ` ${trendIndicator.unit}` : ""}
                </Badge>
                {trendIndicator.threshold_warning != null && (
                  <Badge tone="warning" variant="dot" size="lg">
                    Warning Threshold: {trendIndicator.threshold_warning}
                    {trendIndicator.unit ? ` ${trendIndicator.unit}` : ""}
                  </Badge>
                )}
                {trendIndicator.threshold_critical != null && (
                  <Badge tone="danger" variant="dot" size="lg">
                    Critical Threshold: {trendIndicator.threshold_critical}
                    {trendIndicator.unit ? ` ${trendIndicator.unit}` : ""}
                  </Badge>
                )}
              </Group>
            )}
          </Stack>
        </Card>
      )}

      <Drawer
        opened={opened}
        onClose={close}
        title="New Quality Indicator"
        position="right"
        size="xl"
      >
        <Stack>
          <TextInput
            label="Code"
            required
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.currentTarget.value })}
          />
          <TextInput
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
          />
          <Select
            label="Category"
            required
            data={INDICATOR_CATEGORIES}
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v ?? "" })}
            searchable
          />
          <Select
            label="Sub-Category"
            data={INDICATOR_SUB_CATEGORIES}
            value={form.sub_category ?? null}
            onChange={(v) => setForm({ ...form, sub_category: v || undefined })}
            clearable
            searchable
          />
          <Textarea
            label="Description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value || undefined })}
          />
          <TextInput
            label="Numerator Description"
            value={form.numerator_description ?? ""}
            onChange={(e) =>
              setForm({ ...form, numerator_description: e.currentTarget.value || undefined })
            }
          />
          <TextInput
            label="Denominator Description"
            value={form.denominator_description ?? ""}
            onChange={(e) =>
              setForm({ ...form, denominator_description: e.currentTarget.value || undefined })
            }
          />
          <TextInput
            label="Unit"
            value={form.unit ?? ""}
            onChange={(e) => setForm({ ...form, unit: e.currentTarget.value || undefined })}
          />
          <Select
            label="Frequency"
            required
            data={
              [
                "daily",
                "weekly",
                "monthly",
                "quarterly",
                "annually",
              ] satisfies IndicatorFrequencyType[]
            }
            value={form.frequency}
            onChange={(v) =>
              setForm({ ...form, frequency: (v ?? "monthly") as IndicatorFrequencyType })
            }
          />
          <NumberInput
            label="Target Value"
            decimalScale={2}
            value={form.target_value ?? ""}
            onChange={(v) => setForm({ ...form, target_value: v === "" ? undefined : Number(v) })}
          />
          <NumberInput
            label="Warning Threshold"
            decimalScale={2}
            value={form.threshold_warning ?? ""}
            onChange={(v) =>
              setForm({ ...form, threshold_warning: v === "" ? undefined : Number(v) })
            }
          />
          <NumberInput
            label="Critical Threshold"
            decimalScale={2}
            value={form.threshold_critical ?? ""}
            onChange={(v) =>
              setForm({ ...form, threshold_critical: v === "" ? undefined : Number(v) })
            }
          />
          <Switch
            label="Auto-calculated"
            checked={form.auto_calculated ?? false}
            onChange={(e) => setForm({ ...form, auto_calculated: e.currentTarget.checked })}
          />
          <Button
            tone="primary"
            loading={createMut.isPending}
            onClick={() => createMut.mutate(form)}
          >
            Save
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={recordOpened}
        onClose={closeRecord}
        title={`Record Value: ${selectedIndicator?.name ?? ""}`}
        position="right"
        size="sm"
      >
        <Stack>
          <TextInput
            label="Period Start"
            type="date"
            required
            value={recordForm.period_start}
            onChange={(e) => setRecordForm({ ...recordForm, period_start: e.currentTarget.value })}
          />
          <TextInput
            label="Period End"
            type="date"
            required
            value={recordForm.period_end}
            onChange={(e) => setRecordForm({ ...recordForm, period_end: e.currentTarget.value })}
          />
          <NumberInput
            label="Numerator"
            decimalScale={2}
            value={recordForm.numerator_value ?? ""}
            onChange={(v) =>
              setRecordForm({ ...recordForm, numerator_value: v === "" ? undefined : Number(v) })
            }
          />
          <NumberInput
            label="Denominator"
            decimalScale={2}
            value={recordForm.denominator_value ?? ""}
            onChange={(v) =>
              setRecordForm({ ...recordForm, denominator_value: v === "" ? undefined : Number(v) })
            }
          />
          <NumberInput
            label="Calculated Value"
            decimalScale={2}
            value={recordForm.calculated_value ?? ""}
            onChange={(v) =>
              setRecordForm({ ...recordForm, calculated_value: v === "" ? undefined : Number(v) })
            }
          />
          <Textarea
            label="Notes"
            value={recordForm.notes}
            onChange={(e) => setRecordForm({ ...recordForm, notes: e.currentTarget.value })}
          />
          <Button tone="primary" loading={recordMut.isPending} onClick={() => recordMut.mutate()}>
            Record
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Documents Tab ───────────────────────────────────────

function DocumentsTab() {
  const canManage = useHasPermission(P.QUALITY.DOCUMENTS_MANAGE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [ackModalOpened, { open: openAckModal, close: closeAckModal }] = useDisclosure(false);
  const [versionModalOpened, { open: openVersionModal, close: closeVersionModal }] =
    useDisclosure(false);
  const [ackDocId, setAckDocId] = useState<string | null>(null);
  const [versionDocCode, setVersionDocCode] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [trainingOnly, setTrainingOnly] = useState(false);

  const { data: pendingAcks = [], isLoading: acksLoading } = useQuery({
    queryKey: ["quality-pending-acks", ackDocId],
    queryFn: () => (ackDocId ? qualityService.listPendingAcks(ackDocId) : []),
    enabled: !!ackDocId,
  });

  const { data: versionHistory = [], isLoading: versionsLoading } = useQuery({
    queryKey: ["quality-document-versions", versionDocCode],
    queryFn: async () => {
      const allDocs = await qualityService.listQualityDocuments({});
      return allDocs.filter((d: QualityDocument) => d.document_number === versionDocCode);
    },
    enabled: !!versionDocCode,
  });

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["quality-documents", statusFilter, categoryFilter],
    queryFn: () =>
      qualityService.listQualityDocuments({
        status: statusFilter ?? undefined,
        category: categoryFilter ?? undefined,
      }),
  });

  const filteredDocuments = useMemo(
    () => (trainingOnly ? documents.filter((d) => d.is_training_required) : documents),
    [documents, trainingOnly],
  );

  const [form, setForm] = useState<CreateQualityDocumentRequest>({
    document_number: "",
    title: "",
    category: "",
  });

  const createMut = useMutation({
    mutationFn: (data: CreateQualityDocumentRequest) => qualityService.createQualityDocument(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-documents"] });
      toast.success("", { title: "Document created" });
      close();
      setForm({ document_number: "", title: "", category: "" });
    },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      qualityService.updateDocumentStatus(id, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-documents"] });
      toast.success("", { title: "Status updated" });
    },
  });

  const acknowledgeMut = useMutation({
    mutationFn: (id: string) => qualityService.acknowledgeDocument(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-documents"] });
      toast.success("", { title: "Document acknowledged" });
    },
  });

  const statusTransitions: Record<string, string[]> = {
    draft: ["under_review"],
    under_review: ["approved", "draft"],
    approved: ["released"],
    released: ["revised", "obsolete"],
    revised: ["under_review"],
  };

  const columns = [
    {
      key: "document_number" as const,
      label: "Doc #",
      render: (d: QualityDocument) => <Text fw={500}>{d.document_number}</Text>,
    },
    { key: "title" as const, label: "Title", render: (d: QualityDocument) => d.title },
    { key: "category" as const, label: "Category", render: (d: QualityDocument) => d.category },
    {
      key: "version" as const,
      label: "Version",
      render: (d: QualityDocument) => `v${d.current_version}`,
    },
    {
      key: "status" as const,
      label: "Status",
      render: (d: QualityDocument) => (
        <Badge tone={docStatusColors[d.status] ?? "neutral"}>{d.status.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "review_date" as const,
      label: "Next Review",
      render: (d: QualityDocument) =>
        d.next_review_date ? new Date(d.next_review_date).toLocaleDateString() : "---",
    },
    {
      key: "training" as const,
      label: "Training",
      render: (d: QualityDocument) =>
        d.is_training_required ? (
          <Badge tone="warning" size="sm">
            Required
          </Badge>
        ) : (
          "---"
        ),
    },
    {
      key: "actions" as const,
      label: "Actions",
      render: (d: QualityDocument) => (
        <Group gap="xs">
          {canManage &&
            (statusTransitions[d.status] ?? []).map((nextStatus) => (
              <Tooltip key={nextStatus} label={nextStatus.replace(/_/g, " ")}>
                <Button
                  tone="secondary"
                  size="compact-xs"
                  loading={statusMut.isPending}
                  onClick={() => statusMut.mutate({ id: d.id, status: nextStatus })}
                >
                  {nextStatus.replace(/_/g, " ")}
                </Button>
              </Tooltip>
            ))}
          {d.status === "released" && (
            <>
              <Tooltip label="Acknowledge">
                <IconButton
                  tone="success"
                  onClick={() => acknowledgeMut.mutate(d.id)}
                  aria-label="Acknowledge"
                >
                  <IconChecklist size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip label="Pending Acknowledgments">
                <Badge
                  tone="warning"
                  size="sm"
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setAckDocId(d.id);
                    openAckModal();
                  }}
                >
                  Pending Acks
                </Badge>
              </Tooltip>
              <Tooltip label="Version History">
                <IconButton
                  tone="default"
                  onClick={() => {
                    setVersionDocCode(d.document_number);
                    openVersionModal();
                  }}
                  aria-label="Version History"
                >
                  <IconHistory size={16} />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Select
            placeholder="Status"
            data={["draft", "under_review", "approved", "released", "revised", "obsolete"]}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            w={160}
          />
          <Select
            placeholder="Category"
            data={[...new Set(documents.map((d) => d.category))]}
            value={categoryFilter}
            onChange={setCategoryFilter}
            clearable
            w={160}
          />
          <Switch
            label="Training Required Only"
            checked={trainingOnly}
            onChange={(e) => setTrainingOnly(e.currentTarget.checked)}
            color="orange"
          />
          <Text c="dimmed" size="sm">
            {filteredDocuments.length} document(s)
          </Text>
        </Group>
        <Group>
          <Button
            tone="secondary"
            leftSection={<IconPrinter size={16} />}
            onClick={() => window.print()}
          >
            Print
          </Button>
          {canManage && (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
              New Document
            </Button>
          )}
        </Group>
      </Group>

      <DataTable
        columns={columns}
        data={filteredDocuments}
        loading={isLoading}
        rowKey={(d) => d.id}
        emptyTitle="No controlled documents"
        rowStyle={(d: QualityDocument) =>
          d.is_training_required
            ? { borderLeft: "4px solid var(--mantine-color-orange-5)" }
            : undefined
        }
      />

      <Drawer
        opened={opened}
        onClose={close}
        title="New Controlled Document"
        position="right"
        size="xl"
      >
        <Stack>
          <TextInput
            label="Document Number"
            required
            value={form.document_number}
            onChange={(e) => setForm({ ...form, document_number: e.currentTarget.value })}
          />
          <TextInput
            label="Title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.currentTarget.value })}
          />
          <Select
            label="Category"
            required
            data={["SOP", "Policy", "Protocol", "Guideline", "Manual", "Form", "Record", "Other"]}
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v ?? "" })}
          />
          <Textarea
            label="Content"
            minRows={4}
            value={form.content ?? ""}
            onChange={(e) => setForm({ ...form, content: e.currentTarget.value || undefined })}
          />
          <Textarea
            label="Summary"
            value={form.summary ?? ""}
            onChange={(e) => setForm({ ...form, summary: e.currentTarget.value || undefined })}
          />
          <EmployeeSearchSelect
            label="Reviewer"
            value={form.reviewer_id ?? ""}
            onChange={(employeeId) => setForm({ ...form, reviewer_id: employeeId || undefined })}
          />
          <Checkbox
            label="Training Required"
            checked={form.is_training_required ?? false}
            onChange={(e) => setForm({ ...form, is_training_required: e.currentTarget.checked })}
          />
          <Button
            tone="primary"
            loading={createMut.isPending}
            onClick={() => createMut.mutate(form)}
          >
            Save
          </Button>
        </Stack>
      </Drawer>

      <Modal
        opened={ackModalOpened}
        onClose={() => {
          closeAckModal();
          setAckDocId(null);
        }}
        title="Pending Acknowledgments"
        size="md"
      >
        {acksLoading ? (
          <Text c="dimmed">Loading...</Text>
        ) : pendingAcks.length === 0 ? (
          <Text c="dimmed">All users have acknowledged this document.</Text>
        ) : (
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              {pendingAcks.length} user(s) have not yet acknowledged
            </Text>
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>User ID</Table.Th>
                  <Table.Th>Name</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {pendingAcks.map((u: PendingAckUser) => (
                  <Table.Tr key={u.user_id}>
                    <Table.Td>{u.user_id.slice(0, 8)}...</Table.Td>
                    <Table.Td>{u.full_name}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        )}
      </Modal>

      <Modal
        opened={versionModalOpened}
        onClose={() => {
          closeVersionModal();
          setVersionDocCode(null);
        }}
        title="Version History"
        size="lg"
      >
        {versionsLoading ? (
          <Text c="dimmed">Loading...</Text>
        ) : versionHistory.length === 0 ? (
          <Text c="dimmed">No version history available.</Text>
        ) : (
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              {versionHistory.length} version(s) found for document {versionDocCode}
            </Text>
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Version</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Changes</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {versionHistory
                  .sort(
                    (a: QualityDocument, b: QualityDocument) =>
                      b.current_version - a.current_version,
                  )
                  .map((doc: QualityDocument, idx: number) => {
                    const prevDoc =
                      idx < versionHistory.length - 1
                        ? (versionHistory[idx + 1] as QualityDocument)
                        : null;
                    const hasChanges =
                      prevDoc && (doc.content !== prevDoc.content || doc.title !== prevDoc.title);
                    return (
                      <Table.Tr key={doc.id}>
                        <Table.Td>
                          <Badge tone="primary">v{doc.current_version}</Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge tone={docStatusColors[doc.status] ?? "neutral"}>
                            {doc.status.replace(/_/g, " ")}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{new Date(doc.created_at).toLocaleDateString()}</Table.Td>
                        <Table.Td>
                          {hasChanges ? (
                            <Badge tone="warning" size="sm">
                              Modified
                            </Badge>
                          ) : idx === versionHistory.length - 1 ? (
                            <Text size="sm" c="dimmed">
                              Initial
                            </Text>
                          ) : (
                            <Text size="sm" c="dimmed">
                              No changes
                            </Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
              </Table.Tbody>
            </Table>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

// ── Incidents Tab ───────────────────────────────────────

function IncidentsTab() {
  const canCreate = useHasPermission(P.QUALITY.INCIDENTS_CREATE);
  const canUpdate = useHasPermission(P.QUALITY.INCIDENTS_UPDATE);
  const canManageCapa = useHasPermission(P.QUALITY.CAPA_MANAGE);
  const qc = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [selectedIncident, setSelectedIncident] = useState<QualityIncident | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [selectedCapa, setSelectedCapa] = useState<QualityCapa | null>(null);

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["quality-incidents", statusFilter, severityFilter],
    queryFn: () =>
      qualityService.listQualityIncidents({
        status: statusFilter ?? undefined,
        severity: severityFilter ?? undefined,
      }),
  });

  const { data: capaList = [] } = useQuery({
    queryKey: ["quality-capa", selectedIncident?.id],
    queryFn: () => qualityService.listCapa({ incident_id: selectedIncident?.id }),
    enabled: !!selectedIncident,
  });

  // The list omits the heavy free-text/JSONB fields — fetch the full incident
  // (with description/immediate_action/root_cause) when opening the detail view.
  const openIncidentDetail = async (id: string) => {
    setSelectedIncident(null);
    openDetail();
    const full = await qc.fetchQuery({
      queryKey: ["quality-incident", id],
      queryFn: () => qualityService.getQualityIncident(id),
    });
    setSelectedIncident(full);
  };

  const [form, setForm] = useState<CreateQualityIncidentRequest>({
    title: "",
    incident_type: "",
    severity: "minor",
    incident_date: new Date().toISOString().slice(0, 10),
  });

  const createMut = useMutation({
    mutationFn: (data: CreateQualityIncidentRequest) => qualityService.createQualityIncident(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-incidents"] });
      toast.success("", { title: "Incident reported" });
      closeCreate();
      setForm({
        title: "",
        incident_type: "",
        severity: "minor",
        incident_date: new Date().toISOString().slice(0, 10),
      });
    },
  });

  const openNearMissReport = () => {
    setForm({
      title: "",
      incident_type: "",
      severity: "near_miss",
      incident_date: new Date().toISOString().slice(0, 10),
    });
    openCreate();
  };

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      qualityService.updateQualityIncident(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-incidents"] });
      toast.success("", { title: "Incident updated" });
    },
  });

  // Mortality review
  const [mortalityOpened, { open: openMortality, close: closeMortality }] = useDisclosure(false);
  const [mortalityForm, setMortalityForm] = useState<CreateMortalityReviewRequest>({
    patient_id: "",
    death_date: "",
    primary_diagnosis: "",
  });
  const [mortalityIcd11Code, setMortalityIcd11Code] = useState("");

  const createMortalityMut = useMutation({
    mutationFn: (data: CreateMortalityReviewRequest) => qualityService.createMortalityReview(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-incidents"] });
      toast.success("", { title: "Mortality review created" });
      closeMortality();
      setMortalityForm({ patient_id: "", death_date: "", primary_diagnosis: "" });
      setMortalityIcd11Code("");
    },
  });

  const [capaForm, setCapaForm] = useState<CreateCapaRequest>({
    incident_id: "",
    capa_type: "corrective",
    assigned_to: "",
    due_date: "",
  });

  const createCapaMut = useMutation({
    mutationFn: (data: CreateCapaRequest) => qualityService.createCapa(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-capa"] });
      toast.success("", { title: "CAPA created" });
      setCapaForm({ incident_id: "", capa_type: "corrective", assigned_to: "", due_date: "" });
    },
  });

  const columns = [
    {
      key: "incident_number" as const,
      label: "Incident #",
      render: (i: QualityIncidentListItem) => <Text fw={500}>{i.incident_number}</Text>,
    },
    { key: "title" as const, label: "Title", render: (i: QualityIncidentListItem) => i.title },
    {
      key: "incident_type" as const,
      label: "Type",
      render: (i: QualityIncidentListItem) => i.incident_type,
    },
    {
      key: "severity" as const,
      label: "Severity",
      render: (i: QualityIncidentListItem) => (
        <Badge tone={statusColorTone(i.severity)}>{i.severity.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "status" as const,
      label: "Status",
      render: (i: QualityIncidentListItem) => (
        <Badge tone={incidentStatusColors[i.status] ?? "neutral"}>
          {i.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "incident_date" as const,
      label: "Date",
      render: (i: QualityIncidentListItem) => new Date(i.incident_date).toLocaleDateString(),
    },
    {
      key: "anonymous" as const,
      label: "Anon",
      render: (i: QualityIncidentListItem) =>
        i.is_anonymous ? (
          <Badge size="sm" tone="accent">
            Yes
          </Badge>
        ) : (
          "---"
        ),
    },
    {
      key: "actions" as const,
      label: "Actions",
      render: (i: QualityIncidentListItem) => (
        <Group gap="xs">
          <Tooltip label="View Details">
            <IconButton
              tone="primary"
              onClick={() => void openIncidentDetail(i.id)}
              aria-label="View Details"
            >
              <IconEye size={16} />
            </IconButton>
          </Tooltip>
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Select
            placeholder="Status"
            data={[
              "reported",
              "acknowledged",
              "investigating",
              "rca_complete",
              "capa_assigned",
              "capa_in_progress",
              "closed",
              "reopened",
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            w={180}
          />
          <Select
            placeholder="Severity"
            data={["near_miss", "minor", "moderate", "major", "sentinel"]}
            value={severityFilter}
            onChange={setSeverityFilter}
            clearable
            w={140}
          />
          <Text c="dimmed" size="sm">
            {incidents.length} incident(s)
          </Text>
        </Group>
        {canCreate && (
          <Group>
            <Button
              tone="secondary"
              leftSection={<IconFileDescription size={16} />}
              onClick={openMortality}
            >
              Mortality Review
            </Button>
            <Button
              tone="secondary"
              leftSection={<IconAlertTriangle size={16} />}
              onClick={openNearMissReport}
            >
              Report Near Miss
            </Button>
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
              Report Incident
            </Button>
          </Group>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={incidents}
        loading={isLoading}
        rowKey={(i) => i.id}
        emptyTitle="No incidents reported"
      />

      {/* Create Incident Drawer */}
      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title="Report Incident"
        position="right"
        size="xl"
      >
        <Stack>
          <TextInput
            label="Title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.currentTarget.value })}
          />
          <Textarea
            label="Description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value || undefined })}
          />
          <Select
            label="Incident Type"
            required
            data={[
              { value: "medication_error", label: "Medication error" },
              { value: "fall", label: "Patient fall" },
              { value: "infection", label: "Infection" },
              { value: "surgical", label: "Surgical" },
              { value: "diagnostic", label: "Diagnostic" },
              { value: "equipment", label: "Equipment" },
              { value: "behavioral", label: "Behavioral" },
              { value: "other", label: "Other" },
            ]}
            value={form.incident_type}
            onChange={(v) => setForm({ ...form, incident_type: v ?? "" })}
          />
          {form.incident_type === "fall" && (
            <Alert
              icon={<IconAlertTriangle size={16} />}
              tone="warning"
              title="Feeds NABH falls register"
            >
              Select the patient, location, severity, and immediate action. This report will
              automatically create or update the NABH falls evidence row.
            </Alert>
          )}
          <Select
            label="Severity"
            required
            data={
              [
                "near_miss",
                "minor",
                "moderate",
                "major",
                "sentinel",
              ] satisfies IncidentSeverityType[]
            }
            value={form.severity}
            onChange={(v) => setForm({ ...form, severity: (v ?? "minor") as IncidentSeverityType })}
          />
          <DepartmentSelect
            value={form.department_id ?? ""}
            onChange={(id) => setForm({ ...form, department_id: id || undefined })}
          />
          <TextInput
            label="Location"
            value={form.location ?? ""}
            onChange={(e) => setForm({ ...form, location: e.currentTarget.value || undefined })}
          />
          <TextInput
            label="Incident Date"
            type="date"
            required
            value={form.incident_date}
            onChange={(e) => setForm({ ...form, incident_date: e.currentTarget.value })}
          />
          <PatientSearchSelect
            label="Patient (optional)"
            value={form.patient_id ?? ""}
            onChange={(id) => setForm({ ...form, patient_id: id || undefined })}
          />
          <Textarea
            label="Immediate Action Taken"
            value={form.immediate_action ?? ""}
            onChange={(e) =>
              setForm({ ...form, immediate_action: e.currentTarget.value || undefined })
            }
          />
          <Switch
            label="Report Anonymously"
            checked={form.is_anonymous ?? false}
            onChange={(e) => setForm({ ...form, is_anonymous: e.currentTarget.checked })}
          />
          <Button
            tone="primary"
            loading={createMut.isPending}
            onClick={() => createMut.mutate(form)}
          >
            Submit Report
          </Button>
        </Stack>
      </Drawer>

      {/* Incident Detail Drawer */}
      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title={`Incident: ${selectedIncident?.incident_number ?? ""}`}
        position="right"
        size="lg"
      >
        {detailOpened && !selectedIncident && (
          <Center py="xl">
            <Loader />
          </Center>
        )}
        {selectedIncident && (
          <Stack>
            <Group>
              <Badge tone={statusColorTone(selectedIncident.severity)} size="lg">
                {selectedIncident.severity.replace(/_/g, " ")}
              </Badge>
              <Badge tone={incidentStatusColors[selectedIncident.status] ?? "neutral"} size="lg">
                {selectedIncident.status.replace(/_/g, " ")}
              </Badge>
            </Group>
            <Text fw={600}>{selectedIncident.title}</Text>
            {selectedIncident.description && (
              <Text size="sm" c="dimmed">
                {selectedIncident.description}
              </Text>
            )}
            <Text size="sm">Type: {selectedIncident.incident_type}</Text>
            <Text size="sm">
              Date: {new Date(selectedIncident.incident_date).toLocaleDateString()}
            </Text>
            {selectedIncident.location && (
              <Text size="sm">Location: {selectedIncident.location}</Text>
            )}
            {selectedIncident.immediate_action && (
              <>
                <Text fw={500} size="sm">
                  Immediate Action:
                </Text>
                <Text size="sm" c="dimmed">
                  {selectedIncident.immediate_action}
                </Text>
              </>
            )}

            {/* RCA section */}
            {canUpdate && (
              <>
                <Text fw={600} mt="md">
                  Root Cause Analysis
                </Text>
                <Textarea
                  label="Root Cause"
                  value={selectedIncident.root_cause ?? ""}
                  onChange={(e) =>
                    setSelectedIncident({
                      ...selectedIncident,
                      root_cause: e.currentTarget.value || undefined,
                    })
                  }
                />
                <Button
                  tone="secondary"
                  size="sm"
                  loading={updateMut.isPending}
                  onClick={() =>
                    updateMut.mutate({
                      id: selectedIncident.id,
                      data: { root_cause: selectedIncident.root_cause, status: "rca_complete" },
                    })
                  }
                >
                  Save RCA
                </Button>
              </>
            )}

            {/* CAPA section */}
            <Text fw={600} mt="md">
              CAPA ({capaList.length})
            </Text>
            {capaList.length > 0 && (
              <Table withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>CAPA #</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Due</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {capaList.map((c: QualityCapa) => {
                    const createdDate = new Date(c.created_at);
                    const now = new Date();
                    const capaAgeInDays = Math.floor(
                      (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
                    );
                    return (
                      <Table.Tr key={c.id}>
                        <Table.Td>
                          <Text fw={500}>{c.capa_number}</Text>
                          <Text size="xs" c="dimmed">
                            {capaAgeInDays} days old
                          </Text>
                        </Table.Td>
                        <Table.Td>{c.capa_type}</Table.Td>
                        <Table.Td>
                          <Badge tone={capaStatusColors[c.status] ?? "neutral"}>
                            {c.status.replace(/_/g, " ")}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{new Date(c.due_date).toLocaleDateString()}</Table.Td>
                        <Table.Td>
                          <Tooltip label="View Effectiveness">
                            <IconButton
                              tone="primary"
                              onClick={() => setSelectedCapa(c)}
                              aria-label="View Effectiveness"
                            >
                              <IconEye size={16} />
                            </IconButton>
                          </Tooltip>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}

            {selectedCapa && (
              <Card withBorder shadow="sm" p="md" mt="md">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text fw={600}>CAPA Effectiveness Review: {selectedCapa.capa_number}</Text>
                    <Button tone="ghost" size="compact-sm" onClick={() => setSelectedCapa(null)}>
                      Close
                    </Button>
                  </Group>
                  {(() => {
                    const createdDate = new Date(selectedCapa.created_at);
                    const dueDate = new Date(selectedCapa.due_date);
                    const now = new Date();
                    const capaAgeInDays = Math.floor(
                      (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
                    );
                    const daysOverdueSinceCompletion = selectedCapa.completed_at
                      ? Math.floor(
                          (now.getTime() - new Date(selectedCapa.completed_at).getTime()) /
                            (1000 * 60 * 60 * 24),
                        )
                      : 0;
                    const reviewOverdue =
                      selectedCapa.completed_at && daysOverdueSinceCompletion > 90;
                    const effectivenessReview = (
                      selectedCapa as QualityCapa & {
                        effectiveness_review?: {
                          effectiveness_check_date?: string;
                          effectiveness_result?: string;
                        };
                      }
                    ).effectiveness_review;
                    return (
                      <>
                        <SimpleGrid cols={3} spacing="sm">
                          <Card withBorder p="xs">
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                              CAPA Age
                            </Text>
                            <Text fw={600} mt={4}>
                              {capaAgeInDays} days
                            </Text>
                          </Card>
                          <Card withBorder p="xs">
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                              Due Date
                            </Text>
                            <Text fw={600} mt={4}>
                              {dueDate.toLocaleDateString()}
                            </Text>
                          </Card>
                          <Card withBorder p="xs">
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                              Effectiveness Review
                            </Text>
                            {effectivenessReview ? (
                              <>
                                <Text fw={600} mt={4} c="success">
                                  Completed
                                </Text>
                                {effectivenessReview.effectiveness_check_date && (
                                  <Text size="xs" c="dimmed">
                                    {new Date(
                                      effectivenessReview.effectiveness_check_date,
                                    ).toLocaleDateString()}
                                  </Text>
                                )}
                              </>
                            ) : reviewOverdue ? (
                              <Badge tone="danger" mt={4}>
                                Overdue
                              </Badge>
                            ) : selectedCapa.completed_at ? (
                              <Badge tone="warning" mt={4}>
                                Due Soon
                              </Badge>
                            ) : (
                              <Badge tone="neutral" mt={4}>
                                Pending
                              </Badge>
                            )}
                          </Card>
                        </SimpleGrid>
                        {effectivenessReview ? (
                          <Card withBorder p="sm">
                            <Text size="sm" fw={600} mb="xs">
                              Effectiveness Check Result
                            </Text>
                            <Text size="sm">
                              {effectivenessReview.effectiveness_result ?? "No result recorded"}
                            </Text>
                            {effectivenessReview.effectiveness_check_date && (
                              <Text size="xs" c="dimmed" mt="xs">
                                Checked on{" "}
                                {new Date(
                                  effectivenessReview.effectiveness_check_date,
                                ).toLocaleDateString()}
                              </Text>
                            )}
                          </Card>
                        ) : (
                          <Badge tone="neutral" size="lg">
                            Pending Review
                          </Badge>
                        )}
                        {reviewOverdue && (
                          <Badge tone="danger" size="lg">
                            Review overdue by {daysOverdueSinceCompletion - 90} days (90-day
                            threshold exceeded)
                          </Badge>
                        )}
                      </>
                    );
                  })()}
                </Stack>
              </Card>
            )}

            {canManageCapa && (
              <>
                <Text fw={500} size="sm" mt="sm">
                  Add CAPA
                </Text>
                <Select
                  label="Type"
                  data={["corrective", "preventive"]}
                  value={capaForm.capa_type}
                  onChange={(v) => setCapaForm({ ...capaForm, capa_type: v ?? "corrective" })}
                />
                <Textarea
                  label="Description"
                  value={capaForm.description ?? ""}
                  onChange={(e) =>
                    setCapaForm({ ...capaForm, description: e.currentTarget.value || undefined })
                  }
                />
                <Textarea
                  label="Action Plan"
                  value={capaForm.action_plan ?? ""}
                  onChange={(e) =>
                    setCapaForm({ ...capaForm, action_plan: e.currentTarget.value || undefined })
                  }
                />
                <EmployeeSearchSelect
                  label="Assigned to"
                  required
                  value={capaForm.assigned_to}
                  onChange={(employeeId) => setCapaForm({ ...capaForm, assigned_to: employeeId })}
                />
                <TextInput
                  label="Due Date"
                  type="date"
                  required
                  value={capaForm.due_date}
                  onChange={(e) => setCapaForm({ ...capaForm, due_date: e.currentTarget.value })}
                />
                <Button
                  tone="primary"
                  size="sm"
                  loading={createCapaMut.isPending}
                  onClick={() =>
                    createCapaMut.mutate({ ...capaForm, incident_id: selectedIncident.id })
                  }
                >
                  Create CAPA
                </Button>
              </>
            )}
          </Stack>
        )}
      </Drawer>

      {/* Mortality Review Drawer */}
      <Drawer
        opened={mortalityOpened}
        onClose={closeMortality}
        title="Mortality Review"
        position="right"
        size="xl"
      >
        <Stack>
          <PatientSearchSelect
            value={mortalityForm.patient_id}
            onChange={(v) => setMortalityForm({ ...mortalityForm, patient_id: v })}
            required
          />
          <TextInput
            label="Death Date"
            type="date"
            required
            value={mortalityForm.death_date}
            onChange={(e) =>
              setMortalityForm({ ...mortalityForm, death_date: e.currentTarget.value })
            }
          />
          <Icd11CodeSelect
            label="Primary ICD-11 diagnosis"
            value={mortalityIcd11Code || null}
            onChange={(value) => setMortalityIcd11Code(value ?? "")}
            onSelectResult={(result) =>
              setMortalityForm({
                ...mortalityForm,
                primary_diagnosis: `${result.code} - ${result.display}`,
              })
            }
            required
          />
          <TextInput
            label="Primary diagnosis summary"
            required
            value={mortalityForm.primary_diagnosis}
            onChange={(e) =>
              setMortalityForm({ ...mortalityForm, primary_diagnosis: e.currentTarget.value })
            }
          />
          <Textarea
            label="Review Findings"
            value={mortalityForm.review_findings ?? ""}
            onChange={(e) =>
              setMortalityForm({
                ...mortalityForm,
                review_findings: e.currentTarget.value || undefined,
              })
            }
          />
          <Select
            label="Preventability"
            data={[
              "definitely_preventable",
              "possibly_preventable",
              "not_preventable",
              "undetermined",
            ]}
            value={mortalityForm.preventability ?? null}
            onChange={(v) => setMortalityForm({ ...mortalityForm, preventability: v ?? undefined })}
            clearable
          />
          <Button
            tone="primary"
            loading={createMortalityMut.isPending}
            onClick={() => createMortalityMut.mutate(mortalityForm)}
          >
            Submit Review
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Committees Tab ──────────────────────────────────────

export function QualityPage() {
  useRequirePermission(P.QUALITY.INDICATORS_LIST);

  return (
    <div className={classes.qualityPage}>
      <PageHeader
        title="Quality Management"
        subtitle="Indicators, documents, incidents, committees, accreditation, and audits"
        icon={<IconShieldCheck size={20} stroke={1.5} />}
        color="teal"
      />

      <Tabs defaultValue="indicators" mt="md">
        <Tabs.List>
          <Tabs.Tab value="indicators" leftSection={<IconChartBar size={16} />}>
            Indicators
          </Tabs.Tab>
          <Tabs.Tab value="documents" leftSection={<IconFileDescription size={16} />}>
            Documents
          </Tabs.Tab>
          <Tabs.Tab value="incidents" leftSection={<IconAlertTriangle size={16} />}>
            Incidents
          </Tabs.Tab>
          <Tabs.Tab value="committees" leftSection={<IconUsers size={16} />}>
            Committees
          </Tabs.Tab>
          <Tabs.Tab value="accreditation" leftSection={<IconAward size={16} />}>
            Accreditation
          </Tabs.Tab>
          <Tabs.Tab value="audits" leftSection={<IconClipboardCheck size={16} />}>
            Audits
          </Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconTrendingUp size={16} />}>
            Analytics & Reviews
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="indicators" pt="md">
          <IndicatorsTab />
        </Tabs.Panel>
        <Tabs.Panel value="documents" pt="md">
          <DocumentsTab />
        </Tabs.Panel>
        <Tabs.Panel value="incidents" pt="md">
          <IncidentsTab />
        </Tabs.Panel>
        <Tabs.Panel value="committees" pt="md">
          <CommitteesTab />
        </Tabs.Panel>
        <Tabs.Panel value="accreditation" pt="md">
          <AccreditationTab />
        </Tabs.Panel>
        <Tabs.Panel value="audits" pt="md">
          <AuditsTab />
        </Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md">
          <AnalyticsReviewsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
