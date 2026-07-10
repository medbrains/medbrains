import { zodResolver } from "@hookform/resolvers/zod";
import "@mantine/charts/styles.css";
import { LineChart } from "@mantine/charts";
import {
  Card,
  Checkbox,
  Drawer,
  Group,
  NumberInput,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  IcuBundleCheckFormInput,
  IcuDeviceFormInput,
  IcuFlowsheetFormInput,
  IcuNeonatalFormInput,
  IcuNutritionFormInput,
  IcuScoreFormInput,
  IcuVentilatorFormInput,
} from "@medbrains/schemas";
import {
  icuBundleCheckFormSchema,
  icuDeviceFormSchema,
  icuFlowsheetFormSchema,
  icuNeonatalFormSchema,
  icuNutritionFormSchema,
  icuScoreFormSchema,
  icuVentilatorFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  DeviceInfectionRate,
  IcuBundleCheck,
  IcuDevice,
  IcuDeviceType,
  IcuFlowsheet,
  IcuNeonatalRecord,
  IcuNutrition,
  IcuScore,
  IcuScoreType,
  IcuVentilatorRecord,
  NutritionRoute,
  VentilatorMode,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconBabyCarriage,
  IconChartBar,
  IconHeartbeat,
  IconLungs,
  IconPlus,
  IconReportMedical,
  IconStethoscope,
  IconToolsKitchen2,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Badge, Button, IconButton, Table } from "@/components/ui";
import {
  DEFAULT_ICU_BUNDLE_CHECK_FORM_VALUES,
  DEFAULT_ICU_DEVICE_FORM_VALUES,
  DEFAULT_ICU_FLOWSHEET_FORM_VALUES,
  DEFAULT_ICU_NEONATAL_FORM_VALUES,
  DEFAULT_ICU_NUTRITION_FORM_VALUES,
  DEFAULT_ICU_SCORE_FORM_VALUES,
  DEFAULT_ICU_VENTILATOR_FORM_VALUES,
  ICU_DEVICE_TYPE_OPTIONS,
  ICU_NUTRITION_ROUTE_OPTIONS,
  ICU_SCORE_TYPE_OPTIONS,
  ICU_VENTILATOR_MODE_OPTIONS,
  normalizeIcuDeviceType,
  normalizeIcuNutritionRoute,
  normalizeIcuScoreType,
  normalizeIcuVentilatorMode,
  toCreateIcuBundleCheckRequest,
  toCreateIcuDeviceRequest,
  toCreateIcuFlowsheetRequest,
  toCreateIcuNeonatalRequest,
  toCreateIcuNutritionRequest,
  toCreateIcuScoreRequest,
  toCreateIcuVentilatorRequest,
} from "@/forms/icu.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { icuService } from "@/services/icu.service";

// ── Shared admission selector ──────────────────────────────

function AdmissionSelector({
  admissionId,
  onChange,
}: {
  admissionId: string;
  onChange: (id: string) => void;
}) {
  return (
    <TextInput
      label="Admission ID"
      placeholder="Enter IPD admission ID"
      value={admissionId}
      onChange={(e) => onChange(e.currentTarget.value)}
      style={{ maxWidth: 400 }}
    />
  );
}

// ── Score type labels ────────────────────────────────────────

const scoreTypeLabels: Record<IcuScoreType, string> = {
  apache_ii: "APACHE II",
  apache_iv: "APACHE IV",
  sofa: "SOFA",
  gcs: "GCS",
  prism: "PRISM",
  snappe: "SNAPPE",
  rass: "RASS",
  cam_icu: "CAM-ICU",
};

const ventilatorModeLabels: Record<VentilatorMode, string> = {
  cmv: "CMV",
  acv: "ACV",
  simv: "SIMV",
  psv: "PSV",
  cpap: "CPAP",
  bipap: "BiPAP",
  hfov: "HFOV",
  aprv: "APRV",
  niv: "NIV",
  other: "Other",
};

const deviceTypeLabels: Record<IcuDeviceType, string> = {
  central_line: "Central Line",
  urinary_catheter: "Urinary Catheter",
  ventilator: "Ventilator",
  arterial_line: "Arterial Line",
  peripheral_iv: "Peripheral IV",
  nasogastric_tube: "NG Tube",
  chest_tube: "Chest Tube",
  tracheostomy: "Tracheostomy",
};

const nutritionRouteLabels: Record<NutritionRoute, string> = {
  enteral: "Enteral",
  parenteral: "Parenteral",
  oral: "Oral",
  npo: "NPO",
};

// ── Hemodynamic Trends Chart ─────────────────────────────────

interface InfusionEntry {
  drug_name?: string;
  rate_ml_hr?: number;
  concentration?: string;
  start_time?: string;
  duration_hours?: number;
}

function toInfusionEntry(value: Record<string, unknown>): InfusionEntry {
  const entry: InfusionEntry = {};
  if (typeof value.drug_name === "string") entry.drug_name = value.drug_name;
  if (typeof value.rate_ml_hr === "number") entry.rate_ml_hr = value.rate_ml_hr;
  if (typeof value.concentration === "string") entry.concentration = value.concentration;
  if (typeof value.start_time === "string") entry.start_time = value.start_time;
  if (typeof value.duration_hours === "number") entry.duration_hours = value.duration_hours;
  return entry;
}

function toInfusionRecord(entry: InfusionEntry): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  if (entry.drug_name !== undefined) record.drug_name = entry.drug_name;
  if (entry.rate_ml_hr !== undefined) record.rate_ml_hr = entry.rate_ml_hr;
  if (entry.concentration !== undefined) record.concentration = entry.concentration;
  if (entry.start_time !== undefined) record.start_time = entry.start_time;
  if (entry.duration_hours !== undefined) record.duration_hours = entry.duration_hours;
  return record;
}

function getInfusionKey(entry: InfusionEntry): string {
  return [
    entry.drug_name ?? "drug",
    entry.rate_ml_hr?.toString() ?? "rate",
    entry.concentration ?? "concentration",
    entry.start_time ?? "start",
    entry.duration_hours?.toString() ?? "duration",
  ].join(":");
}

function HemodynamicChart({ flowsheets }: { flowsheets: IcuFlowsheet[] }) {
  const chartData = useMemo(() => {
    const sorted = [...flowsheets].sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );
    return sorted.map((f) => ({
      time: new Date(f.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      HR: f.heart_rate,
      SBP: f.systolic_bp,
      DBP: f.diastolic_bp,
      MAP: f.mean_arterial_bp,
      CVP: f.cvp,
    }));
  }, [flowsheets]);

  return (
    <Card withBorder padding="md" mt="md">
      <Text fw={600} size="sm" mb="sm">
        Hemodynamic Trends
      </Text>
      <LineChart
        h={300}
        data={chartData}
        dataKey="time"
        series={[
          { name: "HR", color: "danger" },
          { name: "SBP", color: "primary" },
          { name: "DBP", color: "info" },
          { name: "MAP", color: "orange" },
          { name: "CVP", color: "violet" },
        ]}
        curveType="monotone"
        connectNulls
        withLegend
        withTooltip
        tooltipAnimationDuration={200}
      />
    </Card>
  );
}

