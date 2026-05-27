import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Collapse, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { OrderBasketDrugFormInput } from "@medbrains/schemas";
import { orderBasketDrugFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  BasketDrugItem,
  BasketItem,
  FoodTiming,
  PharmacyCatalog,
  TimeOfDay,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconChevronDown, IconChevronUp, IconClock } from "@tabler/icons-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { drugFrequencyOptions, formNumberOrFallback } from "../../../forms/orderBasket.form";
import { serializeTiming } from "../../../lib/medication-timing-utils";
import { MedicationTimingPicker } from "../../Clinical/MedicationTimingPicker";
import { DrugRxComposer } from "../../inputs/DrugRxComposer";
import { MedicineOrderLineCard } from "../../Pharmacy/MedicineOrderLineCard";

const ORDER_BASKET_FREQUENCY_OPTIONS = drugFrequencyOptions.map((option) => ({
  ...option,
  label:
    option.value === "OD"
      ? "OD (Once daily)"
      : option.value === "BD"
        ? "BD (Twice daily)"
        : option.value === "TDS"
          ? "TDS (Thrice daily)"
          : option.value === "QID"
            ? "QID (Four times)"
            : option.value === "PRN"
              ? "PRN (When required)"
              : option.value === "STAT"
                ? "STAT (Immediately)"
                : option.label,
}));

const ORDER_BASKET_ROUTE_OPTIONS = [
  { value: "PO", label: "PO (Oral)" },
  { value: "IV", label: "IV" },
  { value: "IM", label: "IM" },
  { value: "SC", label: "SC" },
  { value: "Inhalation", label: "Inhalation" },
  { value: "Topical", label: "Topical" },
  { value: "PR", label: "PR (Rectal)" },
  { value: "SL", label: "SL (Sublingual)" },
  { value: "Per NG", label: "Per NG" },
];

interface DrugPickerFormProps {
  onAdd: (item: BasketItem) => void;
}

export function DrugPickerForm({ onAdd }: DrugPickerFormProps) {
  const [drug, setDrug] = useState<PharmacyCatalog | undefined>();
  const canAddDrug = useHasPermission(P.PHARMACY.DISPENSING_CREATE);
  const [timingOpen, timingHandlers] = useDisclosure(false);
  const [foodTiming, setFoodTiming] = useState<FoodTiming>("any");
  const [timeSlots, setTimeSlots] = useState<TimeOfDay[]>([]);
  const [customInstruction, setCustomInstruction] = useState("");
  const {
    control,
    register,
    reset,
    setValue,
    watch,
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
  const preview = watch();
  const medicineLineValue = {
    catalog_item_id: preview.drug_id || undefined,
    drug_name: drug?.name ?? "",
    quantity: formNumberOrFallback(preview.quantity, 1),
    unit_price: Number(drug?.base_price ?? 0),
    tax_percent: Number(drug?.tax_percent ?? 0),
  };

  const resetForm = () => {
    setDrug(undefined);
    setFoodTiming("any");
    setTimeSlots([]);
    setCustomInstruction("");
    timingHandlers.close();
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
    if (!drug || !canAddDrug) return;
    const hasTiming = foodTiming !== "any" || timeSlots.length > 0 || customInstruction.trim();
    const item: BasketDrugItem = {
      kind: "drug",
      drug_id: drug.id,
      drug_name: drug.name,
      dose: values.dose.trim(),
      frequency: values.frequency,
      route: values.route,
      duration_days: formNumberOrFallback(values.duration_days, 0),
      indication: values.indication.trim() || null,
      instructions: hasTiming
        ? serializeTiming({
            food_timing: foodTiming !== "any" ? foodTiming : undefined,
            time_slots: timeSlots.length > 0 ? timeSlots : undefined,
            custom_instruction: customInstruction.trim() || undefined,
          })
        : null,
      quantity: formNumberOrFallback(values.quantity, 1),
      unit_price: String(drug.base_price ?? "0"),
      schedule_x_serial: isScheduleX ? values.schedule_x_serial.trim() || null : null,
    };
    onAdd(item);
    resetForm();
  };

  return (
    <Stack component="form" gap="xs" onSubmit={handleSubmit(handleAdd)}>
      <MedicineOrderLineCard
        value={medicineLineValue}
        index={0}
        priceLabel="Estimated unit price"
        readOnlyPrice
        onChange={(next) => {
          setValue("drug_id", next.catalog_item_id ?? "", {
            shouldDirty: true,
            shouldValidate: true,
          });
          setValue("quantity", next.quantity, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }}
        onDrugSelect={(selectedDrug) => {
          setDrug(selectedDrug);
          setValue(
            "is_schedule_x",
            selectedDrug?.drug_schedule != null &&
              String(selectedDrug.drug_schedule).toUpperCase() === "X",
            { shouldDirty: true, shouldValidate: true },
          );
        }}
      />
      {(errors.drug_id?.message || errors.quantity?.message) && (
        <Text size="xs" c="danger">
          {errors.drug_id?.message ?? errors.quantity?.message}
        </Text>
      )}
      <Group grow>
        <TextInput
          label="Dosage"
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
              data={ORDER_BASKET_FREQUENCY_OPTIONS}
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
              data={ORDER_BASKET_ROUTE_OPTIONS}
              value={field.value}
              onChange={(value) => value && field.onChange(value)}
              required
            />
          )}
        />
        <TextInput
          label="Duration (days)"
          inputMode="numeric"
          error={errors.duration_days?.message}
          {...register("duration_days")}
        />
      </Group>
      <TextInput
        label="Indication"
        placeholder="optional — diagnosis or reason"
        {...register("indication")}
      />
      <Button
        variant="subtle"
        size="xs"
        onClick={timingHandlers.toggle}
        leftSection={<IconClock size={14} />}
        rightSection={timingOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        style={{ alignSelf: "flex-start" }}
      >
        Timing & Instructions
      </Button>
      <Collapse expanded={timingOpen}>
        <MedicationTimingPicker
          foodTiming={foodTiming}
          onFoodTimingChange={setFoodTiming}
          timeSlots={timeSlots}
          onTimeSlotsChange={setTimeSlots}
          customInstruction={customInstruction}
          onCustomInstructionChange={setCustomInstruction}
          frequency={preview.frequency}
        />
      </Collapse>
      {(drug || preview.dose || preview.frequency || preview.duration_days) && (
        <DrugRxComposer
          rx={{
            drug: drug?.name ?? "Select medicine",
            dose: preview.dose || "dose",
            freq: preview.frequency || "frequency",
            duration: `${formNumberOrFallback(preview.duration_days, 0)} days`,
            instruction: preview.indication || customInstruction || undefined,
          }}
        />
      )}
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
        <Button type="submit" disabled={!drug || !canAddDrug}>
          Add to basket
        </Button>
      </Group>
    </Stack>
  );
}
