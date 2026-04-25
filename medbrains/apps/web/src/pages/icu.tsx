import { useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
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
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { LineChart } from "@mantine/charts";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconHeartbeat,
  IconLungs,
  IconPlus,
  IconReportMedical,
  IconStethoscope,
  IconToolsKitchen2,
  IconBabyCarriage,
  IconTrash,
  IconChartBar,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  IcuFlowsheet,
  IcuVentilatorRecord,
  IcuScore,
  IcuDevice,
  IcuBundleCheck,
  IcuNutrition,
  IcuNeonatalRecord,
  CreateIcuFlowsheetRequest,
  CreateIcuVentilatorRequest,
  CreateIcuScoreRequest,
  CreateIcuDeviceRequest,
  CreateIcuBundleCheckRequest,
  CreateIcuNutritionRequest,
  CreateIcuNeonatalRequest,
  VentilatorMode,
  IcuScoreType,
  IcuDeviceType,
  NutritionRoute,
  DeviceInfectionRate,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import { useRequirePermission } from "../hooks/useRequirePermission";

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
    () => (latestWithInfusions?.infusions ?? []) as InfusionEntry[],
    [latestWithInfusions],
  );

  const saveMut = useMutation({
    mutationFn: async (newInfusion: InfusionEntry) => {
      const existing = activeInfusions;
      const updated = [...existing, newInfusion];
      return api.createIcuFlowsheet(admissionId, { infusions: updated as Record<string, unknown>[] });
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
        <Text fw={600} size="sm">Active Infusions</Text>
        {canCreate && (
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setAdding(true)}>
            Add Infusion
          </Button>
        )}
      </Group>

      {activeInfusions.length > 0 ? (
        <Table withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Drug</Table.Th>
              <Table.Th>Rate (mL/hr)</Table.Th>
              <Table.Th>Concentration</Table.Th>
              <Table.Th>Start Time</Table.Th>
              <Table.Th>Duration (hrs)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {activeInfusions.map((inf, idx) => (
              <Table.Tr key={idx}>
                <Table.Td>{inf.drug_name ?? "—"}</Table.Td>
                <Table.Td>{inf.rate_ml_hr != null ? String(inf.rate_ml_hr) : "—"}</Table.Td>
                <Table.Td>{inf.concentration ?? "—"}</Table.Td>
                <Table.Td>{inf.start_time ? new Date(inf.start_time).toLocaleTimeString() : "—"}</Table.Td>
                <Table.Td>{inf.duration_hours != null ? String(inf.duration_hours) : "—"}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text c="dimmed" size="sm">No active infusions recorded</Text>
      )}

      {adding && (
        <Stack mt="md" gap="xs">
          <Text fw={500} size="sm">New Infusion</Text>
          <Group grow>
            <TextInput
              label="Drug Name"
              placeholder="e.g. Noradrenaline"
              value={infForm.drug_name ?? ""}
              onChange={(e) => setInfForm({ ...infForm, drug_name: e.currentTarget.value || undefined })}
            />
            <NumberInput
              label="Rate (mL/hr)"
              decimalScale={1}
              value={infForm.rate_ml_hr ?? ""}
              onChange={(v) => setInfForm({ ...infForm, rate_ml_hr: v === "" ? undefined : Number(v) })}
            />
          </Group>
          <Group grow>
            <TextInput
              label="Concentration"
              placeholder="e.g. 4mg/50mL"
              value={infForm.concentration ?? ""}
              onChange={(e) => setInfForm({ ...infForm, concentration: e.currentTarget.value || undefined })}
            />
            <NumberInput
              label="Duration (hours)"
              decimalScale={1}
              value={infForm.duration_hours ?? ""}
              onChange={(v) => setInfForm({ ...infForm, duration_hours: v === "" ? undefined : Number(v) })}
            />
          </Group>
          <Group>
            <Button size="xs" loading={saveMut.isPending} onClick={() => saveMut.mutate({ ...infForm, start_time: new Date().toISOString() })}>
              Save Infusion
            </Button>
            <Button size="xs" variant="subtle" onClick={() => { setAdding(false); setInfForm({}); }}>
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

  const { data: flowsheets = [], isLoading } = useQuery({
    queryKey: ["icu-flowsheets", admissionId],
    queryFn: () => api.listIcuFlowsheets(admissionId),
    enabled: !!admissionId,
  });

  const [form, setForm] = useState<CreateIcuFlowsheetRequest>({});
  const createMut = useMutation({
    mutationFn: (data: CreateIcuFlowsheetRequest) =>
      api.createIcuFlowsheet(admissionId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-flowsheets", admissionId] });
      notifications.show({ title: "Flowsheet recorded", message: "", color: "success" });
      close();
      setForm({});
    },
  });

  const columns = [
    { key: "recorded_at" as const, label: "Time", render: (r: IcuFlowsheet) => new Date(r.recorded_at).toLocaleString() },
    { key: "heart_rate" as const, label: "HR", render: (r: IcuFlowsheet) => r.heart_rate != null ? String(r.heart_rate) : "—" },
    { key: "systolic_bp" as const, label: "BP", render: (r: IcuFlowsheet) => r.systolic_bp != null && r.diastolic_bp != null ? `${r.systolic_bp}/${r.diastolic_bp}` : "—" },
    { key: "spo2" as const, label: "SpO2", render: (r: IcuFlowsheet) => r.spo2 != null ? `${r.spo2}%` : "—" },
    { key: "temperature" as const, label: "Temp", render: (r: IcuFlowsheet) => r.temperature != null ? `${r.temperature}°C` : "—" },
    { key: "intake_ml" as const, label: "Intake", render: (r: IcuFlowsheet) => r.intake_ml != null ? `${r.intake_ml} mL` : "—" },
    { key: "output_ml" as const, label: "Output", render: (r: IcuFlowsheet) => r.output_ml != null ? `${r.output_ml} mL` : "—" },
    { key: "notes" as const, label: "Notes", render: (r: IcuFlowsheet) => r.notes ?? "" },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && admissionId && (
          <Button leftSection={<IconPlus size={16} />} onClick={open}>Record Vitals</Button>
        )}
      </Group>

      {admissionId ? (
        <DataTable columns={columns} data={flowsheets} loading={isLoading} rowKey={(r) => r.id} emptyTitle="No flowsheet entries" />
      ) : (
        <Text c="dimmed" ta="center" py="xl">Select an admission to view ICU flowsheets</Text>
      )}

      {/* Hemodynamic Trends Chart */}
      {admissionId && flowsheets.length >= 2 && (
        <HemodynamicChart flowsheets={flowsheets} />
      )}

      {/* Active Infusions */}
      {admissionId && (
        <InfusionTracker
          flowsheets={flowsheets}
          admissionId={admissionId}
          canCreate={canCreate}
        />
      )}

      <Drawer opened={opened} onClose={close} title="Record ICU Vitals" position="right" size="xl">
        <Stack>
          <Group grow>
            <NumberInput label="Heart Rate" value={form.heart_rate ?? ""} onChange={(v) => setForm({ ...form, heart_rate: v === "" ? undefined : Number(v) })} />
            <NumberInput label="SpO2 %" value={form.spo2 ?? ""} onChange={(v) => setForm({ ...form, spo2: v === "" ? undefined : Number(v) })} />
          </Group>
          <Group grow>
            <NumberInput label="Systolic BP" value={form.systolic_bp ?? ""} onChange={(v) => setForm({ ...form, systolic_bp: v === "" ? undefined : Number(v) })} />
            <NumberInput label="Diastolic BP" value={form.diastolic_bp ?? ""} onChange={(v) => setForm({ ...form, diastolic_bp: v === "" ? undefined : Number(v) })} />
          </Group>
          <Group grow>
            <NumberInput label="Resp Rate" value={form.respiratory_rate ?? ""} onChange={(v) => setForm({ ...form, respiratory_rate: v === "" ? undefined : Number(v) })} />
            <NumberInput label="Temp °C" decimalScale={1} value={form.temperature ?? ""} onChange={(v) => setForm({ ...form, temperature: v === "" ? undefined : Number(v) })} />
          </Group>
          <Group grow>
            <NumberInput label="CVP" decimalScale={1} value={form.cvp ?? ""} onChange={(v) => setForm({ ...form, cvp: v === "" ? undefined : Number(v) })} />
            <NumberInput label="MAP" value={form.mean_arterial_bp ?? ""} onChange={(v) => setForm({ ...form, mean_arterial_bp: v === "" ? undefined : Number(v) })} />
          </Group>
          <Group grow>
            <NumberInput label="Intake mL" value={form.intake_ml ?? ""} onChange={(v) => setForm({ ...form, intake_ml: v === "" ? undefined : Number(v) })} />
            <NumberInput label="Output mL" value={form.output_ml ?? ""} onChange={(v) => setForm({ ...form, output_ml: v === "" ? undefined : Number(v) })} />
          </Group>
          <Group grow>
            <NumberInput label="Urine mL" value={form.urine_ml ?? ""} onChange={(v) => setForm({ ...form, urine_ml: v === "" ? undefined : Number(v) })} />
            <NumberInput label="Drain mL" value={form.drain_ml ?? ""} onChange={(v) => setForm({ ...form, drain_ml: v === "" ? undefined : Number(v) })} />
          </Group>
          <Textarea label="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })} />
          <Button loading={createMut.isPending} onClick={() => createMut.mutate(form)}>Save</Button>
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
    queryFn: () => api.listIcuVentilatorRecords(admissionId),
    enabled: !!admissionId,
  });

  const [form, setForm] = useState<CreateIcuVentilatorRequest>({ mode: "cmv" });
  const createMut = useMutation({
    mutationFn: (data: CreateIcuVentilatorRequest) =>
      api.createIcuVentilatorRecord(admissionId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-ventilator", admissionId] });
      notifications.show({ title: "Ventilator record saved", message: "", color: "success" });
      close();
      setForm({ mode: "cmv" });
    },
  });

  const columns = [
    { key: "recorded_at" as const, label: "Time", render: (r: IcuVentilatorRecord) => new Date(r.recorded_at).toLocaleString() },
    { key: "mode" as const, label: "Mode", render: (r: IcuVentilatorRecord) => ventilatorModeLabels[r.mode] ?? r.mode },
    { key: "fio2" as const, label: "FiO2", render: (r: IcuVentilatorRecord) => r.fio2 != null ? `${r.fio2}%` : "—" },
    { key: "peep" as const, label: "PEEP", render: (r: IcuVentilatorRecord) => r.peep != null ? String(r.peep) : "—" },
    { key: "tidal_volume" as const, label: "Vt", render: (r: IcuVentilatorRecord) => r.tidal_volume != null ? `${r.tidal_volume} mL` : "—" },
    { key: "ph" as const, label: "ABG pH", render: (r: IcuVentilatorRecord) => r.ph != null ? String(r.ph) : "—" },
    { key: "pao2" as const, label: "PaO2", render: (r: IcuVentilatorRecord) => r.pao2 != null ? String(r.pao2) : "—" },
    { key: "paco2" as const, label: "PaCO2", render: (r: IcuVentilatorRecord) => r.paco2 != null ? String(r.paco2) : "—" },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && admissionId && (
          <Button leftSection={<IconPlus size={16} />} onClick={open}>Record Ventilator</Button>
        )}
      </Group>

      {admissionId ? (
        <DataTable columns={columns} data={records} loading={isLoading} rowKey={(r) => r.id} emptyTitle="No ventilator records" />
      ) : (
        <Text c="dimmed" ta="center" py="xl">Select an admission to view ventilator records</Text>
      )}

      <Drawer opened={opened} onClose={close} title="Record Ventilator Settings" position="right" size="xl">
        <Stack>
          <Select
            label="Mode"
            data={Object.entries(ventilatorModeLabels).map(([v, l]) => ({ value: v, label: l }))}
            value={form.mode}
            onChange={(v) => setForm({ ...form, mode: (v ?? "cmv") as VentilatorMode })}
          />
          <Group grow>
            <NumberInput label="FiO2 %" decimalScale={1} value={form.fio2 ?? ""} onChange={(v) => setForm({ ...form, fio2: v === "" ? undefined : Number(v) })} />
            <NumberInput label="PEEP" decimalScale={1} value={form.peep ?? ""} onChange={(v) => setForm({ ...form, peep: v === "" ? undefined : Number(v) })} />
          </Group>
          <Group grow>
            <NumberInput label="Tidal Volume mL" value={form.tidal_volume ?? ""} onChange={(v) => setForm({ ...form, tidal_volume: v === "" ? undefined : Number(v) })} />
            <NumberInput label="Resp Rate" value={form.respiratory_rate ?? ""} onChange={(v) => setForm({ ...form, respiratory_rate: v === "" ? undefined : Number(v) })} />
          </Group>
          <Group grow>
            <NumberInput label="PIP" decimalScale={1} value={form.pip ?? ""} onChange={(v) => setForm({ ...form, pip: v === "" ? undefined : Number(v) })} />
            <NumberInput label="Plateau" decimalScale={1} value={form.plateau_pressure ?? ""} onChange={(v) => setForm({ ...form, plateau_pressure: v === "" ? undefined : Number(v) })} />
          </Group>
          <Text fw={600} size="sm" mt="md">ABG Values</Text>
          <Group grow>
            <NumberInput label="pH" decimalScale={2} value={form.ph ?? ""} onChange={(v) => setForm({ ...form, ph: v === "" ? undefined : Number(v) })} />
            <NumberInput label="PaO2" decimalScale={1} value={form.pao2 ?? ""} onChange={(v) => setForm({ ...form, pao2: v === "" ? undefined : Number(v) })} />
          </Group>
          <Group grow>
            <NumberInput label="PaCO2" decimalScale={1} value={form.paco2 ?? ""} onChange={(v) => setForm({ ...form, paco2: v === "" ? undefined : Number(v) })} />
            <NumberInput label="HCO3" decimalScale={1} value={form.hco3 ?? ""} onChange={(v) => setForm({ ...form, hco3: v === "" ? undefined : Number(v) })} />
          </Group>
          <Group grow>
            <NumberInput label="SaO2" decimalScale={1} value={form.sao2 ?? ""} onChange={(v) => setForm({ ...form, sao2: v === "" ? undefined : Number(v) })} />
            <NumberInput label="Lactate" decimalScale={1} value={form.lactate ?? ""} onChange={(v) => setForm({ ...form, lactate: v === "" ? undefined : Number(v) })} />
          </Group>
          <Textarea label="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })} />
          <Button loading={createMut.isPending} onClick={() => createMut.mutate(form)}>Save</Button>
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
          <Progress value={avgMortality} color={avgMortality >= 50 ? "orange" : "primary"} mt="xs" size="sm" />
        </Card>

        <Card withBorder padding="sm" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Trend
          </Text>
          {mortalityScores.length >= 2 ? (
            <>
              {(() => {
                const oldest = mortalityScores[mortalityScores.length - 1] as IcuScore;
                const diff = latestMortality - (oldest.predicted_mortality ?? 0);
                const improving = diff < 0;
                return (
                  <>
                    <Text size="xl" fw={700} c={improving ? "success" : "danger"} mt={4}>
                      {improving ? "" : "+"}{diff.toFixed(1)}%
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
              })()}
            </>
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
    queryFn: () => api.listIcuScores(admissionId),
    enabled: !!admissionId,
  });

  const [form, setForm] = useState<CreateIcuScoreRequest>({ score_type: "sofa", score_value: 0 });
  const createMut = useMutation({
    mutationFn: (data: CreateIcuScoreRequest) =>
      api.createIcuScore(admissionId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-scores", admissionId] });
      notifications.show({ title: "Score recorded", message: "", color: "success" });
      close();
      setForm({ score_type: "sofa", score_value: 0 });
    },
  });

  const columns = [
    { key: "scored_at" as const, label: "Time", render: (r: IcuScore) => new Date(r.scored_at).toLocaleString() },
    { key: "score_type" as const, label: "Type", render: (r: IcuScore) => scoreTypeLabels[r.score_type] ?? r.score_type },
    { key: "score_value" as const, label: "Score", render: (r: IcuScore) => String(r.score_value) },
    { key: "predicted_mortality" as const, label: "Mortality %", render: (r: IcuScore) => r.predicted_mortality != null ? `${r.predicted_mortality}%` : "—" },
    { key: "notes" as const, label: "Notes", render: (r: IcuScore) => r.notes ?? "" },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && admissionId && (
          <Button leftSection={<IconPlus size={16} />} onClick={open}>Record Score</Button>
        )}
      </Group>

      {admissionId ? (
        <DataTable columns={columns} data={scores} loading={isLoading} rowKey={(r) => r.id} emptyTitle="No scores recorded" />
      ) : (
        <Text c="dimmed" ta="center" py="xl">Select an admission to view ICU scores</Text>
      )}

      {/* Predicted vs Actual Mortality */}
      {admissionId && scores.length > 0 && <MortalityComparison scores={scores} />}

      <Drawer opened={opened} onClose={close} title="Record ICU Score" position="right" size="sm">
        <Stack>
          <Select
            label="Score Type"
            data={Object.entries(scoreTypeLabels).map(([v, l]) => ({ value: v, label: l }))}
            value={form.score_type}
            onChange={(v) => setForm({ ...form, score_type: (v ?? "sofa") as IcuScoreType })}
          />
          <NumberInput label="Score Value" value={form.score_value} onChange={(v) => setForm({ ...form, score_value: v === "" ? 0 : Number(v) })} />
          <NumberInput label="Predicted Mortality %" decimalScale={1} value={form.predicted_mortality ?? ""} onChange={(v) => setForm({ ...form, predicted_mortality: v === "" ? undefined : Number(v) })} />
          <Textarea label="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })} />
          <Button loading={createMut.isPending} onClick={() => createMut.mutate(form)}>Save</Button>
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
    queryFn: () => api.listIcuDevices(admissionId),
    enabled: !!admissionId,
  });

  const [form, setForm] = useState<CreateIcuDeviceRequest>({ device_type: "central_line" });
  const createMut = useMutation({
    mutationFn: (data: CreateIcuDeviceRequest) =>
      api.createIcuDevice(admissionId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-devices", admissionId] });
      notifications.show({ title: "Device tracked", message: "", color: "success" });
      close();
      setForm({ device_type: "central_line" });
    },
  });

  const removeMut = useMutation({
    mutationFn: (deviceId: string) =>
      api.removeIcuDevice(admissionId, deviceId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-devices", admissionId] });
      notifications.show({ title: "Device removed", message: "", color: "primary" });
    },
  });

  // Bundle check state
  const { data: bundleChecks = [] } = useQuery({
    queryKey: ["icu-bundle-checks", selectedDevice?.id],
    queryFn: () => api.listIcuBundleChecks(admissionId, selectedDevice?.id ?? ""),
    enabled: !!selectedDevice,
  });

  const [bundleForm, setBundleForm] = useState<CreateIcuBundleCheckRequest>({
    is_compliant: true,
    still_needed: true,
  });
  const bundleMut = useMutation({
    mutationFn: (data: CreateIcuBundleCheckRequest) =>
      api.createIcuBundleCheck(admissionId, selectedDevice?.id ?? "", data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-bundle-checks", selectedDevice?.id] });
      notifications.show({ title: "Bundle check saved", message: "", color: "success" });
      setBundleForm({ is_compliant: true, still_needed: true });
    },
  });

  const columns = [
    { key: "device_type" as const, label: "Type", render: (d: IcuDevice) => deviceTypeLabels[d.device_type] ?? d.device_type },
    { key: "site" as const, label: "Site", render: (d: IcuDevice) => d.site ?? "—" },
    { key: "inserted_at" as const, label: "Inserted", render: (d: IcuDevice) => new Date(d.inserted_at).toLocaleDateString() },
    { key: "is_active" as const, label: "Status", render: (d: IcuDevice) => d.is_active ? <Badge color="success">Active</Badge> : <Badge color="slate">Removed</Badge> },
    {
      key: "id" as const,
      label: "Actions",
      render: (d: IcuDevice) => (
        <Group gap="xs">
          <Tooltip label="Bundle Checks">
            <ActionIcon variant="subtle" onClick={() => { setSelectedDevice(d); openBundle(); }} aria-label="Report Medical">
              <IconReportMedical size={16} />
            </ActionIcon>
          </Tooltip>
          {canManage && d.is_active && (
            <Tooltip label="Remove Device">
              <ActionIcon variant="subtle" color="danger" onClick={() => removeMut.mutate(d.id)} aria-label="Delete">
                <IconTrash size={16} />
              </ActionIcon>
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
          <Button leftSection={<IconPlus size={16} />} onClick={open}>Add Device</Button>
        )}
      </Group>

      {admissionId ? (
        <DataTable columns={columns} data={devices} loading={isLoading} rowKey={(d) => d.id} emptyTitle="No devices tracked" />
      ) : (
        <Text c="dimmed" ta="center" py="xl">Select an admission to manage devices</Text>
      )}

      <Drawer opened={opened} onClose={close} title="Track New Device" position="right" size="sm">
        <Stack>
          <Select
            label="Device Type"
            data={Object.entries(deviceTypeLabels).map(([v, l]) => ({ value: v, label: l }))}
            value={form.device_type}
            onChange={(v) => setForm({ ...form, device_type: (v ?? "central_line") as IcuDeviceType })}
          />
          <TextInput label="Insertion Site" value={form.site ?? ""} onChange={(e) => setForm({ ...form, site: e.currentTarget.value || undefined })} />
          <Textarea label="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })} />
          <Button loading={createMut.isPending} onClick={() => createMut.mutate(form)}>Save</Button>
        </Stack>
      </Drawer>

      <Drawer opened={bundleOpened} onClose={closeBundle} title={`Bundle Checks — ${selectedDevice ? deviceTypeLabels[selectedDevice.device_type] : ""}`} position="right" size="xl">
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
                    <Table.Td>{bc.is_compliant ? <Badge color="success">Yes</Badge> : <Badge color="danger">No</Badge>}</Table.Td>
                    <Table.Td>{bc.still_needed ? "Yes" : "No"}</Table.Td>
                    <Table.Td>{bc.notes ?? "—"}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}

          {canManage && (
            <>
              <Text fw={600}>New Bundle Check</Text>
              <Checkbox label="Compliant" checked={bundleForm.is_compliant} onChange={(e) => setBundleForm({ ...bundleForm, is_compliant: e.currentTarget.checked })} />
              <Checkbox label="Device Still Needed" checked={bundleForm.still_needed} onChange={(e) => setBundleForm({ ...bundleForm, still_needed: e.currentTarget.checked })} />
              <Textarea label="Notes" value={bundleForm.notes ?? ""} onChange={(e) => setBundleForm({ ...bundleForm, notes: e.currentTarget.value || undefined })} />
              <Button loading={bundleMut.isPending} onClick={() => bundleMut.mutate(bundleForm)}>Save Check</Button>
            </>
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
    queryFn: () => api.listIcuNutrition(admissionId),
    enabled: !!admissionId,
  });

  const [form, setForm] = useState<CreateIcuNutritionRequest>({ route: "enteral" });
  const createMut = useMutation({
    mutationFn: (data: CreateIcuNutritionRequest) =>
      api.createIcuNutrition(admissionId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-nutrition", admissionId] });
      notifications.show({ title: "Nutrition recorded", message: "", color: "success" });
      close();
      setForm({ route: "enteral" });
    },
  });

  const columns = [
    { key: "recorded_at" as const, label: "Time", render: (r: IcuNutrition) => new Date(r.recorded_at).toLocaleString() },
    { key: "route" as const, label: "Route", render: (r: IcuNutrition) => nutritionRouteLabels[r.route] ?? r.route },
    { key: "formula_name" as const, label: "Formula", render: (r: IcuNutrition) => r.formula_name ?? "—" },
    { key: "rate_ml_hr" as const, label: "Rate mL/hr", render: (r: IcuNutrition) => r.rate_ml_hr != null ? String(r.rate_ml_hr) : "—" },
    { key: "calories_kcal" as const, label: "kcal", render: (r: IcuNutrition) => r.calories_kcal != null ? String(r.calories_kcal) : "—" },
    { key: "protein_gm" as const, label: "Protein g", render: (r: IcuNutrition) => r.protein_gm != null ? String(r.protein_gm) : "—" },
    { key: "notes" as const, label: "Notes", render: (r: IcuNutrition) => r.notes ?? "" },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && admissionId && (
          <Button leftSection={<IconPlus size={16} />} onClick={open}>Record Nutrition</Button>
        )}
      </Group>

      {admissionId ? (
        <DataTable columns={columns} data={records} loading={isLoading} rowKey={(r) => r.id} emptyTitle="No nutrition records" />
      ) : (
        <Text c="dimmed" ta="center" py="xl">Select an admission to view nutrition</Text>
      )}

      <Drawer opened={opened} onClose={close} title="Record Nutrition" position="right" size="sm">
        <Stack>
          <Select
            label="Route"
            data={Object.entries(nutritionRouteLabels).map(([v, l]) => ({ value: v, label: l }))}
            value={form.route}
            onChange={(v) => setForm({ ...form, route: (v ?? "enteral") as NutritionRoute })}
          />
          <TextInput label="Formula Name" value={form.formula_name ?? ""} onChange={(e) => setForm({ ...form, formula_name: e.currentTarget.value || undefined })} />
          <Group grow>
            <NumberInput label="Rate mL/hr" decimalScale={1} value={form.rate_ml_hr ?? ""} onChange={(v) => setForm({ ...form, rate_ml_hr: v === "" ? undefined : Number(v) })} />
            <NumberInput label="Volume mL" value={form.volume_ml ?? ""} onChange={(v) => setForm({ ...form, volume_ml: v === "" ? undefined : Number(v) })} />
          </Group>
          <Group grow>
            <NumberInput label="Calories kcal" decimalScale={1} value={form.calories_kcal ?? ""} onChange={(v) => setForm({ ...form, calories_kcal: v === "" ? undefined : Number(v) })} />
            <NumberInput label="Protein g" decimalScale={1} value={form.protein_gm ?? ""} onChange={(v) => setForm({ ...form, protein_gm: v === "" ? undefined : Number(v) })} />
          </Group>
          <Textarea label="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })} />
          <Button loading={createMut.isPending} onClick={() => createMut.mutate(form)}>Save</Button>
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
    const firstActive = activeRecords.length > 0
      ? activeRecords.reduce((earliest, r) =>
          new Date(r.recorded_at) < new Date(earliest.recorded_at) ? r : earliest,
        )
      : null;
    const lastActive = activeRecords.length > 0
      ? activeRecords.reduce((latest, r) =>
          new Date(r.recorded_at) > new Date(latest.recorded_at) ? r : latest,
        )
      : null;

    // Peak bilirubin
    const peakBili = records.reduce(
      (max, r) => Math.max(max, r.bilirubin_total ?? 0),
      0,
    );

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
            color={phototherapySummary.currentlyActive ? "warning" : "slate"}
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
            {phototherapySummary.sessionCount} session{phototherapySummary.sessionCount !== 1 ? "s" : ""} recorded
          </Text>
        </Card>

        <Card withBorder padding="sm" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Peak Bilirubin
          </Text>
          <Text
            size="xl"
            fw={700}
            c={phototherapySummary.peakBili >= 20 ? "danger" : phototherapySummary.peakBili >= 15 ? "orange" : "primary"}
            mt={4}
          >
            {phototherapySummary.peakBili > 0 ? `${phototherapySummary.peakBili.toFixed(1)} mg/dL` : "—"}
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
              <Text size="xs" c="dimmed">Started</Text>
              <Text size="sm" fw={500}>
                {new Date(phototherapySummary.firstActive.recorded_at).toLocaleString()}
              </Text>
            </div>
            {phototherapySummary.lastActive && !phototherapySummary.currentlyActive && (
              <div>
                <Text size="xs" c="dimmed">Last Active</Text>
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
            referenceLines={[
              { y: 15, color: "red.5", label: "Exchange threshold" },
            ]}
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
    queryFn: () => api.listIcuNeonatalRecords(admissionId),
    enabled: !!admissionId,
  });

  const [form, setForm] = useState<CreateIcuNeonatalRequest>({});
  const createMut = useMutation({
    mutationFn: (data: CreateIcuNeonatalRequest) =>
      api.createIcuNeonatalRecord(admissionId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-neonatal", admissionId] });
      notifications.show({ title: "Neonatal record saved", message: "", color: "success" });
      close();
      setForm({});
    },
  });

  const columns = [
    { key: "recorded_at" as const, label: "Time", render: (r: IcuNeonatalRecord) => new Date(r.recorded_at).toLocaleString() },
    { key: "gestational_age_weeks" as const, label: "GA wks", render: (r: IcuNeonatalRecord) => r.gestational_age_weeks != null ? String(r.gestational_age_weeks) : "—" },
    { key: "current_weight_gm" as const, label: "Weight g", render: (r: IcuNeonatalRecord) => r.current_weight_gm != null ? String(r.current_weight_gm) : "—" },
    { key: "bilirubin_total" as const, label: "Bilirubin", render: (r: IcuNeonatalRecord) => r.bilirubin_total != null ? String(r.bilirubin_total) : "—" },
    { key: "phototherapy_active" as const, label: "Phototherapy", render: (r: IcuNeonatalRecord) => r.phototherapy_active ? <Badge color="warning">Active</Badge> : <Badge color="slate">Off</Badge> },
    { key: "notes" as const, label: "Notes", render: (r: IcuNeonatalRecord) => r.notes ?? "" },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && admissionId && (
          <Button leftSection={<IconPlus size={16} />} onClick={open}>Record NICU Data</Button>
        )}
      </Group>

      {admissionId ? (
        <DataTable columns={columns} data={records} loading={isLoading} rowKey={(r) => r.id} emptyTitle="No neonatal records" />
      ) : (
        <Text c="dimmed" ta="center" py="xl">Select an admission to view NICU records</Text>
      )}

      {/* Bilirubin Trend & Phototherapy Tracking */}
      {admissionId && records.length > 0 && (
        <BilirubinPhototherapyPanel records={records} />
      )}

      <Drawer opened={opened} onClose={close} title="Record Neonatal Data" position="right" size="xl">
        <Stack>
          <Group grow>
            <NumberInput label="Gestational Age (weeks)" value={form.gestational_age_weeks ?? ""} onChange={(v) => setForm({ ...form, gestational_age_weeks: v === "" ? undefined : Number(v) })} />
            <NumberInput label="Birth Weight (g)" value={form.birth_weight_gm ?? ""} onChange={(v) => setForm({ ...form, birth_weight_gm: v === "" ? undefined : Number(v) })} />
          </Group>
          <NumberInput label="Current Weight (g)" value={form.current_weight_gm ?? ""} onChange={(v) => setForm({ ...form, current_weight_gm: v === "" ? undefined : Number(v) })} />
          <Group grow>
            <NumberInput label="Bilirubin Total" decimalScale={1} value={form.bilirubin_total ?? ""} onChange={(v) => setForm({ ...form, bilirubin_total: v === "" ? undefined : Number(v) })} />
            <NumberInput label="Bilirubin Direct" decimalScale={1} value={form.bilirubin_direct ?? ""} onChange={(v) => setForm({ ...form, bilirubin_direct: v === "" ? undefined : Number(v) })} />
          </Group>
          <Checkbox label="Phototherapy Active" checked={form.phototherapy_active ?? false} onChange={(e) => setForm({ ...form, phototherapy_active: e.currentTarget.checked })} />
          {form.phototherapy_active && (
            <NumberInput label="Phototherapy Hours" value={form.phototherapy_hours ?? ""} onChange={(v) => setForm({ ...form, phototherapy_hours: v === "" ? undefined : Number(v) })} />
          )}
          <Group grow>
            <TextInput label="Breast Milk Type" value={form.breast_milk_type ?? ""} onChange={(e) => setForm({ ...form, breast_milk_type: e.currentTarget.value || undefined })} />
            <NumberInput label="Breast Milk Volume mL" value={form.breast_milk_volume_ml ?? ""} onChange={(v) => setForm({ ...form, breast_milk_volume_ml: v === "" ? undefined : Number(v) })} />
          </Group>
          <Group grow>
            <TextInput label="Hearing Screen" value={form.hearing_screen_result ?? ""} onChange={(e) => setForm({ ...form, hearing_screen_result: e.currentTarget.value || undefined })} />
            <TextInput label="Sepsis Screen" value={form.sepsis_screen_result ?? ""} onChange={(e) => setForm({ ...form, sepsis_screen_result: e.currentTarget.value || undefined })} />
          </Group>
          <PatientSearchSelect label="Mother Patient" value={form.mother_patient_id ?? ""} onChange={(id) => setForm({ ...form, mother_patient_id: id || undefined })} />
          <Textarea label="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })} />
          <Button loading={createMut.isPending} onClick={() => createMut.mutate(form)}>Save</Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Analytics Tab ───────────────────────────────────────────

function AnalyticsTab() {
  const { data: losData, isLoading: loadingLos } = useQuery({
    queryKey: ["icu-los-analytics"],
    queryFn: () => api.getIcuLosAnalytics(),
  });

  const { data: infectionRates = [], isLoading: loadingInfections } = useQuery({
    queryKey: ["icu-device-infection-rates"],
    queryFn: () => api.getIcuDeviceInfectionRates(),
  });

  const infectionColumns = [
    { key: "device_type" as const, label: "Device Type", render: (r: DeviceInfectionRate) => r.device_type.replace(/_/g, " ") },
    { key: "total_device_days" as const, label: "Total Device Days", render: (r: DeviceInfectionRate) => String(r.total_device_days) },
    { key: "infection_count" as const, label: "Infections", render: (r: DeviceInfectionRate) => String(r.infection_count) },
    { key: "rate_per_1000" as const, label: "Rate per 1,000 Days", render: (r: DeviceInfectionRate) => r.rate_per_1000 != null ? r.rate_per_1000.toFixed(2) : "—" },
  ];

  return (
    <Stack>
      <Text fw={600} size="lg">LOS & Readmission Analytics</Text>
      {loadingLos ? (
        <Text c="dimmed" size="sm">Loading...</Text>
      ) : losData ? (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md">
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Total Admissions</Text>
            <Text size="xl" fw={700} mt={4}>{losData.total_admissions}</Text>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Avg LOS (days)</Text>
            <Text size="xl" fw={700} mt={4}>{losData.avg_los_days != null ? losData.avg_los_days.toFixed(1) : "—"}</Text>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Median LOS (days)</Text>
            <Text size="xl" fw={700} mt={4}>{losData.median_los_days != null ? losData.median_los_days.toFixed(1) : "—"}</Text>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Readmissions (30d)</Text>
            <Text size="xl" fw={700} c={losData.readmission_count > 0 ? "orange" : "success"} mt={4}>{losData.readmission_count}</Text>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Readmission Rate</Text>
            <Text size="xl" fw={700} c={losData.readmission_rate != null && losData.readmission_rate > 10 ? "danger" : "success"} mt={4}>
              {losData.readmission_rate != null ? `${losData.readmission_rate.toFixed(1)}%` : "—"}
            </Text>
          </Paper>
        </SimpleGrid>
      ) : (
        <Text c="dimmed" size="sm">No analytics data available</Text>
      )}

      <Text fw={600} size="lg" mt="md">Device Infection Rates</Text>
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
          <Tabs.Tab value="flowsheets" leftSection={<IconHeartbeat size={16} />}>Flowsheets</Tabs.Tab>
          <Tabs.Tab value="ventilator" leftSection={<IconLungs size={16} />}>Ventilator</Tabs.Tab>
          <Tabs.Tab value="scores" leftSection={<IconReportMedical size={16} />}>Scores</Tabs.Tab>
          <Tabs.Tab value="devices" leftSection={<IconStethoscope size={16} />}>Devices</Tabs.Tab>
          <Tabs.Tab value="nutrition" leftSection={<IconToolsKitchen2 size={16} />}>Nutrition</Tabs.Tab>
          <Tabs.Tab value="nicu" leftSection={<IconBabyCarriage size={16} />}>NICU</Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>Analytics</Tabs.Tab>
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
