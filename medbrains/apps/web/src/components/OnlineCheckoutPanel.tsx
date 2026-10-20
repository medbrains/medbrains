import { Group, Stack } from "@mantine/core";
import type { PaymentGatewayTransaction } from "@medbrains/types";
import { IconCash, IconCreditCard, IconQrcode } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, NumberField } from "@/components/ui";
import {
  loadRazorpayCheckout,
  pollUntil,
  type RazorpayCheckoutResponse,
  SETTLED_STATUSES,
} from "@/lib/razorpay-checkout";
import { paymentsService } from "@/services/payments.service";

/** The modes a failed online payment can fall back to. */
export type FallbackMode = "upi_qr" | "cash";

interface OnlineCheckoutPanelProps {
  /** What is due; the cashier may take less of it online (a part payment). */
  amount: number;
  /** How an amount reads; `null` when this user may not see amounts. */
  formatAmount: ((value: number) => string) | null;
  invoiceId?: string;
  posSaleId?: string;
  patientName?: string;
  disabled: boolean;
  /** Fallbacks this counter offers, in order. */
  fallbacks: readonly FallbackMode[];
  onCaptured: (txn: PaymentGatewayTransaction) => void;
  onUseOtherMode: (mode: FallbackMode) => void;
}

/** The patient closed checkout: nothing was charged. */
class CheckoutClosed extends Error {}

const FALLBACK_LABEL: Record<FallbackMode, string> = {
  upi_qr: "Use UPI QR instead",
  cash: "Take cash instead",
};

/** The money is in, but could not be posted to the bill: finance has it. */
export function isHeldForFinance(txn: PaymentGatewayTransaction): boolean {
  return txn.notes?.held_for_finance === true;
}

/** Open Razorpay's checkout and resolve with what it says the patient paid. */
async function payInCheckout(options: {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  patientName?: string;
}): Promise<RazorpayCheckoutResponse> {
  const Razorpay = await loadRazorpayCheckout();
  return new Promise((resolve, reject) => {
    const checkout = new Razorpay({
      key: options.keyId,
      order_id: options.orderId,
      amount: Math.round(options.amount * 100),
      currency: options.currency,
      name: "MedBrains HMS",
      description: options.patientName ? `Payment for ${options.patientName}` : "Hospital payment",
      prefill: { name: options.patientName ?? "" },
      handler: resolve,
      modal: { ondismiss: () => reject(new CheckoutClosed("Checkout was closed")) },
    });
    checkout.open();
  });
}

/** The row once it can no longer change on its own, or `null` if it did not settle in time. */
function waitForSettled(transactionId: string) {
  return pollUntil(
    () => paymentsService.getPaymentStatus(transactionId).then((r) => r.transaction),
    (txn) => SETTLED_STATUSES.has(txn.status),
  );
}

/** Why this amount cannot be taken online, if it cannot. */
export function onlineAmountError(value: number, due: number): string | null {
  if (!(value > 0)) return "Enter the amount to collect";
  if (value > due) return "More than is due on the bill";
  if (Math.round(value * 100) !== value * 100) return "Use whole paise";
  return null;
}

async function collectOnline(
  props: OnlineCheckoutPanelProps,
  amount: number,
): Promise<PaymentGatewayTransaction> {
  const order = await paymentsService.createPaymentOrder({
    invoice_id: props.invoiceId,
    pos_sale_id: props.posSaleId,
    amount,
  });
  if (!order.order_id || !order.key_id) {
    throw new Error("Online checkout here works with Razorpay, which is not the active provider.");
  }
  const paid = await payInCheckout({
    keyId: order.key_id,
    orderId: order.order_id,
    amount: order.amount,
    currency: order.currency,
    patientName: props.patientName,
  });
  const verified = await paymentsService.verifyPayment(paid).catch(() => null);
  if (verified?.status === "captured") return verified;
  const settled = await waitForSettled(order.transaction_id);
  if (settled?.status === "captured") return settled;
  if (settled?.status === "failed") {
    throw new Error(settled.error_description ?? "The payment failed.");
  }
  throw new Error(
    "The payment was taken but Razorpay has not confirmed it yet. It posts to the bill on its own — check the bill before collecting again.",
  );
}

/** Online payment through Razorpay's checkout, with a clear way out when it fails. */
export function OnlineCheckoutPanel(props: OnlineCheckoutPanelProps) {
  const { amount: due, formatAmount, disabled, fallbacks, onCaptured, onUseOtherMode } = props;
  const [amount, setAmount] = useState(due);
  const amountError = onlineAmountError(amount, due);
  const checkout = useMutation({
    mutationFn: () => collectOnline(props, amount),
    onSuccess: (txn) => {
      if (!isHeldForFinance(txn)) onCaptured(txn);
    },
  });
  const held = checkout.isSuccess && isHeldForFinance(checkout.data);
  const closed = checkout.error instanceof CheckoutClosed;

  return (
    <Stack gap="sm">
      <Alert tone="info" icon={<IconCreditCard size={16} />}>
        Pay securely by UPI, card, net banking or wallet through Razorpay.
      </Alert>
      {held && (
        <Alert tone="warning" title="Payment received, not posted" data-testid="alert-online-held">
          The patient paid, but the amount did not match what the bill could take. Finance has it
          under payment exceptions — do not collect again.
        </Alert>
      )}
      {checkout.isError && (
        <Alert
          tone={closed ? "warning" : "danger"}
          title={closed ? "Payment not completed" : "Online payment did not go through"}
          data-testid="alert-online-error"
        >
          <Stack gap="xs">
            {closed
              ? "Checkout was closed before paying. Nothing was charged."
              : checkout.error.message}
            {fallbacks.length > 0 && (
              <Group gap="xs">
                {fallbacks.map((mode) => (
                  <Button
                    key={mode}
                    tone="secondary"
                    size="xs"
                    data-testid={`btn-use-${mode}`}
                    leftSection={
                      mode === "cash" ? <IconCash size={14} /> : <IconQrcode size={14} />
                    }
                    onClick={() => onUseOtherMode(mode)}
                  >
                    {FALLBACK_LABEL[mode]}
                  </Button>
                ))}
              </Group>
            )}
          </Stack>
        </Alert>
      )}
      {formatAmount && (
        <NumberField
          label="Amount to collect online"
          description={`Due ${formatAmount(due)} — less makes it a part payment`}
          data-testid="field-online-amount"
          value={amount}
          onChange={(v) => setAmount(typeof v === "number" ? v : Number(v))}
          decimalScale={2}
          min={0}
          max={due}
          prefix="₹"
          error={amountError}
          disabled={checkout.isPending || held}
        />
      )}
      <Button
        fullWidth
        size="md"
        loading={checkout.isPending}
        disabled={disabled || held || amountError !== null}
        data-testid="btn-pay-online"
        onClick={() => checkout.mutate()}
        leftSection={<IconCreditCard size={18} />}
      >
        {formatAmount ? `Pay ${formatAmount(amount)} Online` : "Pay Online"}
      </Button>
    </Stack>
  );
}
