// IPD ScheduleTab — split from ot.tsx (pure move).

import { Group, Select, Stack, Text } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useHasPermission } from "@medbrains/stores";
import type { OtBooking, OtRoom } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCalendar } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, StatusDot } from "@/components";
import { Badge } from "@/components/ui";
import { otService } from "@/services/ot.service";
import { bookingStatusColors, OtPatientCell } from "./shared";

export function ScheduleTab() {
  const [date, setDate] = useState<string | null>(new Date().toISOString().slice(0, 10));
  const [roomId, setRoomId] = useState<string | null>(null);
  const canViewPatientRecord = useHasPermission(P.PATIENTS.VIEW);

  const { data: rooms } = useQuery({
    queryKey: ["ot-rooms"],
    queryFn: () => otService.listOtRooms(),
  });

  const dateStr = date ?? undefined;
  const params: Record<string, string> = {};
  if (dateStr) params.date = dateStr;
  if (roomId) params.room_id = roomId;

  const { data, isLoading } = useQuery({
    queryKey: ["ot-schedule", dateStr, roomId],
    queryFn: () => otService.getOtSchedule(params),
    enabled: !!dateStr,
  });

  const roomOptions = (rooms ?? []).map((r: OtRoom) => ({ value: r.id, label: r.name }));

  return (
    <Stack>
      <Group>
        <DatePickerInput
          label="Date"
          value={date}
          onChange={setDate}
          leftSection={<IconCalendar size={16} />}
          w={200}
        />
        <Select
          label="OT Room"
          placeholder="All rooms"
          data={roomOptions}
          value={roomId}
          onChange={setRoomId}
          clearable
          w={200}
        />
      </Group>
      <DataTable
        columns={[
          {
            key: "time",
            label: "Time",
            render: (b: OtBooking) => (
              <Text size="sm">
                {new Date(b.scheduled_start).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            ),
          },
          {
            key: "procedure",
            label: "Procedure",
            render: (b: OtBooking) => (
              <Text size="sm" fw={500}>
                {b.procedure_name}
              </Text>
            ),
          },
          {
            key: "patient",
            label: "Patient",
            render: (b: OtBooking) => (
              <OtPatientCell patientId={b.patient_id} canViewPatientRecord={canViewPatientRecord} />
            ),
          },
          {
            key: "priority",
            label: "Priority",
            render: (b: OtBooking) => (
              <Badge
                size="sm"
                tone={
                  b.priority === "emergency"
                    ? "danger"
                    : b.priority === "urgent"
                      ? "warning"
                      : "neutral"
                }
              >
                {b.priority}
              </Badge>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (b: OtBooking) => (
              <StatusDot color={bookingStatusColors[b.status] ?? "slate"} label={b.status} />
            ),
          },
        ]}
        data={data ?? []}
        loading={isLoading}
        rowKey={(b) => b.id}
        emptyTitle="No bookings for this date"
      />
    </Stack>
  );
}

// ── Bookings Tab ───────────────────────────────────────
