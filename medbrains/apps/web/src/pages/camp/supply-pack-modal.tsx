/**
 * Correct a camp supply row: planned and packed quantity, the shortage note,
 * and for medicines the batch and expiry. A camp cannot be activated while a
 * row is short or a packed medicine lacks batch or expiry, and none of these
 * could be changed after the row was first added.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Stack } from "@mantine/core";
import type { CampSupplyItem } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Input, Modal, toast } from "@/components/ui";
import { campService } from "@/services/camp.service";

const packSchema = z
  .object({
    planned_qty: z.number().min(0, "Planned quantity cannot be negative"),
    packed_qty: z.number().min(0, "Packed quantity cannot be negative"),
    shortage_notes: z.string().trim().max(500),
    batch_no: z.string().trim().max(60),
    expiry_date: z.string(),
    is_medicine: z.boolean(),
  })
  .refine((v) => !v.is_medicine || v.packed_qty === 0 || v.batch_no.length > 0, {
    message: "A packed medicine needs its batch number",
    path: ["batch_no"],
  })
  .refine((v) => !v.is_medicine || v.packed_qty === 0 || v.expiry_date.length > 0, {
    message: "A packed medicine needs its expiry date",
    path: ["expiry_date"],
  });
type PackForm = z.infer<typeof packSchema>;

interface SupplyPackModalProps {
  campId: string;
  item: CampSupplyItem;
  onClose: () => void;
}

export function SupplyPackModal({ campId, item, onClose }: SupplyPackModalProps) {
  const queryClient = useQueryClient();
  const { control, handleSubmit, register, formState } = useForm<PackForm>({
    resolver: zodResolver(packSchema),
    defaultValues: {
      planned_qty: Number(item.planned_qty) || 0,
      packed_qty: Number(item.packed_qty) || 0,
      shortage_notes: item.shortage_notes ?? "",
      batch_no: item.batch_no ?? "",
      expiry_date: item.expiry_date ?? "",
      is_medicine: item.category === "medicine",
    },
  });
  const save = useMutation({
    mutationFn: (form: PackForm) =>
      campService.updateCampSupplyItem(item.id, {
        planned_qty: form.planned_qty,
        packed_qty: form.packed_qty,
        // An emptied note is sent empty, which clears the shortage it raised.
        shortage_notes: form.shortage_notes,
        batch_no: form.batch_no || undefined,
        expiry_date: form.expiry_date || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["camp-remote-operations", campId] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Supply not saved" }),
  });
  const errors = formState.errors;

  return (
    <Modal opened onClose={onClose} title={`Supply — ${item.item_name}`}>
      <Stack gap="sm">
        <Group grow>
          {(["planned_qty", "packed_qty"] as const).map((name) => (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({ field }) => (
                <NumberInput
                  label={`${name === "planned_qty" ? "Planned" : "Packed"} quantity${
                    item.unit ? ` (${item.unit})` : ""
                  }`}
                  min={0}
                  value={field.value}
                  onChange={(v) => field.onChange(Number(v) || 0)}
                  error={errors[name]?.message}
                />
              )}
            />
          ))}
        </Group>
        {item.category === "medicine" && (
          <Group grow>
            <Input
              label="Batch number"
              error={errors.batch_no?.message}
              {...register("batch_no")}
            />
            <Input
              label="Expiry date"
              type="date"
              error={errors.expiry_date?.message}
              {...register("expiry_date")}
            />
          </Group>
        )}
        <Input
          label="Shortage note"
          description="Clear it once the shortage is resolved."
          error={errors.shortage_notes?.message}
          {...register("shortage_notes")}
        />
        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            loading={save.isPending}
            onClick={() => void handleSubmit((form) => save.mutate(form))()}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
