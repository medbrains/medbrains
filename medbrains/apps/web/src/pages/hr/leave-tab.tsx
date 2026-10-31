// HR LeaveTab — split from hr.tsx (pure move).

import {
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { LeaveRequest } from "@medbrains/types";
import { IconCheck, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { printColumn } from "@/components/Print/printColumn";
import { Badge, type BadgeTone, Button, IconButton, Modal, toast } from "@/components/ui";
import { hrService } from "@/services/hr.service";
import { approvalAction } from "./leave-calendar";
import { LEAVE_TYPE_OPTIONS } from "./leave-options";

const leaveStatusColors: Record<string, BadgeTone> = {
  draft: "neutral",
  pending_hod: "primary",
  pending_admin: "primary",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
};

interface LeaveTabProps {
  canCreate: boolean;
  canApprove: boolean;
  /** `hr.leave.manage` — file and cancel leave for anyone, not only yourself. */
  canManage: boolean;
}

export function LeaveTab({ canCreate, canApprove, canManage }: LeaveTabProps) {
  const qc = useQueryClient();
  // The server refuses self-approval; this only hides the buttons that would be refused.
  const { data: me } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => hrService.getMyProfile(),
  });
  const myEmployeeId = me?.employee?.id;
  const rights = { canApprove, canManage, myEmployeeId };
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["hr-leaves", statusFilter],
    queryFn: () => hrService.listLeaveRequests({ status: statusFilter || undefined }),
  });

  const [form, setForm] = useState({
    employee_id: "",
    leave_type: "casual",
    start_date: "",
    end_date: "",
    days: 1,
    is_half_day: false,
    reason: "",
  });
  const createMut = useMutation({
    mutationFn: () =>
      hrService.createLeaveRequest({
        employee_id: canManage ? form.employee_id : undefined,
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
        days: form.days,
        is_half_day: form.is_half_day,
        reason: form.reason || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-leaves"] });
      closeCreate();
      setForm({
        employee_id: "",
        leave_type: "casual",
        start_date: "",
        end_date: "",
        days: 1,
        is_half_day: false,
        reason: "",
      });
      toast.success("Leave request submitted", { title: "Leave Applied" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Leave not submitted" }),
  });

  const actionMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      hrService.leaveAction(id, { action }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-leaves"] });
      toast.success("Leave status updated", { title: "Leave Updated" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Leave not updated" }),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => hrService.cancelLeave(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-leaves"] });
      toast.warning("Leave request cancelled", { title: "Leave Cancelled" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Leave not cancelled" }),
  });

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          placeholder="Filter by status"
          value={statusFilter}
          onChange={setStatusFilter}
          clearable
          data={[
            { value: "draft", label: "Draft" },
            { value: "pending_hod", label: "Pending HOD" },
            { value: "pending_admin", label: "Pending Admin" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Apply Leave
          </Button>
        )}
      </Group>

      <DataTable
        data={requests}
        loading={isLoading}
        rowKey={(r: LeaveRequest) => r.id}
        columns={[
          {
            key: "employee",
            label: "Employee",
            render: (r: LeaveRequest) => (
              <Text size="sm" ff="monospace">
                {r.employee_id.slice(0, 8)}
              </Text>
            ),
          },
          {
            key: "type",
            label: "Type",
            render: (r: LeaveRequest) => <Badge size="sm">{r.leave_type.replace(/_/g, " ")}</Badge>,
          },
          {
            key: "dates",
            label: "Period",
            render: (r: LeaveRequest) => (
              <Text size="sm">
                {r.start_date} → {r.end_date}
              </Text>
            ),
          },
          {
            key: "days",
            label: "Days",
            render: (r: LeaveRequest) => (
              <Text size="sm">
                {r.days}
                {r.is_half_day ? " (½)" : ""}
              </Text>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r: LeaveRequest) => (
              <Badge tone={leaveStatusColors[r.status] ?? "neutral"} size="sm">
                {r.status.replace(/_/g, " ")}
              </Badge>
            ),
          },
          {
            key: "reason",
            label: "Reason",
            render: (r: LeaveRequest) => (
              <Text size="sm" lineClamp={1}>
                {r.reason || "—"}
              </Text>
            ),
          },
          {
            key: "actions",
            label: "",
            render: (r: LeaveRequest) => (
              <Group gap={4}>
                {approvalAction(r, rights) && (
                  <>
                    <Tooltip label="Approve">
                      <IconButton
                        tone="success"
                        onClick={() =>
                          actionMut.mutate({ id: r.id, action: approvalAction(r, rights) ?? "" })
                        }
                        aria-label="Approve leave"
                      >
                        <IconCheck size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip label="Reject">
                      <IconButton
                        tone="danger"
                        onClick={() => actionMut.mutate({ id: r.id, action: "reject" })}
                        aria-label="Reject leave"
                      >
                        <IconX size={16} />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
                {(r.status === "draft" || r.status === "pending_hod") &&
                  (canManage || r.employee_id === myEmployeeId) && (
                    <Tooltip label="Cancel">
                      <IconButton onClick={() => cancelMut.mutate(r.id)} aria-label="Cancel leave">
                        <IconX size={16} />
                      </IconButton>
                    </Tooltip>
                  )}
              </Group>
            ),
          },
          printColumn<LeaveRequest>("leave_request"),
        ]}
      />

      <Modal opened={createOpen} onClose={closeCreate} title="Apply Leave" fullScreen>
        <Stack gap="sm">
          {canManage ? (
            <EmployeeSearchSelect
              value={form.employee_id}
              onChange={(id) => setForm({ ...form, employee_id: id })}
              required
            />
          ) : (
            <Text size="sm" c="dimmed">
              You are applying for your own leave.
            </Text>
          )}
          <Select
            label="Leave Type"
            value={form.leave_type}
            onChange={(v) => setForm({ ...form, leave_type: v || "casual" })}
            data={LEAVE_TYPE_OPTIONS}
          />
          <TextInput
            label="Start Date"
            required
            placeholder="YYYY-MM-DD"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.currentTarget.value })}
          />
          <TextInput
            label="End Date"
            required
            placeholder="YYYY-MM-DD"
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.currentTarget.value })}
          />
          <NumberInput
            label="Days"
            value={form.days}
            onChange={(v) => setForm({ ...form, days: typeof v === "number" ? v : 1 })}
            min={0.5}
            step={0.5}
          />
          <Switch
            label="Half Day"
            checked={form.is_half_day}
            onChange={(e) => setForm({ ...form, is_half_day: e.currentTarget.checked })}
          />
          <Textarea
            label="Reason"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.currentTarget.value })}
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={(canManage && !form.employee_id) || !form.start_date || !form.end_date}
          >
            Submit Leave
          </Button>
        </Stack>
      </Modal>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Duty Roster Tab
// ══════════════════════════════════════════════════════════
