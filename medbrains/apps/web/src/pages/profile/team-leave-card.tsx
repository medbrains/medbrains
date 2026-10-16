// A department head's approval queue: their staff's leave, first step of the chain.
// The server scopes the list to departments the caller heads and re-checks on every
// decision; a head forwards to HR (`approve_hod`), HR gives the final approval.

import { Group, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { TeamLeave } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components";
import { Alert, Badge, Card, IconButton, Tooltip, toast } from "@/components/ui";
import { hrService } from "@/services/hr.service";

export function TeamLeaveCard() {
  const canApprove = useHasPermission(P.HR.LEAVE_APPROVE);
  const qc = useQueryClient();
  const team = useQuery({
    queryKey: ["my-team-leaves"],
    queryFn: () => hrService.listMyTeamLeaves(),
    enabled: canApprove,
  });
  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve_hod" | "reject" }) =>
      hrService.leaveAction(id, { action }),
    onSuccess: (_, { action }) => {
      void qc.invalidateQueries({ queryKey: ["my-team-leaves"] });
      toast.success(action === "reject" ? "Leave rejected" : "Forwarded to HR for final approval", {
        title: "Leave decided",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Leave not decided" }),
  });

  if (!canApprove) return null;
  if (team.isError) {
    return (
      <Alert tone="danger" title="Your team's leave could not be loaded">
        {team.error.message}
      </Alert>
    );
  }
  // An approver who heads no department has no queue; that is a fact, not an outage.
  if (!team.data?.is_department_head) return null;

  return (
    <Card withBorder padding="lg">
      <Text fw={600} mb="sm">
        Team leave
      </Text>
      <DataTable
        data={team.data.leaves}
        loading={team.isLoading}
        rowKey={(r: TeamLeave) => r.id}
        columns={[
          {
            key: "employee",
            label: "Employee",
            render: (r: TeamLeave) => `${r.employee_name} · ${r.department_name}`,
          },
          {
            key: "type",
            label: "Type",
            render: (r: TeamLeave) => <Badge size="sm">{r.leave_type.replace(/_/g, " ")}</Badge>,
          },
          {
            key: "period",
            label: "Period",
            render: (r: TeamLeave) => `${r.start_date} → ${r.end_date} (${r.days} d)`,
          },
          {
            key: "status",
            label: "Status",
            render: (r: TeamLeave) => <Badge size="sm">{r.status.replace(/_/g, " ")}</Badge>,
          },
          {
            key: "actions",
            label: "",
            render: (r: TeamLeave) =>
              r.status === "pending_hod" ? (
                <Group gap={4}>
                  <Tooltip label="Approve and forward to HR">
                    <IconButton
                      tone="success"
                      onClick={() => decide.mutate({ id: r.id, action: "approve_hod" })}
                      aria-label={`Approve leave for ${r.employee_name}`}
                    >
                      <IconCheck size={16} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip label="Reject">
                    <IconButton
                      tone="danger"
                      onClick={() => decide.mutate({ id: r.id, action: "reject" })}
                      aria-label={`Reject leave for ${r.employee_name}`}
                    >
                      <IconX size={16} />
                    </IconButton>
                  </Tooltip>
                </Group>
              ) : null,
          },
        ]}
      />
    </Card>
  );
}
