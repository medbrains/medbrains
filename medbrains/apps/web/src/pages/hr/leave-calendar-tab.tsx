// HR → Calendar: everyone's leave for the visible window in one call (with each
// person's remaining balance), filters, the manager rail and the requests table.
// Rendered only for `hr.leave.list` holders, so no query runs without it.

import { Grid, Group, Skeleton, Stack, Text } from "@mantine/core";
import type { LeaveListRow } from "@medbrains/types";
import { IconCheck, IconX } from "@tabler/icons-react";
import { type UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { DataTable } from "@/components";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, Button, Card, IconButton, Tooltip, toast } from "@/components/ui";
import { hrService } from "@/services/hr.service";
import { approvalAction, countOnLeave, isPendingLeave, leaveTypeLabel } from "./leave-calendar";
import { LeaveCalendarView, useLeaveCalendarWindow } from "./leave-calendar-view";
import { LeaveDetailsModal } from "./leave-details-modal";
import { LeaveRequestModal } from "./leave-request-modal";

/** The server's page size for `GET /hr/leaves`; a full page means there may be more. */
const LIST_LIMIT = 1000;

interface LeaveCalendarTabProps {
  canCreate: boolean;
  canApprove: boolean;
  /** `hr.leave.manage` — file for anyone, give final approval. */
  canManage: boolean;
}

function Metric({ label, query, value }: { label: string; query: UseQueryResult; value: string }) {
  let shown: React.ReactNode = value;
  if (query.isLoading) shown = <Skeleton height={28} width={48} />;
  // A failed count must not read as zero.
  else if (query.isError) shown = <Text size="sm">Unavailable</Text>;
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      {typeof shown === "string" ? (
        <Text fz="xl" fw={600}>
          {shown}
        </Text>
      ) : (
        shown
      )}
    </Stack>
  );
}

