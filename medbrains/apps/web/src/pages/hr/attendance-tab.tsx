// HR AttendanceTab — split from hr.tsx (pure move).

import { Drawer, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { AttendanceRecord } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, Button, toast } from "@/components/ui";
import { hrService } from "@/services/hr.service";

export function AttendanceTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["hr-attendance", dateFrom, dateTo],
    queryFn: () =>
      hrService.listAttendance({ date_from: dateFrom || undefined, date_to: dateTo || undefined }),
  });

  const [form, setForm] = useState({
    employee_id: "",
    attendance_date: "",
    check_in: "",
    check_out: "",
    status: "present",
    source: "manual",
  });
  const createMut = useMutation({
    mutationFn: () =>
      hrService.createAttendance({
        employee_id: form.employee_id,
        attendance_date: form.attendance_date,
        check_in: form.check_in || undefined,
        check_out: form.check_out || undefined,
        status: form.status || undefined,
        source: form.source || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-attendance"] });
      closeCreate();
      setForm({
        employee_id: "",
        attendance_date: "",
        check_in: "",
        check_out: "",
        status: "present",
        source: "manual",
      });
      toast.success("Attendance marked", { title: "Attendance Recorded" });
    },
    onError: () => toast.error("Failed to record attendance", { title: "Error" }),
  });

  return (
    <>
      <Group justify="space-between" mb="md">
        <Group>
          <TextInput
            placeholder="From (YYYY-MM-DD)"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.currentTarget.value)}
            style={{ width: 160 }}
          />
          <TextInput
            placeholder="To (YYYY-MM-DD)"
            value={dateTo}
            onChange={(e) => setDateTo(e.currentTarget.value)}
            style={{ width: 160 }}
          />
        </Group>
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Mark Attendance
          </Button>
        )}
      </Group>

      <DataTable
        data={records}
        loading={isLoading}
        rowKey={(r: AttendanceRecord) => r.id}
        columns={[
          {
            key: "date",
            label: "Date",
            render: (r: AttendanceRecord) => <Text size="sm">{r.attendance_date}</Text>,
          },
          {
            key: "employee",
            label: "Employee ID",
            render: (r: AttendanceRecord) => (
              <Text size="sm" ff="monospace">
                {r.employee_id.slice(0, 8)}
              </Text>
            ),
          },
          {
            key: "check_in",
            label: "Check In",
            render: (r: AttendanceRecord) => (
              <Text size="sm">{r.check_in ? new Date(r.check_in).toLocaleTimeString() : "—"}</Text>
            ),
          },
          {
            key: "check_out",
            label: "Check Out",
            render: (r: AttendanceRecord) => (
              <Text size="sm">
                {r.check_out ? new Date(r.check_out).toLocaleTimeString() : "—"}
              </Text>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r: AttendanceRecord) => <Badge size="sm">{r.status}</Badge>,
          },
          {
            key: "late",
            label: "Late",
            render: (r: AttendanceRecord) =>
              r.is_late ? (
                <Badge tone="warning" size="sm">
                  {r.late_minutes}m
                </Badge>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              ),
          },
          {
            key: "overtime",
            label: "OT",
            render: (r: AttendanceRecord) =>
              r.overtime_minutes > 0 ? (
                <Badge tone="primary" size="sm">
                  {r.overtime_minutes}m
                </Badge>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              ),
          },
          {
            key: "source",
            label: "Source",
            render: (r: AttendanceRecord) => <Badge size="sm">{r.source}</Badge>,
          },
        ]}
      />

      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="Mark Attendance"
        position="right"
        size="xl"
      >
        <Stack gap="sm">
          <EmployeeSearchSelect
            value={form.employee_id}
            onChange={(id) => setForm({ ...form, employee_id: id })}
            required
          />
          <TextInput
            label="Date"
            required
            placeholder="YYYY-MM-DD"
            value={form.attendance_date}
            onChange={(e) => setForm({ ...form, attendance_date: e.currentTarget.value })}
          />
          <TextInput
            label="Check In"
            placeholder="HH:MM (ISO timestamp)"
            value={form.check_in}
            onChange={(e) => setForm({ ...form, check_in: e.currentTarget.value })}
          />
          <TextInput
            label="Check Out"
            placeholder="HH:MM (ISO timestamp)"
            value={form.check_out}
            onChange={(e) => setForm({ ...form, check_out: e.currentTarget.value })}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(v) => setForm({ ...form, status: v || "present" })}
            data={[
              { value: "present", label: "Present" },
              { value: "absent", label: "Absent" },
              { value: "half_day", label: "Half Day" },
              { value: "holiday", label: "Holiday" },
              { value: "week_off", label: "Week Off" },
            ]}
          />
          <Select
            label="Source"
            value={form.source}
            onChange={(v) => setForm({ ...form, source: v || "manual" })}
            data={[
              { value: "manual", label: "Manual" },
              { value: "biometric", label: "Biometric" },
            ]}
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={!form.employee_id || !form.attendance_date}
          >
            Record Attendance
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Leave Tab
// ══════════════════════════════════════════════════════════
