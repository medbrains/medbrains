import { useState } from "react";
import { Badge, Button, Card, Group, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconHeartbeat, IconTemperature } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { PatientCardRow, VitalsChecklistRow } from "@medbrains/types";
import { DataTable } from "../../components";
import type { Column } from "../../components/DataTable";
import { fallRiskColor, news2Color, urgencyColor } from "./shared";

export function PatientGridTab({ wardId }: { wardId: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ["care-view", "ward-grid", wardId],
    queryFn: () => api.wardPatientGrid(wardId ?? undefined),
    refetchInterval: 30_000,
  });

  const summary = data?.summary;
  const patients = data?.patients ?? [];

  return (
    <Stack gap="md">
      {summary && (
        <Group gap="xl">
          <Badge size="lg" variant="light" color="primary">
            Occupied: {summary.occupied} / {summary.total_beds}
          </Badge>
          <Badge size="lg" variant="light" color="danger">
            Critical: {summary.critical_count}
          </Badge>
          <Badge size="lg" variant="light" color="orange">
            Isolation: {summary.isolation_count}
          </Badge>
          <Badge size="lg" variant="light" color="warning">
            Overdue Tasks: {summary.overdue_tasks_total}
          </Badge>
          <Badge size="lg" variant="light" color="violet">
            Pending Discharges: {summary.pending_discharges}
          </Badge>
        </Group>
      )}

      <VitalsChecklistSection wardId={wardId} />

      {isLoading && <Text c="dimmed">Loading patient grid...</Text>}

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
        {patients.map((patient) => (
          <PatientCard key={patient.admission_id} patient={patient} />
        ))}
      </SimpleGrid>

      {patients.length === 0 && !isLoading && (
        <Text c="dimmed" ta="center" py="xl">
          No admitted patients in the selected ward.
        </Text>
      )}
    </Stack>
  );
}

function PatientCard({ patient }: { patient: PatientCardRow }) {
  const urgency = urgencyColor(
    patient.overdue_tasks + patient.overdue_meds,
    patient.pending_tasks + patient.pending_meds,
  );

  return (
    <Card shadow="xs" padding="sm" radius="sm" withBorder>
      <Group justify="space-between" mb={4}>
        <div>
          <Text fw={600} size="sm" lineClamp={1}>
            {patient.patient_name}
          </Text>
          <Text size="xs" c="dimmed">
            {patient.uhid} &middot; {patient.bed_name ?? "No bed"}
          </Text>
        </div>
        <ThemeIcon size="sm" radius="xl" color={urgency} variant="filled">
          <IconHeartbeat size={12} />
        </ThemeIcon>
      </Group>

      <Group gap={4} mb={6}>
        {patient.is_critical && (
          <Badge size="xs" color="danger" variant="filled">
            Critical
          </Badge>
        )}
        {patient.isolation_required && (
          <Badge size="xs" color="orange" variant="filled">
            Isolation
          </Badge>
        )}
        {patient.ip_type && (
          <Badge size="xs" color="primary" variant="light">
            {patient.ip_type}
          </Badge>
        )}
      </Group>

      <Stack gap={2}>
        <Group gap={4}>
          <Text size="xs" c="dimmed" w={80}>
            NEWS2:
          </Text>
          <Badge size="xs" color={news2Color(patient.latest_news2_score)} variant="light">
            {patient.latest_news2_score !== null ? patient.latest_news2_score : "N/A"}
          </Badge>
        </Group>

        <Group gap={4}>
          <Text size="xs" c="dimmed" w={80}>
            Fall Risk:
          </Text>
          <Badge size="xs" color={fallRiskColor(patient.fall_risk_level)} variant="light">
            {patient.fall_risk_level ?? "N/A"}
          </Badge>
        </Group>

        <Group gap={4}>
          <Text size="xs" c="dimmed" w={80}>
            Tasks:
          </Text>
          <Text size="xs">
            {patient.pending_tasks} pending
            {patient.overdue_tasks > 0 && (
              <Text span c="danger" fw={600}>
                {" "}
                ({patient.overdue_tasks} overdue)
              </Text>
            )}
          </Text>
        </Group>

        <Group gap={4}>
          <Text size="xs" c="dimmed" w={80}>
            Meds:
          </Text>
          <Text size="xs">
            {patient.pending_meds} pending
            {patient.overdue_meds > 0 && (
              <Text span c="danger" fw={600}>
                {" "}
                ({patient.overdue_meds} overdue)
              </Text>
            )}
          </Text>
        </Group>

        {patient.vitals_due && (
          <Group gap={4}>
            <IconTemperature size={14} color="var(--mantine-color-orange-6)" />
            <Text size="xs" c="orange" fw={600}>
              Vitals due
            </Text>
          </Group>
        )}

        {patient.active_clinical_docs > 0 && (
          <Text size="xs" c="dimmed">
            {patient.active_clinical_docs} active clinical doc(s)
          </Text>
        )}
      </Stack>

      <Group gap={4} mt={6}>
        {patient.admitting_doctor_name && (
          <Text size="xs" c="dimmed">
            Dr. {patient.admitting_doctor_name}
          </Text>
        )}
        {patient.primary_nurse_name && (
          <Text size="xs" c="dimmed">
            &middot; RN {patient.primary_nurse_name}
          </Text>
        )}
      </Group>
    </Card>
  );
}

function VitalsChecklistSection({ wardId }: { wardId: string | null }) {
  const [show, setShow] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["care-view", "vitals-checklist", wardId],
    queryFn: () => api.vitalsChecklist(wardId ?? undefined),
    enabled: show,
    refetchInterval: 60_000,
  });

  const dueCount = data?.filter((row) => row.vitals_due).length ?? 0;

  const columns: Column<VitalsChecklistRow>[] = [
    { key: "patient_name", label: "Patient", render: (row) => <Text size="sm">{row.patient_name}</Text> },
    { key: "bed_name", label: "Bed", render: (row) => <Text size="sm">{row.bed_name ?? "—"}</Text> },
    {
      key: "hours_since_last",
      label: "Hours Since Last",
      render: (row) => (
        <Text size="sm" c={row.vitals_due ? "danger" : undefined}>
          {row.hours_since_last !== null ? `${row.hours_since_last.toFixed(1)}h` : "Never"}
        </Text>
      ),
    },
    {
      key: "vitals_due",
      label: "Status",
      render: (row) => (
        <Badge size="sm" color={row.vitals_due ? "danger" : "success"}>
          {row.vitals_due ? "Due" : "OK"}
        </Badge>
      ),
    },
  ];

  return (
    <Stack gap="xs">
      <Button
        variant="subtle"
        size="compact-sm"
        leftSection={<IconTemperature size={16} />}
        onClick={() => setShow((value) => !value)}
      >
        Vitals Checklist {dueCount > 0 && `(${dueCount} due)`}
      </Button>
      {show && (
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
