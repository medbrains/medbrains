// Pharmacy-finance OpenDrawerModal — split from pharmacy-finance.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Modal, NumberInput, Select, Stack, Textarea } from "@mantine/core";
import type { PharmacyCashDrawerOpenFormInput } from "@medbrains/schemas";
import { pharmacyCashDrawerOpenFormSchema } from "@medbrains/schemas";
import type { FieldAccessLevel } from "@medbrains/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";
import { pharmacyFinanceService } from "@/services/pharmacyFinance.service";
import { canEditFinanceAmount } from "./shared";

export function OpenDrawerModal({
  opened,
  onClose,
  onOpened,
  amountAccess,
}: {
  opened: boolean;
  onClose: () => void;
  onOpened: () => void;
  amountAccess: FieldAccessLevel;
}) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PharmacyCashDrawerOpenFormInput>({
    resolver: zodResolver(pharmacyCashDrawerOpenFormSchema),
    defaultValues: { pharmacy_location_id: "", opening_float: 0, notes: "" },
  });

  const { data: storeLocations = [] } = useQuery({
    queryKey: ["pharmacy-store-locations"],
    queryFn: () => pharmacyService.listStoreLocations(),
  });
  const locationOptions = storeLocations.map((store) => ({
    value: store.id,
    label: [store.name, store.location_type, store.code].filter(Boolean).join(" - "),
  }));

  const open = useMutation({
    mutationFn: (values: PharmacyCashDrawerOpenFormInput) =>
      pharmacyFinanceService.openCashDrawer({
        pharmacy_location_id: values.pharmacy_location_id,
        opening_float: Number(values.opening_float),
        notes: values.notes.trim() || undefined,
      }),
    onSuccess: () => {
      onOpened();
      reset({ pharmacy_location_id: "", opening_float: 0, notes: "" });
      onClose();
    },
  });
  const closeModal = () => {
    reset({ pharmacy_location_id: "", opening_float: 0, notes: "" });
    onClose();
  };
  const canEditAmount = canEditFinanceAmount(amountAccess);

  return (
    <Modal opened={opened} onClose={closeModal} title="Open cash drawer">
      <form onSubmit={handleSubmit((values) => open.mutate(values))}>
        <Stack>
          <Controller
            control={control}
            name="pharmacy_location_id"
            render={({ field }) => (
              <Select
                label="Pharmacy location"
                placeholder="Select the dispensing location"
                required
                searchable
                data={locationOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "")}
                error={errors.pharmacy_location_id?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="opening_float"
            render={({ field }) => (
              <NumberInput
                label="Opening float (₹)"
                value={field.value}
                onChange={(value) => field.onChange(typeof value === "number" ? value : 0)}
                min={0}
                step={100}
                disabled={!canEditAmount}
                error={errors.opening_float?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="notes"
            render={({ field }) => <Textarea label="Notes" minRows={2} {...field} />}
          />
          <Group justify="flex-end">
            <Button tone="primary" type="submit" loading={open.isPending} disabled={!canEditAmount}>
              Open
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
