// PATIENT AppointmentsTab — split from patient-detail.tsx (pure move).

import { Group, Loader, Text } from "@mantine/core";
import type { PatientAppointmentRow } from "@medbrains/types";
import { IconClock } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Badge, type BadgeTone, Table } from "@/components/ui";
import { patientDetailService } from "@/services/patientDetail.service";
import { formatDate } from "./shared";

const APPT_STATUS_COLORS: Record<string, BadgeTone> = {
  scheduled: "primary",
  confirmed: "info",
  checked_in: "warning",
  in_consultation: "warning",
  completed: "success",
  cancelled: "danger",
  no_show: "neutral",
};

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h ?? "0", 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function AppointmentsTab({ patientId }: { patientId: string }) {
  const { data: appointments, isLoading } = useQuery({
    queryKey: ["patient-appointments", patientId],
    queryFn: () => patientDetailService.listPatientAppointments(patientId),
  });

  if (isLoading) return <Loader size="sm" />;

  if (!appointments || appointments.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No appointments found.
      </Text>
    );
  }

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Date</Table.Th>
          <Table.Th>Time</Table.Th>
          <Table.Th>Type</Table.Th>
          <Table.Th>Doctor</Table.Th>
          <Table.Th>Department</Table.Th>
          <Table.Th>Reason</Table.Th>
          <Table.Th>Status</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {appointments.map((a: PatientAppointmentRow) => (
          <Table.Tr key={a.id}>
            <Table.Td>
              <Text size="sm" fw={500}>
                {formatDate(a.appointment_date)}
              </Text>
            </Table.Td>
            <Table.Td>
              <Group gap={4}>
                <IconClock size={14} />
                <Text size="sm">
                  {formatTime(a.slot_start)} - {formatTime(a.slot_end)}
                </Text>
              </Group>
            </Table.Td>
            <Table.Td>
              <Badge size="sm">{a.appointment_type.replace(/_/g, " ")}</Badge>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{a.doctor_name ?? "-"}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{a.department_name ?? "-"}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" lineClamp={1} c={a.reason ? undefined : "dimmed"}>
                {a.reason ?? "-"}
              </Text>
            </Table.Td>
            <Table.Td>
              <Badge tone={APPT_STATUS_COLORS[a.status] ?? "neutral"} size="sm">
                {a.status.replace(/_/g, " ")}
              </Badge>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

// ── Main Patient Detail Page ───────────────────────────────

// ── Family Links Tab (Detail Page) ─────────────────────────
