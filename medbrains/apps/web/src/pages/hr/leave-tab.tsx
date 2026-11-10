// HR LeaveTab — split from hr.tsx (pure move).

import { Group, Select, Text, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { LeaveRequest } from "@medbrains/types";
import { IconCheck, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { DataTable } from "@/components";
import { printColumn } from "@/components/Print/printColumn";
import { Badge, type BadgeTone, Button, IconButton, toast } from "@/components/ui";
import { hrService } from "@/services/hr.service";
import { approvalAction } from "./leave-calendar";
import { LeaveRequestModal } from "./leave-request-modal";

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

      {createOpen && (
        <LeaveRequestModal
          date={dayjs().format("YYYY-MM-DD")}
          withEmployee={canManage}
          submit={(body) => hrService.createLeaveRequest(body)}
          onClose={closeCreate}
          onSubmitted={() => {
            void qc.invalidateQueries({ queryKey: ["hr-leaves"] });
            closeCreate();
          }}
        />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Duty Roster Tab
// ══════════════════════════════════════════════════════════
