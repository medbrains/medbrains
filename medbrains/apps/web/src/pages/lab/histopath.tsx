// Lab HistopathSection — split from lab.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { LabHistopathReportFormInput } from "@medbrains/schemas";
import { labHistopathReportFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateHistopathReportRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Icd11CodeSelect } from "@/components/Clinical/Icd11CodeSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Button } from "@/components/ui";
import { labOptionalInteger, labOptionalText, labSampleTypeOptions } from "@/forms/lab.form";
import { labService } from "@/services/lab.service";

export function HistopathSection() {
  const { t } = useTranslation("lab");
  const canCreate = useHasPermission(P.LAB.SPECIALIZED_CREATE);
  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const [lookupOrderId, setLookupOrderId] = useState("");
  const histopathDefaults: LabHistopathReportFormInput = {
    order_id: "",
    patient_id: "",
    specimen_type: "",
    clinical_history: "",
    gross_description: "",
    microscopy_findings: "",
    diagnosis: "",
    icd_code: "",
    notes: "",
    turnaround_days: "",
  };
  const {
    control,
    register,
    reset,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<LabHistopathReportFormInput>({
    resolver: zodResolver(labHistopathReportFormSchema),
    defaultValues: histopathDefaults,
  });

  const { data: report } = useQuery({
    queryKey: ["lab-histopath", lookupOrderId],
    queryFn: () => labService.getHistopathReport(lookupOrderId),
    enabled: !!lookupOrderId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateHistopathReportRequest) => labService.createHistopathReport(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-histopath"] });
      formHandlers.close();
      reset(histopathDefaults);
      notifications.show({
        title: "Report created",
        message: "Histopathology report saved",
        color: "success",
      });
    },
  });

  const handleCreateHistopathReport = (values: LabHistopathReportFormInput) => {
    createMutation.mutate({
      order_id: values.order_id.trim(),
      patient_id: values.patient_id.trim(),
      specimen_type: labOptionalText(values.specimen_type),
      clinical_history: labOptionalText(values.clinical_history),
      gross_description: labOptionalText(values.gross_description),
      microscopy_findings: labOptionalText(values.microscopy_findings),
      diagnosis: labOptionalText(values.diagnosis),
      icd_code: labOptionalText(values.icd_code),
      notes: labOptionalText(values.notes),
      turnaround_days: labOptionalInteger(values.turnaround_days),
    });
  };

  return (
    <Stack>
      <Group>
        <TextInput
          size="xs"
          placeholder={t("placeholder.orderIdToViewReport")}
          value={lookupOrderId}
          onChange={(e) => setLookupOrderId(e.currentTarget.value)}
          w={300}
        />
      </Group>

      {report && (
        <Stack
          gap="xs"
          p="sm"
          style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 0 }}
        >
          <Text fw={600}>{t("histopathologyReport")}</Text>
          <Text size="sm">
            <strong>Specimen:</strong> {report.specimen_type ?? "—"}
          </Text>
          <Text size="sm">
            <strong>Gross Description:</strong> {report.gross_description ?? "—"}
          </Text>
          <Text size="sm">
            <strong>Microscopy:</strong> {report.microscopy_findings ?? "—"}
          </Text>
          <Text size="sm">
            <strong>Diagnosis:</strong> {report.diagnosis ?? "—"}
          </Text>
          <Text size="sm">
            <strong>ICD Code:</strong> {report.icd_code ?? "—"}
          </Text>
          <Text size="sm">
            <strong>Turnaround:</strong>{" "}
            {report.turnaround_days != null ? `${report.turnaround_days} days` : "—"}
          </Text>
        </Stack>
      )}

      {canCreate && (
        <Button
          tone="primary"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => {
            formHandlers.toggle();
            if (formOpen) reset(histopathDefaults);
          }}
        >
          {t("newHistopathReport")}
        </Button>
      )}

      {formOpen && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateHistopathReport)}>
          <Group grow>
            <TextInput
              label={t("label.orderId")}
              required
              error={errors.order_id?.message}
              {...register("order_id")}
            />
            <Controller
              control={control}
              name="patient_id"
              render={({ field }) => (
                <PatientSearchSelect
                  value={field.value}
                  onChange={(id) => field.onChange(id)}
                  error={errors.patient_id?.message}
                  required
                />
              )}
            />
            <Controller
              control={control}
              name="specimen_type"
              render={({ field }) => (
                <Select
                  label={t("label.specimenType")}
                  data={labSampleTypeOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.specimen_type?.message}
                  clearable
                  searchable
                />
              )}
            />
          </Group>
          <Textarea
            label={t("label.clinicalHistory")}
            autosize
            minRows={2}
            error={errors.clinical_history?.message}
            {...register("clinical_history")}
          />
          <Textarea
            label={t("label.grossDescription")}
            autosize
            minRows={2}
            error={errors.gross_description?.message}
            {...register("gross_description")}
          />
          <Textarea
            label={t("label.microscopyFindings")}
            autosize
            minRows={2}
            error={errors.microscopy_findings?.message}
            {...register("microscopy_findings")}
          />
          <Group grow>
            <TextInput
              label={t("label.diagnosis")}
              error={errors.diagnosis?.message}
              {...register("diagnosis")}
            />
            <Controller
              control={control}
              name="icd_code"
              render={({ field }) => (
                <Icd11CodeSelect
                  label="ICD-11"
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  onSelectResult={(result) => {
                    setValue("diagnosis", result.display, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                  error={errors.icd_code?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="turnaround_days"
              render={({ field }) => (
                <NumberInput
                  label={t("label.turnaround(days)")}
                  min={0}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.turnaround_days?.message}
                />
              )}
            />
          </Group>
          <Textarea label={t("notes")} error={errors.notes?.message} {...register("notes")} />
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            {t("saveReport")}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
