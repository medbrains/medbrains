// IPD FlowsheetsTab — split from icu.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { LineChart } from "@mantine/charts";
import { Card, Drawer, Group, NumberInput, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { IcuFlowsheetFormInput } from "@medbrains/schemas";
import { icuFlowsheetFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { IcuFlowsheet } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Button } from "@/components/ui";
import { DEFAULT_ICU_FLOWSHEET_FORM_VALUES, toCreateIcuFlowsheetRequest } from "@/forms/icu.form";
import { icuService } from "@/services/icu.service";

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
    onError: (e: Error) =>
      notifications.show({ title: "Could not add infusion", message: e.message, color: "red" }),
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

export function FlowsheetsTab({ admissionId }: { admissionId: string }) {
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
    onError: (e: Error) =>
      notifications.show({ title: "Could not record flowsheet", message: e.message, color: "red" }),
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
