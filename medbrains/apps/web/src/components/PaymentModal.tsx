import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { paymentsService } from "@/services/payments.service";
import {
  type PaymentSplitMode,
  type PaymentSplitPart,
  PaymentSplitParts,
} from "./PaymentSplitParts";
import { UpiCollectPanel } from "./UpiCollectPanel";
import { VirtualAccountPanel } from "./VirtualAccountPanel";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export type PaymentModalMode = PaymentFormInput["mode"];

const DEFAULT_MODES: readonly PaymentModalMode[] = ["online", "upi_qr", "cash"];

const MODE_OPTIONS: { value: PaymentModalMode; label: ReactNode }[] = [
  { value: "online", label: <ModeLabel icon={<IconCreditCard size={14} />} text="Online" /> },
  { value: "upi_qr", label: <ModeLabel icon={<IconQrcode size={14} />} text="UPI" /> },
  { value: "cash", label: <ModeLabel icon={<IconCash size={14} />} text="Cash" /> },
  { value: "card", label: <ModeLabel icon={<IconCreditCard size={14} />} text="Card" /> },
];

function ModeLabel({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <Group gap={4} justify="center" wrap="nowrap">
      {icon}
      <Text span size="sm">
        {text}
      </Text>
    </Group>
  );
}

interface PaymentModalProps {
  opened: boolean;
  onClose: () => void;
  amount: number;
  amountAccess?: FieldAccessLevel;
  invoiceId?: string;
  posSaleId?: string;
  patientName?: string;
  /** Tenders offered, first is the default. A counter sale that has not been
   *  posted yet offers only manual tenders — a gateway order needs a record. */
  modes?: readonly PaymentModalMode[];
  /** The permission the caller's settlement call enforces. Billing records an
   *  invoice payment; the pharmacy counter posts a POS sale. */
  collectPermission?: string;
  /** Offer part payments before the last tender (the pharmacy counter). */
  splitModes?: readonly PaymentSplitMode[];
  onSuccess: (paymentId: string, settlement: PaymentModalSettlement) => void;
}

export interface PaymentModalSettlement {
  source: "gateway" | "manual";
  mode: "cash" | "upi" | "card" | "credit";
  /** This tender's amount: what was due after any parts. */
  amount: number;
  reference_number?: string;
  /** Cash handed over, when it was cash; change due is this less `amount`. */
  tendered?: number;
  /** Part payments taken before this tender. */
  parts?: PaymentSplitPart[];
}

