import "@mantine/charts/styles.css";
import { BarChart, DonutChart, LineChart } from "@mantine/charts";
import {
  Card,
  Checkbox,
  Drawer,
  Grid,
  Group,
  Modal,
  MultiSelect,
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
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  AccreditationBodyType,
  AuditFinding,
  CommitteeFrequencyType,
  ComplianceStatusType,
  CreateAccreditationStandardRequest,
  CreateAuditFindingRequest,
  CreateCapaRequest,
  CreateMeetingRequest,
  CreateMortalityReviewRequest,
  CreateQualityAuditRequest,
  CreateQualityCommitteeRequest,
  CreateQualityDocumentRequest,
  CreateQualityIncidentRequest,
  CreateQualityIndicatorRequest,
  DepartmentScorecard,
  EvidenceCompilation,
  IncidentSeverityType,
  IndicatorFrequencyType,
  PatientSafetyIndicator,
  PendingAckUser,
  QualityAccreditationCompliance,
  QualityAccreditationStandard,
  QualityActionItem,
  QualityAudit,
  QualityCapa,
  QualityCommittee,
  QualityCommitteeMeeting,
  QualityDocument,
  QualityIncident,
  QualityIndicator,
  QualityIndicatorValue,
  ScheduleAuditsRequest,
  UpdateComplianceRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconAward,
  IconCalculator,
  IconCalendarEvent,
  IconChartBar,
  IconChecklist,
  IconClipboardCheck,
  IconEye,
  IconFileDescription,
  IconFileStack,
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
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Badge, type BadgeTone, Button, IconButton, Table } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { statusColor } from "@/lib/status-colors";
import { qualityService } from "@/services/quality.service";
import classes from "./quality.module.scss";

// ── Color Maps ──────────────────────────────────────────

const incidentStatusColors: Record<string, BadgeTone> = {
  reported: "neutral",
  acknowledged: "primary",
  investigating: "primary",
  rca_complete: "accent",
  capa_assigned: "warning",
  capa_in_progress: "success",
  closed: "success",
  reopened: "danger",
};

const docStatusColors: Record<string, BadgeTone> = {
  draft: "neutral",
  under_review: "primary",
  approved: "success",
  released: "success",
  revised: "warning",
  obsolete: "danger",
};

const capaStatusColors: Record<string, BadgeTone> = {
  open: "neutral",
  in_progress: "primary",
  completed: "success",
  verified: "success",
  overdue: "danger",
};