export function LeaveCalendarTab({ canCreate, canApprove, canManage }: LeaveCalendarTabProps) {
  const qc = useQueryClient();
  const w = useLeaveCalendarWindow();
  const [departmentId, setDepartmentId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  // Bumped to remount the staff picker when filters clear (it keeps its own text).
  const [filterKey, setFilterKey] = useState(0);
  const [requestDate, setRequestDate] = useState<string | null>(null);
  const [opened, setOpened] = useState<LeaveListRow | null>(null);
  const today = dayjs().format("YYYY-MM-DD");

  const { data: me } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => hrService.getMyProfile(),
    enabled: canApprove,
  });
  const rights = { canApprove, canManage, myEmployeeId: me?.employee?.id };

  const filters = {
    from: w.from,
    to: w.to,
    department_id: departmentId || undefined,
    employee_id: employeeId || undefined,
  };
  const leaves = useQuery({
    queryKey: ["hr-leaves", "window", filters],
    queryFn: () => hrService.listLeaveRequests(filters),
  });
  const onLeaveToday = useQuery({
    queryKey: ["hr-leaves", "window", { from: today, to: today, status: "approved" }],
    queryFn: () => hrService.listLeaveRequests({ from: today, to: today, status: "approved" }),
  });
  const waitingStatus = canManage ? "pending_hod,pending_admin" : "pending_hod";
  const waiting = useQuery({
    queryKey: ["hr-leaves", "waiting", waitingStatus],
    queryFn: () => hrService.listLeaveRequests({ status: waitingStatus }),
    enabled: canApprove,
  });

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      hrService.leaveAction(id, { action }),
    onSuccess: (_, { action }) => {
      void qc.invalidateQueries({ queryKey: ["hr-leaves"] });
      setOpened(null);
      toast.success(
        action === "reject"
          ? "Leave rejected"
          : action === "approve_hod"
            ? "Forwarded to HR"
            : "Leave approved",
        { title: "Leave decided" },
      );
    },
    onError: (e: Error) => toast.error(e.message, { title: "Leave not decided" }),
  });

  const waitingCount = (waiting.data ?? []).filter((r) => approvalAction(r, rights)).length;
  const onDayClick = canCreate ? setRequestDate : undefined;

  return (
    <Stack gap="md">
      <Group align="flex-end" gap="sm">
        <DepartmentSelect
          value={departmentId}
          onChange={setDepartmentId}
          placeholder="All departments"
        />
        <EmployeeSearchSelect
          key={filterKey}
          label="Staff"
          value={employeeId}
          onChange={setEmployeeId}
          placeholder="Search staff by name or code"
        />
        {(departmentId || employeeId) && (
          <Button
            tone="tertiary"
            onClick={() => {
              setDepartmentId("");
              setEmployeeId("");
              setFilterKey((k) => k + 1);
            }}
          >
            Clear filters
          </Button>
        )}
      </Group>

      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 9 }}>
          <LeaveCalendarView
            window={w}
            rows={leaves.data}
            isLoading={leaves.isLoading}
            error={leaves.error}
            onRetry={() => void leaves.refetch()}
            onDayClick={onDayClick}
            onLeaveClick={setOpened}
            isTruncated={(leaves.data?.length ?? 0) >= LIST_LIMIT}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 3 }}>
          <Card withBorder padding="md">
            <Stack gap="md">
              <Metric
                label="On leave today"
                query={onLeaveToday}
                value={String(countOnLeave(onLeaveToday.data ?? [], today))}
              />
              {canApprove && (
                <Metric
                  label="Approvals waiting"
                  query={waiting}
                  value={`${waitingCount}${(waiting.data?.length ?? 0) >= LIST_LIMIT ? "+" : ""}`}
                />
              )}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {!leaves.isError && (
        <DataTable
          data={leaves.data ?? []}
          loading={leaves.isLoading}
          rowKey={(r: LeaveListRow) => r.id}
          columns={[
            {
              key: "employee",
              label: "Employee",
              render: (r: LeaveListRow) => <Text size="sm">{r.employee_name}</Text>,
            },
            {
              key: "type",
              label: "Type",
              render: (r: LeaveListRow) => <Text size="sm">{leaveTypeLabel(r.leave_type)}</Text>,
            },
            {
              key: "period",
              label: "Period",
              render: (r: LeaveListRow) => (
                <Text size="sm">
                  {r.start_date} → {r.end_date} ({r.days} d{r.is_half_day ? ", half" : ""})
                </Text>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (r: LeaveListRow) => (
                <Badge
                  tone={
                    isPendingLeave(r.status)
                      ? "primary"
                      : r.status === "approved"
                        ? "success"
                        : "neutral"
                  }
                >
                  {r.status.replace(/_/g, " ")}
                </Badge>
              ),
            },
            {
              key: "decide",
              label: "Balance · decide",
              render: (r: LeaveListRow) => {
                const approve = approvalAction(r, rights);
                if (!approve) return null;
                return (
                  <Group gap={4} wrap="nowrap">
                    <Text size="sm" c="dimmed">
                      {r.remaining_balance === null ? "No balance" : `${r.remaining_balance} left`}
                    </Text>
                    <Tooltip label={approve === "approve" ? "Approve" : "Forward to HR"}>
                      <IconButton
                        tone="success"
                        aria-label={`Approve leave for ${r.employee_name}`}
                        onClick={() => act.mutate({ id: r.id, action: approve })}
                        disabled={act.isPending}
                      >
                        <IconCheck size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip label="Reject">
                      <IconButton
                        tone="danger"
                        aria-label={`Reject leave for ${r.employee_name}`}
                        onClick={() => act.mutate({ id: r.id, action: "reject" })}
                        disabled={act.isPending}
                      >
                        <IconX size={16} />
                      </IconButton>
                    </Tooltip>
                  </Group>
                );
              },
            },
          ]}
        />
      )}

      {requestDate && (
        <LeaveRequestModal
          date={requestDate}
          withEmployee={canManage}
          submit={(body) => hrService.createLeaveRequest(body)}
          onClose={() => setRequestDate(null)}
          onSubmitted={() => {
            void qc.invalidateQueries({ queryKey: ["hr-leaves"] });
            setRequestDate(null);
          }}
        />
      )}
      {opened && (
        <LeaveDetailsModal
          leave={opened}
          onClose={() => setOpened(null)}
          decide={{
            rights,
            onAction: (action) => act.mutate({ id: opened.id, action }),
            isActing: act.isPending,
          }}
        />
      )}
    </Stack>
  );
}