export function PaymentModal({
  opened,
  onClose,
  amount: billAmount,
  amountAccess = "edit",
  invoiceId,
  posSaleId,
  patientName,
  modes = DEFAULT_MODES,
  collectPermission = P.BILLING.PAYMENTS_CREATE,
  splitModes,
  onSuccess: onSettled,
}: PaymentModalProps) {
  const [parts, setParts] = useState<PaymentSplitPart[]>([]);
  // Everything below collects what is still due once the parts are taken.
  const amount = Math.max(
    0,
    Math.round((billAmount - parts.reduce((sum, p) => sum + p.amount, 0)) * 100) / 100,
  );
  const onSuccess = (paymentId: string, settlement: PaymentModalSettlement) =>
    onSettled(paymentId, parts.length > 0 ? { ...settlement, parts } : settlement);
  const [qrData, setQrData] = useState<UpiQrResponse | null>(null);
  const canCollect = useHasPermission(collectPermission);
  // Gateway orders and generated QR codes are billing endpoints.
  const canUseGateway = useHasPermission(P.BILLING.PAYMENTS_CREATE);

  // Surface which online provider settles gateway/UPI here + sandbox warning.
  const { data: providersResp } = useQuery({
    queryKey: ["payment-providers"],
    queryFn: paymentsService.listPaymentProviders,
    enabled: opened,
    staleTime: 300_000,
  });
  const activeProvider = useMemo(
    () => providersResp?.providers.find((p) => p.active),
    [providersResp],
  );
  const isSandbox = activeProvider?.mode === "sandbox" || activeProvider?.mode === "test";
  // With parts, what is due moves; the cash check below follows it instead.
  const paymentSchema = useMemo(
    () => createPaymentFormSchema(splitModes ? 0 : billAmount),
    [billAmount, splitModes],
  );
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PaymentFormInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      mode: modes[0] ?? "cash",
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
  const paymentBlocked = !canCollect || !canCollectAmount;
  const paymentBlockedMessage = !canCollect
    ? "Your role cannot collect this payment."
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
    onError: (error: Error) => {
      notifications.show({
        title: "Payment Error",
        message: error.message || "Failed to create payment order",
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
          color: "#5B4BC4",
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
      tendered: received,
    });
    onClose();
  });

  const handleCardConfirm = handleSubmit((values) => {
    if (paymentBlocked) {
      notifyPaymentBlocked();
      return;
    }
    const reference = values.utrReference.trim();
    onSuccess(`card:${reference}`, {
      source: "manual",
      mode: "card",
      amount,
      reference_number: reference,
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

        {activeProvider && (
          <Group gap="xs">
            <Text size="xs" c="dimmed">
              Gateway:
            </Text>
            <Badge size="sm" color="primary" variant="light">
              {activeProvider.label}
            </Badge>
            {isSandbox && (
              <Badge size="sm" color="warning" variant="filled">
                SANDBOX — test mode
              </Badge>
            )}
          </Group>
        )}

        {paymentBlocked && (
          <Alert variant="light" color="yellow" icon={<IconAlertCircle size={16} />}>
            {paymentBlockedMessage}
          </Alert>
        )}

        {splitModes && (
          <PaymentSplitParts
            parts={parts}
            due={amount}
            modes={splitModes}
            disabled={paymentBlocked}
            formatAmount={(value) => paymentAmountText(amountAccess, value)}
            onAdd={(part) => {
              const next = [...parts, part];
              setParts(next);
              const due = billAmount - next.reduce((sum, p) => sum + p.amount, 0);
              setValue("cashReceived", Math.max(0, Math.round(due * 100) / 100));
            }}
            onRemove={(index) => setParts(parts.filter((_, i) => i !== index))}
          />
        )}

        {amount <= 0 && parts.length > 0 ? (
          <Button
            fullWidth
            size="md"
            disabled={paymentBlocked}
            leftSection={<IconCheck size={18} />}
            onClick={() => {
              const last = parts[parts.length - 1];
              onSuccess("split", {
                source: "manual",
                mode: last?.mode ?? "card",
                amount: 0,
              });
              onClose();
            }}
          >
            Complete payment
          </Button>
        ) : (
          <>
            <Controller
              control={control}
              name="mode"
              render={({ field }) => (
                <SegmentedControl
                  value={field.value}
                  onChange={field.onChange}
                  fullWidth
                  data={MODE_OPTIONS.filter((option) => modes.includes(option.value))}
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
                {canUseGateway && !qrData && (
                  <>
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
                    {activeProvider?.supports_upi_collect && (
                      <UpiCollectPanel
                        providerLabel={activeProvider.label}
                        amount={amount}
                        invoiceId={invoiceId}
                        posSaleId={posSaleId}
                        disabled={paymentBlocked}
                        onCaptured={(txn) => {
                          onSuccess(txn.id, {
                            source: "gateway",
                            mode: "upi",
                            amount,
                            reference_number: txn.gateway_payment_id ?? txn.id,
                          });
                          onClose();
                        }}
                      />
                    )}
                  </>
                )}
                {qrData && (
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
                  </Stack>
                )}
                {(qrData || !canUseGateway) && (
                  <>
                    <Alert variant="light" color="yellow" icon={<IconAlertCircle size={16} />}>
                      {qrData
                        ? "After the patient pays, enter the UTR/reference number below to confirm."
                        : "The customer pays the counter UPI QR. Enter the UTR from their app to confirm."}
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
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void handleUpiConfirm();
                          }}
                          error={errors.utrReference?.message}
                          disabled={paymentBlocked}
                          required
                          data-autofocus
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
                  </>
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
                      data-autofocus
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void handleCashPayment();
                      }}
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
                {cashReceived < amount && (
                  <Text size="sm" c="dimmed">
                    Short by {paymentAmountText(amountAccess, amount - cashReceived)} — enter the
                    cash handed over.
                  </Text>
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

            {mode === "card" && (
              <Stack gap="sm">
                <Controller
                  control={control}
                  name="utrReference"
                  render={({ field }) => (
                    <TextInput
                      label="Card approval code"
                      description="From the card machine slip"
                      value={field.value}
                      onChange={field.onChange}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void handleCardConfirm();
                      }}
                      error={errors.utrReference?.message}
                      disabled={paymentBlocked}
                      required
                      data-autofocus
                    />
                  )}
                />
                <Button
                  fullWidth
                  size="md"
                  onClick={() => void handleCardConfirm()}
                  disabled={paymentBlocked}
                  leftSection={<IconCreditCard size={18} />}
                >
                  Confirm Card Payment
                </Button>
              </Stack>
            )}
          </>
        )}

        {invoiceId && !paymentBlocked && (
          <>
            <Divider label="or collect by bank transfer" labelPosition="center" />
            <VirtualAccountPanel
              invoiceId={invoiceId}
              amount={amount}
              patientName={patientName}
              onSettled={() => {
                onSuccess("virtual_account", {
                  source: "gateway",
                  mode: "upi",
                  amount,
                  reference_number: "virtual_account",
                });
                onClose();
              }}
            />
          </>
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

/**
 * UPI QR, rendered locally.
 *
 * This used to be an `<img>` pointed at `chart.googleapis.com`. Three things
 * were wrong with that. The UPI string carries the payee VPA, the amount and
 * the transaction reference, so every payment a hospital took was handed to a
 * third party. The Charts image API is turned down, so the cashier could be
 * holding out a blank square to a patient who is trying to pay. And it needed
 * internet egress from the payment counter, which plenty of hospital networks
 * do not give.
 *
 * `qrcode.react` was already a dependency — the prescription print uses it.
 */
function QrCodeDisplay({ value }: { value: string }) {
  return (
    <Stack
      align="center"
      gap="xs"
      style={{
        padding: 16,
        border: "2px dashed var(--mantine-color-gray-4)",
        borderRadius: 0,
        backgroundColor: "var(--mantine-color-gray-0)",
        width: "100%",
      }}
    >
      <Box
        style={{
          width: 200,
          height: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "white",
          borderRadius: 0,
          border: "1px solid var(--mantine-color-gray-3)",
        }}
      >
        <QRCodeSVG
          value={value}
          size={180}
          // A counter QR gets scanned at an angle, in bad light, off a screen
          // with fingerprints on it. Level M leaves room to still decode.
          level="M"
          role="img"
          aria-label="UPI payment QR code"
        />
      </Box>
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
