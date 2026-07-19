import { zodResolver } from "@hookform/resolvers/zod";
import { AnalyticsTab } from "./icu/analytics-tab";
import { DevicesTab } from "./icu/devices-tab";
import { FlowsheetsTab } from "./icu/flowsheets-tab";
import { NutritionTab } from "./icu/nutrition-tab";
import { ScoresTab } from "./icu/scores-tab";
import { VentilatorTab } from "./icu/ventilator-tab";
import "@mantine/charts/styles.css";
import { LineChart } from "@mantine/charts";
import {
  Card,
  Checkbox,
  Drawer,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { IcuNeonatalFormInput } from "@medbrains/schemas";
import { icuNeonatalFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { IcuNeonatalRecord } from "@medbrains/types";
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
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button } from "@/components/ui";
import { DEFAULT_ICU_NEONATAL_FORM_VALUES, toCreateIcuNeonatalRequest } from "@/forms/icu.form";
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

// ── Hemodynamic Trends Chart ─────────────────────────────────

// ── Infusion Tracker ─────────────────────────────────────────

// ── Flowsheets Tab ──────────────────────────────────────────

// ── Scores Tab ──────────────────────────────────────────────

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
    onError: (e: Error) =>
      notifications.show({
        title: "Could not save neonatal record",
        message: e.message,
        color: "red",
      }),
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
