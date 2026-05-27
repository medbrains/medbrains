import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Group, Select, Stack, TextInput } from "@mantine/core";
import type { OrderBasketLabFormInput } from "@medbrains/schemas";
import { orderBasketLabFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { BasketItem, BasketLabItem, LabTestCatalog } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { labPriorityOptions } from "../../../forms/orderBasket.form";
import { LabTestSearchSelect } from "../../LabTestSearchSelect";

interface LabPickerFormProps {
  onAdd: (item: BasketItem) => void;
}

export function LabPickerForm({ onAdd }: LabPickerFormProps) {
  const [test, setTest] = useState<LabTestCatalog | undefined>();
  const canAddLab = useHasPermission(P.LAB.ORDERS_CREATE);
  const { control, register, reset, handleSubmit } = useForm<OrderBasketLabFormInput>({
    resolver: zodResolver(orderBasketLabFormSchema),
    defaultValues: {
      test_id: "",
      priority: "routine",
      indication: "",
      notes: "",
    },
  });

  const resetForm = () => {
    setTest(undefined);
    reset({
      test_id: "",
      priority: "routine",
      indication: "",
      notes: "",
    });
  };

  const handleAdd = (values: OrderBasketLabFormInput) => {
    if (!test || !canAddLab) return;
    const item: BasketLabItem = {
      kind: "lab",
      test_id: test.id,
      priority: values.priority,
      indication: values.indication.trim() || null,
      notes: values.notes.trim() || null,
    };
    onAdd(item);
    resetForm();
  };

  return (
    <Stack component="form" gap="xs" onSubmit={handleSubmit(handleAdd)}>
      <Controller
        control={control}
        name="test_id"
        render={({ field }) => (
          <LabTestSearchSelect
            value={field.value}
            onChange={(id, selectedTest) => {
              field.onChange(id);
              setTest(selectedTest);
            }}
          />
        )}
      />
      <Group grow>
        <Controller
          control={control}
          name="priority"
          render={({ field }) => (
            <Select
              label="Priority"
              data={labPriorityOptions}
              value={field.value}
              onChange={(value) => value && field.onChange(value)}
            />
          )}
        />
        <TextInput label="Indication" placeholder="optional" {...register("indication")} />
      </Group>
      <TextInput label="Notes" placeholder="optional" {...register("notes")} />
      <Group justify="flex-end">
        <Button type="submit" disabled={!test || !canAddLab}>
          Add to basket
        </Button>
      </Group>
    </Stack>
  );
}
