import { Button, Card, Group, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { PatientCardRow, VitalsChecklistRow, WardGridResponse } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBed,
  IconCalendarCheck,
  IconChecklist,
  IconHeartbeat,
  IconPill,
  IconShieldCheck,
  IconTemperature,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable, OperationalSignal, type OperationalSignalTone } from "@/components";
import type { Column } from "@/components/DataTable";
import { careViewService } from "@/services/careView.service";
import { urgencyColor } from "./shared";

function news2Tone(score: number | null): OperationalSignalTone {
  if (score === null) return "neutral";
  if (score >= 7) return "risk";
  if (score >= 5) return "blocked";
  return "ready";
}

function fallRiskTone(level: string | null): OperationalSignalTone {
  if (!level) return "neutral";
  const normalizedLevel = level.toLowerCase();
  if (normalizedLevel.includes("high")) return "risk";
  if (normalizedLevel.includes("medium") || normalizedLevel.includes("moderate")) return "blocked";
  return "ready";
}

function workloadTone(overdue: number, pending: number): OperationalSignalTone {
  if (overdue > 0) return "risk";
  if (pending > 0) return "blocked";
  return "ready";
}

export function PatientGridTab({ wardId }: { wardId: string | null }) {
  const { t } = useTranslation("careView");
  const { data, isLoading } = useQuery<WardGridResponse>({
    queryKey: ["care-view", "ward-grid", wardId],
    queryFn: () => careViewService.wardPatientGrid(wardId ?? undefined),
    refetchInterval: 30_000,
  });

  const summary = data?.summary;
  const patients = data?.patients ?? [];

  return (
    <Stack gap="md">
      {summary && (
        <Group gap="xl">
          <OperationalSignal
            icon={IconBed}
            label={t("summary.occupied")}
            shape="bed"
            tone="active"
            value={`${summary.occupied}/${summary.total_beds}`}
          />
          <OperationalSignal
            icon={IconAlertTriangle}
            label={t("summary.critical")}
            shape="diamond"
            tone={summary.critical_count > 0 ? "risk" : "ready"}
            value={summary.critical_count}
          />
          <OperationalSignal
            icon={IconShieldCheck}
            label={t("summary.isolation")}
            shape="token"
            tone={summary.isolation_count > 0 ? "blocked" : "ready"}
            value={summary.isolation_count}
          />
          <OperationalSignal
            icon={IconChecklist}
            label={t("summary.overdueTasks")}
            shape="diamond"
            tone={summary.overdue_tasks_total > 0 ? "risk" : "ready"}
            value={summary.overdue_tasks_total}
          />
          <OperationalSignal
            icon={IconCalendarCheck}
            label={t("summary.pendingDischarges")}
            shape="token"
            tone={summary.pending_discharges > 0 ? "blocked" : "ready"}
            value={summary.pending_discharges}
          />
        </Group>
      )}

      <VitalsChecklistSection wardId={wardId} />

      {isLoading && <Text c="dimmed">{t("patientGrid.loading")}</Text>}

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
        {patients.map((patient) => (
          <PatientCard key={patient.admission_id} patient={patient} />
        ))}
      </SimpleGrid>

      {patients.length === 0 && !isLoading && (
        <Text c="dimmed" ta="center" py="xl">
          {t("patientGrid.empty")}
        </Text>
      )}
    </Stack>
  );
}

