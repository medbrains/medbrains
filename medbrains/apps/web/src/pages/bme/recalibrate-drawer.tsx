// Record a new calibration on an existing schedule — the only way a
// calibration lock lifts. The server relocks if the result is still out of
// tolerance or the next due date is already past, and says why.

import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, Text } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import type { BmeCalibration, UpdateBmeCalibrationRequest } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Drawer, Input, Switch } from "@/components/ui";
import { bmeService } from "@/services/bme.service";

const recalSchema = z
  .object({
    last_calibrated_date: z.string().min(10, "When was it calibrated?"),
    next_due_date: z.string().min(10, "When is it next due?"),
    is_in_tolerance: z.boolean(),
    certificate_number: z.string().trim().min(1, "The certificate number is the evidence"),
    calibrated_by: z.string().trim().optional(),
  })
  .refine((v) => v.next_due_date > v.last_calibrated_date, {
    path: ["next_due_date"],
    message: "Next due must be after the calibration date",
  });
type RecalForm = z.infer<typeof recalSchema>;

/** Turn the form into the PUT body: a calibration recorded as "calibrated". */
export function recalibrationRequest(values: RecalForm): UpdateBmeCalibrationRequest {
  return {
    calibration_status: values.is_in_tolerance ? "calibrated" : "out_of_tolerance",
    last_calibrated_date: values.last_calibrated_date,
    next_due_date: values.next_due_date,
    is_in_tolerance: values.is_in_tolerance,
    certificate_number: values.certificate_number,
    calibrated_by: values.calibrated_by || undefined,
  };
}

interface RecalibrateDrawerProps {
  calibration: BmeCalibration | null;
  equipmentName: string;
  onClose: () => void;
}

export function RecalibrateDrawer({ calibration, equipmentName, onClose }: RecalibrateDrawerProps) {
  const qc = useQueryClient();
  const form = useForm<RecalForm>({
    resolver: zodResolver(recalSchema),
    defaultValues: {
      last_calibrated_date: "",
      next_due_date: "",
      is_in_tolerance: true,
      certificate_number: "",
      calibrated_by: "",
    },
  });
  const mut = useMutation<BmeCalibration, Error, UpdateBmeCalibrationRequest>({
    mutationFn: (body) => bmeService.updateBmeCalibration(calibration?.id ?? "", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bme-calibrations"] });
      void qc.invalidateQueries({ queryKey: ["bme-stats"] });
      form.reset();
    },
    onError: () => undefined,
  });
  const saved = mut.data;

  return (
    <Drawer
      opened={calibration !== null}
      onClose={() => {
        mut.reset();
        onClose();
      }}
      title={`Record calibration — ${equipmentName}`}
      position="right"
      size="lg"
    >
      <Stack
        component="form"
        onSubmit={form.handleSubmit((v) => mut.mutate(recalibrationRequest(v)))}
      >
        {calibration?.locked_reason && (
          <Alert tone="danger" title="Locked out of patient use">
            {calibration.locked_reason}
          </Alert>
        )}
        <Controller
          control={form.control}
          name="last_calibrated_date"
          render={({ field, fieldState }) => (
            <DateInput
              label="Calibrated on"
              required
              value={field.value || null}
              onChange={(d) => field.onChange(d?.slice(0, 10) ?? "")}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="next_due_date"
          render={({ field, fieldState }) => (
            <DateInput
              label="Next due"
              required
              value={field.value || null}
              onChange={(d) => field.onChange(d?.slice(0, 10) ?? "")}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="certificate_number"
          render={({ field, fieldState }) => (
            <Input
              label="Certificate number"
              required
              {...field}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="calibrated_by"
          render={({ field }) => (
            <Input label="Calibrated by" {...field} value={field.value ?? ""} />
          )}
        />
        <Controller
          control={form.control}
          name="is_in_tolerance"
          render={({ field }) => (
            <Switch
              label="Within tolerance"
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />
        <Text size="xs" c="dimmed">
          The equipment stays out of service on the register until you set it back to Active.
        </Text>
        <Button tone="primary" type="submit" loading={mut.isPending}>
          Save calibration
        </Button>
        {saved && !saved.is_locked && (
          <Alert tone="success" title="Calibration lock lifted">
            Set the equipment back to Active on the equipment register once it is verified.
          </Alert>
        )}
        {saved?.is_locked && (
          <Alert tone="warning" title="Still locked">
            {saved.locked_reason ?? "The result does not release the equipment."}
          </Alert>
        )}
        {mut.isError && (
          <Alert tone="danger" title="Calibration not saved">
            {mut.error.message}
          </Alert>
        )}
      </Stack>
    </Drawer>
  );
}
