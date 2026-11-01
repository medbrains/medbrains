// "Request leave" — shared by the calendar (prefilled with the clicked day) and Profile.
// The caller supplies the endpoint, so self-service and HR filing keep their own rules.

import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Stack, Text } from "@mantine/core";
import type { CreateLeaveRequestInput } from "@medbrains/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Button, Input, Modal, Select, Switch, TextArea, toast } from "@/components/ui";
import { hrService } from "@/services/hr.service";
import { LeaveDayPreview } from "./leave-day-preview";
import { LEAVE_TYPE_OPTIONS } from "./leave-options";

interface LeaveRequestModalProps {
  /** The first day, prefilled — also the last day until the user changes it. */
  date: string;
  onClose: () => void;
  submit: (body: CreateLeaveRequestInput) => Promise<unknown>;
  /** `hr.leave.manage`: file for anyone, so ask whose leave it is. */
  withEmployee: boolean;
  onSubmitted: () => void;
}

// The day count and its rules (weekly offs, holidays, half days) are the server's.
const schema = z.object({
  employee_id: z.string(),
  leave_type: z.string().min(1, "Choose a leave type"),
  start_date: z.string().min(1, "Enter the first day"),
  end_date: z.string().min(1, "Enter the last day"),
  is_half_day: z.boolean(),
  reason: z.string().max(500).optional(),
});
type FormValues = z.infer<typeof schema>;

export function LeaveRequestModal({
  date,
  onClose,
  submit,
  withEmployee,
  onSubmitted,
}: LeaveRequestModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(
      withEmployee
        ? schema.refine((v) => v.employee_id !== "", {
            path: ["employee_id"],
            message: "Choose whose leave this is",
          })
        : schema,
    ),
    defaultValues: {
      employee_id: "",
      leave_type: "casual",
      start_date: date,
      end_date: date,
      is_half_day: false,
      reason: "",
    },
  });
  const [leaveType, startDate, endDate, isHalfDay] = form.watch([
    "leave_type",
    "start_date",
    "end_date",
    "is_half_day",
  ]);
  const previewParams = {
    leave_type: leaveType,
    start_date: startDate,
    end_date: endDate,
    is_half_day: isHalfDay,
  };
  const preview = useQuery({
    queryKey: ["hr-leave-preview", previewParams],
    queryFn: () => hrService.previewLeaveDays(previewParams),
    enabled: Boolean(leaveType && startDate && endDate),
    retry: false,
  });
  const apply = useMutation({
    mutationFn: (v: FormValues) =>
      submit({
        employee_id: withEmployee ? v.employee_id : undefined,
        leave_type: v.leave_type,
        start_date: v.start_date,
        end_date: v.end_date,
        is_half_day: v.is_half_day,
        reason: v.reason || undefined,
      }),
    onSuccess: () => {
      toast.success("Sent to the department head for approval", { title: "Leave requested" });
      onSubmitted();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Leave not requested" }),
  });

  return (
    <Modal opened onClose={onClose} title="Request leave" size="md">
      <Box component="form" onSubmit={form.handleSubmit((v) => apply.mutate(v))} noValidate>
        <Stack gap="sm">
          {withEmployee ? (
            <Controller
              control={form.control}
              name="employee_id"
              render={({ field, fieldState }) => (
                <EmployeeSearchSelect
                  value={field.value}
                  onChange={(id) => field.onChange(id)}
                  required
                  error={fieldState.error?.message}
                />
              )}
            />
          ) : (
            <Text size="sm" c="dimmed">
              You are requesting your own leave.
            </Text>
          )}
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
          <LeaveDayPreview query={preview} />
          <Controller
            control={form.control}
            name="reason"
            render={({ field, fieldState }) => (
              <TextArea {...field} label="Reason" error={fieldState.error?.message} />
            )}
          />
          <Button type="submit" tone="primary" loading={apply.isPending} disabled={preview.isError}>
            Submit for approval
          </Button>
        </Stack>
      </Box>
    </Modal>
  );
}
