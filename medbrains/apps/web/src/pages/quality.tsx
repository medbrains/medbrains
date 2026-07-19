import "@mantine/charts/styles.css";
import { LineChart } from "@mantine/charts";
import {
  Card,
  Drawer,
  Group,
  NumberInput,
  Progress,
  SegmentedControl,
  Select,
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
  CreateQualityIndicatorRequest,
  IndicatorFrequencyType,
  QualityIndicator,
  QualityIndicatorValue,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconAward,
  IconCalculator,
  IconChartBar,
  IconClipboardCheck,
  IconFileDescription,
  IconPlus,
  IconSearch,
  IconShieldCheck,
  IconTrendingUp,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { Badge, Button, IconButton, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { qualityService } from "@/services/quality.service";
import { AccreditationTab } from "./quality/accreditation-tab";
import { AnalyticsReviewsTab } from "./quality/analytics-reviews-tab";
import { AuditsTab } from "./quality/audits-tab";
import { CommitteesTab } from "./quality/committees-tab";
import { DocumentsTab } from "./quality/documents-tab";
import { IncidentsTab } from "./quality/incidents-tab";
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
