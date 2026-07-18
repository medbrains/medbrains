// Pharmacy PharmacyOrderForm — split from pharmacy.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Card, Group, Stack, Text, Textarea } from "@mantine/core";
import type { PharmacyOrderFormInput } from "@medbrains/schemas";
import { pharmacyOrderFormSchema } from "@medbrains/schemas";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import type { CreatePharmacyOrderRequest, PharmacyOrderDetailResponse } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle, IconPill, IconPlus } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useClinicalEmit } from "@/components";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { MedicineOrderLineCard } from "@/components/Pharmacy/MedicineOrderLineCard";
import { Alert, Button, SignatureHero, toast } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";
import styles from "../pharmacy.module.scss";
import {
  draftTotals,
  newPharmacyOrderFormItem,
  PharmacyPatientContext,
  pharmacyOrderDefaults,
  pharmacyOrderEventItems,
  pharmacyOrderLineFromForm,
  pharmacyOrderPayloadFromForm,
  renderPharmacySensitiveCurrency,
} from "./shared";

export function PharmacyOrderForm({
  initialPatientId,
  canViewPatientRecord,
  onCancel,
  onSuccess,
}: {
  initialPatientId?: string;
  canViewPatientRecord: boolean;
  onCancel: () => void;
  onSuccess: (detail: PharmacyOrderDetailResponse) => void;
}) {
  const queryClient = useQueryClient();
  const emit = useClinicalEmit();
  const canOverrideSafety = useHasPermission(P.PHARMACY.SAFETY_OVERRIDE);
  const priceAccess = useFieldAccess("pharmacy.pricing.unit_price");
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PharmacyOrderFormInput>({
    resolver: zodResolver(pharmacyOrderFormSchema),
    defaultValues: pharmacyOrderDefaults(initialPatientId),
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });
  const patientId = watch("patient_id");
  const items = watch("items");

  const createMutation = useMutation({
    mutationFn: (data: CreatePharmacyOrderRequest) => pharmacyService.createPharmacyOrder(data),
    onSuccess: (detail) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-order-detail", detail.order.id] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({
        queryKey: ["patient-invoices", detail.order.patient_id],
      });
      toast.success("Pharmacy order placed and draft billing indent updated", {
        title: "Order created",
      });
      emit("order.created", {
        admission_id: detail.admission_id,
        dispensing_type: detail.order.dispensing_type,
        encounter_id: detail.order.encounter_id,
        items: pharmacyOrderEventItems(detail.items),
        order_id: detail.order.id,
        order_type: "pharmacy",
        patient_id: detail.order.patient_id,
        prescription_id: detail.order.prescription_id,
      });
      reset(pharmacyOrderDefaults(initialPatientId));
      onSuccess(detail);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create order", {
        title: "Order blocked",
      });
    },
  });

  const orderTotals = draftTotals(items.map(pharmacyOrderLineFromForm));
  const createError =
    createMutation.error instanceof Error ? createMutation.error.message : undefined;
  const submitOrder = handleSubmit((values) => {
    createMutation.mutate(pharmacyOrderPayloadFromForm(values));
  });

  return (
    <Card withBorder>
      <Stack component="form" onSubmit={submitOrder}>
        <SignatureHero
          compact
          eyebrow="Pharmacy"
          title="Medicine order"
          subtitle="Pick drugs with safety + billing checks, then submit"
          icon={<IconPill size={20} />}
        />
        <Controller
          control={control}
          name="patient_id"
          render={({ field, fieldState }) => (
            <PatientSearchSelect
              value={field.value}
              onChange={field.onChange}
              required
              error={fieldState.error?.message}
            />
          )}
        />
        <PharmacyPatientContext patientId={patientId} canViewPatientRecord={canViewPatientRecord} />
        {createError && (
          <Alert tone="danger" icon={<IconAlertTriangle size={16} />}>
            {createError}
          </Alert>
        )}
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <Textarea label="Notes" value={field.value} onChange={field.onChange} />
          )}
        />
        {canOverrideSafety && (
          <Controller
            control={control}
            name="safety_override_reason"
            render={({ field }) => (
              <Textarea
                label="Medication safety override reason"
                value={field.value}
                onChange={field.onChange}
                minRows={2}
              />
            )}
          />
        )}
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Medications
          </Text>
          {fields.map((field, idx) => (
            <Controller
              key={field.id}
              control={control}
              name={`items.${idx}`}
              render={({ field: itemField, fieldState }) => (
                <Stack gap={4}>
                  <MedicineOrderLineCard
                    value={pharmacyOrderLineFromForm(itemField.value)}
                    index={idx}
                    priceLabel="Unit price (ex-GST)"
                    className={styles.medicationCard}
                    removePermission={P.PHARMACY.DISPENSING_CREATE}
                    onChange={(next) => {
                      itemField.onChange({
                        ...itemField.value,
                        catalog_item_id: next.catalog_item_id ?? "",
                        drug_name: next.drug_name,
                        quantity: next.quantity,
                        unit_price: next.unit_price,
                        tax_percent: next.tax_percent ?? 0,
                      });
                    }}
                    canRemove={fields.length > 1}
                    onRemove={() => remove(idx)}
                  />
                  {fieldState.error && (
                    <Text size="xs" c="danger">
                      Complete medicine, quantity, and price before placing the order.
                    </Text>
                  )}
                </Stack>
              )}
            />
          ))}
        </Stack>
        {errors.items?.message && (
          <Text size="xs" c="danger">
            {errors.items.message}
          </Text>
        )}
        <Group justify="space-between">
          <Button
            size="xs"
            tone="secondary"
            leftSection={<IconPlus size={14} />}
            onClick={() => append(newPharmacyOrderFormItem())}
          >
            Add medicine
          </Button>
          <Stack gap={0} align="flex-end">
            <Text size="xs" c="dimmed">
              Subtotal {renderPharmacySensitiveCurrency(priceAccess, orderTotals.subtotal)} · GST{" "}
              {renderPharmacySensitiveCurrency(priceAccess, orderTotals.tax)}
            </Text>
            <Text fw={700}>
              Payable: {renderPharmacySensitiveCurrency(priceAccess, orderTotals.total)}
            </Text>
          </Stack>
        </Group>
        <Group justify="flex-end">
          <Button tone="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button tone="primary" type="submit" loading={createMutation.isPending}>
            Place Order
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
