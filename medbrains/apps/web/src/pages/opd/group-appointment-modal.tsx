// OPD GroupAppointmentModal — split from opd.tsx (pure move).

import { Card, Group, Menu, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { BookAppointmentGroupRequest, DepartmentRow } from "@medbrains/types";
import { IconPlus, IconTrash, IconUsers } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button, IconButton, toast } from "@/components/ui";
import { toDateString } from "@/lib/date-utils";
import { opdService } from "@/services/opd.service";

interface GroupSlotRow {
  id: string;
  doctorId: string;
  departmentId: string;
  date: string;
  slotStart: string;
  slotEnd: string;
  notes: string;
}

type GroupSlotEditableField = Exclude<keyof GroupSlotRow, "id">;

let groupSlotRowSequence = 0;

function createGroupSlotRow(): GroupSlotRow {
  groupSlotRowSequence += 1;
  return {
    id: `group-slot-${groupSlotRowSequence}`,
    doctorId: "",
    departmentId: "",
    date: "",
    slotStart: "",
    slotEnd: "",
    notes: "",
  };
}

export function GroupAppointmentModal({
  patientId,
  asMenuItem = false,
}: {
  patientId: string;
  asMenuItem?: boolean;
}) {
  const [opened, { open, close }] = useDisclosure(false);
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<GroupSlotRow[]>([createGroupSlotRow(), createGroupSlotRow()]);

  const { data: allDoctors = [] } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => opdService.listDoctors(),
    staleTime: 600_000,
    enabled: opened,
  });

  const { data: groupDepts = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => opdService.listDepartments(),
    staleTime: 600_000,
  });

  const doctorOptions = useMemo(
    () =>
      allDoctors.map((u) => ({
        value: u.id,
        label: `${u.full_name}${u.specialization ? ` (${u.specialization})` : ""}`,
      })),
    [allDoctors],
  );

  const groupDeptOptions = useMemo(
    () => (groupDepts as DepartmentRow[]).map((d) => ({ value: d.id, label: d.name })),
    [groupDepts],
  );

  const updateRow = (idx: number, field: GroupSlotEditableField, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, createGroupSlotRow()]);
  };

  const removeRow = (idx: number) => {
    if (rows.length <= 2) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const bookGroupMutation = useMutation({
    mutationFn: (data: BookAppointmentGroupRequest) => opdService.bookAppointmentGroup(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      toast.success(`${result.length} appointments created`, {
        title: "Group appointment booked",
      });
      close();
      setRows([createGroupSlotRow(), createGroupSlotRow()]);
    },
    onError: () => {
      toast.error("Failed to book group appointment", { title: "Error" });
    },
  });

  const canSubmit = rows.every(
    (r) => r.doctorId && r.departmentId && r.date && r.slotStart && r.slotEnd,
  );

  const handleSubmit = () => {
    if (!canSubmit) return;
    const slotRequests: BookAppointmentGroupRequest["slot_requests"] = rows.map((r) => ({
      doctor_id: r.doctorId,
      department_id: r.departmentId,
      appointment_date: r.date,
      slot_start: r.slotStart,
      slot_end: r.slotEnd,
      appointment_type: "consultation",
      notes: r.notes.trim() || undefined,
    }));

    bookGroupMutation.mutate({
      patient_id: patientId,
      slot_requests: slotRequests,
    });
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = toDateString(tomorrow);

  return (
    <>
      {asMenuItem ? (
        <Menu.Item leftSection={<IconUsers size={14} />} onClick={open}>
          Group Appointment
        </Menu.Item>
      ) : (
        <Button tone="secondary" size="xs" leftSection={<IconUsers size={14} />} onClick={open}>
          Group Appointment
        </Button>
      )}
      <Modal opened={opened} onClose={close} title="Book Multi-Doctor Appointment" size="lg">
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Book appointments with multiple doctors in a single group. The patient will see all
            listed doctors.
          </Text>
          {rows.map((row, idx) => (
            <Card key={row.id} padding="xs" radius="sm" withBorder>
              <Group gap="xs" align="flex-end" wrap="nowrap">
                <Select
                  label={`Doctor ${idx + 1}`}
                  placeholder="Select doctor"
                  data={doctorOptions}
                  value={row.doctorId}
                  onChange={(val) => updateRow(idx, "doctorId", val ?? "")}
                  searchable
                  w={180}
                  size="xs"
                />
                <Select
                  label="Dept"
                  placeholder="Department"
                  data={groupDeptOptions}
                  value={row.departmentId}
                  onChange={(val) => updateRow(idx, "departmentId", val ?? "")}
                  searchable
                  w={150}
                  size="xs"
                />
                <TextInput
                  label="Date"
                  type="date"
                  value={row.date}
                  onChange={(e) => updateRow(idx, "date", e.currentTarget.value)}
                  min={minDate}
                  w={140}
                  size="xs"
                />
                <TextInput
                  label="Start"
                  type="time"
                  value={row.slotStart}
                  onChange={(e) => updateRow(idx, "slotStart", e.currentTarget.value)}
                  w={100}
                  size="xs"
                />
                <TextInput
                  label="End"
                  type="time"
                  value={row.slotEnd}
                  onChange={(e) => updateRow(idx, "slotEnd", e.currentTarget.value)}
                  w={100}
                  size="xs"
                />
                <TextInput
                  label="Notes"
                  placeholder="Optional"
                  value={row.notes}
                  onChange={(e) => updateRow(idx, "notes", e.currentTarget.value)}
                  style={{ flex: 1 }}
                  size="xs"
                />
                {rows.length > 2 && (
                  <IconButton
                    tone="danger"
                    size="sm"
                    onClick={() => removeRow(idx)}
                    mt={18}
                    aria-label="Delete"
                  >
                    <IconTrash size={14} />
                  </IconButton>
                )}
              </Group>
            </Card>
          ))}
          <Button tone="ghost" size="xs" leftSection={<IconPlus size={14} />} onClick={addRow}>
            Add Another Doctor
          </Button>
          <Group justify="flex-end">
            <Button tone="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              tone="primary"
              onClick={handleSubmit}
              loading={bookGroupMutation.isPending}
              disabled={!canSubmit}
            >
              Book {rows.length} Appointments
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
