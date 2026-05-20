import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Checkbox, Group, Select, Stack, TextInput } from "@mantine/core";
import type { OrderBasketRadiologyFormInput } from "@medbrains/schemas";
import { orderBasketRadiologyFormSchema } from "@medbrains/schemas";
import type { BasketItem, BasketRadiologyItem } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { radiologyPriorityOptions } from "../../../forms/orderBasket.form";
import { clinicalSupportService } from "../../../services/clinicalSupport.service";

interface RadiologyPickerFormProps {
  onAdd: (item: BasketItem) => void;
}

export function RadiologyPickerForm({ onAdd }: RadiologyPickerFormProps) {
  const {
    control,
    register,
    reset,
    handleSubmit,
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

  const { data: modalities = [] } = useQuery({
    queryKey: ["radiology-modalities"],
    queryFn: () => clinicalSupportService.listRadiologyModalities(),
    staleTime: 60_000,
  });

  const resetForm = () => {
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
    const item: BasketRadiologyItem = {
      kind: "radiology",
      modality_id: values.modality_id,
      body_part: values.body_part.trim() || null,
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
            data={modalities.map((m) => ({ value: m.id, label: m.name }))}
            value={field.value || null}
            onChange={(value) => field.onChange(value ?? "")}
            error={errors.modality_id?.message}
            searchable
            required
          />
        )}
      />
      <Group grow>
        <TextInput
          label="Body part"
          placeholder="e.g., Chest PA, Abdomen"
          {...register("body_part")}
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
        <Button type="submit">Add to basket</Button>
      </Group>
    </Stack>
  );
}
