import { zodResolver } from "@hookform/resolvers/zod";
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
import { notifications } from "@mantine/notifications";
import type { PaymentFormInput } from "@medbrains/schemas";
import { createPaymentFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreatePaymentOrderResponse, FieldAccessLevel, UpiQrResponse } from "@medbrains/types";
import { P } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import {
  IconAlertCircle,
  IconCash,
  IconCheck,
  IconCreditCard,
  IconQrcode,
} from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { paymentsService } from "@/services/payments.service";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

interface PaymentModalProps {
  opened: boolean;
  onClose: () => void;
  amount: number;
  amountAccess?: FieldAccessLevel;
  invoiceId?: string;
  posSaleId?: string;
  patientName?: string;
  onSuccess: (paymentId: string, settlement: PaymentModalSettlement) => void;
}

export interface PaymentModalSettlement {
  source: "gateway" | "manual";
  mode: "cash" | "upi";
  amount: number;
  reference_number?: string;
}

export function PaymentModal({
  opened,
  onClose,
  amount,
  amountAccess = "edit",
  invoiceId,
  posSaleId,
  patientName,
  onSuccess,
}: PaymentModalProps) {
  const [qrData, setQrData] = useState<UpiQrResponse | null>(null);
  const canCreatePayment = useHasPermission(P.BILLING.PAYMENTS_CREATE);
  const paymentSchema = useMemo(() => createPaymentFormSchema(amount), [amount]);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PaymentFormInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      mode: "online",
      cashReceived: amount,
      utrReference: "",
    },
    mode: "onTouched",
  });

  const formValues = watch();
  const mode = formValues.mode;
  const cashReceived = Number(formValues.cashReceived || 0);
  const changeDue = Math.max(0, cashReceived - amount);
  const amountLabel = paymentAmountText(amountAccess, amount);
  const changeDueLabel = paymentAmountText(amountAccess, changeDue);
  const showAmountInAction = amountAccess === "edit" || amountAccess === "view";
  const canCollectAmount = amountAccess === "edit";
  const paymentBlocked = !canCreatePayment || !canCollectAmount;
  const paymentBlockedMessage = !canCreatePayment
    ? "Payment collection requires billing payment permission."
    : "Payment collection requires editable billing amount access.";

  const notifyPaymentBlocked = useCallback(() => {
    notifications.show({
      title: "Payment not allowed",
      message: paymentBlockedMessage,
      color: "yellow",
    });
  }, [paymentBlockedMessage]);

  const createOrderMutation = useMutation({
    mutationFn: () =>
      paymentsService.createPaymentOrder({
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
    }) => paymentsService.verifyPayment(params),
    onSuccess: (txn) => {
      notifications.show({
        title: "Payment Successful",
        message: `Payment of ${amountLabel} captured successfully`,
        color: "green",
        icon: <IconCheck size={16} />,
      });
      onSuccess(txn.id, {
        source: "gateway",
        mode: "upi",
        amount,
        reference_number: txn.gateway_payment_id ?? txn.id,
      });
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
      paymentsService.generateUpiQr({
        amount,
        invoice_id: invoiceId,
        pos_sale_id: posSaleId,
        description: patientName ? `Payment for ${patientName}` : "Hospital Payment",
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

  const startOnlinePayment = useCallback(() => {
    if (paymentBlocked) {
      notifyPaymentBlocked();
      return;
    }
    createOrderMutation.mutate();
  }, [createOrderMutation, notifyPaymentBlocked, paymentBlocked]);

  const generateUpiQr = useCallback(() => {
    if (paymentBlocked) {
      notifyPaymentBlocked();
      return;
    }
    upiQrMutation.mutate();
  }, [notifyPaymentBlocked, paymentBlocked, upiQrMutation]);

  const openRazorpayCheckout = useCallback(
    (orderData: CreatePaymentOrderResponse) => {
      if (!window.Razorpay) {
        notifications.show({
          title: "Payment Error",
          message: "Razorpay SDK not loaded. Please refresh the page and try again.",
          color: "red",
        });
        return;
      }

      const options: Record<string, unknown> = {
        key: orderData.key_id,
        amount: orderData.amount * 100,
        currency: orderData.currency,
        name: "MedBrains HMS",
        description: patientName ? `Payment for ${patientName}` : "Hospital Payment",
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

  const handleCashPayment = handleSubmit((values) => {
    if (paymentBlocked) {
      notifyPaymentBlocked();
      return;
    }
    const received = Number(values.cashReceived || 0);
    if (received < amount) {
      notifications.show({
        title: "Insufficient Amount",
        message: "Cash received is less than amount due",
        color: "red",
      });
      return;
    }
    onSuccess("cash", {
      source: "manual",
      mode: "cash",
      amount,
    });
    onClose();
  });

  const handleUpiConfirm = handleSubmit((values) => {
    if (paymentBlocked) {
      notifyPaymentBlocked();
      return;
    }
    const reference = values.utrReference.trim();
    onSuccess(`upi_qr:${reference}`, {
      source: "manual",
      mode: "upi",
      amount,
      reference_number: reference,
    });
    onClose();
  });

  const isProcessing = createOrderMutation.isPending || verifyMutation.isPending;

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
      size="lg"
      closeOnClickOutside={!isProcessing}
      closeOnEscape={!isProcessing}
    >
      <Stack gap="md">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Amount Due
          </Text>
          <Text fw={700} size="xl">
            {amountLabel}
          </Text>
        </Group>

        {patientName && (
          <Text size="sm" c="dimmed">
            Patient: {patientName}
          </Text>
        )}

        {paymentBlocked && (
          <Alert variant="light" color="yellow" icon={<IconAlertCircle size={16} />}>
            {paymentBlockedMessage}
          </Alert>
        )}

        <Controller
          control={control}
          name="mode"
          render={({ field }) => (
            <SegmentedControl
              value={field.value}
              onChange={field.onChange}
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
          )}
        />

        {mode === "online" && (
          <Stack gap="sm">
            <Alert variant="light" color="primary" icon={<IconCreditCard size={16} />}>
              Pay securely via UPI, Credit/Debit Card, Net Banking, or Wallet through Razorpay.
            </Alert>
            <Button
              fullWidth
              size="md"
              loading={isProcessing}
              disabled={paymentBlocked}
              onClick={startOnlinePayment}
              leftSection={<IconCreditCard size={18} />}
            >
              {showAmountInAction ? `Pay ${amountLabel} Online` : "Pay Online"}
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
                disabled={paymentBlocked}
                onClick={generateUpiQr}
                leftSection={<IconQrcode size={18} />}
              >
                Generate UPI QR Code
              </Button>
            ) : (
              <Stack gap="sm" align="center">
                <Badge size="lg" variant="light" color="green">
                  {showAmountInAction
                    ? `Scan to Pay ${paymentAmountText(amountAccess, qrData.amount)}`
                    : "Scan to Pay"}
                </Badge>
                <QrCodeDisplay value={qrData.upi_uri} />
                <Text size="xs" c="dimmed">
                  VPA: {qrData.vpa}
                </Text>
                <Text size="xs" c="dimmed">
                  Ref: {qrData.transaction_ref}
                </Text>
                <Alert variant="light" color="yellow" icon={<IconAlertCircle size={16} />}>
                  After patient pays, enter the UTR/reference number below to confirm.
                </Alert>
                <Controller
                  control={control}
                  name="utrReference"
                  render={({ field }) => (
                    <TextInput
                      label="UTR / Reference Number"
                      placeholder="Enter UTR after payment"
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.utrReference?.message}
                      disabled={paymentBlocked}
                      required
                      w="100%"
                    />
                  )}
                />
                <Button
                  fullWidth
                  onClick={() => void handleUpiConfirm()}
                  disabled={paymentBlocked}
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
            <Controller
              control={control}
              name="cashReceived"
              render={({ field }) => (
                <NumberInput
                  label="Cash Received"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.cashReceived?.message}
                  min={0}
                  decimalScale={2}
                  prefix="₹"
                  size="md"
                  disabled={paymentBlocked}
                />
              )}
            />
            {cashReceived >= amount && (
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Change Due
                </Text>
                <Text fw={600} c="green" size="lg">
                  {changeDueLabel}
                </Text>
              </Group>
            )}
            <Button
              fullWidth
              size="md"
              onClick={() => void handleCashPayment()}
              disabled={paymentBlocked || cashReceived < amount}
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

function paymentAmountText(
  access: FieldAccessLevel,
  value: number | string | null | undefined,
): string {
  const parsed = Number(value ?? 0);
  const amount = Number.isFinite(parsed) ? parsed : 0;
  return fieldAccessText(
    access,
    `₹${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    "amount",
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
      <div
        style={{
          width: 200,
          height: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "white",
          borderRadius: 8,
          border: "1px solid var(--mantine-color-gray-3)",
        }}
      >
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
          e.currentTarget.select();
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
