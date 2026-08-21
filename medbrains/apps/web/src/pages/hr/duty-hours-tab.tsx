// HR DutyHoursTab — split from hr.tsx (pure move).

import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { DutyHoursRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components";
import { Badge } from "@/components/ui";
import { hrService } from "@/services/hr.service";

const FATIGUE_FLAG_LABEL: Record<string, string> = {
  long_continuous: "12h+ continuous",
  short_rest: "<8h rest",
  heavy_week: "60h+ this week",
};

export function DutyHoursTab() {
  // Duty hours are attendance data. An empty roster reads as "nobody worked",
  // which on a duty-hours screen is the number a fatigue rule is checked against.
  const canListAttendance = useHasPermission(P.HR.ATTENDANCE_LIST);

  const { data = [], isLoading } = useQuery({
    queryKey: ["hr-duty-hours"],
    queryFn: () => hrService.listDutyHours(),
    enabled: canListAttendance,
  });

  const columns = [
    {
      key: "employee_name",
      label: "Staff",
      render: (r: DutyHoursRow) => <Text fw={500}>{r.employee_name}</Text>,
    },
    {
      key: "session_status",
      label: "On shift",
      render: (r: DutyHoursRow) =>
        r.session_status ? (
          <Badge tone={r.session_status === "paused" ? "warning" : "success"} size="sm">
            {r.session_status === "paused" ? "Paused" : "On duty"}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ),
    },
    {
      key: "shift_end",
      label: "Ends",
      render: (r: DutyHoursRow) => (
        <Text size="sm">
          {r.shift_end
            ? new Date(r.shift_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "—"}
        </Text>
      ),
    },
    {
      key: "continuous_h",
      label: "Continuous",
      render: (r: DutyHoursRow) => <Text size="sm">{r.continuous_h.toFixed(1)}h</Text>,
    },
    {
      key: "week_h",
      label: "7-day",
      render: (r: DutyHoursRow) => <Text size="sm">{r.week_h.toFixed(1)}h</Text>,
    },
    {
      key: "overtime_h",
      label: "Overtime",
      render: (r: DutyHoursRow) => <Text size="sm">{r.overtime_h.toFixed(1)}h</Text>,
    },
    {
      key: "flags",
      label: "Fatigue",
      render: (r: DutyHoursRow) =>
        r.flags.length > 0 ? (
          <Group gap={4}>
            {r.flags.map((f) => (
              <Badge key={f} tone="danger" size="sm">
                {FATIGUE_FLAG_LABEL[f] ?? f}
              </Badge>
            ))}
          </Group>
        ) : (
          <Badge tone="success" size="sm">
            OK
          </Badge>
        ),
    },
  ];

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Worked hours over the last 7 days, sorted by load. Fatigue flags are advisory — follow up
        with flagged staff and arrange relief where you can.
      </Text>
      <DataTable
        columns={columns}
        data={data}
        loading={isLoading}
        rowKey={(r: DutyHoursRow) => r.employee_id}
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Attendance Tab
// ══════════════════════════════════════════════════════════
