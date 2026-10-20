import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Badge,
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
import type { FieldAccessLevel, PaymentGatewayTransaction, UpiQrResponse } from "@medbrains/types";
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
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { paymentsService } from "@/services/payments.service";
import { LiveUpiQrPanel } from "./LiveUpiQrPanel";
import { type FallbackMode, OnlineCheckoutPanel } from "./OnlineCheckoutPanel";
import {
  type PaymentSplitMode,
  type PaymentSplitPart,
  PaymentSplitParts,
} from "./PaymentSplitParts";
import { UpiCollectPanel } from "./UpiCollectPanel";
import { UpiQrCode } from "./UpiQrCode";
import { VirtualAccountPanel } from "./VirtualAccountPanel";

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
  // A Razorpay QR confirms itself; the hospital's UPI ID QR needs the UTR.
  const liveQr = qrData?.source === "razorpay" ? qrData : null;
  const staticQr = qrData?.source === "upi_id" ? qrData : null;
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

  const handleOnlineCaptured = (txn: PaymentGatewayTransaction) => {
    const paid = Number(txn.amount);
    notifications.show({
      title: "Payment successful",
      message: `Payment of ${paymentAmountText(amountAccess, paid)} captured`,
      color: "green",
      icon: <IconCheck size={16} />,
    });
    onSuccess(txn.id, {
      source: "gateway",
      mode: txn.payment_method === "card" ? "card" : "upi",
      amount: paid,
      reference_number: txn.gateway_payment_id ?? txn.id,
    });
    onClose();
  };
  const fallbacks = (["upi_qr", "cash"] as const).filter((m): m is FallbackMode =>
    modes.includes(m),
  );

  const upiQrMutation = useMutation({
    mutationFn: () =>
      paymentsService.generateUpiQr({
        amount,
        invoice_id: invoiceId,
        pos_sale_id: posSaleId,
        description: patientName ? `Payment for ${patientName}` : "Hospital Payment",
        live: true,
      }),
    onSuccess: (data: UpiQrResponse) => {
      setQrData(data);
    },
  });

  const generateUpiQr = useCallback(() => {
    if (paymentBlocked) {
      notifyPaymentBlocked();
      return;
    }
    upiQrMutation.mutate();
  }, [notifyPaymentBlocked, paymentBlocked, upiQrMutation]);

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
              <OnlineCheckoutPanel
                amount={amount}
                formatAmount={
                  showAmountInAction ? (value) => paymentAmountText(amountAccess, value) : null
                }
                invoiceId={invoiceId}
                posSaleId={posSaleId}
                patientName={patientName}
                disabled={paymentBlocked}
                fallbacks={fallbacks}
                onCaptured={handleOnlineCaptured}
                onUseOtherMode={(next) => setValue("mode", next)}
              />
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
                    {upiQrMutation.isError && (
                      <Alert
                        variant="light"
                        color="red"
                        icon={<IconAlertCircle size={16} />}
                        title="UPI QR not made"
                        data-testid="alert-upi-qr-error"
                      >
                        {upiQrMutation.error.message}
                      </Alert>
                    )}
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
                {liveQr && (
                  <LiveUpiQrPanel
                    qr={liveQr}
                    amountText={
                      showAmountInAction ? paymentAmountText(amountAccess, liveQr.amount) : null
                    }
                    onCaptured={handleOnlineCaptured}
                    onRenew={() => {
                      setQrData(null);
                      generateUpiQr();
                    }}
                  />
                )}
                {staticQr?.fallback_reason && (
                  <Alert
                    variant="light"
                    color="yellow"
                    icon={<IconAlertCircle size={16} />}
                    title="Showing the hospital's own UPI QR"
                    data-testid="alert-upi-qr-fallback"
                  >
                    {staticQr.fallback_reason}. This QR is not confirmed by Razorpay — enter the UTR
                    the patient shows.
                  </Alert>
                )}
                {staticQr && (
                  <Stack gap="sm" align="center">
                    <Badge size="lg" variant="light" color="green">
                      {showAmountInAction
                        ? `Scan to Pay ${paymentAmountText(amountAccess, staticQr.amount)}`
                        : "Scan to Pay"}
                    </Badge>
                    <UpiQrCode value={staticQr.upi_uri ?? ""} />
                    <Text size="xs" c="dimmed">
                      VPA: {staticQr.vpa}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Ref: {staticQr.transaction_ref}
                    </Text>
                  </Stack>
                )}
                {(staticQr || !canUseGateway || upiQrMutation.isError) && (
                  <>
                    <Alert variant="light" color="yellow" icon={<IconAlertCircle size={16} />}>
                      {staticQr
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
