// Radiology CreateOrderDrawer — split from radiology.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Checkbox, Drawer, Select, Stack, Switch, Textarea, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { RadiologyOrderFormInput } from "@medbrains/schemas";
import { radiologyOrderFormSchema } from "@medbrains/schemas";
import type { CreateRadiologyOrderRequest, RadiologyModality } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useClinicalEmit } from "@/components";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Button } from "@/components/ui";
import { radiologyOptionalText, radiologyPriorityOptions } from "@/forms/radiology.form";
import { radiologyService } from "@/services/radiology.service";

export function CreateOrderDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const emit = useClinicalEmit();

  const { data: modalities } = useQuery({
    queryKey: ["radiology-modalities"],
    queryFn: () => radiologyService.listRadiologyModalities(),
  });

  const orderDefaults: RadiologyOrderFormInput = {
    patient_id: "",
    modality_id: "",
    body_part: "",
    clinical_indication: "",
    priority: "routine",
    contrast_required: false,
    pregnancy_checked: false,
    allergy_flagged: false,
    notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RadiologyOrderFormInput>({
    resolver: zodResolver(radiologyOrderFormSchema),
    defaultValues: orderDefaults,
  });
  const patientId = watch("patient_id");
  const contrastRequired = watch("contrast_required");

  const { data: contrastScreen } = useQuery({
    queryKey: ["contrast-screening", patientId],
    queryFn: () => radiologyService.contrastScreening({ patient_id: patientId }),
    enabled: !!patientId && contrastRequired,
  });

  const { data: cumulativeDose } = useQuery({
    queryKey: ["cumulative-dose", patientId],
    queryFn: () => radiologyService.cumulativeDose(patientId),
    enabled: !!patientId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateRadiologyOrderRequest) => radiologyService.createRadiologyOrder(data),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["radiology-orders"] });
      notifications.show({ title: "Order created", message: "", color: "success" });
      emit("order.created", {
        body_part: result.body_part,
        clinical_indication: result.clinical_indication,
        contrast_required: result.contrast_required,
        encounter_id: result.encounter_id,
        modality_id: result.modality_id,
        order_id: result.id,
        order_type: "radiology",
        patient_id: result.patient_id,
        pregnancy_checked: result.pregnancy_checked,
        priority: result.priority,
      });
      reset(orderDefaults);
      onClose();
    },
  });

  const modalityOptions = (modalities ?? [])
    .filter((m: RadiologyModality) => m.is_active)
    .map((m: RadiologyModality) => ({ value: m.id, label: `${m.code} — ${m.name}` }));

  const handleCreateOrder = (values: RadiologyOrderFormInput) => {
    createMutation.mutate({
      patient_id: values.patient_id.trim(),
      modality_id: values.modality_id.trim(),
      body_part: radiologyOptionalText(values.body_part),
      clinical_indication: radiologyOptionalText(values.clinical_indication),
      priority: values.priority,
      notes: radiologyOptionalText(values.notes),
      contrast_required: values.contrast_required,
      pregnancy_checked: values.pregnancy_checked,
      allergy_flagged: values.allergy_flagged,
    });
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="New Radiology Order"
      position="right"
      size="xl"
    >
      <Stack component="form" onSubmit={handleSubmit(handleCreateOrder)}>
        <Controller
          control={control}
          name="patient_id"
          render={({ field }) => (
            <PatientSearchSelect
              value={field.value}
              onChange={field.onChange}
              error={errors.patient_id?.message}
              required
            />
          )}
        />
        <PatientContextBanner patientId={patientId} hideLoadingState />
        <Controller
          control={control}
          name="modality_id"
          render={({ field }) => (
            <Select
              label="Modality"
              required
              data={modalityOptions}
              value={field.value || null}
              onChange={(value) => field.onChange(value ?? "")}
              error={errors.modality_id?.message}
              searchable
            />
          )}
        />
        <TextInput label="Body Part" error={errors.body_part?.message} {...register("body_part")} />
        <Textarea
          label="Clinical Indication"
          error={errors.clinical_indication?.message}
          {...register("clinical_indication")}
        />
        <Controller
          control={control}
          name="priority"
          render={({ field }) => (
            <Select
              label="Priority"
              data={radiologyPriorityOptions}
              value={field.value}
              onChange={(value) => field.onChange(value ?? "routine")}
              error={errors.priority?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="contrast_required"
          render={({ field }) => (
            <Switch
              label="Contrast Required"
              checked={field.value}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
              error={errors.contrast_required?.message}
            />
          )}
        />
        {contrastRequired && contrastScreen && (
          <Alert
            tone={
              contrastScreen.clearance === "hold_review"
                ? "danger"
                : contrastScreen.clearance === "proceed_with_caution"
                  ? "warning"
                  : "success"
            }
            title={`Pre-contrast screening — ${contrastScreen.clearance.replace(/_/g, " ")}${
              contrastScreen.egfr != null ? ` · eGFR ${Math.round(contrastScreen.egfr)}` : ""
            }`}
          >
            {contrastScreen.flags.length > 0
              ? contrastScreen.flags.join(" ")
              : "No contrast-safety concerns from renal function on record."}
          </Alert>
        )}
        {cumulativeDose?.near_threshold && (
          <Alert
            tone={cumulativeDose.over_threshold ? "danger" : "warning"}
            title={`Cumulative radiation ≈ ${Math.round(cumulativeDose.estimated_effective_msv)} mSv over ${cumulativeDose.study_count} CT stud${cumulativeDose.study_count === 1 ? "y" : "ies"}`}
          >
            {cumulativeDose.over_threshold
              ? `Estimated cumulative effective dose has reached the ${cumulativeDose.review_threshold_msv} mSv review level — justify further imaging and consider a non-ionising alternative (US/MRI).`
              : "Approaching the cumulative-dose review level — justify further ionising imaging and consider alternatives."}
          </Alert>
        )}
        <Controller
          control={control}
          name="pregnancy_checked"
          render={({ field }) => (
            <Checkbox
              label="Pregnancy Verified"
              checked={field.value}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
              error={errors.pregnancy_checked?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="allergy_flagged"
          render={({ field }) => (
            <Checkbox
              label="Allergy Flagged"
              checked={field.value}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
              error={errors.allergy_flagged?.message}
            />
          )}
        />
        <Textarea label="Notes" error={errors.notes?.message} {...register("notes")} />
        <Button tone="primary" type="submit" loading={createMutation.isPending}>
          Create Order
        </Button>
      </Stack>
    </Drawer>
  );
}

// ══════════════════════════════════════════════════════════
//  Order Detail Drawer
// ══════════════════════════════════════════════════════════
