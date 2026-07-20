// Pharmacy-finance CloseDrawerModal — split from pharmacy-finance.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Modal, NumberInput, Stack, Text, Textarea } from "@mantine/core";
import type { PharmacyCashDrawerCloseFormInput } from "@medbrains/schemas";
import { pharmacyCashDrawerCloseFormSchema } from "@medbrains/schemas";
import type { FieldAccessLevel } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui";
import { pharmacyFinanceService } from "@/services/pharmacyFinance.service";
import type { CashDrawerRow } from "./shared";
import { canEditFinanceAmount, financeAmountText } from "./shared";

export function CloseDrawerModal({
  drawer,
  onClose,
  onClosed,
  amountAccess,
}: {
  drawer: CashDrawerRow | null;
  onClose: () => void;
  onClosed: () => void;
  amountAccess: FieldAccessLevel;
}) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PharmacyCashDrawerCloseFormInput>({
    resolver: zodResolver(pharmacyCashDrawerCloseFormSchema),
    defaultValues: { actual_close_amount: 0, variance_reason: "" },
  });

  const close = useMutation({
    mutationFn: (values: PharmacyCashDrawerCloseFormInput) => {
      if (!drawer) throw new Error("no drawer");
      return pharmacyFinanceService.closeCashDrawer(drawer.id, {
        actual_close_amount: Number(values.actual_close_amount),
        variance_reason: values.variance_reason.trim() || undefined,
      });
    },
    onSuccess: () => {
      onClosed();
      onClose();
      reset({ actual_close_amount: 0, variance_reason: "" });
    },
  });
  const closeModal = () => {
    reset({ actual_close_amount: 0, variance_reason: "" });
    onClose();
  };
  const canEditAmount = canEditFinanceAmount(amountAccess);

  return (
    <Modal opened={drawer !== null} onClose={closeModal} title="Close cash drawer">
      <form onSubmit={handleSubmit((values) => close.mutate(values))}>
        <Stack>
          <Text size="sm" c="dimmed">
            Opening float: {financeAmountText(amountAccess, drawer?.opening_float)}. Variance &gt;
            ₹100 requires sign-off.
          </Text>
          <Controller
            control={control}
            name="actual_close_amount"
            render={({ field }) => (
              <NumberInput
                label="Actual cash counted (₹)"
                value={field.value}
                onChange={(value) => field.onChange(typeof value === "number" ? value : 0)}
                min={0}
                step={100}
                disabled={!canEditAmount}
                error={errors.actual_close_amount?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="variance_reason"
            render={({ field }) => (
              <Textarea label="Variance reason (optional)" minRows={2} {...field} />
            )}
          />
          <Group justify="flex-end">
            <Button
              tone="primary"
              type="submit"
              loading={close.isPending}
              disabled={!canEditAmount}
            >
              Close
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

// ── Petty Cash Tab ──────────────────────────────────────────────────
