// Lab EqasSection — split from lab.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { LabEqasResultFormInput } from "@medbrains/schemas";
import { labEqasResultFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateEqasResultRequest, LabEqasResult } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components";
import { LabTestSearchSelect } from "@/components/LabTestSearchSelect";
import { Badge, type BadgeTone, Button } from "@/components/ui";
import { labEqasEvaluationOptions, labOptionalNumber, labOptionalText } from "@/forms/lab.form";
import { labService } from "@/services/lab.service";

const eqasColors: Record<string, BadgeTone> = {
  acceptable: "success",
  marginal: "warning",
  unacceptable: "danger",
  pending: "neutral",
};

export function EqasSection() {
  const { t } = useTranslation("lab");
  const canCreate = useHasPermission(P.LAB.QC_CREATE);
  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const eqasDefaults: LabEqasResultFormInput = {
    program_name: "",
    provider: "",
    test_id: "",
    cycle: "",
    sample_number: "",
    expected_value: "",
    reported_value: "",
    evaluation: "pending",
    bias_percent: "",
    z_score: "",
    report_date: "",
    notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<LabEqasResultFormInput>({
    resolver: zodResolver(labEqasResultFormSchema),
    defaultValues: eqasDefaults,
  });

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["lab-eqas"],
    queryFn: () => labService.listEqasResults(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateEqasResultRequest) => labService.createEqasResult(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-eqas"] });
      formHandlers.close();
      reset(eqasDefaults);
    },
  });

  const handleCreateEqasResult = (values: LabEqasResultFormInput) => {
    createMutation.mutate({
      program_name: values.program_name.trim(),
      provider: labOptionalText(values.provider),
      test_id: labOptionalText(values.test_id),
      cycle: labOptionalText(values.cycle),
      sample_number: labOptionalText(values.sample_number),
      expected_value: labOptionalNumber(values.expected_value),
      reported_value: labOptionalNumber(values.reported_value),
      evaluation: values.evaluation,
      bias_percent: labOptionalNumber(values.bias_percent),
      z_score: labOptionalNumber(values.z_score),
      report_date: labOptionalText(values.report_date),
      notes: labOptionalText(values.notes),
    });
  };

  const columns = [
    {
      key: "program_name",
      label: "Program",
      render: (row: LabEqasResult) => <Text fw={500}>{row.program_name}</Text>,
    },
    {
      key: "provider",
      label: "Provider",
      render: (row: LabEqasResult) => <Text size="sm">{row.provider ?? "—"}</Text>,
    },
    {
      key: "cycle",
      label: "Cycle",
      render: (row: LabEqasResult) => <Text size="sm">{row.cycle ?? "—"}</Text>,
    },
    {
      key: "expected_value",
      label: "Expected",
      render: (row: LabEqasResult) => <Text size="sm">{row.expected_value ?? "—"}</Text>,
    },
    {
      key: "reported_value",
      label: "Reported",
      render: (row: LabEqasResult) => <Text size="sm">{row.reported_value ?? "—"}</Text>,
    },
    {
      key: "evaluation",
      label: "Evaluation",
      render: (row: LabEqasResult) => (
        <Badge tone={eqasColors[row.evaluation] ?? "neutral"} size="sm">
          {row.evaluation}
        </Badge>
      ),
    },
    {
      key: "z_score",
      label: "Z-Score",
      render: (row: LabEqasResult) => <Text size="sm">{row.z_score ?? "—"}</Text>,
    },
    {
      key: "bias_percent",
      label: "Bias %",
      render: (row: LabEqasResult) => (
        <Text size="sm">{row.bias_percent != null ? `${row.bias_percent}%` : "—"}</Text>
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
              if (formOpen) reset(eqasDefaults);
            }}
          >
            {t("addEqasResult")}
          </Button>
        </Group>
      )}
      {formOpen && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateEqasResult)}>
          <Group grow>
            <TextInput
              label={t("label.programName")}
              required
              error={errors.program_name?.message}
              {...register("program_name")}
            />
            <TextInput
              label={t("label.provider")}
              error={errors.provider?.message}
              {...register("provider")}
            />
            <TextInput
              label={t("label.cycle")}
              error={errors.cycle?.message}
              {...register("cycle")}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="test_id"
              render={({ field }) => (
                <LabTestSearchSelect
                  value={field.value}
                  onChange={(id) => field.onChange(id)}
                  error={errors.test_id?.message}
                />
              )}
            />
            <TextInput
              label={t("label.sampleNumber")}
              error={errors.sample_number?.message}
              {...register("sample_number")}
            />
            <Controller
              control={control}
              name="evaluation"
              render={({ field }) => (
                <Select
                  label={t("label.evaluation")}
                  data={labEqasEvaluationOptions}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? "pending")}
                  error={errors.evaluation?.message}
                  required
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="expected_value"
              render={({ field }) => (
                <NumberInput
                  label={t("label.expectedValue")}
                  decimalScale={4}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.expected_value?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="reported_value"
              render={({ field }) => (
                <NumberInput
                  label={t("label.reportedValue")}
                  decimalScale={4}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.reported_value?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="bias_percent"
              render={({ field }) => (
                <NumberInput
                  label={t("label.bias%")}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.bias_percent?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="z_score"
              render={({ field }) => (
                <NumberInput
                  label={t("label.zScore")}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.z_score?.message}
                />
              )}
            />
            <TextInput
              label={t("label.reportDate")}
              type="date"
              error={errors.report_date?.message}
              {...register("report_date")}
            />
            <Textarea label={t("notes")} error={errors.notes?.message} {...register("notes")} />
          </Group>
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={results} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}
