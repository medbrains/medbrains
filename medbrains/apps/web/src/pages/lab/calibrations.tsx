// Lab CalibrationsSection — split from lab.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Switch, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { LabCalibrationFormInput } from "@medbrains/schemas";
import { labCalibrationFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateCalibrationRequest, LabCalibration } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components";
import { LabTestSearchSelect } from "@/components/LabTestSearchSelect";
import { Button } from "@/components/ui";
import { labOptionalText } from "@/forms/lab.form";
import { labService } from "@/services/lab.service";

export function CalibrationsSection() {
  const { t } = useTranslation("lab");
  const canCreate = useHasPermission(P.LAB.QC_CREATE);
  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const calibrationDefaults: LabCalibrationFormInput = {
    test_id: "",
    instrument_name: "",
    calibrator_lot: "",
    calibration_date: "",
    next_calibration_date: "",
    is_passed: true,
    notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<LabCalibrationFormInput>({
    resolver: zodResolver(labCalibrationFormSchema),
    defaultValues: calibrationDefaults,
  });

  const { data: calibrations = [], isLoading } = useQuery({
    queryKey: ["lab-calibrations"],
    queryFn: () => labService.listCalibrations(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCalibrationRequest) => labService.createCalibration(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-calibrations"] });
      formHandlers.close();
      reset(calibrationDefaults);
    },
  });

  const handleCreateCalibration = (values: LabCalibrationFormInput) => {
    createMutation.mutate({
      test_id: values.test_id.trim(),
      instrument_name: labOptionalText(values.instrument_name),
      calibrator_lot: labOptionalText(values.calibrator_lot),
      calibration_date: labOptionalText(values.calibration_date),
      next_calibration_date: labOptionalText(values.next_calibration_date),
      is_passed: values.is_passed,
      notes: labOptionalText(values.notes),
    });
  };

  const columns = [
    {
      key: "test_id",
      label: "Test",
      render: (row: LabCalibration) => <Text size="sm">{row.test_id.slice(0, 8)}...</Text>,
    },
    {
      key: "instrument_name",
      label: "Instrument",
      render: (row: LabCalibration) => <Text size="sm">{row.instrument_name ?? "—"}</Text>,
    },
    {
      key: "calibrator_lot",
      label: "Calibrator Lot",
      render: (row: LabCalibration) => <Text size="sm">{row.calibrator_lot ?? "—"}</Text>,
    },
    {
      key: "calibration_date",
      label: "Date",
      render: (row: LabCalibration) => <Text size="sm">{row.calibration_date ?? "—"}</Text>,
    },
    {
      key: "next_calibration_date",
      label: "Next",
      render: (row: LabCalibration) => <Text size="sm">{row.next_calibration_date ?? "—"}</Text>,
    },
    {
      key: "is_passed",
      label: "Passed",
      render: (row: LabCalibration) =>
        row.is_passed ? (
          <IconCheck size={14} color="success" />
        ) : (
          <IconX size={14} color="danger" />
        ),
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              formHandlers.toggle();
              if (formOpen) reset(calibrationDefaults);
            }}
          >
            {t("addCalibration")}
          </Button>
        </Group>
      )}
      {formOpen && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateCalibration)}>
          <Group grow>
            <Controller
              control={control}
              name="test_id"
              render={({ field }) => (
                <LabTestSearchSelect
                  value={field.value}
                  onChange={(id) => field.onChange(id)}
                  error={errors.test_id?.message}
                  required
                />
              )}
            />
            <TextInput
              label={t("label.instrument")}
              error={errors.instrument_name?.message}
              {...register("instrument_name")}
            />
            <TextInput
              label={t("label.calibratorLot")}
              error={errors.calibrator_lot?.message}
              {...register("calibrator_lot")}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t("label.date")}
              type="date"
              error={errors.calibration_date?.message}
              {...register("calibration_date")}
            />
            <TextInput
              label={t("label.nextCalibration")}
              type="date"
              error={errors.next_calibration_date?.message}
              {...register("next_calibration_date")}
            />
          </Group>
          <Controller
            control={control}
            name="is_passed"
            render={({ field }) => (
              <Switch
                label={t("passed")}
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Textarea label={t("notes")} error={errors.notes?.message} {...register("notes")} />
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <DataTable
        columns={columns}
        data={calibrations}
        loading={isLoading}
        rowKey={(row) => row.id}
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Outsourced Tab (NEW)
// ══════════════════════════════════════════════════════════
