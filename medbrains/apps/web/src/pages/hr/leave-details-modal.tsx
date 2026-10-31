// One leave, opened from its calendar block. Approve/Reject appear only for an
// approver who may take that step (the server checks again); the balance sits beside them.

import { Box, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconCheck, IconX } from "@tabler/icons-react";
import { Badge, Button, Modal } from "@/components/ui";
import {
  type ApprovalRights,
  approvalAction,
  isPendingLeave,
  type LeaveRow,
  leaveTypeLabel,
} from "./leave-calendar";

interface LeaveDetailsModalProps {
  leave: LeaveRow & { remaining_balance?: number | null };
  onClose: () => void;
  /** Omit where nobody decides leave (the employee's own view). */
  decide?: { rights: ApprovalRights; onAction: (action: string) => void; isActing: boolean };
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Box fz="sm">{value}</Box>
    </Stack>
  );
}

export function LeaveDetailsModal({ leave, onClose, decide }: LeaveDetailsModalProps) {
  const approve = decide ? approvalAction(leave, decide.rights) : null;
  const pending = isPendingLeave(leave.status);
  return (
    <Modal opened onClose={onClose} title={`${leaveTypeLabel(leave.leave_type)} leave`} size="md">
      <Stack gap="md">
        <SimpleGrid cols={2} spacing="sm">
          {leave.employee_name && <Field label="Employee" value={leave.employee_name} />}
          <Field
            label="Status"
            value={
              <Badge
                tone={pending ? "primary" : leave.status === "approved" ? "success" : "neutral"}
              >
                {leave.status.replace(/_/g, " ")}
              </Badge>
            }
          />
          <Field label="First day" value={leave.start_date} />
          <Field label="Last day" value={leave.end_date} />
          <Field label="Days" value={`${leave.days}${leave.is_half_day ? " (half day)" : ""}`} />
          {leave.remaining_balance !== undefined && (
            <Field
              label={`${leaveTypeLabel(leave.leave_type)} balance`}
              value={
                leave.remaining_balance === null
                  ? "No balance set"
                  : `${leave.remaining_balance} days left`
              }
            />
          )}
        </SimpleGrid>
        <Field label="Reason" value={leave.reason || "—"} />
        {decide && approve && (
          <Group justify="flex-end">
            <Button
              tone="danger"
              leftSection={<IconX size={16} />}
              onClick={() => decide.onAction("reject")}
              disabled={decide.isActing}
            >
              Reject
            </Button>
            <Button
              tone="primary"
              leftSection={<IconCheck size={16} />}
              onClick={() => decide.onAction(approve)}
              loading={decide.isActing}
            >
              {approve === "approve" ? "Approve" : "Forward to HR"}
            </Button>
          </Group>
        )}
      </Stack>
    </Modal>
  );
}
