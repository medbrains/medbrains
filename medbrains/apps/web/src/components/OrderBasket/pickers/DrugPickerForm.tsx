import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Group, NumberInput, Select, Stack, TextInput } from "@mantine/core";
import type { OrderBasketDrugFormInput } from "@medbrains/schemas";
import { orderBasketDrugFormSchema } from "@medbrains/schemas";
import type { BasketDrugItem, BasketItem, PharmacyCatalog } from "@medbrains/types";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  drugFrequencyOptions,
  drugRouteOptions,
  formNumberOrFallback,
} from "../../../forms/orderBasket.form";
import { DrugSearchSelect } from "../../DrugSearchSelect";

interface DrugPickerFormProps {
  onAdd: (item: BasketItem) => void;
}

export function DrugPickerForm({ onAdd }: DrugPickerFormProps) {
  const [drug, setDrug] = useState<PharmacyCatalog | undefined>();
  const {
    control,
    register,
    reset,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<OrderBasketDrugFormInput>({
    resolver: zodResolver(orderBasketDrugFormSchema),
    mode: "onChange",
    defaultValues: {
      drug_id: "",
      dose: "",
      frequency: "BD",
      route: "PO",
      duration_days: 5,
      quantity: 10,
      indication: "",
      schedule_x_serial: "",
      is_schedule_x: false,
    },
  });

  const isScheduleX =
    drug?.drug_schedule != null && String(drug.drug_schedule).toUpperCase() === "X";

  const resetForm = () => {
    setDrug(undefined);
    reset({
      drug_id: "",
      dose: "",
      frequency: "BD",
      route: "PO",
      duration_days: 5,
      quantity: 10,
      indication: "",
      schedule_x_serial: "",
      is_schedule_x: false,
    });
  };

  const handleAdd = (values: OrderBasketDrugFormInput) => {
    if (!drug) return;
    const item: BasketDrugItem = {
      kind: "drug",
      drug_id: drug.id,
      drug_name: drug.name,
      dose: values.dose.trim(),
      frequency: values.frequency,
      route: values.route,
      duration_days: formNumberOrFallback(values.duration_days, 0),
      indication: values.indication.trim() || null,
      quantity: formNumberOrFallback(values.quantity, 1),
      unit_price: String(drug.base_price ?? "0"),
      schedule_x_serial: isScheduleX ? values.schedule_x_serial.trim() || null : null,
    };
    onAdd(item);
    resetForm();
  };

  return (
    <Stack component="form" gap="xs" onSubmit={handleSubmit(handleAdd)}>
      <Controller
        control={control}
        name="drug_id"
        render={({ field }) => (
          <DrugSearchSelect
            value={field.value}
            onChange={(id, selectedDrug) => {
              field.onChange(id);
              setDrug(selectedDrug);
              setValue(
                "is_schedule_x",
                selectedDrug?.drug_schedule != null &&
                  String(selectedDrug.drug_schedule).toUpperCase() === "X",
                { shouldDirty: true, shouldValidate: true },
              );
            }}
          />
        )}
      />
      <Group grow>
        <TextInput
          label="Dose"
          placeholder="e.g., 500mg"
          error={errors.dose?.message}
          {...register("dose")}
          required
        />
        <Controller
          control={control}
          name="frequency"
          render={({ field }) => (
            <Select
              label="Frequency"
              data={drugFrequencyOptions}
              value={field.value}
              onChange={(value) => value && field.onChange(value)}
              required
            />
          )}
        />
      </Group>
      <Group grow>
        <Controller
          control={control}
          name="route"
          render={({ field }) => (
            <Select
              label="Route"
              data={drugRouteOptions}
              value={field.value}
              onChange={(value) => value && field.onChange(value)}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="duration_days"
          render={({ field }) => (
            <NumberInput
              label="Duration (days)"
              value={field.value}
              onChange={field.onChange}
              error={errors.duration_days?.message}
              min={0}
              max={365}
            />
          )}
        />
        <Controller
          control={control}
          name="quantity"
          render={({ field }) => (
            <NumberInput
              label="Quantity"
              value={field.value}
              onChange={field.onChange}
              error={errors.quantity?.message}
              min={1}
            />
          )}
        />
      </Group>
      <TextInput
        label="Indication"
        placeholder="optional — diagnosis or reason"
        {...register("indication")}
      />
      {isScheduleX && (
        <TextInput
          label="Schedule X paper Rx serial number"
          placeholder="required for Schedule X"
          error={errors.schedule_x_serial?.message}
          {...register("schedule_x_serial")}
          required
        />
      )}
      <Group justify="flex-end">
        <Button type="submit" disabled={!drug}>
          Add to basket
        </Button>
      </Group>
    </Stack>
  );
}
