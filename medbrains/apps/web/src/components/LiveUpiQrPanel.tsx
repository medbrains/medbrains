import { Stack, Text } from "@mantine/core";
import type { PaymentGatewayTransaction, UpiQrResponse } from "@medbrains/types";
import { IconRefresh } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Image } from "@/components/ui";
import { SETTLED_STATUSES } from "@/lib/razorpay-checkout";
import { paymentsService } from "@/services/payments.service";
import { isHeldForFinance } from "./OnlineCheckoutPanel";

/** How often the counter asks whether the QR has been paid. */
export const LIVE_QR_POLL_MS = 3_000;

interface LiveUpiQrPanelProps {
  qr: UpiQrResponse;
  /** "₹600.00", or null when this user may not see amounts. */
  amountText: string | null;
  onCaptured: (txn: PaymentGatewayTransaction) => void;
  /** Make a fresh QR once this one has closed. */
  onRenew: () => void;
  /** Test seam: the clock, in Unix seconds. */
  now?: () => number;
}

const nowSecs = () => Math.floor(Date.now() / 1000);

/** Whether the QR has stopped taking payment. */
export function qrClosed(closeBy: number | null, now: number): boolean {
  return closeBy !== null && now >= closeBy;
}

/**
 * A Razorpay UPI QR for exactly what is due. Razorpay tells the server when
 * it is paid; this watches the payment row and finishes on its own — nobody
 * types a UTR.
 */
export function LiveUpiQrPanel({
  qr,
  amountText,
  onCaptured,
  onRenew,
  now = nowSecs,
}: LiveUpiQrPanelProps) {
  const transactionId = qr.transaction_id ?? "";
  const status = useQuery({
    queryKey: ["payments", "status", transactionId],
    queryFn: async () => {
      const txn = (await paymentsService.getPaymentStatus(transactionId)).transaction;
      if (txn.status === "captured" && !isHeldForFinance(txn)) onCaptured(txn);
      return txn;
    },
    enabled: transactionId !== "",
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (s && SETTLED_STATUSES.has(s)) return false;
      return qrClosed(qr.close_by, now()) ? false : LIVE_QR_POLL_MS;
    },
  });
  const txn = status.data;
  const closesAt = qr.close_by ? new Date(qr.close_by * 1000).toLocaleTimeString() : null;

  if (txn && isHeldForFinance(txn)) {
    return (
      <Alert tone="warning" title="Payment received, not posted" data-testid="alert-qr-held">
        The patient paid, but the amount did not match what the bill could take. Finance has it
        under payment exceptions — do not collect again.
      </Alert>
    );
  }
  if (txn?.status === "failed") {
    return (
      <Alert tone="danger" title="UPI payment failed">
        {txn.error_description ?? "The payment did not go through."}
      </Alert>
    );
  }
  if (qrClosed(qr.close_by, now()) && txn?.status !== "captured") {
    return (
      <Alert tone="warning" title="This QR has closed" data-testid="alert-qr-closed">
        <Stack gap="xs">
          Nothing was paid on it. Make a new one if the patient still wants to pay by UPI.
          <Button
            tone="secondary"
            size="xs"
            leftSection={<IconRefresh size={14} />}
            onClick={onRenew}
          >
            New UPI QR
          </Button>
        </Stack>
      </Alert>
    );
  }
  return (
    <Stack gap="xs" align="center">
      <Text fw={600}>{amountText ? `Scan to pay ${amountText}` : "Scan to pay"}</Text>
      {qr.image_url && (
        <Image
          src={qr.image_url}
          alt={amountText ? `UPI QR for ${amountText}` : "UPI QR"}
          w={240}
          data-testid="img-live-upi-qr"
        />
      )}
      {status.isError ? (
        <Alert tone="danger" title="Could not check the payment">
          The QR is still valid, but whether it was paid could not be read. Check the bill before
          collecting again.
        </Alert>
      ) : (
        <Text size="sm" c="dimmed" ta="center" data-testid="text-qr-waiting">
          Any UPI app can pay it. The bill updates by itself when Razorpay confirms the payment
          {closesAt ? ` — the QR closes at ${closesAt}.` : "."}
        </Text>
      )}
    </Stack>
  );
}
