// Self-service leave: the signed-in employee's balances, applications and the form to
// apply. Every call is /hr/me/* — the server decides whose leave it is, never the page.

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { LeaveRequest } from "@medbrains/types";
import { IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable } from "@/components";
import {
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  IconButton,
  Input,
  Select,
  Switch,
  TextArea,
  Tooltip,
  toast,
} from "@/components/ui";
import { hrService } from "@/services/hr.service";
import { LEAVE_TYPE_OPTIONS, leaveDays } from "../hr/leave-options";

const schema = z
  .object({
    leave_type: z.string().min(1, "Choose a leave type"),
    start_date: z.string().min(1, "Enter the first day"),
    end_date: z.string().min(1, "Enter the last day"),
    is_half_day: z.boolean(),
    reason: z.string().max(500).optional(),
  })
  .refine((v) => leaveDays(v.start_date, v.end_date, v.is_half_day) !== null, {
    path: ["end_date"],
    message: "The last day must be on or after the first; a half day is a single date",
  });
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  leave_type: "casual",
  start_date: "",
  end_date: "",
  is_half_day: false,
  reason: "",
};

const PENDING = new Set(["draft", "pending_hod", "pending_admin"]);

export function MyLeaveCard() {
  const qc = useQueryClient();
  const [applyOpen, { open, close }] = useDisclosure(false);
  const requests = useQuery({
    queryKey: ["my-leaves"],
    queryFn: () => hrService.listMyLeaveRequests(),
  });
  const balances = useQuery({
    queryKey: ["my-leave-balances"],
    queryFn: () => hrService.listMyLeaveBalances(),
  });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  const apply = useMutation({
    mutationFn: (v: FormValues) =>
      hrService.createMyLeaveRequest({
        leave_type: v.leave_type,
        start_date: v.start_date,
        end_date: v.end_date,
        days: leaveDays(v.start_date, v.end_date, v.is_half_day) ?? undefined,
        is_half_day: v.is_half_day,
        reason: v.reason || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-leaves"] });
      form.reset(EMPTY);
      close();
      toast.success("Sent to your department head for approval", { title: "Leave applied" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Leave not applied" }),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => hrService.cancelLeave(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-leaves"] });
      toast.warning("Leave application withdrawn", { title: "Leave cancelled" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Leave not cancelled" }),
  });

  return (
    <Card withBorder padding="lg">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>My leave</Text>
        <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
          Apply for leave
        </Button>
      </Group>

      {balances.isError ? (
        <Alert tone="danger" title="Balances unavailable">
          {balances.error.message}
        </Alert>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm" mb="md">
          {(balances.data ?? []).map((b) => (
            <Stack key={b.id} gap={0}>
              <Text size="xs" c="dimmed" tt="capitalize">
                {b.leave_type.replace(/_/g, " ")} · {b.year}
              </Text>
              <Text fw={600}>{b.balance} days left</Text>
            </Stack>
          ))}
        </SimpleGrid>
      )}

      {requests.isError ? (
        <Alert tone="danger" title="Your leave could not be loaded">
          {requests.error.message}
        </Alert>
      ) : (
        <DataTable
          data={requests.data ?? []}
          loading={requests.isLoading}
          rowKey={(r: LeaveRequest) => r.id}
          columns={[
            {
              key: "type",
              label: "Type",
              render: (r: LeaveRequest) => (
                <Badge size="sm">{r.leave_type.replace(/_/g, " ")}</Badge>
              ),
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
                PENDING.has(r.status) ? (
                  <Tooltip label="Withdraw">
                    <IconButton
                      onClick={() => cancel.mutate(r.id)}
                      aria-label="Withdraw leave application"
                    >
                      <IconX size={16} />
                    </IconButton>
                  </Tooltip>
                ) : null,
            },
          ]}
        />
      )}

      <Drawer opened={applyOpen} onClose={close} title="Apply for leave" position="right">
        <form onSubmit={form.handleSubmit((v) => apply.mutate(v))} noValidate>
          <Stack gap="sm">
            <Controller
              control={form.control}
              name="leave_type"
              render={({ field, fieldState }) => (
                <Select
                  {...field}
                  label="Leave type"
                  data={LEAVE_TYPE_OPTIONS}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={form.control}
              name="start_date"
              render={({ field, fieldState }) => (
                <Input {...field} type="date" label="First day" error={fieldState.error?.message} />
              )}
            />
            <Controller
              control={form.control}
              name="end_date"
              render={({ field, fieldState }) => (
                <Input {...field} type="date" label="Last day" error={fieldState.error?.message} />
              )}
            />
            <Controller
              control={form.control}
              name="is_half_day"
              render={({ field }) => (
                <Switch
                  label="Half day"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
              )}
            />
            <Controller
              control={form.control}
              name="reason"
              render={({ field, fieldState }) => (
                <TextArea {...field} label="Reason" error={fieldState.error?.message} />
              )}
            />
            <Button type="submit" tone="primary" loading={apply.isPending}>
              Submit for approval
            </Button>
          </Stack>
        </form>
      </Drawer>
    </Card>
  );
}
