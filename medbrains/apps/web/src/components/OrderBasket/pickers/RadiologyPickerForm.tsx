import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Checkbox, Group, Select, Stack, TextInput } from "@mantine/core";
import type { OrderBasketRadiologyFormInput } from "@medbrains/schemas";
import { orderBasketRadiologyFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { BasketItem, BasketRadiologyItem, RadiologyExamListItem } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { type BodySite, formatBodySite } from "@/components/BodySite/anatomy-atlas";
import { BodySitePicker } from "@/components/BodySite/BodySitePicker";
import { RadiologyExamSelect } from "@/components/RadiologyExamSelect";
import { Alert } from "@/components/ui";
import { radiologyPriorityOptions } from "@/forms/orderBasket.form";
import { examOrderDefaults } from "@/lib/radiology-exams";
import { modalityLoadError, toModalityOptions } from "@/lib/radiology-modalities";
import { clinicalSupportService } from "@/services/clinicalSupport.service";

interface RadiologyPickerFormProps {
  onAdd: (item: BasketItem) => void;
}

export function RadiologyPickerForm({ onAdd }: RadiologyPickerFormProps) {
  const canAddRadiology = useHasPermission(P.RADIOLOGY.ORDERS_CREATE);
  // The picked site's code and side, beside the words the form holds.
  const [site, setSite] = useState<BodySite | null>(null);
  const [exam, setExam] = useState<RadiologyExamListItem | null>(null);
  const {
    control,
    register,
    reset,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OrderBasketRadiologyFormInput>({
    resolver: zodResolver(orderBasketRadiologyFormSchema),
    defaultValues: {
      modality_id: "",
      body_part: "",
      clinical_indication: "",
      priority: "routine",
      contrast_required: false,
      pregnancy_checked: false,
      allergy_flagged: false,
      notes: "",
    },
  });

  const {
    data: modalities = [],
    isLoading: modalitiesLoading,
    error: modalitiesError,
  } = useQuery({
    queryKey: ["radiology-modalities"],
    queryFn: () => clinicalSupportService.listRadiologyModalities(),
    enabled: canAddRadiology,
    staleTime: 60_000,
  });

  const modalityId = watch("modality_id");
  const pickExam = (next: RadiologyExamListItem | null) => {
    setExam(next);
    if (!next) return;
    const defaults = examOrderDefaults(next);
    if (defaults.site) {
      setSite(defaults.site);
      setValue("body_part", defaults.site.label);
    }
    setValue("contrast_required", defaults.contrastRequired);
  };

  const resetForm = () => {
    setSite(null);
    setExam(null);
    reset({
      modality_id: "",
      body_part: "",
      clinical_indication: "",
      priority: "routine",
      contrast_required: false,
      pregnancy_checked: false,
      allergy_flagged: false,
      notes: "",
    });
  };

  const handleAdd = (values: OrderBasketRadiologyFormInput) => {
    if (!canAddRadiology) return;
    const item: BasketRadiologyItem = {
      kind: "radiology",
      modality_id: values.modality_id,
      exam_id: exam?.id ?? null,
      body_part: site ? formatBodySite(site) : values.body_part.trim() || null,
      body_part_code: site?.code ?? null,
      body_part_laterality: site?.laterality ?? null,
      clinical_indication: values.clinical_indication.trim() || null,
      priority: values.priority,
      scheduled_at: null,
      contrast_required: values.contrast_required || null,
      pregnancy_checked: values.pregnancy_checked || null,
      allergy_flagged: values.allergy_flagged || null,
      notes: values.notes.trim() || null,
    };
    onAdd(item);
    resetForm();
  };

  return (
    <Stack component="form" gap="xs" onSubmit={handleSubmit(handleAdd)}>
      <Controller
        control={control}
        name="modality_id"
        render={({ field }) => (
          <Select
            label="Modality"
            placeholder="X-ray, CT, MRI, US, etc."
            data={toModalityOptions(modalities)}
            value={field.value || null}
            onChange={(value) => {
              field.onChange(value ?? "");
              setExam(null);
            }}
            error={
              errors.modality_id?.message ??
              modalityLoadError(modalities, modalitiesLoading, modalitiesError)
            }
            nothingFoundMessage="No modality by that name"
            searchable
            required
          />
        )}
      />
      <RadiologyExamSelect modalityId={modalityId} value={exam?.id ?? ""} onChange={pickExam} />
      {exam?.preparation && (
        <Alert tone="info" title="Patient preparation">
          {exam.preparation}
        </Alert>
      )}
      <Group grow>
        <Controller
          control={control}
          name="body_part"
          render={({ field }) => (
            <BodySitePicker
              label="Body part"
              placeholder="e.g. Chest, Left knee"
              value={
                site ?? (field.value ? { label: field.value, code: null, laterality: null } : null)
              }
              onChange={(next) => {
                setSite(next);
                field.onChange(next?.label ?? "");
              }}
            />
          )}
        />
        <Controller
          control={control}
          name="priority"
          render={({ field }) => (
            <Select
              label="Priority"
              data={radiologyPriorityOptions}
              value={field.value}
              onChange={(value) => value && field.onChange(value)}
            />
          )}
        />
      </Group>
      <TextInput label="Clinical indication" {...register("clinical_indication")} />
      <Group>
        <Controller
          control={control}
          name="contrast_required"
          render={({ field }) => (
            <Checkbox
              label="Contrast required"
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />
        <Controller
          control={control}
          name="pregnancy_checked"
          render={({ field }) => (
            <Checkbox
              label="Pregnancy checked"
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />
        <Controller
          control={control}
          name="allergy_flagged"
          render={({ field }) => (
            <Checkbox
              label="Allergy flagged"
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />
      </Group>
      <TextInput label="Notes" {...register("notes")} />
      <Group justify="flex-end">
        <Button type="submit" disabled={!canAddRadiology}>
          Add to basket
        </Button>
      </Group>
    </Stack>
  );
}
