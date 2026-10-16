import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import type { PaymentGatewayTransaction } from "@medbrains/types";
import { IconDeviceMobileMessage } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Input } from "@/components/ui";
import { paymentsService } from "@/services/payments.service";

interface UpiCollectPanelProps {
  /** The active provider's name, e.g. "PhonePe" — it sends the request. */
  providerLabel: string;
  amount: number;
  invoiceId?: string;
  posSaleId?: string;
  disabled: boolean;
  onCaptured: (txn: PaymentGatewayTransaction) => void;
}

const STATUS_POLL_MS = 5_000;
const TERMINAL_STATUSES = new Set(["captured", "failed", "refunded"]);

export const upiCollectSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter the patient's 10-digit mobile number"),
  vpa: z.string().regex(/^[\w.-]{2,}@[a-zA-Z]{2,}$/, "Enter the patient's UPI ID, like name@bank"),
});

type UpiCollectForm = z.infer<typeof upiCollectSchema>;

/** Sends a UPI collect request to the patient's phone and watches it settle. */
export function UpiCollectPanel({
  providerLabel,
  amount,
  invoiceId,
  posSaleId,
  disabled,
  onCaptured,
}: UpiCollectPanelProps) {
  const [txnId, setTxnId] = useState<string | null>(null);
  const { control, handleSubmit } = useForm<UpiCollectForm>({
    resolver: zodResolver(upiCollectSchema),
    defaultValues: { phone: "", vpa: "" },
  });

  const collect = useMutation({
    mutationFn: (values: UpiCollectForm) =>
      paymentsService.requestUpiCollect({
        amount,
        phone: values.phone,
        vpa: values.vpa,
        invoice_id: invoiceId,
        pos_sale_id: posSaleId,
      }),
    onSuccess: (res) => setTxnId(res.transaction_id),
  });

  const status = useQuery({
    queryKey: ["payments", "status", txnId],
    queryFn: () => paymentsService.getPaymentStatus(txnId ?? ""),
    enabled: txnId !== null,
    refetchInterval: (q) => {
      const s = q.state.data?.transaction.status;
      return s && TERMINAL_STATUSES.has(s) ? false : STATUS_POLL_MS;
    },
  });

  if (txnId) {
    const s = status.data?.transaction.status;
    if (status.isError) {
      return (
        <Alert tone="danger" title="Could not check the request">
          The request was sent, but its status could not be read. Check the payment before
          collecting again.
        </Alert>
      );
    }
    const txn = status.data?.transaction;
    if (s === "captured" && txn) {
      return (
        <Stack gap="xs">
          <Alert tone="success" title="Payment received">
            The patient approved the UPI request.
          </Alert>
          <Button onClick={() => onCaptured(txn)}>Done</Button>
        </Stack>
      );
    }
    if (s === "failed") {
      return (
        <Alert tone="danger" title="Patient did not pay">
          {status.data?.transaction.error_description ?? "The UPI request failed or expired."}
        </Alert>
      );
    }
    return (
      <Alert tone="info" title="Waiting for the patient">
        Request sent. Ask the patient to approve it in their UPI app — the payment posts here when
        it clears.
      </Alert>
    );
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Or send a UPI request to the patient's phone via {providerLabel}
      </Text>
      <Group align="flex-start" grow>
        <Controller
          control={control}
          name="phone"
          render={({ field, fieldState }) => (
            <Input label="Mobile number" {...field} error={fieldState.error?.message} />
          )}
        />
        <Controller
          control={control}
          name="vpa"
          render={({ field, fieldState }) => (
            <Input label="UPI ID" {...field} error={fieldState.error?.message} />
          )}
        />
      </Group>
      {collect.isError && (
        <Alert tone="danger" title="Request not sent">
          {collect.error.message}
        </Alert>
      )}
      <Button
        tone="secondary"
        loading={collect.isPending}
        disabled={disabled}
        leftSection={<IconDeviceMobileMessage size={16} />}
        onClick={handleSubmit((v) => collect.mutate(v))}
      >
        Send UPI request
      </Button>
    </Stack>
  );
}
