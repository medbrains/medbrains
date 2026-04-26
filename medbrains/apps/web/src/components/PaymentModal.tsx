import { useCallback, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconCash,
  IconCheck,
  IconCreditCard,
  IconQrcode,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useMutation } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type {
  CreatePaymentOrderResponse,
  UpiQrResponse,
} from "@medbrains/types";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type PaymentMode = "online" | "upi_qr" | "cash";

interface PaymentModalProps {
  opened: boolean;
  onClose: () => void;
  amount: number;
  invoiceId?: string;
  posSaleId?: string;
  patientName?: string;
  onSuccess: (paymentId: string) => void;
}

export function PaymentModal({
  opened,
  onClose,
  amount,
  invoiceId,
  posSaleId,
  patientName,
  onSuccess,
}: PaymentModalProps) {
  const [mode, setMode] = useState<PaymentMode>("online");
  const [cashReceived, setCashReceived] = useState<number>(amount);
  const [utrReference, setUtrReference] = useState("");
  const [qrData, setQrData] = useState<UpiQrResponse | null>(null);

  const changeDue = Math.max(0, cashReceived - amount);

  const createOrderMutation = useMutation({
    mutationFn: () =>
      api.createPaymentOrder({
        invoice_id: invoiceId,
        pos_sale_id: posSaleId,
        amount,
      }),
    onSuccess: (data: CreatePaymentOrderResponse) => {
      openRazorpayCheckout(data);
    },
    onError: () => {
      notifications.show({
        title: "Payment Error",
        message: "Failed to create payment order",
        color: "red",
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (params: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => api.verifyPayment(params),
    onSuccess: (txn) => {
      notifications.show({
        title: "Payment Successful",
        message: `Payment of ₹${amount} captured successfully`,
        color: "green",
        icon: <IconCheck size={16} />,
      });
      onSuccess(txn.id);
      onClose();
    },
    onError: () => {
      notifications.show({
        title: "Verification Failed",
        message: "Payment verification failed. Please contact support.",
        color: "red",
      });
    },
  });

  const upiQrMutation = useMutation({
    mutationFn: () =>
      api.generateUpiQr({
        amount,
        invoice_id: invoiceId,
        pos_sale_id: posSaleId,
        description: patientName
          ? `Payment for ${patientName}`
          : "Hospital Payment",
      }),
    onSuccess: (data: UpiQrResponse) => {
      setQrData(data);
    },
    onError: () => {
      notifications.show({
        title: "UPI Error",
        message: "Failed to generate UPI QR code",
        color: "red",
      });
    },
  });

  const openRazorpayCheckout = useCallback(
    (orderData: CreatePaymentOrderResponse) => {
      if (!window.Razorpay) {
        notifications.show({
          title: "Payment Error",
          message:
            "Razorpay SDK not loaded. Please refresh the page and try again.",
          color: "red",
        });
        return;
      }

      const options: Record<string, unknown> = {
        key: orderData.key_id,
        amount: orderData.amount * 100,
        currency: orderData.currency,
        name: "MedBrains HMS",
        description: patientName
          ? `Payment for ${patientName}`
          : "Hospital Payment",
        order_id: orderData.order_id,
        handler: (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          verifyMutation.mutate({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
        },
        prefill: {
          name: patientName ?? "",
        },
        theme: {
          color: "#1F4332",
        },
        modal: {
          ondismiss: () => {
            notifications.show({
              title: "Payment Cancelled",
              message: "Payment was cancelled by user",
              color: "yellow",
            });
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    },
    [patientName, verifyMutation],
  );

  const handleCashPayment = useCallback(() => {
    if (cashReceived < amount) {
      notifications.show({
        title: "Insufficient Amount",
        message: "Cash received is less than amount due",
        color: "red",
      });
      return;
    }
    // For cash payments, record directly via the existing billing record_payment
    // The parent component handles this through onSuccess
    onSuccess("cash");
    onClose();
  }, [cashReceived, amount, onSuccess, onClose]);

  const handleUpiConfirm = useCallback(() => {
    if (!utrReference.trim()) {
      notifications.show({
        title: "UTR Required",
        message: "Please enter the UTR/reference number after patient pays",
        color: "yellow",
      });
      return;
    }
    onSuccess(`upi_qr:${utrReference}`);
    onClose();
  }, [utrReference, onSuccess, onClose]);

  const isProcessing =
    createOrderMutation.isPending || verifyMutation.isPending;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconCreditCard size={20} />
          <Text fw={600}>Collect Payment</Text>
        </Group>
      }
      size="md"
      closeOnClickOutside={!isProcessing}
      closeOnEscape={!isProcessing}
    >
      <Stack gap="md">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Amount Due
          </Text>
          <Text fw={700} size="xl">
            ₹{amount.toFixed(2)}
          </Text>
        </Group>

        {patientName && (
          <Text size="sm" c="dimmed">
            Patient: {patientName}
          </Text>
        )}

        <SegmentedControl
          value={mode}
          onChange={(v) => setMode(v as PaymentMode)}
          fullWidth
          data={[
            {
              value: "online",
              label: (
                <Group gap={4} justify="center">
                  <IconCreditCard size={14} />
                  <span>Online</span>
                </Group>
              ),
            },
            {
              value: "upi_qr",
              label: (
                <Group gap={4} justify="center">
                  <IconQrcode size={14} />
                  <span>UPI QR</span>
                </Group>
              ),
            },
            {
              value: "cash",
              label: (
                <Group gap={4} justify="center">
                  <IconCash size={14} />
                  <span>Cash</span>
                </Group>
              ),
            },
          ]}
        />

        {mode === "online" && (
          <Stack gap="sm">
            <Alert
              variant="light"
              color="primary"
              icon={<IconCreditCard size={16} />}
            >
              Pay securely via UPI, Credit/Debit Card, Net Banking, or Wallet
              through Razorpay.
            </Alert>
            <Button
              fullWidth
              size="md"
              loading={isProcessing}
              onClick={() => createOrderMutation.mutate()}
              leftSection={<IconCreditCard size={18} />}
            >
              Pay ₹{amount.toFixed(2)} Online
            </Button>
          </Stack>
        )}

        {mode === "upi_qr" && (
          <Stack gap="sm">
            {!qrData ? (
              <Button
                fullWidth
                variant="light"
                loading={upiQrMutation.isPending}
                onClick={() => upiQrMutation.mutate()}
                leftSection={<IconQrcode size={18} />}
              >
                Generate UPI QR Code
              </Button>
            ) : (
              <Stack gap="sm" align="center">
                <Badge size="lg" variant="light" color="green">
                  Scan to Pay ₹{qrData.amount}
                </Badge>
                <QrCodeDisplay value={qrData.upi_uri} />
                <Text size="xs" c="dimmed">
                  VPA: {qrData.vpa}
                </Text>
                <Text size="xs" c="dimmed">
                  Ref: {qrData.transaction_ref}
                </Text>
                <Alert
                  variant="light"
                  color="yellow"
                  icon={<IconAlertCircle size={16} />}
                >
                  After patient pays, enter the UTR/reference number below to
                  confirm.
                </Alert>
                <TextInput
                  label="UTR / Reference Number"
                  placeholder="Enter UTR after payment"
                  value={utrReference}
                  onChange={(e) => setUtrReference(e.currentTarget.value)}
                  required
                  w="100%"
                />
                <Button
                  fullWidth
                  onClick={handleUpiConfirm}
                  leftSection={<IconCheck size={18} />}
                >
                  Confirm Payment Received
                </Button>
              </Stack>
            )}
          </Stack>
        )}

        {mode === "cash" && (
          <Stack gap="sm">
            <NumberInput
              label="Cash Received"
              value={cashReceived}
              onChange={(v) => setCashReceived(Number(v))}
              min={0}
              decimalScale={2}
              prefix="₹"
              size="md"
            />
            {cashReceived >= amount && (
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Change Due
                </Text>
                <Text fw={600} c="green" size="lg">
                  ₹{changeDue.toFixed(2)}
                </Text>
              </Group>
            )}
            <Button
              fullWidth
              size="md"
              onClick={handleCashPayment}
              disabled={cashReceived < amount}
              leftSection={<IconCash size={18} />}
              color="green"
            >
              Record Cash Payment
            </Button>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}

/** UPI QR code display using Google Charts API. Replace with `qrcode.react` in production. */
function QrCodeDisplay({ value }: { value: string }) {
  return (
    <Stack
      align="center"
      gap="xs"
      style={{
        padding: 16,
        border: "2px dashed var(--mantine-color-gray-4)",
        borderRadius: 8,
        backgroundColor: "var(--mantine-color-gray-0)",
        width: "100%",
      }}
    >
      <div style={{ width: 200, height: 200, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "white", borderRadius: 8, border: "1px solid var(--mantine-color-gray-3)" }}>
        <img
          src={`https://chart.googleapis.com/chart?cht=qr&chs=180x180&chl=${encodeURIComponent(value)}`}
          alt="UPI QR Code"
          width={180}
          height={180}
          style={{ borderRadius: 4 }}
        />
      </div>
      <TextInput
        value={value}
        readOnly
        size="xs"
        w="100%"
        styles={{ input: { fontFamily: "monospace", fontSize: 10 } }}
        onClick={(e) => {
          (e.target as HTMLInputElement).select();
          void navigator.clipboard.writeText(value);
          notifications.show({
            message: "UPI URI copied to clipboard",
            color: "green",
          });
        }}
      />
    </Stack>
  );
}
