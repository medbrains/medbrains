// Take one instalment as money: mode + reference, then offer its receipt.

import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { PayInstallmentResponse } from "@medbrains/types";
import { P, PATIENT_NAME_FIELD_ACCESS_KEYS, PATIENT_UHID_FIELD_ACCESS_KEY } from "@medbrains/types";
import { IconPrinter } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useProtectedFieldAccess } from "@/components";
import { Alert, Button, Input, Modal, Select, toast } from "@/components/ui";
import { billingService } from "@/services/billing.service";
import { printReceiptPacket } from "./shared";

const MODES = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
] as const;

export const installmentPaySchema = z
  .object({
    mode: z.enum(["cash", "card", "upi", "bank_transfer", "cheque"]),
    reference_number: z.string().trim(),
  })
  .refine((v) => v.mode === "cash" || v.reference_number.length > 0, {
    path: ["reference_number"],
    message: "Enter the transaction or cheque reference",
  });

type PayForm = z.infer<typeof installmentPaySchema>;

interface InstallmentPayModalProps {
  target: { installmentId: string; itemId: string; amount: number } | null;
  onClose: () => void;
  onPaid: () => void;
}

export function InstallmentPayModal({ target, onClose, onPaid }: InstallmentPayModalProps) {
  const canPrint = useHasPermission(P.BILLING.RECEIPTS_PRINT);
  const access = {
    amount: useProtectedFieldAccess("billing.amount"),
    patientAddress: useProtectedFieldAccess("patients.address"),
    patientName: useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS),
    uhid: useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY),
  };
  const [paid, setPaid] = useState<PayInstallmentResponse | null>(null);
  const { control, handleSubmit, reset } = useForm<PayForm>({
    resolver: zodResolver(installmentPaySchema),
    defaultValues: { mode: "cash", reference_number: "" },
  });

  const pay = useMutation({
    mutationFn: (values: PayForm) => {
      if (!target) throw new Error("No instalment selected");
      return billingService.payInstallmentItem(target.installmentId, target.itemId, {
        mode: values.mode,
        reference_number: values.reference_number || undefined,
      });
    },
    onSuccess: (res) => {
      setPaid(res);
      onPaid();
    },
  });

  const print = useMutation({
    mutationFn: (paymentId: string) => billingService.getReceiptPrintData(paymentId),
    onSuccess: (data) => printReceiptPacket(data, access),
    onError: (e: Error) => toast.error(e.message, { title: "Receipt print failed" }),
  });

  const close = () => {
    setPaid(null);
    pay.reset();
    reset();
    onClose();
  };

  return (
    <Modal opened={target !== null} onClose={close} title="Take instalment payment" size="sm">
      {paid ? (
        <Stack gap="sm">
          <Alert tone="success" title="Payment recorded">
            Receipt {paid.receipt.receipt_number} for ₹{paid.payment.amount} is on the bill.
          </Alert>
          {canPrint && (
            <Button
              leftSection={<IconPrinter size={16} />}
              loading={print.isPending}
              onClick={() => print.mutate(paid.payment.id)}
            >
              Print receipt
            </Button>
          )}
          <Button tone="secondary" onClick={close}>
            Done
          </Button>
        </Stack>
      ) : (
        <Stack gap="sm" component="form" onSubmit={handleSubmit((v) => pay.mutate(v))}>
          <Text size="sm">Amount due: ₹{target?.amount.toLocaleString()}</Text>
          <Controller
            control={control}
            name="mode"
            render={({ field }) => (
              <Select
                label="Payment mode"
                data={[...MODES]}
                allowDeselect={false}
                value={field.value}
                onChange={(v) => field.onChange(v ?? "cash")}
              />
            )}
          />
          <Controller
            control={control}
            name="reference_number"
            render={({ field, fieldState }) => (
              <Input
                label="Reference (UTR, card slip or cheque no.)"
                {...field}
                error={fieldState.error?.message}
              />
            )}
          />
          {pay.isError && (
            <Alert tone="danger" title="Payment not recorded">
              {pay.error.message}
            </Alert>
          )}
          <Button type="submit" loading={pay.isPending}>
            Record payment
          </Button>
        </Stack>
      )}
    </Modal>
  );
}
