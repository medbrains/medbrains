// Lab CytologySection — split from lab.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { LabCytologyReportFormInput } from "@medbrains/schemas";
import { labCytologyReportFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateCytologyReportRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Icd11CodeSelect } from "@/components/Clinical/Icd11CodeSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Button } from "@/components/ui";
import {
  labBethesdaCategoryOptions,
  labOptionalText,
  labSampleTypeOptions,
} from "@/forms/lab.form";
import { labService } from "@/services/lab.service";

export function CytologySection() {
  const { t } = useTranslation("lab");
  const canCreate = useHasPermission(P.LAB.SPECIALIZED_CREATE);
  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const [lookupOrderId, setLookupOrderId] = useState("");
  const cytologyDefaults: LabCytologyReportFormInput = {
    order_id: "",
    patient_id: "",
    specimen_type: "",
    clinical_indication: "",
    adequacy: "",
    screening_findings: "",
    diagnosis: "",
    bethesda_category: "",
    icd_code: "",
    notes: "",
  };
  const {
    control,
    register,
    reset,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<LabCytologyReportFormInput>({
    resolver: zodResolver(labCytologyReportFormSchema),
    defaultValues: cytologyDefaults,
  });

  const { data: report } = useQuery({
    queryKey: ["lab-cytology", lookupOrderId],
    queryFn: () => labService.getCytologyReport(lookupOrderId),
    enabled: !!lookupOrderId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCytologyReportRequest) => labService.createCytologyReport(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-cytology"] });
      formHandlers.close();
      reset(cytologyDefaults);
      notifications.show({
        title: "Report created",
        message: "Cytology report saved",
        color: "success",
      });
    },
  });

  const handleCreateCytologyReport = (values: LabCytologyReportFormInput) => {
    createMutation.mutate({
      order_id: values.order_id.trim(),
      patient_id: values.patient_id.trim(),
      specimen_type: labOptionalText(values.specimen_type),
      clinical_indication: labOptionalText(values.clinical_indication),
      adequacy: labOptionalText(values.adequacy),
      screening_findings: labOptionalText(values.screening_findings),
      diagnosis: labOptionalText(values.diagnosis),
      bethesda_category: labOptionalText(values.bethesda_category),
      icd_code: labOptionalText(values.icd_code),
      notes: labOptionalText(values.notes),
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
          <Text fw={600}>{t("cytologyReport")}</Text>
          <Text size="sm">
            <strong>Specimen:</strong> {report.specimen_type ?? "—"}
          </Text>
          <Text size="sm">
            <strong>Adequacy:</strong> {report.adequacy ?? "—"}
          </Text>
          <Text size="sm">
            <strong>Screening:</strong> {report.screening_findings ?? "—"}
          </Text>
          <Text size="sm">
            <strong>Bethesda:</strong> {report.bethesda_category ?? "—"}
          </Text>
          <Text size="sm">
            <strong>Diagnosis:</strong> {report.diagnosis ?? "—"}
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
            if (formOpen) reset(cytologyDefaults);
          }}
        >
          {t("newCytologyReport")}
        </Button>
      )}

      {formOpen && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateCytologyReport)}>
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
          <TextInput
            label={t("label.clinicalIndication")}
            error={errors.clinical_indication?.message}
            {...register("clinical_indication")}
          />
          <Group grow>
            <TextInput
              label={t("label.adequacy")}
              error={errors.adequacy?.message}
              {...register("adequacy")}
            />
            <Controller
              control={control}
              name="bethesda_category"
              render={({ field }) => (
                <Select
                  label={t("label.bethesdaCategory")}
                  data={labBethesdaCategoryOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.bethesda_category?.message}
                  clearable
                  searchable
                />
              )}
            />
          </Group>
          <Textarea
            label={t("label.screeningFindings")}
            autosize
            minRows={2}
            error={errors.screening_findings?.message}
            {...register("screening_findings")}
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
          </Group>
          <Textarea label={t("notes")} error={errors.notes?.message} {...register("notes")} />
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save Report
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