const auditStatusColors: Record<string, BadgeTone> = {
  planned: "neutral",
  in_progress: "primary",
  completed: "success",
  cancelled: "danger",
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
      notifications.show({ title: "Indicator created", message: "", color: "success" });
      close();
      setForm({ code: "", name: "", category: "", frequency: "monthly" });
    },
  });

  const calculateMut = useMutation({
    mutationFn: (id: string) => qualityService.calculateIndicator(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-indicators"] });
      void qc.invalidateQueries({ queryKey: ["quality-indicator-values"] });
      notifications.show({
        title: "Indicator calculated",
        message: "Value auto-computed",
        color: "teal",
      });
    },
    onError: () => {
      notifications.show({
        title: "Calculation failed",
        message: "Could not auto-calculate indicator",
        color: "danger",
      });
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
      notifications.show({ title: "Value recorded", message: "", color: "success" });
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
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Indicator</Table.Th>
                  <Table.Th>Current Value</Table.Th>
                  <Table.Th>Target Value</Table.Th>
                  <Table.Th>Variance</Table.Th>
                  <Table.Th>Progress</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {indicators
                  .filter((i) => i.target_value != null)
                  .map((i) => {
                    const latestValue = indicatorLatestValues.get(i.id);
                    const current = latestValue?.calculated_value ?? 0;
                    const target = i.target_value ?? 0;
                    const variance = target !== 0 ? ((current - target) / target) * 100 : 0;
                    const progress = target !== 0 ? Math.min(100, (current / target) * 100) : 0;
                    const meetsTarget = current >= target;
                    return (
                      <Table.Tr key={i.id}>
                        <Table.Td>
                          <div>
                            <Text fw={500} size="sm">
                              {i.name}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {i.code}
                            </Text>
                          </div>
                        </Table.Td>
                        <Table.Td>
                          <Badge tone={meetsTarget ? "success" : "danger"}>
                            {current.toFixed(2)}
                            {i.unit ? ` ${i.unit}` : ""}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          {target.toFixed(2)}
                          {i.unit ? ` ${i.unit}` : ""}
                        </Table.Td>
                        <Table.Td>
                          <Text c={variance >= 0 ? "success" : "danger"} fw={500}>
                            {variance > 0 ? "+" : ""}
                            {variance.toFixed(1)}%
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Progress
                            value={progress}
                            color={meetsTarget ? "success" : "danger"}
                            size="lg"
                          />
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
              </Table.Tbody>
            </Table>
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
      notifications.show({ title: "Document created", message: "", color: "success" });
      close();
      setForm({ document_number: "", title: "", category: "" });
    },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      qualityService.updateDocumentStatus(id, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-documents"] });
      notifications.show({ title: "Status updated", message: "", color: "success" });
    },
  });

  const acknowledgeMut = useMutation({
    mutationFn: (id: string) => qualityService.acknowledgeDocument(id),
    onSuccess: () => {
      notifications.show({ title: "Document acknowledged", message: "", color: "success" });
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
          <TextInput
            label="Reviewer ID"
            value={form.reviewer_id ?? ""}
            onChange={(e) => setForm({ ...form, reviewer_id: e.currentTarget.value || undefined })}
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
      notifications.show({ title: "Incident reported", message: "", color: "success" });
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
      notifications.show({ title: "Incident updated", message: "", color: "success" });
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
      notifications.show({ title: "Mortality review created", message: "", color: "success" });
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
      notifications.show({ title: "CAPA created", message: "", color: "success" });
      setCapaForm({ incident_id: "", capa_type: "corrective", assigned_to: "", due_date: "" });
    },
  });

  const columns = [
    {
      key: "incident_number" as const,
      label: "Incident #",
      render: (i: QualityIncident) => <Text fw={500}>{i.incident_number}</Text>,
    },
    { key: "title" as const, label: "Title", render: (i: QualityIncident) => i.title },
    {
      key: "incident_type" as const,
      label: "Type",
      render: (i: QualityIncident) => i.incident_type,
    },
    {
      key: "severity" as const,
      label: "Severity",
      render: (i: QualityIncident) => (
        <Badge tone={statusColorTone(i.severity)}>{i.severity.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "status" as const,
      label: "Status",
      render: (i: QualityIncident) => (
        <Badge tone={incidentStatusColors[i.status] ?? "neutral"}>
          {i.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "incident_date" as const,
      label: "Date",
      render: (i: QualityIncident) => new Date(i.incident_date).toLocaleDateString(),
    },
    {
      key: "anonymous" as const,
      label: "Anon",
      render: (i: QualityIncident) =>
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
      render: (i: QualityIncident) => (
        <Group gap="xs">
          <Tooltip label="View Details">
            <IconButton
              tone="primary"
              onClick={() => {
                setSelectedIncident(i);
                openDetail();
              }}
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
                <TextInput
                  label="Assigned To (User ID)"
                  required
                  value={capaForm.assigned_to}
                  onChange={(e) => setCapaForm({ ...capaForm, assigned_to: e.currentTarget.value })}
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

function CommitteesTab() {
  const canManage = useHasPermission(P.QUALITY.COMMITTEES_MANAGE);
  const qc = useQueryClient();
  const [committeeOpened, { open: openCommittee, close: closeCommittee }] = useDisclosure(false);
  const [meetingOpened, { open: openMeeting, close: closeMeeting }] = useDisclosure(false);
  const [selectedCommittee, setSelectedCommittee] = useState<QualityCommittee | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const { data: committees = [], isLoading } = useQuery({
    queryKey: ["quality-committees"],
    queryFn: () => qualityService.listQualityCommittees(),
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["quality-meetings", selectedCommittee?.id],
    queryFn: () => qualityService.listCommitteeMeetings({ committee_id: selectedCommittee?.id }),
    enabled: !!selectedCommittee,
  });

  const { data: actionItems = [] } = useQuery({
    queryKey: ["quality-action-items"],
    queryFn: () => qualityService.listActionItems(),
  });

  // Patient feedback data (graceful fallback if API not available)
  const { data: feedbackData, isLoading: feedbackLoading } = useQuery({
    queryKey: ["patient-feedback"],
    queryFn: async () => null,
    enabled: showFeedback,
  });

  // Mock chart data for feedback analysis
  const feedbackByDeptData = useMemo(() => {
    if (!feedbackData || !Array.isArray(feedbackData)) {
      return [
        { department: "OPD", count: 45 },
        { department: "IPD", count: 32 },
        { department: "Emergency", count: 28 },
        { department: "Lab", count: 18 },
        { department: "Pharmacy", count: 15 },
      ];
    }
    // Process real data if available
    return feedbackData;
  }, [feedbackData]);

  const feedbackByRatingData = useMemo(() => {
    if (!feedbackData || !Array.isArray(feedbackData)) {
      return [
        { name: "Excellent", value: 42, color: "green.6" },
        { name: "Good", value: 35, color: "teal.5" },
        { name: "Average", value: 15, color: "yellow.5" },
        { name: "Poor", value: 5, color: "orange.5" },
        { name: "Very Poor", value: 3, color: "red.6" },
      ];
    }
    // Process real data if available
    return feedbackData;
  }, [feedbackData]);

  const [committeeForm, setCommitteeForm] = useState<CreateQualityCommitteeRequest>({
    name: "",
    code: "",
    committee_type: "",
    meeting_frequency: "monthly",
  });

  const createCommitteeMut = useMutation({
    mutationFn: (data: CreateQualityCommitteeRequest) =>
      qualityService.createQualityCommittee(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-committees"] });
      notifications.show({ title: "Committee created", message: "", color: "success" });
      closeCommittee();
      setCommitteeForm({ name: "", code: "", committee_type: "", meeting_frequency: "monthly" });
    },
  });

  const [meetingForm, setMeetingForm] = useState<CreateMeetingRequest>({
    committee_id: "",
    scheduled_date: "",
  });

  const createMeetingMut = useMutation({
    mutationFn: (data: CreateMeetingRequest) => qualityService.createCommitteeMeeting(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-meetings"] });
      notifications.show({ title: "Meeting scheduled", message: "", color: "success" });
      closeMeeting();
      setMeetingForm({ committee_id: "", scheduled_date: "" });
    },
  });

  const autoScheduleMut = useMutation({
    mutationFn: (committeeId: string) =>
      qualityService.autoScheduleMeetings(committeeId, { months_ahead: 6 }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-meetings"] });
      notifications.show({
        title: "Meetings auto-scheduled",
        message: "Scheduled for the next 6 months",
        color: "teal",
      });
    },
    onError: () => {
      notifications.show({
        title: "Auto-schedule failed",
        message: "Could not generate meeting schedule",
        color: "danger",
      });
    },
  });

  const committeeColumns = [
    {
      key: "code" as const,
      label: "Code",
      render: (c: QualityCommittee) => <Text fw={500}>{c.code}</Text>,
    },
    { key: "name" as const, label: "Name", render: (c: QualityCommittee) => c.name },
    { key: "type" as const, label: "Type", render: (c: QualityCommittee) => c.committee_type },
    {
      key: "frequency" as const,
      label: "Meeting Frequency",
      render: (c: QualityCommittee) => c.meeting_frequency.replace(/_/g, " "),
    },
    {
      key: "mandatory" as const,
      label: "Mandatory",
      render: (c: QualityCommittee) =>
        c.is_mandatory ? (
          <Badge tone="danger" size="sm">
            Mandatory
          </Badge>
        ) : (
          "---"
        ),
    },
    {
      key: "active" as const,
      label: "Status",
      render: (c: QualityCommittee) =>
        c.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>,
    },
    {
      key: "actions" as const,
      label: "Actions",
      render: (c: QualityCommittee) => (
        <Group gap="xs">
          <Tooltip label="View Meetings">
            <IconButton
              tone="primary"
              onClick={() => {
                setSelectedCommittee(c);
              }}
              aria-label="View Meetings"
            >
              <IconCalendarEvent size={16} />
            </IconButton>
          </Tooltip>
          {canManage && (
            <Tooltip label="Schedule Meeting">
              <IconButton
                tone="success"
                onClick={() => {
                  setSelectedCommittee(c);
                  setMeetingForm({ committee_id: c.id, scheduled_date: "" });
                  openMeeting();
                }}
                aria-label="Schedule Meeting"
              >
                <IconPlus size={16} />
              </IconButton>
            </Tooltip>
          )}
          {canManage && (
            <Tooltip label="Auto-Schedule 6 Months">
              <IconButton
                tone="primary"
                loading={autoScheduleMut.isPending}
                onClick={() => autoScheduleMut.mutate(c.id)}
                aria-label="Auto-Schedule 6 Months"
              >
                <IconCalendarEvent size={16} />
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
          <Text c="dimmed" size="sm">
            {committees.length} committee(s)
          </Text>
          <Button tone="secondary" size="sm" onClick={() => setShowFeedback(!showFeedback)}>
            {showFeedback ? "Hide Feedback" : "Show Feedback"}
          </Button>
        </Group>
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCommittee}>
            New Committee
          </Button>
        )}
      </Group>

      {showFeedback && (
        <Card withBorder shadow="sm" p="md" mb="md">
          <Text fw={600} mb="md">
            Patient Feedback Analysis
          </Text>
          {feedbackLoading ? (
            <Text c="dimmed">Loading feedback data...</Text>
          ) : !feedbackData ? (
            <>
              <Text c="dimmed" size="sm" mb="md">
                No feedback data available. Showing sample structure.
              </Text>
              <SimpleGrid cols={2} spacing="lg">
                <div>
                  <Text size="sm" fw={600} mb="xs">
                    Feedback by Department
                  </Text>
                  <BarChart
                    h={250}
                    data={feedbackByDeptData}
                    dataKey="department"
                    series={[{ name: "count", color: "teal.6" }]}
                    withLegend={false}
                  />
                </div>
                <div>
                  <Text size="sm" fw={600} mb="xs">
                    Feedback by Rating
                  </Text>
                  <DonutChart
                    data={feedbackByRatingData}
                    withLabelsLine
                    withLabels
                    tooltipDataSource="segment"
                    size={220}
                    thickness={30}
                  />
                </div>
              </SimpleGrid>
            </>
          ) : (
            <Text c="dimmed">Feedback data loaded. Display logic pending.</Text>
          )}
        </Card>
      )}

      <DataTable
        columns={committeeColumns}
        data={committees}
        loading={isLoading}
        rowKey={(c) => c.id}
        emptyTitle="No committees"
      />

      {/* Meetings for selected committee */}
      {selectedCommittee && (
        <>
          <Text fw={600} mt="md">
            Meetings: {selectedCommittee.name}
          </Text>
          {meetings.length > 0 ? (
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Meeting #</Table.Th>
                  <Table.Th>Scheduled</Table.Th>
                  <Table.Th>Actual</Table.Th>
                  <Table.Th>Venue</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {meetings.map((m: QualityCommitteeMeeting) => (
                  <Table.Tr key={m.id}>
                    <Table.Td>{m.meeting_number ?? "---"}</Table.Td>
                    <Table.Td>{new Date(m.scheduled_date).toLocaleDateString()}</Table.Td>
                    <Table.Td>
                      {m.actual_date ? new Date(m.actual_date).toLocaleDateString() : "---"}
                    </Table.Td>
                    <Table.Td>{m.venue ?? "---"}</Table.Td>
                    <Table.Td>
                      <Badge tone="neutral">{m.status}</Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text c="dimmed" size="sm">
              No meetings scheduled
            </Text>
          )}
        </>
      )}

      {/* Action Items */}
      {actionItems.length > 0 && (
        <>
          <Text fw={600} mt="md">
            Action Items ({actionItems.length})
          </Text>
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Source</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>Due Date</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {actionItems.map((a: QualityActionItem) => (
                <Table.Tr key={a.id}>
                  <Table.Td>{a.source_type}</Table.Td>
                  <Table.Td>{a.description ?? "---"}</Table.Td>
                  <Table.Td>{new Date(a.due_date).toLocaleDateString()}</Table.Td>
                  <Table.Td>
                    <Badge
                      tone={
                        a.status === "completed"
                          ? "success"
                          : a.status === "overdue"
                            ? "danger"
                            : "primary"
                      }
                    >
                      {a.status}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}

      {/* Create Committee Drawer */}
      <Drawer
        opened={committeeOpened}
        onClose={closeCommittee}
        title="New Committee"
        position="right"
        size="xl"
      >
        <Stack>
          <TextInput
            label="Code"
            required
            value={committeeForm.code}
            onChange={(e) => setCommitteeForm({ ...committeeForm, code: e.currentTarget.value })}
          />
          <TextInput
            label="Name"
            required
            value={committeeForm.name}
            onChange={(e) => setCommitteeForm({ ...committeeForm, name: e.currentTarget.value })}
          />
          <Textarea
            label="Description"
            value={committeeForm.description ?? ""}
            onChange={(e) =>
              setCommitteeForm({
                ...committeeForm,
                description: e.currentTarget.value || undefined,
              })
            }
          />
          <Select
            label="Committee Type"
            required
            data={[
              "quality_assurance",
              "infection_control",
              "pharmacy_therapeutic",
              "mortality_review",
              "ethics",
              "safety",
              "credentialing",
              "other",
            ]}
            value={committeeForm.committee_type}
            onChange={(v) => setCommitteeForm({ ...committeeForm, committee_type: v ?? "" })}
          />
          <TextInput
            label="Chairperson ID"
            value={committeeForm.chairperson_id ?? ""}
            onChange={(e) =>
              setCommitteeForm({
                ...committeeForm,
                chairperson_id: e.currentTarget.value || undefined,
              })
            }
          />
          <TextInput
            label="Secretary ID"
            value={committeeForm.secretary_id ?? ""}
            onChange={(e) =>
              setCommitteeForm({
                ...committeeForm,
                secretary_id: e.currentTarget.value || undefined,
              })
            }
          />
          <Select
            label="Meeting Frequency"
            required
            data={
              [
                "weekly",
                "biweekly",
                "monthly",
                "quarterly",
                "biannual",
                "annual",
                "as_needed",
              ] satisfies CommitteeFrequencyType[]
            }
            value={committeeForm.meeting_frequency}
            onChange={(v) =>
              setCommitteeForm({
                ...committeeForm,
                meeting_frequency: (v ?? "monthly") as CommitteeFrequencyType,
              })
            }
          />
          <Textarea
            label="Charter"
            value={committeeForm.charter ?? ""}
            onChange={(e) =>
              setCommitteeForm({ ...committeeForm, charter: e.currentTarget.value || undefined })
            }
          />
          <Checkbox
            label="Mandatory Committee"
            checked={committeeForm.is_mandatory ?? false}
            onChange={(e) =>
              setCommitteeForm({ ...committeeForm, is_mandatory: e.currentTarget.checked })
            }
          />
          <Button
            tone="primary"
            loading={createCommitteeMut.isPending}
            onClick={() => createCommitteeMut.mutate(committeeForm)}
          >
            Save
          </Button>
        </Stack>
      </Drawer>

      {/* Schedule Meeting Drawer */}
      <Drawer
        opened={meetingOpened}
        onClose={closeMeeting}
        title={`Schedule Meeting: ${selectedCommittee?.name ?? ""}`}
        position="right"
        size="sm"
      >
        <Stack>
          <TextInput
            label="Scheduled Date"
            type="datetime-local"
            required
            value={meetingForm.scheduled_date}
            onChange={(e) =>
              setMeetingForm({ ...meetingForm, scheduled_date: e.currentTarget.value })
            }
          />
          <TextInput
            label="Venue"
            value={meetingForm.venue ?? ""}
            onChange={(e) =>
              setMeetingForm({ ...meetingForm, venue: e.currentTarget.value || undefined })
            }
          />
          <Button
            tone="primary"
            loading={createMeetingMut.isPending}
            onClick={() => createMeetingMut.mutate(meetingForm)}
          >
            Schedule
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Accreditation Tab ───────────────────────────────────

function AccreditationTab() {
  const canManage = useHasPermission(P.QUALITY.ACCREDITATION_MANAGE);
  const qc = useQueryClient();
  const [standardOpened, { open: openStandard, close: closeStandard }] = useDisclosure(false);
  const [complianceOpened, { open: openCompliance, close: closeCompliance }] = useDisclosure(false);
  const [evidenceModalOpened, { open: openEvidenceModal, close: closeEvidenceModal }] =
    useDisclosure(false);
  const [evidenceData, setEvidenceData] = useState<EvidenceCompilation | null>(null);
  const [bodyFilter, setBodyFilter] = useState<string | null>(null);
  const [selectedStandard, setSelectedStandard] = useState<QualityAccreditationStandard | null>(
    null,
  );

  const compileEvidenceMut = useMutation({
    mutationFn: (body: string) => qualityService.compileEvidence(body),
    onSuccess: (data) => {
      setEvidenceData(data);
      openEvidenceModal();
    },
    onError: () => {
      notifications.show({
        title: "Error",
        message: "Failed to compile evidence",
        color: "danger",
      });
    },
  });

  const { data: standards = [], isLoading } = useQuery({
    queryKey: ["quality-standards", bodyFilter],
    queryFn: () =>
      qualityService.listAccreditationStandards(bodyFilter ? { body: bodyFilter } : undefined),
  });

  const { data: compliance = [] } = useQuery({
    queryKey: ["quality-compliance"],
    queryFn: () => qualityService.listAccreditationCompliance(),
  });

  const complianceMap = new Map(
    compliance.map((c: QualityAccreditationCompliance) => [c.standard_id, c]),
  );

  const [standardForm, setStandardForm] = useState<CreateAccreditationStandardRequest>({
    body: "nabh",
    standard_code: "",
    standard_name: "",
  });

  const createStandardMut = useMutation({
    mutationFn: (data: CreateAccreditationStandardRequest) =>
      qualityService.createAccreditationStandard(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-standards"] });
      notifications.show({ title: "Standard added", message: "", color: "success" });
      closeStandard();
      setStandardForm({ body: "nabh", standard_code: "", standard_name: "" });
    },
  });

  const [complianceForm, setComplianceForm] = useState<UpdateComplianceRequest>({
    standard_id: "",
    compliance: "non_compliant",
  });

  const updateComplianceMut = useMutation({
    mutationFn: (data: UpdateComplianceRequest) =>
      qualityService.updateAccreditationCompliance(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-compliance"] });
      notifications.show({ title: "Compliance updated", message: "", color: "success" });
      closeCompliance();
    },
  });

  // Summary counts
  const compliantCount = compliance.filter(
    (c: QualityAccreditationCompliance) => c.compliance === "compliant",
  ).length;
  const partialCount = compliance.filter(
    (c: QualityAccreditationCompliance) => c.compliance === "partially_compliant",
  ).length;
  const nonCompliantCount = compliance.filter(
    (c: QualityAccreditationCompliance) => c.compliance === "non_compliant",
  ).length;
  const naCount = compliance.filter(
    (c: QualityAccreditationCompliance) => c.compliance === "not_applicable",
  ).length;
  const notAssessedCount = standards.length - compliance.length;

  const donutData = useMemo(
    () =>
      [
        { name: "Compliant", value: compliantCount, color: "green.6" },
        { name: "Partial", value: partialCount, color: "yellow.5" },
        { name: "Non-Compliant", value: nonCompliantCount, color: "red.6" },
        { name: "N/A", value: naCount, color: "gray.4" },
        {
          name: "Not Assessed",
          value: notAssessedCount > 0 ? notAssessedCount : 0,
          color: "gray.2",
        },
      ].filter((d) => d.value > 0),
    [compliantCount, partialCount, nonCompliantCount, naCount, notAssessedCount],
  );

  const columns = [
    {
      key: "standard_code" as const,
      label: "Code",
      render: (s: QualityAccreditationStandard) => <Text fw={500}>{s.standard_code}</Text>,
    },
    {
      key: "standard_name" as const,
      label: "Standard",
      render: (s: QualityAccreditationStandard) => s.standard_name,
    },
    {
      key: "body" as const,
      label: "Body",
      render: (s: QualityAccreditationStandard) => (
        <Badge tone="neutral" variant="outline">
          {s.body.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "chapter" as const,
      label: "Chapter",
      render: (s: QualityAccreditationStandard) => s.chapter ?? "---",
    },
    {
      key: "compliance" as const,
      label: "Compliance",
      render: (s: QualityAccreditationStandard) => {
        const c = complianceMap.get(s.id);
        if (!c) return <Badge tone="neutral">Not Assessed</Badge>;
        return (
          <Badge tone={statusColorTone(c.compliance)}>{c.compliance.replace(/_/g, " ")}</Badge>
        );
      },
    },
    {
      key: "gap" as const,
      label: "Gap",
      render: (s: QualityAccreditationStandard) => {
        const c = complianceMap.get(s.id);
        return c?.gap_description ? (
          <Text size="xs" c="danger" lineClamp={1}>
            {c.gap_description}
          </Text>
        ) : (
          "---"
        );
      },
    },
    {
      key: "actions" as const,
      label: "Actions",
      render: (s: QualityAccreditationStandard) => (
        <Group gap="xs">
          {canManage && (
            <Tooltip label="Update Compliance">
              <IconButton
                tone="primary"
                onClick={() => {
                  setSelectedStandard(s);
                  const existing = complianceMap.get(s.id);
                  setComplianceForm({
                    standard_id: s.id,
                    compliance: existing?.compliance ?? "non_compliant",
                    evidence_summary: existing?.evidence_summary,
                    gap_description: existing?.gap_description,
                    action_plan: existing?.action_plan,
                    responsible_person_id: existing?.responsible_person_id,
                    target_date: existing?.target_date,
                  });
                  openCompliance();
                }}
                aria-label="Update Compliance"
              >
                <IconClipboardCheck size={16} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      {/* Compliance Dashboard */}
      <SimpleGrid cols={4} spacing="md">
        <Card withBorder shadow="sm" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Total Standards
          </Text>
          <Text size="xl" fw={700} mt={4}>
            {standards.length}
          </Text>
        </Card>
        <Card withBorder shadow="sm" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Compliant
          </Text>
          <Text size="xl" fw={700} mt={4} c="success">
            {compliantCount}
          </Text>
        </Card>
        <Card withBorder shadow="sm" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Partially Compliant
          </Text>
          <Text size="xl" fw={700} mt={4} c="yellow.7">
            {partialCount}
          </Text>
        </Card>
        <Card withBorder shadow="sm" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Non-Compliant
          </Text>
          <Text size="xl" fw={700} mt={4} c="danger">
            {nonCompliantCount}
          </Text>
        </Card>
      </SimpleGrid>

      {donutData.length > 0 && (
        <Card withBorder shadow="sm" p="md">
          <Text fw={600} mb="sm">
            Compliance Distribution
          </Text>
          <DonutChart
            data={donutData}
            withLabelsLine
            withLabels
            tooltipDataSource="segment"
            size={220}
            thickness={30}
          />
        </Card>
      )}

      <Group justify="space-between">
        <Group>
          <Select
            placeholder="Filter by body"
            data={["nabh", "nmc", "nabl", "jci", "abdm", "naac", "other"].map((b) => ({
              value: b,
              label: b.toUpperCase(),
            }))}
            value={bodyFilter}
            onChange={setBodyFilter}
            clearable
            w={160}
          />
          <Badge tone="success">Compliant: {compliantCount}</Badge>
          <Badge tone="warning">Partial: {partialCount}</Badge>
          <Badge tone="danger">Non-Compliant: {nonCompliantCount}</Badge>
        </Group>
        <Group>
          {canManage && (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openStandard}>
              Add Standard
            </Button>
          )}
          {bodyFilter && canManage && (
            <Button
              tone="secondary"
              leftSection={<IconFileStack size={16} />}
              loading={compileEvidenceMut.isPending}
              onClick={() => compileEvidenceMut.mutate(bodyFilter)}
            >
              Compile Evidence
            </Button>
          )}
        </Group>
      </Group>

      <DataTable
        columns={columns}
        data={standards}
        loading={isLoading}
        rowKey={(s) => s.id}
        emptyTitle="No accreditation standards"
      />

      {/* Create Standard Drawer */}
      <Drawer
        opened={standardOpened}
        onClose={closeStandard}
        title="Add Accreditation Standard"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Accreditation Body"
            required
            data={(["nabh", "nmc", "nabl", "jci", "abdm", "naac", "other"] as const).map((b) => ({
              value: b,
              label: b.toUpperCase(),
            }))}
            value={standardForm.body}
            onChange={(v) =>
              setStandardForm({ ...standardForm, body: (v ?? "nabh") as AccreditationBodyType })
            }
          />
          <TextInput
            label="Standard Code"
            required
            value={standardForm.standard_code}
            onChange={(e) =>
              setStandardForm({ ...standardForm, standard_code: e.currentTarget.value })
            }
          />
          <TextInput
            label="Standard Name"
            required
            value={standardForm.standard_name}
            onChange={(e) =>
              setStandardForm({ ...standardForm, standard_name: e.currentTarget.value })
            }
          />
          <TextInput
            label="Chapter"
            value={standardForm.chapter ?? ""}
            onChange={(e) =>
              setStandardForm({ ...standardForm, chapter: e.currentTarget.value || undefined })
            }
          />
          <Textarea
            label="Description"
            value={standardForm.description ?? ""}
            onChange={(e) =>
              setStandardForm({ ...standardForm, description: e.currentTarget.value || undefined })
            }
          />
          <Button
            tone="primary"
            loading={createStandardMut.isPending}
            onClick={() => createStandardMut.mutate(standardForm)}
          >
            Save
          </Button>
        </Stack>
      </Drawer>

      {/* Update Compliance Drawer */}
      <Drawer
        opened={complianceOpened}
        onClose={closeCompliance}
        title={`Compliance: ${selectedStandard?.standard_code ?? ""}`}
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Compliance Status"
            required
            data={(
              ["compliant", "partially_compliant", "non_compliant", "not_applicable"] as const
            ).map((c) => ({ value: c, label: c.replace(/_/g, " ") }))}
            value={complianceForm.compliance}
            onChange={(v) =>
              setComplianceForm({
                ...complianceForm,
                compliance: (v ?? "non_compliant") as ComplianceStatusType,
              })
            }
          />
          <Textarea
            label="Evidence Summary"
            value={complianceForm.evidence_summary ?? ""}
            onChange={(e) =>
              setComplianceForm({
                ...complianceForm,
                evidence_summary: e.currentTarget.value || undefined,
              })
            }
          />
          <Textarea
            label="Gap Description"
            value={complianceForm.gap_description ?? ""}
            onChange={(e) =>
              setComplianceForm({
                ...complianceForm,
                gap_description: e.currentTarget.value || undefined,
              })
            }
          />
          <Textarea
            label="Action Plan"
            value={complianceForm.action_plan ?? ""}
            onChange={(e) =>
              setComplianceForm({
                ...complianceForm,
                action_plan: e.currentTarget.value || undefined,
              })
            }
          />
          <TextInput
            label="Responsible Person ID"
            value={complianceForm.responsible_person_id ?? ""}
            onChange={(e) =>
              setComplianceForm({
                ...complianceForm,
                responsible_person_id: e.currentTarget.value || undefined,
              })
            }
          />
          <TextInput
            label="Target Date"
            type="date"
            value={complianceForm.target_date ?? ""}
            onChange={(e) =>
              setComplianceForm({
                ...complianceForm,
                target_date: e.currentTarget.value || undefined,
              })
            }
          />
          <Button
            tone="primary"
            loading={updateComplianceMut.isPending}
            onClick={() => updateComplianceMut.mutate(complianceForm)}
          >
            Update Compliance
          </Button>
        </Stack>
      </Drawer>

      {/* Evidence Compilation Modal */}
      <Modal
        opened={evidenceModalOpened}
        onClose={() => {
          closeEvidenceModal();
          setEvidenceData(null);
        }}
        title="Evidence Compilation"
        size="lg"
      >
        {evidenceData ? (
          <Stack>
            <SimpleGrid cols={3} spacing="md">
              <Card withBorder p="sm">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Accreditation Body
                </Text>
                <Text fw={600} mt={4}>
                  {evidenceData.accreditation_body.toUpperCase()}
                </Text>
              </Card>
              <Card withBorder p="sm">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Total Standards
                </Text>
                <Text fw={600} mt={4}>
                  {evidenceData.total_standards}
                </Text>
              </Card>
              <Card withBorder p="sm">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Compliance Rate
                </Text>
                <Text
                  fw={600}
                  mt={4}
                  c={
                    evidenceData.compliance_rate >= 80
                      ? "success"
                      : evidenceData.compliance_rate >= 50
                        ? "warning"
                        : "danger"
                  }
                >
                  {evidenceData.compliance_rate.toFixed(1)}%
                </Text>
              </Card>
            </SimpleGrid>
            <Group>
              <Badge tone="success">Compliant: {evidenceData.compliant_count}</Badge>
              <Badge tone="danger">Non-Compliant: {evidenceData.non_compliant_items.length}</Badge>
            </Group>
            {evidenceData.non_compliant_items.length > 0 && (
              <>
                <Text fw={600} size="sm" mt="xs">
                  Non-Compliant Items
                </Text>
                <Table withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>#</Table.Th>
                      <Table.Th>Details</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {evidenceData.non_compliant_items.map((item, idx) => (
                      <Table.Tr key={typeof item === "string" ? item : JSON.stringify(item)}>
                        <Table.Td>{idx + 1}</Table.Td>
                        <Table.Td>
                          {typeof item === "string" ? item : JSON.stringify(item)}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </>
            )}
          </Stack>
        ) : (
          <Text c="dimmed">No evidence data available.</Text>
        )}
      </Modal>
    </Stack>
  );
}

// ── Audits Tab ──────────────────────────────────────────

function AuditsTab() {
  const canCreate = useHasPermission(P.QUALITY.AUDITS_CREATE);
  const qc = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [selectedAudit, setSelectedAudit] = useState<QualityAudit | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: audits = [], isLoading } = useQuery({
    queryKey: ["quality-audits", statusFilter],
    queryFn: () => qualityService.listQualityAudits({ status: statusFilter ?? undefined }),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments-list"],
    queryFn: () => qualityService.listDepartments(),
    staleTime: 300_000,
  });

  const departmentOptions = departments
    .filter((d: { is_active: boolean }) => d.is_active)
    .map((d: { id: string; name: string }) => ({ value: d.id, label: d.name }));

  const [form, setForm] = useState<CreateQualityAuditRequest>({
    audit_type: "internal",
    title: "",
    audit_date: new Date().toISOString().slice(0, 10),
  });

  const createMut = useMutation({
    mutationFn: (data: CreateQualityAuditRequest) => qualityService.createQualityAudit(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-audits"] });
      notifications.show({ title: "Audit created", message: "", color: "success" });
      closeCreate();
      setForm({
        audit_type: "internal",
        title: "",
        audit_date: new Date().toISOString().slice(0, 10),
      });
    },
  });

  // Schedule audits
  const [scheduleOpened, { open: openSchedule, close: closeSchedule }] = useDisclosure(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleAuditsRequest>({
    department_ids: [],
    frequency: "quarterly",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });

  const scheduleAuditsMut = useMutation({
    mutationFn: (data: ScheduleAuditsRequest) => qualityService.scheduleAudits(data),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["quality-audits"] });
      notifications.show({
        title: "Audits scheduled",
        message: `${result.count} audit(s) created`,
        color: "teal",
      });
      closeSchedule();
    },
  });

  // Audit findings
  const [findingOpened, { open: openFinding, close: closeFinding }] = useDisclosure(false);
  const [findingForm, setFindingForm] = useState<CreateAuditFindingRequest>({
    finding_type: "non_conformity",
    description: "",
    severity: "minor",
  });

  const { data: findings = [], isLoading: findingsLoading } = useQuery({
    queryKey: ["quality-audit-findings", selectedAudit?.id],
    queryFn: () => qualityService.listAuditFindings(selectedAudit?.id ?? ""),
    enabled: !!selectedAudit,
  });

  const createFindingMut = useMutation({
    mutationFn: (data: CreateAuditFindingRequest) => {
      if (!selectedAudit) throw new Error("No audit selected");
      return qualityService.createAuditFinding(selectedAudit.id, data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-audit-findings", selectedAudit?.id] });
      void qc.invalidateQueries({ queryKey: ["quality-audits"] });
      notifications.show({ title: "Finding added", message: "", color: "success" });
      closeFinding();
      setFindingForm({ finding_type: "non_conformity", description: "", severity: "minor" });
    },
  });

  const openMockInspection = () => {
    setForm({
      audit_type: "mock",
      title: "",
      audit_date: new Date().toISOString().slice(0, 10),
    });
    openCreate();
  };

  const columns = [
    {
      key: "audit_number" as const,
      label: "Audit #",
      render: (a: QualityAudit) => <Text fw={500}>{a.audit_number}</Text>,
    },
    { key: "title" as const, label: "Title", render: (a: QualityAudit) => a.title },
    {
      key: "audit_type" as const,
      label: "Type",
      render: (a: QualityAudit) => <Badge tone="neutral">{a.audit_type}</Badge>,
    },
    {
      key: "audit_date" as const,
      label: "Date",
      render: (a: QualityAudit) => new Date(a.audit_date).toLocaleDateString(),
    },
    {
      key: "score" as const,
      label: "Score",
      render: (a: QualityAudit) => (a.overall_score != null ? `${a.overall_score}%` : "---"),
    },
    {
      key: "nc" as const,
      label: "NC / Obs / Opp",
      render: (a: QualityAudit) => `${a.non_conformities} / ${a.observations} / ${a.opportunities}`,
    },
    {
      key: "status" as const,
      label: "Status",
      render: (a: QualityAudit) => (
        <Badge tone={auditStatusColors[a.status] ?? "neutral"}>{a.status.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "actions" as const,
      label: "Actions",
      render: (a: QualityAudit) => (
        <Group gap="xs">
          <Tooltip label="View Details">
            <IconButton
              tone="primary"
              onClick={() => {
                setSelectedAudit(a);
                openDetail();
              }}
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
            data={["planned", "in_progress", "completed", "cancelled"]}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            w={160}
          />
          <Text c="dimmed" size="sm">
            {audits.length} audit(s)
          </Text>
        </Group>
        {canCreate && (
          <Group>
            <Button
              tone="secondary"
              leftSection={<IconCalendarEvent size={16} />}
              onClick={openSchedule}
            >
              Schedule Audits
            </Button>
            <Button
              tone="secondary"
              leftSection={<IconShieldCheck size={16} />}
              onClick={openMockInspection}
            >
              Mock Inspection
            </Button>
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
              New Audit
            </Button>
          </Group>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={audits}
        loading={isLoading}
        rowKey={(a) => a.id}
        emptyTitle="No audits"
      />

      {/* Create Audit Drawer */}
      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title={form.audit_type === "mock" ? "Schedule Mock Inspection" : "New Audit"}
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
          <Select
            label="Audit Type"
            required
            data={["internal", "external", "mock", "surveillance", "follow_up"]}
            value={form.audit_type}
            onChange={(v) => setForm({ ...form, audit_type: v ?? "internal" })}
          />
          <Textarea
            label="Scope"
            value={form.scope ?? ""}
            onChange={(e) => setForm({ ...form, scope: e.currentTarget.value || undefined })}
          />
          <DepartmentSelect
            value={form.department_id ?? ""}
            onChange={(id) => setForm({ ...form, department_id: id || undefined })}
          />
          <TextInput
            label="Audit Date"
            type="date"
            required
            value={form.audit_date}
            onChange={(e) => setForm({ ...form, audit_date: e.currentTarget.value })}
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

      {/* Audit Detail Drawer */}
      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title={`Audit: ${selectedAudit?.audit_number ?? ""}`}
        position="right"
        size="lg"
      >
        {selectedAudit && (
          <Stack>
            <Text fw={600} size="lg">
              {selectedAudit.title}
            </Text>
            <Group>
              <Badge tone="neutral">{selectedAudit.audit_type}</Badge>
              <Badge tone={auditStatusColors[selectedAudit.status] ?? "neutral"}>
                {selectedAudit.status.replace(/_/g, " ")}
              </Badge>
            </Group>
            <Text size="sm">Date: {new Date(selectedAudit.audit_date).toLocaleDateString()}</Text>
            {selectedAudit.scope && <Text size="sm">Scope: {selectedAudit.scope}</Text>}
            {selectedAudit.report_date && (
              <Text size="sm">
                Report Date: {new Date(selectedAudit.report_date).toLocaleDateString()}
              </Text>
            )}

            <Group mt="md">
              <Badge tone="danger" size="lg">
                Non-Conformities: {selectedAudit.non_conformities}
              </Badge>
              <Badge tone="warning" size="lg">
                Observations: {selectedAudit.observations}
              </Badge>
              <Badge tone="primary" size="lg">
                Opportunities: {selectedAudit.opportunities}
              </Badge>
            </Group>

            {selectedAudit.overall_score != null && (
              <Text
                fw={600}
                size="xl"
                c={
                  selectedAudit.overall_score >= 80
                    ? "success"
                    : selectedAudit.overall_score >= 60
                      ? "warning"
                      : "danger"
                }
              >
                Score: {selectedAudit.overall_score}%
              </Text>
            )}

            {Array.isArray(selectedAudit.findings) && selectedAudit.findings.length > 0 && (
              <>
                <Text fw={600} mt="md">
                  Findings (legacy)
                </Text>
                <Table withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>#</Table.Th>
                      <Table.Th>Finding</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {selectedAudit.findings.map((f, idx) => (
                      <Table.Tr key={typeof f === "string" ? f : JSON.stringify(f)}>
                        <Table.Td>{idx + 1}</Table.Td>
                        <Table.Td>{typeof f === "string" ? f : JSON.stringify(f)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </>
            )}

            {/* Structured Findings */}
            <Group justify="space-between" mt="md">
              <Text fw={600}>Audit Findings ({findings.length})</Text>
              {canCreate && (
                <Button
                  tone="primary"
                  size="compact-sm"
                  leftSection={<IconPlus size={14} />}
                  onClick={openFinding}
                >
                  Add Finding
                </Button>
              )}
            </Group>
            {findingsLoading ? (
              <Text c="dimmed" size="sm">
                Loading findings...
              </Text>
            ) : findings.length > 0 ? (
              <Table withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Description</Table.Th>
                    <Table.Th>Severity</Table.Th>
                    <Table.Th>Recommendation</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {findings.map((f: AuditFinding) => (
                    <Table.Tr key={f.id}>
                      <Table.Td>
                        <Badge tone="neutral">{f.finding_type.replace(/_/g, " ")}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={2}>
                          {f.description}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge tone={statusColorTone(f.severity)}>{f.severity}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={1}>
                          {f.recommendation ?? "---"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          tone={
                            f.status === "closed"
                              ? "success"
                              : f.status === "open"
                                ? "danger"
                                : "primary"
                          }
                        >
                          {f.status}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed" size="sm">
                No structured findings recorded
              </Text>
            )}
          </Stack>
        )}
      </Drawer>

      {/* Schedule Audits Drawer */}
      <Drawer
        opened={scheduleOpened}
        onClose={closeSchedule}
        title="Schedule Audits"
        position="right"
        size="xl"
      >
        <Stack>
          <MultiSelect
            label="Departments"
            required
            data={departmentOptions}
            value={scheduleForm.department_ids}
            onChange={(ids) => setScheduleForm({ ...scheduleForm, department_ids: ids })}
            searchable
            placeholder="Select departments..."
          />
          <Select
            label="Frequency"
            required
            data={["monthly", "quarterly", "biannual", "annual"]}
            value={scheduleForm.frequency}
            onChange={(v) => setScheduleForm({ ...scheduleForm, frequency: v ?? "quarterly" })}
          />
          <TextInput
            label="Start Date"
            type="date"
            required
            value={scheduleForm.start_date}
            onChange={(e) =>
              setScheduleForm({ ...scheduleForm, start_date: e.currentTarget.value })
            }
          />
          <TextInput
            label="End Date"
            type="date"
            required
            value={scheduleForm.end_date}
            onChange={(e) => setScheduleForm({ ...scheduleForm, end_date: e.currentTarget.value })}
          />
          <Button
            tone="primary"
            loading={scheduleAuditsMut.isPending}
            onClick={() => scheduleAuditsMut.mutate(scheduleForm)}
          >
            Schedule
          </Button>
        </Stack>
      </Drawer>

      {/* Add Finding Drawer */}
      <Drawer
        opened={findingOpened}
        onClose={closeFinding}
        title={`Add Finding: ${selectedAudit?.audit_number ?? ""}`}
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Finding Type"
            required
            data={["non_conformity", "observation", "opportunity_for_improvement", "strength"]}
            value={findingForm.finding_type}
            onChange={(v) =>
              setFindingForm({ ...findingForm, finding_type: v ?? "non_conformity" })
            }
          />
          <Textarea
            label="Description"
            required
            value={findingForm.description}
            onChange={(e) => setFindingForm({ ...findingForm, description: e.currentTarget.value })}
            minRows={3}
          />
          <Select
            label="Severity"
            required
            data={["minor", "moderate", "major", "critical"]}
            value={findingForm.severity}
            onChange={(v) => setFindingForm({ ...findingForm, severity: v ?? "minor" })}
          />
          <Textarea
            label="Recommendation"
            value={findingForm.recommendation ?? ""}
            onChange={(e) =>
              setFindingForm({ ...findingForm, recommendation: e.currentTarget.value || undefined })
            }
          />
          <Button
            tone="primary"
            loading={createFindingMut.isPending}
            onClick={() => createFindingMut.mutate(findingForm)}
          >
            Add Finding
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Analytics & Reviews Tab ──────────────────────────────

function AnalyticsReviewsTab() {
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
    enabled: subView === "overdue-capas",
  });

  const { data: committeeDash, isLoading: cdLoading } = useQuery({
    queryKey: ["quality-committee-dashboard"],
    queryFn: () => qualityService.committeeDashboard(),
    enabled: subView === "committee-dashboard",
  });

  const { data: sentinelEvents = [], isLoading: seLoading } = useQuery({
    queryKey: ["quality-sentinel-events"],
    queryFn: () => qualityService.listSentinelEvents(),
    enabled: subView === "sentinel",
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
