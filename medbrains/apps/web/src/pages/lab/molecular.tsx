// Lab MolecularSection — split from lab.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { LabMolecularReportFormInput } from "@medbrains/schemas";
import { labMolecularReportFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateMolecularReportRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Button } from "@/components/ui";
import {
  labMolecularResultInterpretationOptions,
  labMolecularTestMethodOptions,
  labOptionalNumber,
  labOptionalText,
} from "@/forms/lab.form";
import { labService } from "@/services/lab.service";

export function MolecularSection() {
  const { t } = useTranslation("lab");
  const canCreate = useHasPermission(P.LAB.SPECIALIZED_CREATE);
  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const [lookupOrderId, setLookupOrderId] = useState("");
  const molecularDefaults: LabMolecularReportFormInput = {
    order_id: "",
    patient_id: "",
    test_method: "",
    target_gene: "",
    ct_value: "",
    result_interpretation: "",
    quantitative_value: "",
    quantitative_unit: "",
    kit_name: "",
    kit_lot: "",
    notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<LabMolecularReportFormInput>({
    resolver: zodResolver(labMolecularReportFormSchema),
    defaultValues: molecularDefaults,
  });

  const { data: report } = useQuery({
    queryKey: ["lab-molecular", lookupOrderId],
    queryFn: () => labService.getMolecularReport(lookupOrderId),
    enabled: !!lookupOrderId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateMolecularReportRequest) => labService.createMolecularReport(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-molecular"] });
      formHandlers.close();
      reset(molecularDefaults);
      notifications.show({
        title: "Report created",
        message: "Molecular report saved",
        color: "success",
      });
    },
  });

  const handleCreateMolecularReport = (values: LabMolecularReportFormInput) => {
    createMutation.mutate({
      order_id: values.order_id.trim(),
      patient_id: values.patient_id.trim(),
      test_method: labOptionalText(values.test_method),
      target_gene: labOptionalText(values.target_gene),
      ct_value: labOptionalNumber(values.ct_value),
      result_interpretation: labOptionalText(values.result_interpretation),
      quantitative_value: labOptionalNumber(values.quantitative_value),
      quantitative_unit: labOptionalText(values.quantitative_unit),
      kit_name: labOptionalText(values.kit_name),
      kit_lot: labOptionalText(values.kit_lot),
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
          <Text fw={600}>{t("molecularPcrReport")}</Text>
          <Text size="sm">
            <strong>Method:</strong> {report.test_method ?? "—"}
          </Text>
          <Text size="sm">
            <strong>Target Gene:</strong> {report.target_gene ?? "—"}
          </Text>
          <Text size="sm">
            <strong>Ct Value:</strong> {report.ct_value ?? "—"}
          </Text>
          <Text size="sm">
            <strong>Interpretation:</strong> {report.result_interpretation ?? "—"}
          </Text>
          <Text size="sm">
            <strong>Kit:</strong> {report.kit_name ?? "—"} (Lot: {report.kit_lot ?? "—"})
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
            if (formOpen) reset(molecularDefaults);
          }}
        >
          {t("newMolecularReport")}
        </Button>
      )}

      {formOpen && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateMolecularReport)}>
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
              name="test_method"
              render={({ field }) => (
                <Select
                  label={t("label.testMethod")}
                  data={labMolecularTestMethodOptions}
                  placeholder={t("placeholder.selectMethod")}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.test_method?.message}
                  clearable
                  searchable
                />
              )}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t("label.targetGene")}
              error={errors.target_gene?.message}
              {...register("target_gene")}
            />
            <Controller
              control={control}
              name="ct_value"
              render={({ field }) => (
                <NumberInput
                  label={t("label.ctValue")}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.ct_value?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="result_interpretation"
              render={({ field }) => (
                <Select
                  label={t("label.interpretation")}
                  data={labMolecularResultInterpretationOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.result_interpretation?.message}
                  clearable
                  searchable
                />
              )}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t("label.kitName")}
              error={errors.kit_name?.message}
              {...register("kit_name")}
            />
            <TextInput
              label={t("label.kitLot")}
              error={errors.kit_lot?.message}
              {...register("kit_lot")}
            />
            <Controller
              control={control}
              name="quantitative_value"
              render={({ field }) => (
                <NumberInput
                  label={t("label.quantitativeValue")}
                  decimalScale={4}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.quantitative_value?.message}
                />
              )}
            />
            <TextInput
              label={t("unit")}
              error={errors.quantitative_unit?.message}
              {...register("quantitative_unit")}
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

// ══════════════════════════════════════════════════════════
//  B2B Tab (Phase 3)
// ══════════════════════════════════════════════════════════
