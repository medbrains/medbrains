import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { IconReceiptRefund } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Input, Modal, NumberField } from "@/components/ui";
import { paymentsService } from "@/services/payments.service";

/** The note the server files on a payment an online gateway posted. */
export const ONLINE_PAYMENT_NOTE_PREFIX = "Online payment";

export function isOnlinePayment(notes: string | null | undefined): boolean {
  return notes?.startsWith(ONLINE_PAYMENT_NOTE_PREFIX) ?? false;
}

export function gatewayRefundSchema(max: number) {
  return z.object({
    amount: z
      .number({ message: "Enter the amount to refund" })
      .positive("Enter the amount to refund")
      .max(max, `At most ₹${max.toFixed(2)} can go back on this payment`)
      .refine((v) => Math.round(v * 100) === v * 100, "Use whole paise"),
    reason: z.string().trim().min(3, "Say why the money is going back"),
  });
}

type GatewayRefundForm = z.infer<ReturnType<typeof gatewayRefundSchema>>;

interface GatewayRefundModalProps {
  /** The bill's payment row the gateway posted. */
  paymentId: string;
  /** What is left to refund on it. */
  maxAmount: number;
  opened: boolean;
  onClose: () => void;
  onRefunded: () => void;
}

/** Send part or all of an online payment back to the card / UPI it came from. */
export function GatewayRefundModal({
  paymentId,
  maxAmount,
  opened,
  onClose,
  onRefunded,
}: GatewayRefundModalProps) {
  const { control, handleSubmit } = useForm<GatewayRefundForm>({
    resolver: zodResolver(gatewayRefundSchema(maxAmount)),
    defaultValues: { amount: maxAmount, reason: "" },
  });
  const refund = useMutation({
    mutationFn: (values: GatewayRefundForm) =>
      paymentsService.initiateRefund({
        payment_id: paymentId,
        amount: values.amount,
        reason: values.reason.trim(),
      }),
    onSuccess: () => {
      onRefunded();
      onClose();
    },
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Refund online payment">
      <Stack gap="sm">
        <Text size="sm">
          The money goes back to the card, UPI ID or bank it was paid from, and comes off the bill.
        </Text>
        <Controller
          control={control}
          name="amount"
          render={({ field, fieldState }) => (
            <NumberField
              label="Amount to refund"
              data-testid="field-refund-amount"
              value={field.value}
              onChange={(v) => field.onChange(typeof v === "number" ? v : Number(v))}
              decimalScale={2}
              min={0}
              prefix="₹"
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="reason"
          render={({ field, fieldState }) => (
            <Input
              label="Reason"
              data-testid="field-refund-reason"
              {...field}
              error={fieldState.error?.message}
            />
          )}
        />
        {refund.isError && (
          <Alert tone="danger" title="Refund not made">
            {refund.error.message}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button tone="tertiary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="danger"
            data-testid="btn-confirm-refund"
            loading={refund.isPending}
            leftSection={<IconReceiptRefund size={16} />}
            onClick={handleSubmit((v) => refund.mutate(v))}
          >
            Refund
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
