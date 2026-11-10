// Add or edit one holiday. The server refuses a second holiday on the same date.

import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Stack } from "@mantine/core";
import type { Holiday, HolidayInput, HolidayKind } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Input, Modal, Select, toast } from "@/components/ui";
import { hrService } from "@/services/hr.service";

export const HOLIDAY_KINDS: { value: HolidayKind; label: string }[] = [
  { value: "national", label: "National — closed, not a leave day" },
  { value: "regional", label: "Regional — closed, not a leave day" },
  { value: "restricted", label: "Restricted — optional, still a working day" },
];

const schema = z.object({
  holiday_date: z.string().min(1, "Enter the date"),
  name: z.string().trim().min(1, "Name the holiday").max(120),
  kind: z.enum(["national", "regional", "restricted"]),
});

interface HolidayModalProps {
  /** Omit to add a new holiday. */
  holiday?: Holiday;
  /** Prefilled date for a new holiday. */
  defaultDate: string;
  onClose: () => void;
}

export function HolidayModal({ holiday, defaultDate, onClose }: HolidayModalProps) {
  const qc = useQueryClient();
  const form = useForm<HolidayInput>({
    resolver: zodResolver(schema),
    defaultValues: holiday ?? { holiday_date: defaultDate, name: "", kind: "national" },
  });
  const save = useMutation({
    mutationFn: (v: HolidayInput) =>
      holiday ? hrService.updateHoliday(holiday.id, v) : hrService.createHoliday(v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-holidays"] });
      toast.success("Leave requested from now on is counted with it.", {
        title: holiday ? "Holiday updated" : "Holiday added",
      });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Holiday not saved" }),
  });

  return (
    <Modal opened onClose={onClose} title={holiday ? "Edit holiday" : "Add holiday"} size="md">
      <Box component="form" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        <Stack gap="sm">
          <Controller
            control={form.control}
            name="holiday_date"
            render={({ field, fieldState }) => (
              <Input
                {...field}
                type="date"
                label="Date"
                required
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <Input {...field} label="Name" required error={fieldState.error?.message} />
            )}
          />
          <Controller
            control={form.control}
            name="kind"
            render={({ field, fieldState }) => (
              <Select
                {...field}
                label="Kind"
                data={HOLIDAY_KINDS}
                allowDeselect={false}
                error={fieldState.error?.message}
              />
            )}
          />
          <Button type="submit" tone="primary" loading={save.isPending}>
            Save holiday
          </Button>
        </Stack>
      </Box>
    </Modal>
  );
}
