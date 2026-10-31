// My time off: the signed-in employee's leave on the shared calendar, their balances,
// and the request form. Every call is /hr/me/* — the server decides whose leave it is.

import { Grid, Group, Skeleton, Stack, Text } from "@mantine/core";
import type { LeaveRequest } from "@medbrains/types";
import { IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { Alert, Badge, Button, Card, IconButton, Tooltip, toast } from "@/components/ui";
import { hrService } from "@/services/hr.service";
import { isPendingLeave, leaveTypeLabel, upcomingApproved } from "../hr/leave-calendar";
import { LeaveCalendarView, useLeaveCalendarWindow } from "../hr/leave-calendar-view";
import { LeaveDetailsModal } from "../hr/leave-details-modal";
import { LeaveRequestModal } from "../hr/leave-request-modal";

const UPCOMING_SHOWN = 3;

export function MyLeaveCard() {
  const qc = useQueryClient();
  const w = useLeaveCalendarWindow();
  const [requestDate, setRequestDate] = useState<string | null>(null);
  const [opened, setOpened] = useState<LeaveRequest | null>(null);
  const today = dayjs().format("YYYY-MM-DD");
  const year = dayjs().year();

  // At most 500 of the caller's own requests, so the calendar filters them locally.
  const requests = useQuery({
    queryKey: ["my-leaves"],
    queryFn: () => hrService.listMyLeaveRequests(),
  });
  const balances = useQuery({
    queryKey: ["my-leave-balances"],
    queryFn: () => hrService.listMyLeaveBalances(),
  });
  const thisYear = useMemo(
    () => (balances.data ?? []).filter((b) => b.year === year),
    [balances.data, year],
  );
  const pendingCount = (requests.data ?? []).filter((r) => isPendingLeave(r.status)).length;
  const upcoming = useMemo(
    () => upcomingApproved(requests.data ?? [], today, UPCOMING_SHOWN),
    [requests.data, today],
  );

  const cancel = useMutation({
    mutationFn: (id: string) => hrService.cancelLeave(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-leaves"] });
      toast.warning("Leave request withdrawn", { title: "Leave cancelled" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Leave not cancelled" }),
  });

  let balanceList: React.ReactNode;
  if (balances.isError) {
    balanceList = (
      <Alert tone="danger" title="Balances unavailable">
        {balances.error.message}
      </Alert>
    );
  } else if (balances.isLoading) {
    balanceList = <Skeleton height={60} />;
  } else if (thisYear.length === 0) {
    balanceList = <Text size="sm">No balances set for {year}. Ask HR.</Text>;
  } else {
    balanceList = thisYear.map((b) => (
      <Group key={b.id} justify="space-between">
        <Text size="sm">{leaveTypeLabel(b.leave_type)}</Text>
        <Text size="sm" fw={600}>
          {b.balance} days
        </Text>
      </Group>
    ));
  }

  return (
    <Card withBorder padding="lg">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>My time off</Text>
        <Button
          tone="primary"
          leftSection={<IconPlus size={16} />}
          onClick={() => setRequestDate(today)}
        >
          Request leave
        </Button>
      </Group>

      <Grid gap="md" mb="md">
        <Grid.Col span={{ base: 12, lg: 9 }}>
          <LeaveCalendarView
            window={w}
            rows={requests.data}
            isLoading={requests.isLoading}
            error={requests.error}
            onRetry={() => void requests.refetch()}
            onDayClick={setRequestDate}
            onLeaveClick={setOpened}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 3 }}>
          <Stack gap="md">
            <Stack gap={4}>
              <Text size="xs" c="dimmed" tt="uppercase">
                Balance {year}
              </Text>
              {balanceList}
            </Stack>
            {requests.isSuccess && (
              <>
                <Stack gap={2}>
                  <Text size="xs" c="dimmed" tt="uppercase">
                    Pending
                  </Text>
                  <Text fz="xl" fw={600}>
                    {pendingCount}
                  </Text>
                </Stack>
                <Stack gap={4}>
                  <Text size="xs" c="dimmed" tt="uppercase">
                    Upcoming approved
                  </Text>
                  {upcoming.length === 0 ? (
                    <Text size="sm">None</Text>
                  ) : (
                    upcoming.map((r) => (
                      <Text key={r.id} size="sm">
                        {leaveTypeLabel(r.leave_type)}: {r.start_date} → {r.end_date}
                      </Text>
                    ))
                  )}
                </Stack>
              </>
            )}
          </Stack>
        </Grid.Col>
      </Grid>

      {!requests.isError && (
        <DataTable
          data={requests.data ?? []}
          loading={requests.isLoading}
          rowKey={(r: LeaveRequest) => r.id}
          columns={[
            {
              key: "type",
              label: "Type",
              render: (r: LeaveRequest) => <Text size="sm">{leaveTypeLabel(r.leave_type)}</Text>,
            },
            {
              key: "period",
              label: "Period",
              render: (r: LeaveRequest) => (
                <Text size="sm">
                  {r.start_date} → {r.end_date} ({r.days} d)
                </Text>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (r: LeaveRequest) => <Badge size="sm">{r.status.replace(/_/g, " ")}</Badge>,
            },
            {
              key: "actions",
              label: "",
              render: (r: LeaveRequest) =>
                isPendingLeave(r.status) ? (
                  <Tooltip label="Withdraw">
                    <IconButton
                      onClick={() => cancel.mutate(r.id)}
                      aria-label="Withdraw leave request"
                    >
                      <IconX size={16} />
                    </IconButton>
                  </Tooltip>
                ) : null,
            },
          ]}
        />
      )}

      {requestDate && (
        <LeaveRequestModal
          date={requestDate}
          withEmployee={false}
          submit={(body) => hrService.createMyLeaveRequest(body)}
          onClose={() => setRequestDate(null)}
          onSubmitted={() => {
            void qc.invalidateQueries({ queryKey: ["my-leaves"] });
            setRequestDate(null);
          }}
        />
      )}
      {opened && <LeaveDetailsModal leave={opened} onClose={() => setOpened(null)} />}
    </Card>
  );
}