// ── Infusion Tracker ─────────────────────────────────────────

function InfusionTracker({
  flowsheets,
  admissionId,
  canCreate,
}: {
  flowsheets: IcuFlowsheet[];
  admissionId: string;
  canCreate: boolean;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [infForm, setInfForm] = useState<InfusionEntry>({});

  // Get infusions from the most recent flowsheet
  const latestWithInfusions = useMemo(() => {
    const sorted = [...flowsheets].sort(
      (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
    );
    return sorted.find((f) => f.infusions && f.infusions.length > 0) ?? null;
  }, [flowsheets]);

  const activeInfusions = useMemo(
    () => (latestWithInfusions?.infusions ?? []).map(toInfusionEntry),
    [latestWithInfusions],
  );

  const saveMut = useMutation({
    mutationFn: async (newInfusion: InfusionEntry) => {
      const existing = activeInfusions;
      const updated = [...existing, newInfusion];
      return icuService.createIcuFlowsheet(admissionId, {
        infusions: updated.map(toInfusionRecord),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-flowsheets", admissionId] });
      notifications.show({ title: "Infusion added", message: "", color: "success" });
      setAdding(false);
      setInfForm({});
    },
  });

  return (
    <Card withBorder padding="md" mt="md">
      <Group justify="space-between" mb="sm">
        <Text fw={600} size="sm">
          Active Infusions
        </Text>
        {canCreate && (
          <Button
            tone="secondary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setAdding(true)}
          >
            Add Infusion
          </Button>
        )}
      </Group>

      {activeInfusions.length > 0 ? (
        <DataTable
          columns={[
            {
              key: "drug",
              label: "Drug",
              render: (inf: InfusionEntry) => inf.drug_name ?? "—",
            },
            {
              key: "rate",
              label: "Rate (mL/hr)",
              render: (inf: InfusionEntry) =>
                inf.rate_ml_hr != null ? String(inf.rate_ml_hr) : "—",
            },
            {
              key: "concentration",
              label: "Concentration",
              render: (inf: InfusionEntry) => inf.concentration ?? "—",
            },
            {
              key: "start_time",
              label: "Start Time",
              render: (inf: InfusionEntry) =>
                inf.start_time ? new Date(inf.start_time).toLocaleTimeString() : "—",
            },
            {
              key: "duration",
              label: "Duration (hrs)",
              render: (inf: InfusionEntry) =>
                inf.duration_hours != null ? String(inf.duration_hours) : "—",
            },
          ]}
          data={activeInfusions}
          rowKey={getInfusionKey}
        />
      ) : (
        <Text c="dimmed" size="sm">
          No active infusions recorded
        </Text>
      )}

      {adding && (
        <Stack mt="md" gap="xs">
          <Text fw={500} size="sm">
            New Infusion
          </Text>
          <Group grow>
            <TextInput
              label="Drug Name"
              placeholder="e.g. Noradrenaline"
              value={infForm.drug_name ?? ""}
              onChange={(e) =>
                setInfForm({ ...infForm, drug_name: e.currentTarget.value || undefined })
              }
            />
            <NumberInput
              label="Rate (mL/hr)"
              decimalScale={1}
              value={infForm.rate_ml_hr ?? ""}
              onChange={(v) =>
                setInfForm({ ...infForm, rate_ml_hr: v === "" ? undefined : Number(v) })
              }
            />
          </Group>
          <Group grow>
            <TextInput
              label="Concentration"
              placeholder="e.g. 4mg/50mL"
              value={infForm.concentration ?? ""}
              onChange={(e) =>
                setInfForm({ ...infForm, concentration: e.currentTarget.value || undefined })
              }
            />
            <NumberInput
              label="Duration (hours)"
              decimalScale={1}
              value={infForm.duration_hours ?? ""}
              onChange={(v) =>
                setInfForm({ ...infForm, duration_hours: v === "" ? undefined : Number(v) })
              }
            />
          </Group>
          <Group>
            <Button
              tone="primary"
              size="xs"
              loading={saveMut.isPending}
              onClick={() => saveMut.mutate({ ...infForm, start_time: new Date().toISOString() })}
            >
              Save Infusion
            </Button>
            <Button
              tone="ghost"
              size="xs"
              onClick={() => {
                setAdding(false);
                setInfForm({});
              }}
            >
              Cancel
            </Button>
          </Group>
        </Stack>
      )}
    </Card>
  );
}

// ── Flowsheets Tab ──────────────────────────────────────────

function FlowsheetsTab({ admissionId }: { admissionId: string }) {
  const canCreate = useHasPermission(P.ICU.FLOWSHEETS_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IcuFlowsheetFormInput>({
    resolver: zodResolver(icuFlowsheetFormSchema),
    defaultValues: DEFAULT_ICU_FLOWSHEET_FORM_VALUES,
    mode: "onTouched",
  });

  const { data: flowsheets = [], isLoading } = useQuery<IcuFlowsheet[]>({
    queryKey: ["icu-flowsheets", admissionId],
    queryFn: () => icuService.listIcuFlowsheets(admissionId),
    enabled: !!admissionId,
  });

  const createMut = useMutation({
    mutationFn: (data: ReturnType<typeof toCreateIcuFlowsheetRequest>) =>
      icuService.createIcuFlowsheet(admissionId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-flowsheets", admissionId] });
      notifications.show({ title: "Flowsheet recorded", message: "", color: "success" });
      close();
      reset(DEFAULT_ICU_FLOWSHEET_FORM_VALUES);
    },
  });
  const handleCreate = handleSubmit((values) => {
    createMut.mutate(toCreateIcuFlowsheetRequest(values));
  });
  const closeForm = () => {
    close();
    reset(DEFAULT_ICU_FLOWSHEET_FORM_VALUES);
  };

  const columns = [
    {
      key: "recorded_at",
      label: "Time",
      render: (r: IcuFlowsheet) => new Date(r.recorded_at).toLocaleString(),
    },
    {
      key: "heart_rate",
      label: "HR",
      render: (r: IcuFlowsheet) => (r.heart_rate != null ? String(r.heart_rate) : "—"),
    },
    {
      key: "systolic_bp",
      label: "BP",
      render: (r: IcuFlowsheet) =>
        r.systolic_bp != null && r.diastolic_bp != null
          ? `${r.systolic_bp}/${r.diastolic_bp}`
          : "—",
    },
    {
      key: "spo2",
      label: "SpO2",
      render: (r: IcuFlowsheet) => (r.spo2 != null ? `${r.spo2}%` : "—"),
    },
    {
      key: "temperature",
      label: "Temp",
      render: (r: IcuFlowsheet) => (r.temperature != null ? `${r.temperature}°C` : "—"),
    },
    {
      key: "intake_ml",
      label: "Intake",
      render: (r: IcuFlowsheet) => (r.intake_ml != null ? `${r.intake_ml} mL` : "—"),
    },
    {
      key: "output_ml",
      label: "Output",
      render: (r: IcuFlowsheet) => (r.output_ml != null ? `${r.output_ml} mL` : "—"),
    },
    { key: "notes", label: "Notes", render: (r: IcuFlowsheet) => r.notes ?? "" },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && admissionId && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            Record Vitals
          </Button>
        )}
      </Group>

      {admissionId ? (
        <DataTable
          columns={columns}
          data={flowsheets}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No flowsheet entries"
        />
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          Select an admission to view ICU flowsheets
        </Text>
      )}

      {/* Hemodynamic Trends Chart */}
      {admissionId && flowsheets.length >= 2 && <HemodynamicChart flowsheets={flowsheets} />}

      {/* Active Infusions */}
      {admissionId && (
        <InfusionTracker flowsheets={flowsheets} admissionId={admissionId} canCreate={canCreate} />
      )}

      <Drawer
        opened={opened}
        onClose={closeForm}
        title="Record ICU Vitals"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleCreate}>
          <Group grow>
            <Controller
              control={control}
              name="heart_rate"
              render={({ field }) => (
                <NumberInput
                  label="Heart Rate"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.heart_rate?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="spo2"
              render={({ field }) => (
                <NumberInput
                  label="SpO2 %"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.spo2?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="systolic_bp"
              render={({ field }) => (
                <NumberInput
                  label="Systolic BP"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.systolic_bp?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="diastolic_bp"
              render={({ field }) => (
                <NumberInput
                  label="Diastolic BP"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.diastolic_bp?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="respiratory_rate"
              render={({ field }) => (
                <NumberInput
                  label="Resp Rate"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.respiratory_rate?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="temperature"
              render={({ field }) => (
                <NumberInput
                  label="Temp °C"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.temperature?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="cvp"
              render={({ field }) => (
                <NumberInput
                  label="CVP"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.cvp?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="mean_arterial_bp"
              render={({ field }) => (
                <NumberInput
                  label="MAP"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.mean_arterial_bp?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="intake_ml"
              render={({ field }) => (
                <NumberInput
                  label="Intake mL"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.intake_ml?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="output_ml"
              render={({ field }) => (
                <NumberInput
                  label="Output mL"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.output_ml?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="urine_ml"
              render={({ field }) => (
                <NumberInput
                  label="Urine mL"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.urine_ml?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="drain_ml"
              render={({ field }) => (
                <NumberInput
                  label="Drain mL"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.drain_ml?.message}
                />
              )}
            />
          </Group>
          <Controller
            control={control}
            name="notes"
            render={({ field }) => <Textarea label="Notes" {...field} />}
          />
          <Button tone="primary" loading={createMut.isPending} type="submit">
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Ventilator Tab ──────────────────────────────────────────

function VentilatorTab({ admissionId }: { admissionId: string }) {
  const canCreate = useHasPermission(P.ICU.VENTILATOR_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["icu-ventilator", admissionId],
    queryFn: () => icuService.listIcuVentilatorRecords(admissionId),
    enabled: !!admissionId,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IcuVentilatorFormInput>({
    resolver: zodResolver(icuVentilatorFormSchema),
    defaultValues: DEFAULT_ICU_VENTILATOR_FORM_VALUES,
  });

  const createMut = useMutation({
    mutationFn: (values: IcuVentilatorFormInput) =>
      icuService.createIcuVentilatorRecord(admissionId, toCreateIcuVentilatorRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-ventilator", admissionId] });
      notifications.show({ title: "Ventilator record saved", message: "", color: "success" });
      close();
      reset(DEFAULT_ICU_VENTILATOR_FORM_VALUES);
    },
  });

  // Lung-protective target: IBW-based tidal volume (ARDSNet). Height + sex are entered here for the
  // target calc; the watched tidal volume from the form is checked against the 4-8 mL/kg range.
  const [lpHeight, setLpHeight] = useState<number | "">("");
  const [lpSex, setLpSex] = useState<string | null>("male");
  const watchedTidal = useWatch({ control, name: "tidal_volume" });
  const tidalMl =
    typeof watchedTidal === "number" ? watchedTidal : Number(watchedTidal) || undefined;
  const { data: lungTarget } = useQuery({
    queryKey: ["lung-protective", lpHeight, lpSex, tidalMl],
    queryFn: () =>
      icuService.lungProtective({
        height_cm: Number(lpHeight),
        sex: lpSex ?? "male",
        tidal_volume_ml: tidalMl,
      }),
    enabled: lpHeight !== "" && Number(lpHeight) >= 100 && !!lpSex,
  });

  const columns = [
    {
      key: "recorded_at",
      label: "Time",
      render: (r: IcuVentilatorRecord) => new Date(r.recorded_at).toLocaleString(),
    },
    {
      key: "mode",
      label: "Mode",
      render: (r: IcuVentilatorRecord) => ventilatorModeLabels[r.mode] ?? r.mode,
    },
    {
      key: "fio2",
      label: "FiO2",
      render: (r: IcuVentilatorRecord) => (r.fio2 != null ? `${r.fio2}%` : "—"),
    },
    {
      key: "peep",
      label: "PEEP",
      render: (r: IcuVentilatorRecord) => (r.peep != null ? String(r.peep) : "—"),
    },
    {
      key: "tidal_volume",
      label: "Vt",
      render: (r: IcuVentilatorRecord) => (r.tidal_volume != null ? `${r.tidal_volume} mL` : "—"),
    },
    {
      key: "ph",
      label: "ABG pH",
      render: (r: IcuVentilatorRecord) => (r.ph != null ? String(r.ph) : "—"),
    },
    {
      key: "pao2",
      label: "PaO2",
      render: (r: IcuVentilatorRecord) => (r.pao2 != null ? String(r.pao2) : "—"),
    },
    {
      key: "paco2",
      label: "PaCO2",
      render: (r: IcuVentilatorRecord) => (r.paco2 != null ? String(r.paco2) : "—"),
    },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && admissionId && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            Record Ventilator
          </Button>
        )}
      </Group>

      {admissionId ? (
        <DataTable
          columns={columns}
          data={records}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No ventilator records"
        />
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          Select an admission to view ventilator records
        </Text>
      )}

      <Drawer
        opened={opened}
        onClose={close}
        title="Record Ventilator Settings"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmit((values) => createMut.mutate(values))}>
          <Controller
            control={control}
            name="mode"
            render={({ field }) => (
              <Select
                label="Mode"
                data={ICU_VENTILATOR_MODE_OPTIONS}
                value={field.value}
                onChange={(value) => field.onChange(normalizeIcuVentilatorMode(value))}
                error={errors.mode?.message}
              />
            )}
          />
          <Group grow>
            <Controller
              control={control}
              name="fio2"
              render={({ field }) => (
                <NumberInput
                  label="FiO2 %"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.fio2?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="peep"
              render={({ field }) => (
                <NumberInput
                  label="PEEP"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.peep?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="tidal_volume"
              render={({ field }) => (
                <NumberInput
                  label="Tidal Volume mL"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.tidal_volume?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="respiratory_rate"
              render={({ field }) => (
                <NumberInput
                  label="Resp Rate"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.respiratory_rate?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <NumberInput
              label="Height (cm) — for lung-protective Vt"
              value={lpHeight}
              onChange={(v) => setLpHeight(typeof v === "number" ? v : "")}
              min={100}
              max={250}
            />
            <Select
              label="Sex (for IBW)"
              data={[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
              ]}
              value={lpSex}
              onChange={setLpSex}
            />
          </Group>
          {lungTarget && (
            <Alert
              tone={lungTarget.within_range === false ? "danger" : "info"}
              title={`Lung-protective Vt: ${lungTarget.target_ml} mL (6 mL/kg IBW ${lungTarget.ibw_kg} kg; range ${lungTarget.low_ml}–${lungTarget.high_ml} mL)`}
            >
              {lungTarget.set_ml_per_kg != null
                ? `Set Vt is ${lungTarget.set_ml_per_kg} mL/kg IBW. ${lungTarget.response}`
                : lungTarget.response}
            </Alert>
          )}
          <Group grow>
            <Controller
              control={control}
              name="pip"
              render={({ field }) => (
                <NumberInput
                  label="PIP"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.pip?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="plateau_pressure"
              render={({ field }) => (
                <NumberInput
                  label="Plateau"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.plateau_pressure?.message}
                />
              )}
            />
          </Group>
          <Text fw={600} size="sm" mt="md">
            ABG Values
          </Text>
          <Group grow>
            <Controller
              control={control}
              name="ph"
              render={({ field }) => (
                <NumberInput
                  label="pH"
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.ph?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="pao2"
              render={({ field }) => (
                <NumberInput
                  label="PaO2"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.pao2?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="paco2"
              render={({ field }) => (
                <NumberInput
                  label="PaCO2"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.paco2?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="hco3"
              render={({ field }) => (
                <NumberInput
                  label="HCO3"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.hco3?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="sao2"
              render={({ field }) => (
                <NumberInput
                  label="SaO2"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.sao2?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="lactate"
              render={({ field }) => (
                <NumberInput
                  label="Lactate"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.lactate?.message}
                />
              )}
            />
          </Group>
          <Controller
            control={control}
            name="notes"
            render={({ field }) => <Textarea label="Notes" {...field} />}
          />
          <Button tone="primary" loading={createMut.isPending} type="submit">
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Mortality Comparison ─────────────────────────────────────

function MortalityComparison({ scores }: { scores: IcuScore[] }) {
  const mortalityScores = useMemo(
    () =>
      scores
        .filter((s) => s.predicted_mortality != null)
        .sort((a, b) => new Date(b.scored_at).getTime() - new Date(a.scored_at).getTime()),
    [scores],
  );

  const latest = mortalityScores[0];
  if (!latest) return null;

  const latestMortality = latest.predicted_mortality ?? 0;

  // Determine severity color based on predicted mortality
  const severityColor =
    latestMortality >= 75
      ? "danger"
      : latestMortality >= 50
        ? "orange"
        : latestMortality >= 25
          ? "warning"
          : "success";

  // Average predicted mortality across all scored entries
  const avgMortality =
    mortalityScores.reduce((sum, s) => sum + (s.predicted_mortality ?? 0), 0) /
    mortalityScores.length;

  return (
    <Card withBorder padding="md" mt="md">
      <Text fw={600} size="sm" mb="sm">
        Predicted Mortality Analysis
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Card withBorder padding="sm" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Latest Prediction ({scoreTypeLabels[latest.score_type] ?? latest.score_type})
          </Text>
          <Text size="xl" fw={700} c={severityColor} mt={4}>
            {latestMortality.toFixed(1)}%
          </Text>
          <Text size="xs" c="dimmed">
            Score: {latest.score_value} | {new Date(latest.scored_at).toLocaleDateString()}
          </Text>
          <Progress value={latestMortality} color={severityColor} mt="xs" size="sm" />
        </Card>

        <Card withBorder padding="sm" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Average Predicted Mortality
          </Text>
          <Text size="xl" fw={700} c={avgMortality >= 50 ? "orange" : "primary"} mt={4}>
            {avgMortality.toFixed(1)}%
          </Text>
          <Text size="xs" c="dimmed">
            Across {mortalityScores.length} scored assessment{mortalityScores.length > 1 ? "s" : ""}
          </Text>
          <Progress
            value={avgMortality}
            color={avgMortality >= 50 ? "orange" : "primary"}
            mt="xs"
            size="sm"
          />
        </Card>

        <Card withBorder padding="sm" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Trend
          </Text>
          {mortalityScores.length >= 2 ? (
            (() => {
              const oldest = mortalityScores[mortalityScores.length - 1];
              if (!oldest) return null;
              const diff = latestMortality - (oldest.predicted_mortality ?? 0);
              const improving = diff < 0;
              return (
                <>
                  <Text size="xl" fw={700} c={improving ? "success" : "danger"} mt={4}>
                    {improving ? "" : "+"}
                    {diff.toFixed(1)}%
                  </Text>
                  <Text size="xs" c="dimmed">
                    {improving ? "Improving" : "Worsening"} from first assessment
                  </Text>
                  <ThemeIcon
                    size="sm"
                    variant="light"
                    color={improving ? "success" : "danger"}
                    mt="xs"
                  >
                    <Text size="xs">{improving ? "v" : "^"}</Text>
                  </ThemeIcon>
                </>
              );
            })()
          ) : (
            <Text size="sm" c="dimmed" mt={4}>
              Need 2+ assessments
            </Text>
          )}
        </Card>
      </SimpleGrid>
    </Card>
  );
}

// ── Scores Tab ──────────────────────────────────────────────

function ScoresTab({ admissionId }: { admissionId: string }) {
  const canCreate = useHasPermission(P.ICU.SCORES_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);

  const { data: scores = [], isLoading } = useQuery({
    queryKey: ["icu-scores", admissionId],
    queryFn: () => icuService.listIcuScores(admissionId),
    enabled: !!admissionId,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IcuScoreFormInput>({
    resolver: zodResolver(icuScoreFormSchema),
    defaultValues: DEFAULT_ICU_SCORE_FORM_VALUES,
  });

  const createMut = useMutation({
    mutationFn: (values: IcuScoreFormInput) =>
      icuService.createIcuScore(admissionId, toCreateIcuScoreRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-scores", admissionId] });
      notifications.show({ title: "Score recorded", message: "", color: "success" });
      close();
      reset(DEFAULT_ICU_SCORE_FORM_VALUES);
    },
  });

  const columns = [
    {
      key: "scored_at",
      label: "Time",
      render: (r: IcuScore) => new Date(r.scored_at).toLocaleString(),
    },
    {
      key: "score_type",
      label: "Type",
      render: (r: IcuScore) => scoreTypeLabels[r.score_type] ?? r.score_type,
    },
    { key: "score_value", label: "Score", render: (r: IcuScore) => String(r.score_value) },
    {
      key: "predicted_mortality",
      label: "Mortality %",
      render: (r: IcuScore) => (r.predicted_mortality != null ? `${r.predicted_mortality}%` : "—"),
    },
    { key: "notes", label: "Notes", render: (r: IcuScore) => r.notes ?? "" },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && admissionId && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            Record Score
          </Button>
        )}
      </Group>

      {admissionId ? (
        <DataTable
          columns={columns}
          data={scores}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No scores recorded"
        />
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          Select an admission to view ICU scores
        </Text>
      )}

      {/* Predicted vs Actual Mortality */}
      {admissionId && scores.length > 0 && <MortalityComparison scores={scores} />}

      <Drawer opened={opened} onClose={close} title="Record ICU Score" position="right" size="sm">
        <Stack component="form" onSubmit={handleSubmit((values) => createMut.mutate(values))}>
          <Controller
            control={control}
            name="score_type"
            render={({ field }) => (
              <Select
                label="Score Type"
                data={ICU_SCORE_TYPE_OPTIONS}
                value={field.value}
                onChange={(value) => field.onChange(normalizeIcuScoreType(value))}
                error={errors.score_type?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="score_value"
            render={({ field }) => (
              <NumberInput
                label="Score Value"
                value={field.value}
                onChange={field.onChange}
                error={errors.score_value?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="predicted_mortality"
            render={({ field }) => (
              <NumberInput
                label="Predicted Mortality %"
                decimalScale={1}
                value={field.value}
                onChange={field.onChange}
                error={errors.predicted_mortality?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="notes"
            render={({ field }) => <Textarea label="Notes" {...field} />}
          />
          <Button tone="primary" loading={createMut.isPending} type="submit">
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Devices Tab ─────────────────────────────────────────────

function DevicesTab({ admissionId }: { admissionId: string }) {
  const canManage = useHasPermission(P.ICU.DEVICES_MANAGE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedDevice, setSelectedDevice] = useState<IcuDevice | null>(null);
  const [bundleOpened, { open: openBundle, close: closeBundle }] = useDisclosure(false);

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["icu-devices", admissionId],
    queryFn: () => icuService.listIcuDevices(admissionId),
    enabled: !!admissionId,
  });

  const {
    control: deviceControl,
    handleSubmit: handleDeviceSubmit,
    reset: resetDeviceForm,
    formState: { errors: deviceErrors },
  } = useForm<IcuDeviceFormInput>({
    resolver: zodResolver(icuDeviceFormSchema),
    defaultValues: DEFAULT_ICU_DEVICE_FORM_VALUES,
  });

  const createMut = useMutation({
    mutationFn: (values: IcuDeviceFormInput) =>
      icuService.createIcuDevice(admissionId, toCreateIcuDeviceRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-devices", admissionId] });
      notifications.show({ title: "Device tracked", message: "", color: "success" });
      close();
      resetDeviceForm(DEFAULT_ICU_DEVICE_FORM_VALUES);
    },
  });

  const removeMut = useMutation({
    mutationFn: (deviceId: string) => icuService.removeIcuDevice(admissionId, deviceId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-devices", admissionId] });
      notifications.show({ title: "Device removed", message: "", color: "primary" });
    },
  });

  // Bundle check state
  const { data: bundleChecks = [] } = useQuery({
    queryKey: ["icu-bundle-checks", selectedDevice?.id],
    queryFn: () => icuService.listIcuBundleChecks(admissionId, selectedDevice?.id ?? ""),
    enabled: !!selectedDevice,
  });

  const {
    control: bundleControl,
    handleSubmit: handleBundleSubmit,
    reset: resetBundleForm,
  } = useForm<IcuBundleCheckFormInput>({
    resolver: zodResolver(icuBundleCheckFormSchema),
    defaultValues: DEFAULT_ICU_BUNDLE_CHECK_FORM_VALUES,
  });

  const bundleMut = useMutation({
    mutationFn: (values: IcuBundleCheckFormInput) =>
      icuService.createIcuBundleCheck(
        admissionId,
        selectedDevice?.id ?? "",
        toCreateIcuBundleCheckRequest(values),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-bundle-checks", selectedDevice?.id] });
      notifications.show({ title: "Bundle check saved", message: "", color: "success" });
      resetBundleForm(DEFAULT_ICU_BUNDLE_CHECK_FORM_VALUES);
    },
  });

  const columns = [
    {
      key: "device_type",
      label: "Type",
      render: (d: IcuDevice) => deviceTypeLabels[d.device_type] ?? d.device_type,
    },
    { key: "site", label: "Site", render: (d: IcuDevice) => d.site ?? "—" },
    {
      key: "inserted_at",
      label: "Inserted",
      render: (d: IcuDevice) => new Date(d.inserted_at).toLocaleDateString(),
    },
    {
      key: "is_active",
      label: "Status",
      render: (d: IcuDevice) =>
        d.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Removed</Badge>,
    },
    {
      key: "id",
      label: "Actions",
      render: (d: IcuDevice) => (
        <Group gap="xs">
          <Tooltip label="Bundle Checks">
            <IconButton
              onClick={() => {
                setSelectedDevice(d);
                openBundle();
              }}
              aria-label="Bundle Checks"
            >
              <IconReportMedical size={16} />
            </IconButton>
          </Tooltip>
          {canManage && d.is_active && (
            <Tooltip label="Remove Device">
              <IconButton
                tone="danger"
                onClick={() => removeMut.mutate(d.id)}
                aria-label="Remove Device"
              >
                <IconTrash size={16} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canManage && admissionId && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            Add Device
          </Button>
        )}
      </Group>

      {admissionId ? (
        <DataTable
          columns={columns}
          data={devices}
          loading={isLoading}
          rowKey={(d) => d.id}
          emptyTitle="No devices tracked"
        />
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          Select an admission to manage devices
        </Text>
      )}

      <Drawer opened={opened} onClose={close} title="Track New Device" position="right" size="sm">
        <Stack component="form" onSubmit={handleDeviceSubmit((values) => createMut.mutate(values))}>
          <Controller
            control={deviceControl}
            name="device_type"
            render={({ field }) => (
              <Select
                label="Device Type"
                data={ICU_DEVICE_TYPE_OPTIONS}
                value={field.value}
                onChange={(value) => field.onChange(normalizeIcuDeviceType(value))}
                error={deviceErrors.device_type?.message}
              />
            )}
          />
          <Controller
            control={deviceControl}
            name="site"
            render={({ field }) => (
              <TextInput label="Insertion Site" {...field} error={deviceErrors.site?.message} />
            )}
          />
          <Controller
            control={deviceControl}
            name="notes"
            render={({ field }) => <Textarea label="Notes" {...field} />}
          />
          <Button tone="primary" loading={createMut.isPending} type="submit">
            Save
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={bundleOpened}
        onClose={closeBundle}
        title={`Bundle Checks — ${selectedDevice ? deviceTypeLabels[selectedDevice.device_type] : ""}`}
        position="right"
        size="xl"
      >
        <Stack>
          {bundleChecks.length > 0 && (
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Compliant</Table.Th>
                  <Table.Th>Still Needed</Table.Th>
                  <Table.Th>Notes</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {bundleChecks.map((bc: IcuBundleCheck) => (
                  <Table.Tr key={bc.id}>
                    <Table.Td>{new Date(bc.checked_at).toLocaleString()}</Table.Td>
                    <Table.Td>
                      {bc.is_compliant ? (
                        <Badge tone="success">Yes</Badge>
                      ) : (
                        <Badge tone="danger">No</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>{bc.still_needed ? "Yes" : "No"}</Table.Td>
                    <Table.Td>{bc.notes ?? "—"}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}

          {canManage && (
            <Stack
              component="form"
              onSubmit={handleBundleSubmit((values) => bundleMut.mutate(values))}
            >
              <Text fw={600}>New Bundle Check</Text>
              <Controller
                control={bundleControl}
                name="is_compliant"
                render={({ field }) => (
                  <Checkbox
                    label="Compliant"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.currentTarget.checked)}
                  />
                )}
              />
              <Controller
                control={bundleControl}
                name="still_needed"
                render={({ field }) => (
                  <Checkbox
                    label="Device Still Needed"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.currentTarget.checked)}
                  />
                )}
              />
              <Controller
                control={bundleControl}
                name="notes"
                render={({ field }) => <Textarea label="Notes" {...field} />}
              />
              <Button tone="primary" loading={bundleMut.isPending} type="submit">
                Save Check
              </Button>
            </Stack>
          )}
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Nutrition Tab ───────────────────────────────────────────

function NutritionTab({ admissionId }: { admissionId: string }) {
  const canCreate = useHasPermission(P.ICU.NUTRITION_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["icu-nutrition", admissionId],
    queryFn: () => icuService.listIcuNutrition(admissionId),
    enabled: !!admissionId,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IcuNutritionFormInput>({
    resolver: zodResolver(icuNutritionFormSchema),
    defaultValues: DEFAULT_ICU_NUTRITION_FORM_VALUES,
  });

  const createMut = useMutation({
    mutationFn: (values: IcuNutritionFormInput) =>
      icuService.createIcuNutrition(admissionId, toCreateIcuNutritionRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-nutrition", admissionId] });
      notifications.show({ title: "Nutrition recorded", message: "", color: "success" });
      close();
      reset(DEFAULT_ICU_NUTRITION_FORM_VALUES);
    },
  });

  const columns = [
    {
      key: "recorded_at",
      label: "Time",
      render: (r: IcuNutrition) => new Date(r.recorded_at).toLocaleString(),
    },
    {
      key: "route",
      label: "Route",
      render: (r: IcuNutrition) => nutritionRouteLabels[r.route] ?? r.route,
    },
    {
      key: "formula_name",
      label: "Formula",
      render: (r: IcuNutrition) => r.formula_name ?? "—",
    },
    {
      key: "rate_ml_hr",
      label: "Rate mL/hr",
      render: (r: IcuNutrition) => (r.rate_ml_hr != null ? String(r.rate_ml_hr) : "—"),
    },
    {
      key: "calories_kcal",
      label: "kcal",
      render: (r: IcuNutrition) => (r.calories_kcal != null ? String(r.calories_kcal) : "—"),
    },
    {
      key: "protein_gm",
      label: "Protein g",
      render: (r: IcuNutrition) => (r.protein_gm != null ? String(r.protein_gm) : "—"),
    },
    { key: "notes", label: "Notes", render: (r: IcuNutrition) => r.notes ?? "" },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && admissionId && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            Record Nutrition
          </Button>
        )}
      </Group>

      {admissionId ? (
        <DataTable
          columns={columns}
          data={records}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No nutrition records"
        />
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          Select an admission to view nutrition
        </Text>
      )}

      <Drawer opened={opened} onClose={close} title="Record Nutrition" position="right" size="sm">
        <Stack component="form" onSubmit={handleSubmit((values) => createMut.mutate(values))}>
          <Controller
            control={control}
            name="route"
            render={({ field }) => (
              <Select
                label="Route"
                data={ICU_NUTRITION_ROUTE_OPTIONS}
                value={field.value}
                onChange={(value) => field.onChange(normalizeIcuNutritionRoute(value))}
                error={errors.route?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="formula_name"
            render={({ field }) => (
              <TextInput label="Formula Name" {...field} error={errors.formula_name?.message} />
            )}
          />
          <Group grow>
            <Controller
              control={control}
              name="rate_ml_hr"
              render={({ field }) => (
                <NumberInput
                  label="Rate mL/hr"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.rate_ml_hr?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="volume_ml"
              render={({ field }) => (
                <NumberInput
                  label="Volume mL"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.volume_ml?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="calories_kcal"
              render={({ field }) => (
                <NumberInput
                  label="Calories kcal"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.calories_kcal?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="protein_gm"
              render={({ field }) => (
                <NumberInput
                  label="Protein g"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.protein_gm?.message}
                />
              )}
            />
          </Group>
          <Controller
            control={control}
            name="notes"
            render={({ field }) => <Textarea label="Notes" {...field} />}
          />
          <Button tone="primary" loading={createMut.isPending} type="submit">
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Bilirubin & Phototherapy Panel ───────────────────────────

function BilirubinPhototherapyPanel({ records }: { records: IcuNeonatalRecord[] }) {
  const bilirubinData = useMemo(() => {
    const sorted = [...records]
      .filter((r) => r.bilirubin_total != null)
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    return sorted.map((r) => ({
      time: new Date(r.recorded_at).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      "Total Bilirubin": r.bilirubin_total,
      "Direct Bilirubin": r.bilirubin_direct,
    }));
  }, [records]);

  const phototherapySummary = useMemo(() => {
    const sorted = [...records].sort(
      (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
    );

    const currentlyActive = sorted.some((r) => r.phototherapy_active);
    const totalHours = records.reduce((sum, r) => sum + (r.phototherapy_hours ?? 0), 0);

    // Find first record with phototherapy active and last with it active
    const activeRecords = records.filter((r) => r.phototherapy_active);
    const firstActive =
      activeRecords.length > 0
        ? activeRecords.reduce((earliest, r) =>
            new Date(r.recorded_at) < new Date(earliest.recorded_at) ? r : earliest,
          )
        : null;
    const lastActive =
      activeRecords.length > 0
        ? activeRecords.reduce((latest, r) =>
            new Date(r.recorded_at) > new Date(latest.recorded_at) ? r : latest,
          )
        : null;

    // Peak bilirubin
    const peakBili = records.reduce((max, r) => Math.max(max, r.bilirubin_total ?? 0), 0);

    // Latest bilirubin
    const latestWithBili = sorted.find((r) => r.bilirubin_total != null);
    const latestBili = latestWithBili?.bilirubin_total ?? null;

    return {
      currentlyActive,
      totalHours,
      firstActive,
      lastActive,
      peakBili,
      latestBili,
      sessionCount: activeRecords.length,
    };
  }, [records]);

  return (
    <Stack mt="md" gap="md">
      {/* Phototherapy Status Summary */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        <Card withBorder padding="sm" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Phototherapy Status
          </Text>
          <Badge
            size="lg"
            tone={phototherapySummary.currentlyActive ? "warning" : "neutral"}
            mt={4}
          >
            {phototherapySummary.currentlyActive ? "Active" : "Completed / Off"}
          </Badge>
        </Card>

        <Card withBorder padding="sm" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Total Phototherapy Hours
          </Text>
          <Text size="xl" fw={700} c="yellow.7" mt={4}>
            {phototherapySummary.totalHours.toFixed(1)} hrs
          </Text>
          <Text size="xs" c="dimmed">
            {phototherapySummary.sessionCount} session
            {phototherapySummary.sessionCount !== 1 ? "s" : ""} recorded
          </Text>
        </Card>

        <Card withBorder padding="sm" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Peak Bilirubin
          </Text>
          <Text
            size="xl"
            fw={700}
            c={
              phototherapySummary.peakBili >= 20
                ? "danger"
                : phototherapySummary.peakBili >= 15
                  ? "orange"
                  : "primary"
            }
            mt={4}
          >
            {phototherapySummary.peakBili > 0
              ? `${phototherapySummary.peakBili.toFixed(1)} mg/dL`
              : "—"}
          </Text>
        </Card>

        <Card withBorder padding="sm" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Latest Bilirubin
          </Text>
          <Text
            size="xl"
            fw={700}
            c={
              phototherapySummary.latestBili != null && phototherapySummary.latestBili >= 15
                ? "orange"
                : "success"
            }
            mt={4}
          >
            {phototherapySummary.latestBili != null
              ? `${phototherapySummary.latestBili.toFixed(1)} mg/dL`
              : "—"}
          </Text>
          {phototherapySummary.latestBili != null && phototherapySummary.peakBili > 0 && (
            <Text size="xs" c="dimmed">
              {phototherapySummary.latestBili < phototherapySummary.peakBili
                ? `Decreased ${(phototherapySummary.peakBili - phototherapySummary.latestBili).toFixed(1)} from peak`
                : "At peak level"}
            </Text>
          )}
        </Card>
      </SimpleGrid>

      {/* Phototherapy Timeline */}
      {phototherapySummary.firstActive && (
        <Card withBorder padding="sm" radius="md">
          <Text size="xs" c="dimmed" fw={600} mb="xs">
            Phototherapy Timeline
          </Text>
          <Group gap="xl">
            <div>
              <Text size="xs" c="dimmed">
                Started
              </Text>
              <Text size="sm" fw={500}>
                {new Date(phototherapySummary.firstActive.recorded_at).toLocaleString()}
              </Text>
            </div>
            {phototherapySummary.lastActive && !phototherapySummary.currentlyActive && (
              <div>
                <Text size="xs" c="dimmed">
                  Last Active
                </Text>
                <Text size="sm" fw={500}>
                  {new Date(phototherapySummary.lastActive.recorded_at).toLocaleString()}
                </Text>
              </div>
            )}
          </Group>
        </Card>
      )}

      {/* Bilirubin Trend Chart */}
      {bilirubinData.length >= 2 && (
        <Card withBorder padding="md">
          <Text fw={600} size="sm" mb="sm">
            Bilirubin Trend
          </Text>
          <LineChart
            h={250}
            data={bilirubinData}
            dataKey="time"
            series={[
              { name: "Total Bilirubin", color: "orange" },
              { name: "Direct Bilirubin", color: "teal" },
            ]}
            curveType="monotone"
            connectNulls
            withLegend
            withTooltip
            tooltipAnimationDuration={200}
            referenceLines={[{ y: 15, color: "red.5", label: "Exchange threshold" }]}
          />
        </Card>
      )}
    </Stack>
  );
}

// ── Neonatal Tab ────────────────────────────────────────────

function NeonatalTab({ admissionId }: { admissionId: string }) {
  const canCreate = useHasPermission(P.ICU.NEONATAL_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["icu-neonatal", admissionId],
    queryFn: () => icuService.listIcuNeonatalRecords(admissionId),
    enabled: !!admissionId,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IcuNeonatalFormInput>({
    resolver: zodResolver(icuNeonatalFormSchema),
    defaultValues: DEFAULT_ICU_NEONATAL_FORM_VALUES,
  });
  const phototherapyActive = useWatch({ control, name: "phototherapy_active" });

  const createMut = useMutation({
    mutationFn: (values: IcuNeonatalFormInput) =>
      icuService.createIcuNeonatalRecord(admissionId, toCreateIcuNeonatalRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-neonatal", admissionId] });
      notifications.show({ title: "Neonatal record saved", message: "", color: "success" });
      close();
      reset(DEFAULT_ICU_NEONATAL_FORM_VALUES);
    },
  });

  const columns = [
    {
      key: "recorded_at",
      label: "Time",
      render: (r: IcuNeonatalRecord) => new Date(r.recorded_at).toLocaleString(),
    },
    {
      key: "gestational_age_weeks",
      label: "GA wks",
      render: (r: IcuNeonatalRecord) =>
        r.gestational_age_weeks != null ? String(r.gestational_age_weeks) : "—",
    },
    {
      key: "current_weight_gm",
      label: "Weight g",
      render: (r: IcuNeonatalRecord) =>
        r.current_weight_gm != null ? String(r.current_weight_gm) : "—",
    },
    {
      key: "bilirubin_total",
      label: "Bilirubin",
      render: (r: IcuNeonatalRecord) =>
        r.bilirubin_total != null ? String(r.bilirubin_total) : "—",
    },
    {
      key: "phototherapy_active",
      label: "Phototherapy",
      render: (r: IcuNeonatalRecord) =>
        r.phototherapy_active ? (
          <Badge tone="warning">Active</Badge>
        ) : (
          <Badge tone="neutral">Off</Badge>
        ),
    },
    { key: "notes", label: "Notes", render: (r: IcuNeonatalRecord) => r.notes ?? "" },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && admissionId && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            Record NICU Data
          </Button>
        )}
      </Group>

      {admissionId ? (
        <DataTable
          columns={columns}
          data={records}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No neonatal records"
        />
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          Select an admission to view NICU records
        </Text>
      )}

      {/* Bilirubin Trend & Phototherapy Tracking */}
      {admissionId && records.length > 0 && <BilirubinPhototherapyPanel records={records} />}

      <Drawer
        opened={opened}
        onClose={close}
        title="Record Neonatal Data"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmit((values) => createMut.mutate(values))}>
          <Group grow>
            <Controller
              control={control}
              name="gestational_age_weeks"
              render={({ field }) => (
                <NumberInput
                  label="Gestational Age (weeks)"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.gestational_age_weeks?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="birth_weight_gm"
              render={({ field }) => (
                <NumberInput
                  label="Birth Weight (g)"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.birth_weight_gm?.message}
                />
              )}
            />
          </Group>
          <Controller
            control={control}
            name="current_weight_gm"
            render={({ field }) => (
              <NumberInput
                label="Current Weight (g)"
                value={field.value}
                onChange={field.onChange}
                error={errors.current_weight_gm?.message}
              />
            )}
          />
          <Group grow>
            <Controller
              control={control}
              name="bilirubin_total"
              render={({ field }) => (
                <NumberInput
                  label="Bilirubin Total"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.bilirubin_total?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="bilirubin_direct"
              render={({ field }) => (
                <NumberInput
                  label="Bilirubin Direct"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.bilirubin_direct?.message}
                />
              )}
            />
          </Group>
          <Controller
            control={control}
            name="phototherapy_active"
            render={({ field }) => (
              <Checkbox
                label="Phototherapy Active"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          {phototherapyActive && (
            <Controller
              control={control}
              name="phototherapy_hours"
              render={({ field }) => (
                <NumberInput
                  label="Phototherapy Hours"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.phototherapy_hours?.message}
                />
              )}
            />
          )}
          <Group grow>
            <Controller
              control={control}
              name="breast_milk_type"
              render={({ field }) => (
                <TextInput
                  label="Breast Milk Type"
                  {...field}
                  error={errors.breast_milk_type?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="breast_milk_volume_ml"
              render={({ field }) => (
                <NumberInput
                  label="Breast Milk Volume mL"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.breast_milk_volume_ml?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="hearing_screen_result"
              render={({ field }) => (
                <TextInput
                  label="Hearing Screen"
                  {...field}
                  error={errors.hearing_screen_result?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="sepsis_screen_result"
              render={({ field }) => (
                <TextInput
                  label="Sepsis Screen"
                  {...field}
                  error={errors.sepsis_screen_result?.message}
                />
              )}
            />
          </Group>
          <Controller
            control={control}
            name="mother_patient_id"
            render={({ field }) => (
              <PatientSearchSelect
                label="Mother Patient"
                value={field.value}
                onChange={field.onChange}
                error={errors.mother_patient_id?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="notes"
            render={({ field }) => <Textarea label="Notes" {...field} />}
          />
          <Button tone="primary" loading={createMut.isPending} type="submit">
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Analytics Tab ───────────────────────────────────────────

function AnalyticsTab() {
  const { data: losData, isLoading: loadingLos } = useQuery({
    queryKey: ["icu-los-analytics"],
    queryFn: () => icuService.getIcuLosAnalytics(),
  });

  const { data: infectionRates = [], isLoading: loadingInfections } = useQuery({
    queryKey: ["icu-device-infection-rates"],
    queryFn: () => icuService.getIcuDeviceInfectionRates(),
  });

  const infectionColumns = [
    {
      key: "device_type",
      label: "Device Type",
      render: (r: DeviceInfectionRate) => r.device_type.replace(/_/g, " "),
    },
    {
      key: "total_device_days",
      label: "Total Device Days",
      render: (r: DeviceInfectionRate) => String(r.total_device_days),
    },
    {
      key: "infection_count",
      label: "Infections",
      render: (r: DeviceInfectionRate) => String(r.infection_count),
    },
    {
      key: "rate_per_1000",
      label: "Rate per 1,000 Days",
      render: (r: DeviceInfectionRate) =>
        r.rate_per_1000 != null ? r.rate_per_1000.toFixed(2) : "—",
    },
  ];

  return (
    <Stack>
      <Text fw={600} size="lg">
        LOS & Readmission Analytics
      </Text>
      {loadingLos ? (
        <Text c="dimmed" size="sm">
          Loading...
        </Text>
      ) : losData ? (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md">
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Total Admissions
            </Text>
            <Text size="xl" fw={700} mt={4}>
              {losData.total_admissions}
            </Text>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Avg LOS (days)
            </Text>
            <Text size="xl" fw={700} mt={4}>
              {losData.avg_los_days != null ? losData.avg_los_days.toFixed(1) : "—"}
            </Text>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Median LOS (days)
            </Text>
            <Text size="xl" fw={700} mt={4}>
              {losData.median_los_days != null ? losData.median_los_days.toFixed(1) : "—"}
            </Text>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Readmissions (30d)
            </Text>
            <Text
              size="xl"
              fw={700}
              c={losData.readmission_count > 0 ? "orange" : "success"}
              mt={4}
            >
              {losData.readmission_count}
            </Text>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Readmission Rate
            </Text>
            <Text
              size="xl"
              fw={700}
              c={
                losData.readmission_rate != null && losData.readmission_rate > 10
                  ? "danger"
                  : "success"
              }
              mt={4}
            >
              {losData.readmission_rate != null ? `${losData.readmission_rate.toFixed(1)}%` : "—"}
            </Text>
          </Paper>
        </SimpleGrid>
      ) : (
        <Text c="dimmed" size="sm">
          No analytics data available
        </Text>
      )}

      <Text fw={600} size="lg" mt="md">
        Device Infection Rates
      </Text>
      <DataTable
        columns={infectionColumns}
        data={infectionRates}
        loading={loadingInfections}
        rowKey={(r) => r.device_type}
        emptyTitle="No device infection data"
      />
    </Stack>
  );
}

// ── Main ICU Page ───────────────────────────────────────────

export function IcuPage() {
  useRequirePermission(P.ICU.FLOWSHEETS_LIST);

  const [admissionId, setAdmissionId] = useState("");

  return (
    <div>
      <PageHeader
        title="ICU / Critical Care"
        subtitle="Flowsheets, ventilator management, scoring, device tracking, nutrition, and NICU"
      />

      <AdmissionSelector admissionId={admissionId} onChange={setAdmissionId} />

      <Tabs defaultValue="flowsheets" mt="md">
        <Tabs.List>
          <Tabs.Tab value="flowsheets" leftSection={<IconHeartbeat size={16} />}>
            Flowsheets
          </Tabs.Tab>
          <Tabs.Tab value="ventilator" leftSection={<IconLungs size={16} />}>
            Ventilator
          </Tabs.Tab>
          <Tabs.Tab value="scores" leftSection={<IconReportMedical size={16} />}>
            Scores
          </Tabs.Tab>
          <Tabs.Tab value="devices" leftSection={<IconStethoscope size={16} />}>
            Devices
          </Tabs.Tab>
          <Tabs.Tab value="nutrition" leftSection={<IconToolsKitchen2 size={16} />}>
            Nutrition
          </Tabs.Tab>
          <Tabs.Tab value="nicu" leftSection={<IconBabyCarriage size={16} />}>
            NICU
          </Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
            Analytics
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="flowsheets" pt="md">
          <FlowsheetsTab admissionId={admissionId} />
        </Tabs.Panel>
        <Tabs.Panel value="ventilator" pt="md">
          <VentilatorTab admissionId={admissionId} />
        </Tabs.Panel>
        <Tabs.Panel value="scores" pt="md">
          <ScoresTab admissionId={admissionId} />
        </Tabs.Panel>
        <Tabs.Panel value="devices" pt="md">
          <DevicesTab admissionId={admissionId} />
        </Tabs.Panel>
        <Tabs.Panel value="nutrition" pt="md">
          <NutritionTab admissionId={admissionId} />
        </Tabs.Panel>
        <Tabs.Panel value="nicu" pt="md">
          <NeonatalTab admissionId={admissionId} />
        </Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md">
          <AnalyticsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
