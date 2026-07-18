// Pharmacy CreatePharmacyReturnModal — split from pharmacy.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Card, Group, Modal, MultiSelect, NumberInput, Stack, Text, Textarea } from "@mantine/core";
import type { PharmacyReturnRequestFormInput } from "@medbrains/schemas";
import { pharmacyReturnRequestFormSchema } from "@medbrains/schemas";
import { IconClock, IconLock, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Badge, Button, IconButton, toast } from "@/components/ui";
import { formIntegerOrFallback, optionalFormText } from "@/forms/pharmacy.form";
import { pharmacyService } from "@/services/pharmacy.service";
import { normalizeReturnableItems, PharmacyPatientContext } from "./shared";

export function CreatePharmacyReturnModal({
  opened,
  onClose,
  canViewPatientRecord,
}: {
  opened: boolean;
  onClose: () => void;
  canViewPatientRecord: boolean;
}) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<PharmacyReturnRequestFormInput>({
    resolver: zodResolver(pharmacyReturnRequestFormSchema),
    defaultValues: {
      patient_id: "",
      items: [],
    },
  });
  const {
    fields: selectedReturnFields,
    replace: replaceReturnItems,
    remove: removeReturnItem,
  } = useFieldArray({
    control,
    name: "items",
  });

  const patientId = watch("patient_id");
  const selectedReturnItems = watch("items") ?? [];
  const selectedOrderItemIds = selectedReturnItems.map((item) => item.order_item_id);

  const { data: patientOrders = [], isLoading: patientOrdersLoading } = useQuery({
    queryKey: ["pharmacy", "patient-orders", patientId],
    queryFn: () => pharmacyService.listPatientOrdersForReturn(patientId),
    enabled: canViewPatientRecord && patientId.length > 0,
  });

  const returnableItems = useMemo(
    () =>
      patientOrders
        .filter((order) => order.status === "dispensed")
        .flatMap((order) => normalizeReturnableItems(order)),
    [patientOrders],
  );

  const returnableItemById = useMemo(
    () => new Map(returnableItems.map((item) => [item.itemId, item])),
    [returnableItems],
  );
  const returnableItemOptions = useMemo(
    () =>
      returnableItems.map((item) => ({
        value: item.itemId,
        label: `${item.drugName} · remaining ${item.remainingQuantity}/${item.quantity} · ${new Date(
          item.orderDate,
        ).toLocaleDateString()}`,
      })),
    [returnableItems],
  );

  const createMutation = useMutation({
    mutationFn: (values: PharmacyReturnRequestFormInput) =>
      pharmacyService.createPharmacyReturns({
        patient_id: values.patient_id,
        items: values.items.map((item) => ({
          order_item_id: item.order_item_id,
          quantity_returned: formIntegerOrFallback(item.quantity_returned, 1),
          reason: optionalFormText(item.reason),
        })),
      }),
    onSuccess: (rows) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-returns"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-order-detail"] });
      toast.success(
        `${rows.length} return ${rows.length === 1 ? "line is" : "lines are"} waiting for approval`,
        { title: "Return requested" },
      );
      reset({ patient_id: "", items: [] });
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to request return", {
        title: "Return request failed",
      });
    },
  });

  function handleClose() {
    reset({ patient_id: "", items: [] });
    onClose();
  }

  function submitReturn(values: PharmacyReturnRequestFormInput) {
    for (const item of values.items) {
      const returnableItem = returnableItemById.get(item.order_item_id);
      const returnQuantity = formIntegerOrFallback(item.quantity_returned, 1);
      if (!returnableItem) {
        setError("items", {
          type: "validate",
          message: "One selected medicine is no longer available for return.",
        });
        return;
      }
      if (returnQuantity > returnableItem.remainingQuantity) {
        setError("items", {
          type: "validate",
          message: `${returnableItem.drugName} can return only ${returnableItem.remainingQuantity} more.`,
        });
        return;
      }
    }
    createMutation.mutate(values);
  }

  function updateSelectedMedicineIds(itemIds: string[]) {
    const currentById = new Map(selectedReturnItems.map((item) => [item.order_item_id, item]));
    replaceReturnItems(
      itemIds.map(
        (itemId) =>
          currentById.get(itemId) ?? {
            order_item_id: itemId,
            quantity_returned: 1,
            reason: "",
          },
      ),
    );
    clearErrors("items");
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Request Medicine Return" size="xl">
      {!canViewPatientRecord ? (
        <Stack>
          <Alert tone="warning" icon={<IconLock size={16} />}>
            Patient record access is required to select the dispensed medicine for a return.
          </Alert>
          <Group justify="flex-end">
            <Button tone="ghost" onClick={handleClose}>
              Close
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack component="form" onSubmit={handleSubmit(submitReturn)}>
          <Controller
            control={control}
            name="patient_id"
            render={({ field, fieldState }) => (
              <PatientSearchSelect
                label="Patient"
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  replaceReturnItems([]);
                  setValue("items", []);
                  clearErrors("items");
                }}
                error={fieldState.error?.message}
                required
              />
            )}
          />
          {patientId.length > 0 && (
            <PharmacyPatientContext
              patientId={patientId}
              canViewPatientRecord={canViewPatientRecord}
            />
          )}
          <MultiSelect
            label="Previous billed / dispensed medicines"
            placeholder={
              patientOrdersLoading ? "Loading dispensed medicines..." : "Select medicine lines"
            }
            data={returnableItemOptions}
            value={selectedOrderItemIds}
            onChange={updateSelectedMedicineIds}
            error={typeof errors.items?.message === "string" ? errors.items.message : undefined}
            disabled={!patientId || patientOrdersLoading}
            searchable
            clearable
            required
          />
          {patientId.length > 0 && !patientOrdersLoading && returnableItems.length === 0 && (
            <Alert tone="neutral" icon={<IconClock size={16} />}>
              No dispensed pharmacy medicines are available for return.
            </Alert>
          )}
          {selectedReturnFields.map((field, index) => {
            const selectedLine = selectedReturnItems[index];
            const returnableItem = returnableItemById.get(selectedLine?.order_item_id ?? "");
            return (
              <Card key={field.id} withBorder radius="sm" p="sm">
                <Stack gap="xs">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={2}>
                      <Text size="sm" fw={700}>
                        {returnableItem?.drugName ?? "Selected medicine"}
                      </Text>
                      <Group gap="xs">
                        <Badge size="xs" tone="info">
                          {returnableItem
                            ? new Date(returnableItem.orderDate).toLocaleDateString()
                            : "Order"}
                        </Badge>
                        <Badge size="xs" tone="neutral">
                          Batch {returnableItem?.batchNumber ?? "not captured"}
                        </Badge>
                        <Badge size="xs" tone="success">
                          Remaining {returnableItem?.remainingQuantity ?? 0}/
                          {returnableItem?.quantity ?? 0}
                        </Badge>
                      </Group>
                    </Stack>
                    <IconButton
                      size="sm"
                      tone="danger"
                      aria-label="Remove return line"
                      onClick={() => removeReturnItem(index)}
                    >
                      <IconTrash size={14} />
                    </IconButton>
                  </Group>
                  <Group grow align="flex-start">
                    <Controller
                      control={control}
                      name={`items.${index}.quantity_returned`}
                      render={({ field: quantityField, fieldState }) => (
                        <NumberInput
                          label="Return quantity"
                          min={1}
                          max={returnableItem?.remainingQuantity}
                          value={quantityField.value}
                          onChange={quantityField.onChange}
                          error={fieldState.error?.message}
                          required
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name={`items.${index}.reason`}
                      render={({ field: reasonField, fieldState }) => (
                        <Textarea
                          label="Reason"
                          placeholder="Wrong medicine, adverse event, patient refused, damaged strip..."
                          value={reasonField.value}
                          onChange={reasonField.onChange}
                          error={fieldState.error?.message}
                          autosize
                          minRows={1}
                        />
                      )}
                    />
                  </Group>
                </Stack>
              </Card>
            );
          })}
          <Group justify="flex-end">
            <Button tone="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              tone="primary"
              type="submit"
              loading={createMutation.isPending}
              disabled={selectedReturnItems.length === 0}
            >
              Submit {selectedReturnItems.length > 1 ? "Returns" : "Return"}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
