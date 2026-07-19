// Lab ProficiencyTestingSection — split from lab.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { LabProficiencyTestFormInput } from "@medbrains/schemas";
import { labProficiencyTestFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateProficiencyTestRequest, LabProficiencyTest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components";
import { LabTestSearchSelect } from "@/components/LabTestSearchSelect";
import { Badge, Button } from "@/components/ui";
import { labOptionalNumber, labOptionalText } from "@/forms/lab.form";
import { labService } from "@/services/lab.service";

export function ProficiencyTestingSection() {
  const { t } = useTranslation("lab");
  const canCreate = useHasPermission(P.LAB.QC_CREATE);
  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const proficiencyDefaults: LabProficiencyTestFormInput = {
    program: "",
    test_id: "",
    survey_round: "",
    sample_id: "",
    assigned_value: "",
    reported_value: "",
    acceptable_range_low: "",
    acceptable_range_high: "",
    is_acceptable: null,
    evaluation_date: "",
    notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<LabProficiencyTestFormInput>({
    resolver: zodResolver(labProficiencyTestFormSchema),
    defaultValues: proficiencyDefaults,
  });

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ["lab-proficiency-tests"],
    queryFn: () => labService.listProficiencyTests(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateProficiencyTestRequest) => labService.createProficiencyTest(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-proficiency-tests"] });
      formHandlers.close();
      reset(proficiencyDefaults);
    },
  });

  const handleCreateProficiencyTest = (values: LabProficiencyTestFormInput) => {
    createMutation.mutate({
      program: values.program.trim(),
      test_id: labOptionalText(values.test_id),
      survey_round: labOptionalText(values.survey_round),
      sample_id: labOptionalText(values.sample_id),
      assigned_value: labOptionalNumber(values.assigned_value),
      reported_value: labOptionalNumber(values.reported_value),
      acceptable_range_low: labOptionalNumber(values.acceptable_range_low),
      acceptable_range_high: labOptionalNumber(values.acceptable_range_high),
      is_acceptable: values.is_acceptable ?? undefined,
      evaluation_date: labOptionalText(values.evaluation_date),
      notes: labOptionalText(values.notes),
    });
  };

  const columns = [
    {
      key: "program",
      label: "Program",
      render: (row: LabProficiencyTest) => <Text fw={500}>{row.program}</Text>,
    },
    {
      key: "survey_round",
      label: "Round",
      render: (row: LabProficiencyTest) => <Text size="sm">{row.survey_round ?? "—"}</Text>,
    },
    {
      key: "sample_id",
      label: "Sample",
      render: (row: LabProficiencyTest) => <Text size="sm">{row.sample_id ?? "—"}</Text>,
    },
    {
      key: "assigned_value",
      label: "Assigned",
      render: (row: LabProficiencyTest) => <Text size="sm">{row.assigned_value ?? "—"}</Text>,
    },
    {
      key: "reported_value",
      label: "Reported",
      render: (row: LabProficiencyTest) => <Text size="sm">{row.reported_value ?? "—"}</Text>,
    },
    {
      key: "range",
      label: "Range",
      render: (row: LabProficiencyTest) => (
        <Text size="sm">
          {row.acceptable_range_low != null && row.acceptable_range_high != null
            ? `${row.acceptable_range_low}–${row.acceptable_range_high}`
            : "—"}
        </Text>
      ),
    },
    {
      key: "is_acceptable",
      label: "Result",
      render: (row: LabProficiencyTest) =>
        row.is_acceptable != null ? (
          <Badge tone={row.is_acceptable ? "success" : "danger"} size="sm">
            {row.is_acceptable ? "Pass" : "Fail"}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            {t("pending")}
          </Text>
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
              if (formOpen) reset(proficiencyDefaults);
            }}
          >
            {t("addPtResult")}
          </Button>
        </Group>
      )}
      {formOpen && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateProficiencyTest)}>
          <Group grow>
            <TextInput
              label={t("label.program")}
              required
              error={errors.program?.message}
              {...register("program")}
            />
            <TextInput
              label={t("label.surveyRound")}
              error={errors.survey_round?.message}
              {...register("survey_round")}
            />
            <TextInput
              label={t("label.sampleId")}
              error={errors.sample_id?.message}
              {...register("sample_id")}
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
            <Controller
              control={control}
              name="assigned_value"
              render={({ field }) => (
                <NumberInput
                  label={t("label.assignedValue")}
                  decimalScale={4}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.assigned_value?.message}
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
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="acceptable_range_low"
              render={({ field }) => (
                <NumberInput
                  label={t("label.rangeLow")}
                  decimalScale={4}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.acceptable_range_low?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="acceptable_range_high"
              render={({ field }) => (
                <NumberInput
                  label={t("label.rangeHigh")}
                  decimalScale={4}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.acceptable_range_high?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="is_acceptable"
              render={({ field }) => (
                <Select
                  label={t("label.result")}
                  data={[
                    { value: "pending", label: t("pending") },
                    { value: "pass", label: "Pass" },
                    { value: "fail", label: "Fail" },
                  ]}
                  value={field.value == null ? "pending" : field.value ? "pass" : "fail"}
                  onChange={(value) => {
                    if (value === "pass") field.onChange(true);
                    else if (value === "fail") field.onChange(false);
                    else field.onChange(null);
                  }}
                  error={errors.is_acceptable?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t("label.evaluationDate")}
              type="date"
              error={errors.evaluation_date?.message}
              {...register("evaluation_date")}
            />
            <Textarea label={t("notes")} error={errors.notes?.message} {...register("notes")} />
          </Group>
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={tests} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}