function PatientCard({ patient }: { patient: PatientCardRow }) {
  const { t } = useTranslation("careView");
  const urgency = urgencyColor(
    patient.overdue_tasks + patient.overdue_meds,
    patient.pending_tasks + patient.pending_meds,
  );
  const news2Value =
    patient.latest_news2_score !== null ? patient.latest_news2_score : t("common.notAvailable");
  const fallRiskValue = patient.fall_risk_level ?? t("common.notAvailable");

  return (
    <Card shadow="xs" padding="sm" radius="sm" withBorder>
      <Group justify="space-between" mb={4}>
        <div>
          <Text fw={600} size="sm" lineClamp={1}>
            {patient.patient_name}
          </Text>
          <Text size="xs" c="dimmed">
            {patient.uhid} &middot; {patient.bed_name ?? t("patient.noBed")}
          </Text>
        </div>
        <ThemeIcon size="sm" radius="xl" color={urgency} variant="filled">
          <IconHeartbeat size={12} />
        </ThemeIcon>
      </Group>

      <Group gap={4} mb={6}>
        {patient.is_critical && (
          <OperationalSignal
            icon={IconAlertTriangle}
            label={t("patient.critical")}
            shape="diamond"
            size="xs"
            tone="risk"
          />
        )}
        {patient.isolation_required && (
          <OperationalSignal
            icon={IconShieldCheck}
            label={t("patient.isolation")}
            shape="token"
            size="xs"
            tone="blocked"
          />
        )}
        {patient.ip_type && (
          <OperationalSignal
            icon={IconBed}
            label={t("patient.ipType")}
            shape="bed"
            size="xs"
            tone="active"
            value={patient.ip_type}
          />
        )}
        {patient.expected_discharge_date && (
          <OperationalSignal
            icon={IconCalendarCheck}
            label={t("patient.expectedDischarge")}
            shape="token"
            size="xs"
            tone="ready"
            value={new Date(patient.expected_discharge_date).toLocaleDateString()}
          />
        )}
      </Group>

      <Stack gap={2}>
        <Group gap={4} wrap="wrap">
          <OperationalSignal
            label={t("patient.news2")}
            shape="diamond"
            size="xs"
            tone={news2Tone(patient.latest_news2_score)}
            value={news2Value}
          />
          <OperationalSignal
            label={t("patient.fallRisk")}
            shape="diamond"
            size="xs"
            tone={fallRiskTone(patient.fall_risk_level)}
            value={fallRiskValue}
          />
          <OperationalSignal
            icon={IconChecklist}
            label={t("patient.tasks")}
            shape="token"
            size="xs"
            tone={workloadTone(patient.overdue_tasks, patient.pending_tasks)}
            value={patient.pending_tasks}
          />
          {patient.overdue_tasks > 0 && (
            <OperationalSignal
              icon={IconAlertTriangle}
              label={t("patient.tasksOverdue")}
              shape="diamond"
              size="xs"
              tone="risk"
              value={patient.overdue_tasks}
            />
          )}
          <OperationalSignal
            icon={IconPill}
            label={t("patient.meds")}
            shape="token"
            size="xs"
            tone={workloadTone(patient.overdue_meds, patient.pending_meds)}
            value={patient.pending_meds}
          />
          {patient.overdue_meds > 0 && (
            <OperationalSignal
              icon={IconAlertTriangle}
              label={t("patient.medsOverdue")}
              shape="diamond"
              size="xs"
              tone="risk"
              value={patient.overdue_meds}
            />
          )}
          {patient.vitals_due && (
            <OperationalSignal
              icon={IconTemperature}
              label={t("patient.vitalsDue")}
              shape="diamond"
              size="xs"
              tone="blocked"
            />
          )}
        </Group>

        {patient.active_clinical_docs > 0 && (
          <Text size="xs" c="dimmed">
            {t("patient.activeClinicalDocs", { count: patient.active_clinical_docs })}
          </Text>
        )}
      </Stack>

      <Group gap={4} mt={6}>
        {patient.admitting_doctor_name && (
          <Text size="xs" c="dimmed">
            {t("patient.admittingDoctor", { name: patient.admitting_doctor_name })}
          </Text>
        )}
        {patient.primary_nurse_name && (
          <Text size="xs" c="dimmed">
            {t("patient.primaryNurse", { name: patient.primary_nurse_name })}
          </Text>
        )}
      </Group>
    </Card>
  );
}

function VitalsChecklistSection({ wardId }: { wardId: string | null }) {
  const { t } = useTranslation("careView");
  const [opened, disclosure] = useDisclosure(false);

  const { data, isLoading } = useQuery<VitalsChecklistRow[]>({
    queryKey: ["care-view", "vitals-checklist", wardId],
    queryFn: () => careViewService.vitalsChecklist(wardId ?? undefined),
    enabled: opened,
    refetchInterval: 60_000,
  });

  const dueCount = data?.filter((row) => row.vitals_due).length ?? 0;

  const columns: Column<VitalsChecklistRow>[] = [
    {
      key: "patient_name",
      label: t("vitalsChecklist.columns.patient"),
      render: (row) => <Text size="sm">{row.patient_name}</Text>,
    },
    {
      key: "bed_name",
      label: t("vitalsChecklist.columns.bed"),
      render: (row) => <Text size="sm">{row.bed_name ?? "—"}</Text>,
    },
    {
      key: "hours_since_last",
      label: t("vitalsChecklist.columns.hoursSinceLast"),
      render: (row) => (
        <Text size="sm" c={row.vitals_due ? "danger" : undefined}>
          {row.hours_since_last !== null
            ? t("vitalsChecklist.hoursValue", { hours: row.hours_since_last.toFixed(1) })
            : t("vitalsChecklist.never")}
        </Text>
      ),
    },
    {
      key: "vitals_due",
      label: t("vitalsChecklist.columns.status"),
      render: (row) => (
        <OperationalSignal
          label={row.vitals_due ? t("vitalsChecklist.status.due") : t("vitalsChecklist.status.ok")}
          shape={row.vitals_due ? "diamond" : "pill"}
          size="xs"
          tone={row.vitals_due ? "blocked" : "ready"}
        />
      ),
    },
  ];

  return (
    <Stack gap="xs">
      <Button
        variant="subtle"
        size="compact-sm"
        leftSection={<IconTemperature size={16} />}
        onClick={disclosure.toggle}
      >
        {dueCount > 0
          ? t("vitalsChecklist.titleWithDue", { count: dueCount })
          : t("vitalsChecklist.title")}
      </Button>
      {opened && (
        <DataTable
          columns={columns}
          data={data ?? []}
          loading={isLoading}
          rowKey={(row) => row.admission_id}
        />
      )}
    </Stack>
  );
}
