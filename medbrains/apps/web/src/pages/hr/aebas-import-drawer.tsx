import { zodResolver } from "@hookform/resolvers/zod";
import { Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconUpload } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Drawer, Input, NumberField, toast } from "@/components/ui";
import { hrService } from "@/services/hr.service";

// The AEBAS print looks the period up by exact string, so it must be the
// same `YYYY-MM` the month picker on "Print Aebas Attendance" sends.
const aebasImportSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Enter the month as YYYY-MM"),
  total_employees: z.number().int().min(0),
  average_attendance_percentage: z.number().min(0).max(100).optional(),
  total_working_days: z.number().int().min(0).max(31),
  holidays: z.number().int().min(0).max(31),
});

type AebasImportForm = z.infer<typeof aebasImportSchema>;

const NUMBER_FIELDS = [
  { name: "total_employees", label: "Total employees" },
  { name: "average_attendance_percentage", label: "Average attendance (%)" },
  { name: "total_working_days", label: "Working days" },
  { name: "holidays", label: "Holidays" },
] as const;

/** Records a month's AEBAS MIS summary so the AEBAS attendance return can print it. */
export function AebasImportDrawer() {
  const [opened, { open, close }] = useDisclosure(false);
  const form = useForm<AebasImportForm>({
    resolver: zodResolver(aebasImportSchema),
    defaultValues: { period: "", total_employees: 0, total_working_days: 0, holidays: 0 },
  });

  const importMut = useMutation({
    mutationFn: (values: AebasImportForm) =>
      hrService.importAebasPeriodSummary({ ...values, departments: [] }),
    onSuccess: (res) => {
      toast.success(`AEBAS summary saved for ${res.period}`, { title: "Imported" });
      form.reset();
      close();
    },
    onError: () => toast.error("The AEBAS summary could not be saved", { title: "Import failed" }),
  });

  return (
    <>
      <Button tone="secondary" leftSection={<IconUpload size={16} />} onClick={open}>
        Import AEBAS month
      </Button>
      <Drawer opened={opened} onClose={close} title="Import AEBAS monthly summary" position="right">
        <Stack
          component="form"
          onSubmit={form.handleSubmit((values) => importMut.mutate(values))}
          gap="sm"
        >
          <Controller
            control={form.control}
            name="period"
            render={({ field, fieldState }) => (
              <Input
                {...field}
                label="Month"
                placeholder="YYYY-MM"
                required
                error={fieldState.error?.message}
              />
            )}
          />
          {NUMBER_FIELDS.map((f) => (
            <Controller
              key={f.name}
              control={form.control}
              name={f.name}
              render={({ field, fieldState }) => (
                <NumberField
                  label={f.label}
                  value={field.value ?? ""}
                  onChange={(v) => field.onChange(typeof v === "number" ? v : undefined)}
                  onBlur={field.onBlur}
                  min={0}
                  error={fieldState.error?.message}
                />
              )}
            />
          ))}
          <Button tone="primary" type="submit" loading={importMut.isPending}>
            Save summary
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}
