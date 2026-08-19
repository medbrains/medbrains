// Billing InvoiceDetail — split from billing.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Card,
  Divider,
  Grid,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { BillingDiscountFormInput, BillingInvoiceItemFormInput } from "@medbrains/schemas";
import { billingDiscountFormSchema, billingInvoiceItemFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AddDiscountRequest,
  AddInvoiceItemRequest,
  ClinicalEventName,
  ClinicalJourneyContext,
  CopayCalculation,
  InvoiceDetailResponse,
  InvoiceDiscount,
  RecordPaymentRequest,
} from "@medbrains/types";
import {
  billingInvoiceBalance,
  billingInvoiceBalanceSignal,
  billingInvoiceStatusSignal,
  P,
  PATIENT_NAME_FIELD_ACCESS_KEYS,
  PATIENT_UHID_FIELD_ACCESS_KEY,
} from "@medbrains/types";
import {
  IconCash,
  IconCheck,
  IconCreditCard,
  IconDiscount2,
  IconFileInvoice,
  IconPlus,
  IconPrinter,
  IconReceipt,
  IconShieldCheck,
  IconTags,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  DocumentActions,
  OperationalSignal,
  PaymentCollectPanel,
  useClinicalEmit,
  useProtectedFieldAccess,
} from "@/components";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { PatientJourneyActions } from "@/components/Patient/PatientJourneyActions";
import type { PaymentModalSettlement } from "@/components/PaymentModal";
import { PaymentModal } from "@/components/PaymentModal";
import { Alert, Badge, Button, IconButton, Table, toast } from "@/components/ui";
import {
  billingChargeSourceOptions,
  billingDiscountTypeOptions,
  billingIntegerOrFallback,
  billingNumberOrFallback,
  billingOptionalText,
} from "@/forms/billing.form";
import { confirmDestructive } from "@/lib/confirm-destructive";
import { billingService } from "@/services/billing.service";
import { paymentsService } from "@/services/payments.service";
import { printCopyRouteLabel } from "@/utils/printCopies";
import classes from "../billing.module.scss";
import { billingInvoicePaymentRoute } from "../billing-workspace";
import type { BillingDisplayAccess } from "./shared";
import {
  BILLING_INVOICE_PRINT_COPIES,
  billingAmountText,
  invoiceBalance,
  invoiceBalanceLabel,
  invoiceDisplayStatus,
  invoiceStatusLabel,
  printInvoicePacket,
  printReceiptPacket,
} from "./shared";

const BILLING_DETAIL_HIDDEN_ACTIONS = [
  "patient.edit",
  "patient.share",
  "patient.print_card",
  "opd.open_visit",
  "orders.medication",
  "orders.lab",
  "orders.radiology",
  "ipd.open_admission",
  "ipd.admit",
  "emergency.open_visit",
  "emergency.open_mlc",
  "camp.open_context",
  "pharmacy.dispense_order",
  "pharmacy.open_patient_queue",
  "mrd.open_case_sheet",
  "billing.open_ledger",
] as const;

function BillingSummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "success";
}) {
  return (
    <Stack gap={1}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={700} c={tone}>
        {value}
      </Text>
    </Stack>
  );
}

function CopayBreakdown({ invoiceId }: { invoiceId: string }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["copay-calculation", invoiceId],
    queryFn: () => billingService.calculateCopay({ invoice_id: invoiceId }),
    enabled: false,
  });

  const calculateMutation = useMutation({
    mutationFn: () => billingService.calculateCopay({ invoice_id: invoiceId }),
    onSuccess: () => refetch(),
  });

  const copay = data as CopayCalculation | undefined;

  return (
    <Card withBorder p="sm">
      {!copay && !isLoading && (
        <Button
          tone="primary"
          size="xs"
          onClick={() => calculateMutation.mutate()}
          loading={calculateMutation.isPending}
        >
          Calculate Co-pay
        </Button>
      )}
      {(isLoading || calculateMutation.isPending) && (
        <Text size="sm" c="dimmed">
          Calculating...
        </Text>
      )}
      {copay && (
        <SimpleGrid cols={5}>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              Invoice Amount
            </Text>
            <Text size="sm" fw={700}>
              {"\u20B9"}
              {copay.invoice_amount.toFixed(2)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              Insurance Coverage
            </Text>
            <Text size="sm" fw={700} c="success">
              {"\u20B9"}
              {copay.insurance_coverage.toFixed(2)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              Co-pay
            </Text>
            <Text size="sm" fw={700}>
              {"\u20B9"}
              {copay.copay_amount.toFixed(2)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              Deductible
            </Text>
            <Text size="sm" fw={700}>
              {"\u20B9"}
              {copay.deductible.toFixed(2)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              Patient Responsibility
            </Text>
            <Text size="sm" fw={700} c="danger">
              {"\u20B9"}
              {copay.patient_responsibility.toFixed(2)}
            </Text>
          </Stack>
        </SimpleGrid>
      )}
    </Card>
  );
}

// ── ER Fast Invoice Modal ─────────────────────────────────

export function InvoiceDetail({
  invoiceId,
  canCreate,
  canPay,
  initialAction,
  onClearAction,
}: {
  invoiceId: string;
  canCreate: boolean;
  canPay: boolean;
  initialAction?: "payment" | null;
  onClearAction?: () => void;
}) {
  const { t } = useTranslation("billing");
  const emit = useClinicalEmit();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // `canCreate` — `billing.invoices.create` — is the right code for STARTING an
  // invoice and the wrong one for everything done to a draft afterwards. Editing
  // its lines and issuing it need `update`; cancelling needs `cancel`. A biller
  // who may raise a draft but not issue it was shown the Issue button anyway.
  const canEditDraft = useHasPermission(P.BILLING.INVOICES_UPDATE);
  const canCancelInvoice = useHasPermission(P.BILLING.INVOICES_CANCEL);
  const canPrintBillingDocs = useHasPermission(P.BILLING.RECEIPTS_PRINT);
  const amountAccess = useProtectedFieldAccess("billing.amount");
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const patientAddressAccess = useProtectedFieldAccess("patients.address");
  const uhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);
  const billingDisplayAccess: BillingDisplayAccess = {
    amount: amountAccess,
    patientAddress: patientAddressAccess,
    patientName: patientNameAccess,
    uhid: uhidAccess,
  };
  const [addItemOpened, addItemHandlers] = useDisclosure(false);
  const [paymentOpened, { open: openPaymentPanel, close: closePaymentPanel }] =
    useDisclosure(false);
  const [gatewayOpened, gatewayHandlers] = useDisclosure(false);
  const [discountOpened, discountHandlers] = useDisclosure(false);
  const [copayOpened, copayHandlers] = useDisclosure(false);
  const itemDefaults: BillingInvoiceItemFormInput = {
    charge_code: "",
    description: "",
    source: "manual",
    quantity: 1,
    unit_price: 0,
    tax_percent: 0,
  };
  const discountDefaults: BillingDiscountFormInput = {
    discount_type: "percentage",
    discount_value: 0,
    reason: "",
  };
  const {
    control: itemControl,
    register: registerItem,
    reset: resetItem,
    handleSubmit: handleSubmitItem,
    formState: { errors: itemErrors },
  } = useForm<BillingInvoiceItemFormInput>({
    resolver: zodResolver(billingInvoiceItemFormSchema),
    defaultValues: itemDefaults,
  });
  const {
    control: discountControl,
    register: registerDiscount,
    reset: resetDiscount,
    handleSubmit: handleSubmitDiscount,
    formState: { errors: discountErrors },
  } = useForm<BillingDiscountFormInput>({
    resolver: zodResolver(billingDiscountFormSchema),
    defaultValues: discountDefaults,
  });

  const { data } = useQuery({
    queryKey: ["invoice-detail", invoiceId],
    queryFn: () => billingService.getInvoice(invoiceId),
  });

  const issueMutation = useMutation({
    mutationFn: () => billingService.issueInvoice(invoiceId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-invoices", result.patient_id] });
      emit("billing.invoice.finalized", {
        admission_id: result.admission_id,
        encounter_id: result.encounter_id,
        invoice_id: result.id,
        invoice_number: result.invoice_number,
        patient_id: result.patient_id,
        status: result.status,
      });
      // Cashier flow: issuing is almost always followed by collecting —
      // land straight on the payment panel via the ?action=payment link.
      if (canPay && invoiceBalance(result) > 0) {
        navigate(billingInvoicePaymentRoute(invoiceId), { replace: true });
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => billingService.cancelInvoice(invoiceId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] }),
  });

  const closeZeroMutation = useMutation({
    mutationFn: () => billingService.closeZeroInvoice(invoiceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Zero-balance bill settled.", { title: "Invoice closed" });
    },
    onError: (error: Error) => {
      toast.error(error.message, { title: "Could not close" });
    },
  });

  const invoicePrintMutation = useMutation({
    mutationFn: async () => {
      const printData = await billingService.getInvoicePrintData(invoiceId);
      const balance = billingInvoiceBalance(
        printData.invoice.total_amount,
        printData.invoice.paid_amount,
      );
      const canSeeAmounts =
        billingDisplayAccess.amount === "edit" || billingDisplayAccess.amount === "view";
      // No QR on a settled bill, and none for a user who is not allowed to see
      // the amount — the URI carries it.
      if (balance <= 0 || !canSeeAmounts) {
        return { printData, upiUri: undefined };
      }
      try {
        const qr = await paymentsService.generateUpiQr({
          amount: balance,
          invoice_id: invoiceId,
          description: `Invoice ${printData.invoice.invoice_number}`,
        });
        return { printData, upiUri: qr.upi_uri };
      } catch {
        // A hospital with no UPI configured still needs its bill. Print without.
        return { printData, upiUri: undefined };
      }
    },
    onSuccess: ({ printData, upiUri }) => {
      printInvoicePacket(printData, billingDisplayAccess, upiUri);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to prepare invoice packet", {
        title: "Invoice print failed",
      });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: (item: AddInvoiceItemRequest) => billingService.addInvoiceItem(invoiceId, item),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      addItemHandlers.close();
      resetItem(itemDefaults);
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => billingService.removeInvoiceItem(invoiceId, itemId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] }),
  });

  const payMutation = useMutation({
    mutationFn: (pay: RecordPaymentRequest) => billingService.recordPayment(invoiceId, pay),
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-context", inv.patient_id] });
      void queryClient.invalidateQueries({ queryKey: ["patient-invoices", inv.patient_id] });
      emit("billing.payment.received", {
        amount: variables.amount,
        admission_id: inv.admission_id,
        encounter_id: inv.encounter_id,
        invoice_id: result.invoice_id,
        mode: variables.mode,
        patient_id: inv.patient_id,
        payment_id: result.id,
      });
      closePaymentPanel();
      onClearAction?.();
    },
  });

  const { data: discounts = [] } = useQuery({
    queryKey: ["invoice-discounts", invoiceId],
    queryFn: () => billingService.listInvoiceDiscounts(invoiceId),
  });

  const addDiscountMutation = useMutation({
    mutationFn: (d: AddDiscountRequest) => billingService.addDiscount(invoiceId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-discounts", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      discountHandlers.close();
      resetDiscount(discountDefaults);
    },
  });

  const removeDiscountMutation = useMutation({
    mutationFn: (discId: string) => billingService.removeDiscount(invoiceId, discId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-discounts", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
    },
  });

  const { data: receipts = [] } = useQuery({
    queryKey: ["invoice-receipts", invoiceId],
    queryFn: () => billingService.listReceipts(invoiceId),
    enabled: canPrintBillingDocs,
  });

  const receiptMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const receipt = await billingService.generateReceipt(invoiceId, paymentId);
      const printData = await billingService.getReceiptPrintData(paymentId);
      return { printData, receipt };
    },
    onSuccess: ({ printData }) => {
      printReceiptPacket(printData, billingDisplayAccess);
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoice-receipts", invoiceId] });
      toast.success("Customer and office copies are ready to print", {
        title: "Receipt generated",
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to prepare receipt packet", {
        title: "Receipt print failed",
      });
    },
  });

  useEffect(() => {
    if (initialAction !== "payment" || !data) {
      return;
    }

    window.requestAnimationFrame(() => {
      document.getElementById("billing-payments")?.scrollIntoView({ block: "start" });
    });

    if (paymentOpened) {
      return;
    }

    const invoiceDetail = data as InvoiceDetailResponse;
    const invoice = invoiceDetail.invoice;
    const invoiceStatus = invoiceDisplayStatus(invoice);
    const invoiceBalanceAmount = invoiceBalance(invoice);
    const canOpenPaymentPanel =
      amountAccess === "edit" &&
      canPay &&
      (invoiceStatus === "issued" || invoiceStatus === "partially_paid") &&
      invoiceBalanceAmount > 0;

    if (!canOpenPaymentPanel) {
      return;
    }

    openPaymentPanel();
  }, [amountAccess, canPay, data, initialAction, openPaymentPanel, paymentOpened]);

  if (!data) return <Text c="dimmed">Loading...</Text>;

  const detail = data as InvoiceDetailResponse;
  const inv = detail.invoice;
  const displayStatus = invoiceDisplayStatus(inv);
  const invoiceSignal = billingInvoiceStatusSignal(displayStatus);
  const balance = invoiceBalance(inv);
  const balanceSignal = billingInvoiceBalanceSignal(balance, amountAccess !== "hidden");
  const balanceSignalLabel = invoiceBalanceLabel(t, balanceSignal);
  const completedEvents: ClinicalEventName[] = ["billing.invoice.created"];
  if (
    displayStatus === "issued" ||
    displayStatus === "partially_paid" ||
    displayStatus === "paid"
  ) {
    completedEvents.push("billing.invoice.finalized");
  }
  if (
    displayStatus === "partially_paid" ||
    displayStatus === "paid" ||
    detail.payments.length > 0
  ) {
    completedEvents.push("billing.payment.received");
  }
  const journeyContext: ClinicalJourneyContext = {
    patientId: inv.patient_id,
    activeEncounterId: inv.encounter_id,
    activeAdmissionId: inv.admission_id,
    activeAdmissionStatus: inv.admission_id ? "admitted" : null,
    activeInvoiceId: inv.id,
    activeOrderContext: inv.admission_id ? "ipd" : inv.encounter_id ? "opd" : null,
    completedEvents,
  };
  const canRecordPayment =
    amountAccess === "edit" &&
    canPay &&
    (displayStatus === "issued" || displayStatus === "partially_paid") &&
    balance > 0;
  const openPaymentForm = () => {
    if (paymentOpened) {
      closePaymentPanel();
      onClearAction?.();
      return;
    }
    navigate(billingInvoicePaymentRoute(invoiceId), { replace: true });
    openPaymentPanel();
  };
  const handleAddInvoiceItem = (values: BillingInvoiceItemFormInput) => {
    addItemMutation.mutate({
      charge_code: values.charge_code.trim(),
      description: values.description.trim(),
      source: values.source,
      quantity: billingIntegerOrFallback(values.quantity, 1),
      unit_price: billingNumberOrFallback(values.unit_price, 0),
      tax_percent: billingNumberOrFallback(values.tax_percent, 0),
    });
  };
  const handleAddDiscount = (values: BillingDiscountFormInput) => {
    addDiscountMutation.mutate({
      discount_type: values.discount_type,
      discount_value: billingNumberOrFallback(values.discount_value, 0),
      reason: billingOptionalText(values.reason),
    });
  };
  const handleGatewayPaymentSuccess = (_paymentId: string, settlement: PaymentModalSettlement) => {
    if (settlement.source === "manual") {
      payMutation.mutate({
        amount: settlement.amount,
        mode: settlement.mode,
        reference_number: settlement.reference_number,
      });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
    void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    gatewayHandlers.close();
    onClearAction?.();
  };

  return (
    <Stack className={classes.invoiceWorkspace}>
      <Card withBorder className={classes.commandBar}>
        <Stack gap="xs">
          <PatientContextBanner patientId={inv.patient_id} hideLoadingState variant="financial" />
          <PatientFlowNavigator
            patientId={inv.patient_id}
            active="billing"
            activeEncounterId={inv.encounter_id}
            activeAdmissionId={inv.admission_id}
            activeInvoiceId={inv.id}
            activeOrderContext={inv.admission_id ? "ipd" : inv.encounter_id ? "opd" : null}
            completedEvents={completedEvents}
            compact
          />
          <Group justify="space-between" align="flex-start" gap="sm">
            <Stack gap={4}>
              <Group gap="xs">
                <Text fw={700}>{inv.invoice_number}</Text>
                <OperationalSignal
                  label={invoiceStatusLabel(t, displayStatus)}
                  shape={invoiceSignal.shape}
                  tone={invoiceSignal.tone}
                />
                {inv.is_interim && <Badge tone="accent">Interim #{inv.sequence_number}</Badge>}
                {inv.is_er_deferred && <Badge tone="danger">ER Deferred</Badge>}
              </Group>
              <Group gap="md">
                <Text size="sm">Total: {billingAmountText(inv.total_amount, amountAccess)}</Text>
                <Text size="sm">Paid: {billingAmountText(inv.paid_amount, amountAccess)}</Text>
                <Text
                  size="sm"
                  c={amountAccess === "hidden" ? undefined : balance > 0 ? "danger" : "success"}
                >
                  Balance: {billingAmountText(balance, amountAccess)}
                </Text>
              </Group>
              <PatientJourneyActions
                context={journeyContext}
                hiddenActionIds={BILLING_DETAIL_HIDDEN_ACTIONS}
                size="xs"
              />
            </Stack>
            <Group gap="xs" justify="flex-end">
              {canPay && displayStatus === "issued" && balance === 0 && (
                <Tooltip label="No money to collect — record this free / scheme bill as settled">
                  <Button
                    tone="secondary"
                    size="xs"
                    leftSection={<IconCheck size={14} />}
                    loading={closeZeroMutation.isPending}
                    onClick={() => closeZeroMutation.mutate()}
                  >
                    Close ₹0 bill
                  </Button>
                </Tooltip>
              )}
              {canPrintBillingDocs && (
                <Tooltip
                  label={
                    inv.status === "draft"
                      ? "Issue the invoice before printing"
                      : "Customer and office copies"
                  }
                >
                  <Button
                    tone="secondary"
                    size="xs"
                    leftSection={<IconPrinter size={14} />}
                    loading={invoicePrintMutation.isPending}
                    disabled={inv.status === "draft"}
                    onClick={() => invoicePrintMutation.mutate()}
                  >
                    Print packet
                  </Button>
                </Tooltip>
              )}
              {inv.status !== "draft" && (
                <DocumentActions templateCode="invoice_gst" sourceId={inv.id} />
              )}
              {canEditDraft && inv.status === "draft" && (
                <Button
                  tone="primary"
                  size="xs"
                  leftSection={<IconCheck size={14} />}
                  loading={issueMutation.isPending}
                  onClick={() => issueMutation.mutate()}
                >
                  Issue
                </Button>
              )}
              {canCancelInvoice && inv.status === "draft" && (
                <Button
                  tone="subtle-danger"
                  size="xs"
                  leftSection={<IconX size={14} />}
                  loading={cancelMutation.isPending}
                  onClick={() =>
                    confirmDestructive({
                      title: "Cancel invoice",
                      message:
                        "Cancel this draft invoice? Its line items will no longer be billable from this draft.",
                      confirmLabel: "Cancel invoice",
                      onConfirm: () => cancelMutation.mutate(),
                    })
                  }
                >
                  Cancel
                </Button>
              )}
              {canRecordPayment && (
                <>
                  <Button
                    tone="primary"
                    size="xs"
                    leftSection={<IconCash size={14} />}
                    onClick={openPaymentForm}
                  >
                    {t("button.recordPayment")}
                  </Button>
                  <Button
                    tone="secondary"
                    size="xs"
                    leftSection={<IconCreditCard size={14} />}
                    onClick={gatewayHandlers.open}
                  >
                    {t("button.gateway")}
                  </Button>
                </>
              )}
            </Group>
          </Group>
        </Stack>
      </Card>

      {initialAction === "payment" && (
        <Alert tone={canRecordPayment ? "warning" : "neutral"} title={t("handoff.payment.title")}>
          <Group justify="space-between" align="center" gap="sm">
            <Text size="sm">
              {canRecordPayment
                ? t("handoff.invoicePayment.readyMessage")
                : t("handoff.invoicePayment.unavailableMessage")}
            </Text>
            <Group gap="xs">
              {canRecordPayment && (
                <Button
                  tone="primary"
                  size="xs"
                  leftSection={<IconCash size={14} />}
                  onClick={openPaymentForm}
                >
                  {t("button.recordPayment")}
                </Button>
              )}
              {onClearAction && (
                <Button tone="ghost" size="xs" onClick={onClearAction}>
                  {t("button.dismiss")}
                </Button>
              )}
            </Group>
          </Group>
        </Alert>
      )}

      <Grid align="flex-start" className={classes.workspaceGrid}>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack className={classes.workspaceMain}>
            <Card id="billing-summary" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={700}>Invoice summary</Text>
                  {canPrintBillingDocs && (
                    <Group gap={4}>
                      {BILLING_INVOICE_PRINT_COPIES.map((copy) => (
                        <Badge key={copy.label} tone="accent">
                          {printCopyRouteLabel(copy)}
                        </Badge>
                      ))}
                    </Group>
                  )}
                </Group>
                {(Number(inv.cgst_amount ?? 0) > 0 ||
                  Number(inv.sgst_amount ?? 0) > 0 ||
                  Number(inv.igst_amount ?? 0) > 0) && (
                  <Group gap="xs">
                    <Badge tone="success" size="sm">
                      CGST: {billingAmountText(inv.cgst_amount, amountAccess)}
                    </Badge>
                    <Badge tone="success" size="sm">
                      SGST: {billingAmountText(inv.sgst_amount, amountAccess)}
                    </Badge>
                    <Badge tone="primary" size="sm">
                      IGST: {billingAmountText(inv.igst_amount, amountAccess)}
                    </Badge>
                    {Number(inv.cess_amount ?? 0) > 0 && (
                      <Badge tone="warning" size="sm">
                        Cess: {billingAmountText(inv.cess_amount, amountAccess)}
                      </Badge>
                    )}
                  </Group>
                )}
                {inv.is_interim && inv.billing_period_start && inv.billing_period_end && (
                  <Text size="xs" c="dimmed">
                    Period: {new Date(inv.billing_period_start).toLocaleDateString()} -{" "}
                    {new Date(inv.billing_period_end).toLocaleDateString()}
                  </Text>
                )}
                {copayOpened && (
                  <Box id="billing-copay">
                    <CopayBreakdown invoiceId={invoiceId} />
                  </Box>
                )}
              </Stack>
            </Card>

            <Card id="billing-items" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={700}>Items</Text>
                  {canEditDraft && inv.status === "draft" && (
                    <Button
                      tone="secondary"
                      size="xs"
                      leftSection={<IconPlus size={14} />}
                      onClick={addItemHandlers.toggle}
                    >
                      {addItemOpened ? "Close" : "Add Item"}
                    </Button>
                  )}
                </Group>
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Description</Table.Th>
                      <Table.Th>Qty</Table.Th>
                      <Table.Th>Price</Table.Th>
                      <Table.Th>Tax</Table.Th>
                      <Table.Th>Total</Table.Th>
                      {canEditDraft && inv.status === "draft" && <Table.Th />}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {detail.items.map((item) => (
                      <Table.Tr key={item.id}>
                        <Table.Td>{item.description}</Table.Td>
                        <Table.Td>{item.quantity}</Table.Td>
                        <Table.Td>{billingAmountText(item.unit_price, amountAccess)}</Table.Td>
                        <Table.Td>{item.tax_percent}%</Table.Td>
                        <Table.Td>{billingAmountText(item.total_price, amountAccess)}</Table.Td>
                        {canEditDraft && inv.status === "draft" && (
                          <Table.Td>
                            <IconButton
                              tone="danger"
                              aria-label="Delete"
                              onClick={() =>
                                confirmDestructive({
                                  title: "Remove item",
                                  message: "Remove this line item from the invoice?",
                                  confirmLabel: "Remove item",
                                  onConfirm: () => removeItemMutation.mutate(item.id),
                                })
                              }
                            >
                              <IconTrash size={14} />
                            </IconButton>
                          </Table.Td>
                        )}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>

                {canEditDraft && inv.status === "draft" && addItemOpened && (
                  <Stack
                    component="form"
                    gap="xs"
                    onSubmit={handleSubmitItem(handleAddInvoiceItem)}
                  >
                    <Group grow>
                      <TextInput
                        label="Charge Code"
                        required
                        error={itemErrors.charge_code?.message}
                        {...registerItem("charge_code")}
                      />
                      <Controller
                        control={itemControl}
                        name="source"
                        render={({ field }) => (
                          <Select
                            label="Source"
                            data={billingChargeSourceOptions}
                            value={field.value}
                            onChange={(value) => field.onChange(value ?? "manual")}
                            error={itemErrors.source?.message}
                          />
                        )}
                      />
                    </Group>
                    <TextInput
                      label="Description"
                      required
                      error={itemErrors.description?.message}
                      {...registerItem("description")}
                    />
                    <Group grow>
                      <Controller
                        control={itemControl}
                        name="quantity"
                        render={({ field }) => (
                          <NumberInput
                            label="Qty"
                            min={1}
                            value={field.value}
                            onChange={field.onChange}
                            error={itemErrors.quantity?.message}
                          />
                        )}
                      />
                      <Controller
                        control={itemControl}
                        name="unit_price"
                        render={({ field }) => (
                          <NumberInput
                            label="Unit Price"
                            min={0}
                            decimalScale={2}
                            value={field.value}
                            onChange={field.onChange}
                            error={itemErrors.unit_price?.message}
                          />
                        )}
                      />
                      <Controller
                        control={itemControl}
                        name="tax_percent"
                        render={({ field }) => (
                          <NumberInput
                            label="Tax %"
                            min={0}
                            max={100}
                            decimalScale={2}
                            value={field.value}
                            onChange={field.onChange}
                            error={itemErrors.tax_percent?.message}
                          />
                        )}
                      />
                    </Group>
                    <Button
                      tone="primary"
                      size="xs"
                      type="submit"
                      loading={addItemMutation.isPending}
                    >
                      Add
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Card>

            <Card id="billing-payments" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={700}>{t("payments")}</Text>
                  {canRecordPayment && (
                    <Group gap="xs">
                      <Button
                        tone="primary"
                        size="xs"
                        leftSection={<IconCash size={14} />}
                        onClick={openPaymentForm}
                      >
                        {paymentOpened ? t("label.close") : t("button.recordPayment")}
                      </Button>
                      <Button
                        tone="secondary"
                        size="xs"
                        leftSection={<IconCreditCard size={14} />}
                        onClick={gatewayHandlers.open}
                      >
                        {t("button.gateway")}
                      </Button>
                    </Group>
                  )}
                </Group>
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t("label.amount")}</Table.Th>
                      <Table.Th>{t("label.mode")}</Table.Th>
                      <Table.Th>{t("label.reference")}</Table.Th>
                      <Table.Th>{t("label.date")}</Table.Th>
                      {canPrintBillingDocs && <Table.Th />}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {detail.payments.map((p) => (
                      <Table.Tr key={p.id}>
                        <Table.Td>{billingAmountText(p.amount, amountAccess)}</Table.Td>
                        <Table.Td>{p.mode}</Table.Td>
                        <Table.Td>{p.reference_number ?? "—"}</Table.Td>
                        <Table.Td>{new Date(p.created_at).toLocaleString()}</Table.Td>
                        {canPrintBillingDocs && (
                          <Table.Td>
                            <Tooltip label="Generate + print receipt packet">
                              <IconButton
                                tone="default"
                                aria-label="Generate + print receipt packet"
                                size="sm"
                                loading={receiptMutation.isPending}
                                onClick={() => receiptMutation.mutate(p.id)}
                              >
                                <IconReceipt size={14} />
                              </IconButton>
                            </Tooltip>
                          </Table.Td>
                        )}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>

                {canRecordPayment && paymentOpened && (
                  <PaymentCollectPanel
                    invoiceId={invoiceId}
                    balance={balance}
                    onRecorded={(payments) => {
                      for (const payment of payments) {
                        emit("billing.payment.received", {
                          amount: Number(payment.amount),
                          admission_id: inv.admission_id,
                          encounter_id: inv.encounter_id,
                          invoice_id: payment.invoice_id,
                          mode: payment.mode,
                          patient_id: inv.patient_id,
                          payment_id: payment.id,
                        });
                      }
                      void queryClient.invalidateQueries({
                        queryKey: ["invoice-detail", invoiceId],
                      });
                      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
                      void queryClient.invalidateQueries({
                        queryKey: ["patient-context", inv.patient_id],
                      });
                      void queryClient.invalidateQueries({
                        queryKey: ["patient-invoices", inv.patient_id],
                      });
                      closePaymentPanel();
                      onClearAction?.();
                    }}
                    onPrint={
                      canPrintBillingDocs
                        ? (payments) => {
                            const last = payments.at(-1);
                            if (last) receiptMutation.mutate(last.id);
                          }
                        : undefined
                    }
                    autoFocus
                  />
                )}
                {canRecordPayment && (
                  <PaymentModal
                    opened={gatewayOpened}
                    onClose={gatewayHandlers.close}
                    amount={balance}
                    amountAccess={amountAccess}
                    invoiceId={invoiceId}
                    onSuccess={handleGatewayPaymentSuccess}
                  />
                )}
              </Stack>
            </Card>

            {canPrintBillingDocs && receipts.length > 0 && (
              <Card id="billing-receipts" withBorder>
                <Stack gap="sm">
                  <Text fw={700}>Issued receipts</Text>
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Receipt #</Table.Th>
                        <Table.Th>{t("label.date")}</Table.Th>
                        <Table.Th>{t("label.amount")}</Table.Th>
                        <Table.Th>Printed</Table.Th>
                        <Table.Th />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {receipts.map((r) => (
                        <Table.Tr key={r.id}>
                          <Table.Td>
                            <Text ff="monospace" size="sm">
                              {r.receipt_number}
                            </Text>
                          </Table.Td>
                          <Table.Td>{new Date(r.receipt_date).toLocaleString()}</Table.Td>
                          <Table.Td>{billingAmountText(r.amount, amountAccess)}</Table.Td>
                          <Table.Td>
                            <Badge tone={r.printed_at ? "success" : "neutral"} size="sm">
                              {r.printed_at ? "Printed" : "Not printed"}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Tooltip label="Reprint receipt">
                              <IconButton
                                tone="default"
                                aria-label="Reprint receipt"
                                size="sm"
                                loading={receiptMutation.isPending}
                                onClick={() => receiptMutation.mutate(r.payment_id)}
                              >
                                <IconReceipt size={14} />
                              </IconButton>
                            </Tooltip>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Stack>
              </Card>
            )}

            <Card id="billing-discounts" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={700}>Discounts</Text>
                  {canCreate && inv.status === "draft" && (
                    <Button
                      tone="secondary"
                      size="xs"
                      leftSection={<IconDiscount2 size={14} />}
                      onClick={discountHandlers.toggle}
                    >
                      {discountOpened ? "Close" : "Add Discount"}
                    </Button>
                  )}
                </Group>
                {discounts.length > 0 ? (
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Type</Table.Th>
                        <Table.Th>Value</Table.Th>
                        <Table.Th>Reason</Table.Th>
                        {canCreate && <Table.Th />}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {discounts.map((d: InvoiceDiscount) => (
                        <Table.Tr key={d.id}>
                          <Table.Td>
                            <Badge tone="neutral">{d.discount_type}</Badge>
                          </Table.Td>
                          <Table.Td>
                            {d.discount_type === "percentage"
                              ? `${d.discount_value}%`
                              : billingAmountText(d.discount_value, amountAccess)}
                          </Table.Td>
                          <Table.Td>{d.reason ?? "—"}</Table.Td>
                          {canCreate && (
                            <Table.Td>
                              <IconButton
                                tone="danger"
                                aria-label="Delete"
                                size="sm"
                                onClick={() =>
                                  confirmDestructive({
                                    title: "Remove discount",
                                    message:
                                      "Remove this discount from the invoice? Totals will be recalculated.",
                                    confirmLabel: "Remove discount",
                                    onConfirm: () => removeDiscountMutation.mutate(d.id),
                                  })
                                }
                              >
                                <IconTrash size={14} />
                              </IconButton>
                            </Table.Td>
                          )}
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Text size="sm" c="dimmed">
                    No discounts applied
                  </Text>
                )}

                {canCreate && inv.status === "draft" && discountOpened && (
                  <Stack
                    component="form"
                    gap="xs"
                    onSubmit={handleSubmitDiscount(handleAddDiscount)}
                  >
                    <Group grow>
                      <Controller
                        control={discountControl}
                        name="discount_type"
                        render={({ field }) => (
                          <Select
                            label="Type"
                            data={billingDiscountTypeOptions}
                            value={field.value}
                            onChange={(value) => field.onChange(value ?? "percentage")}
                            error={discountErrors.discount_type?.message}
                          />
                        )}
                      />
                      <Controller
                        control={discountControl}
                        name="discount_value"
                        render={({ field }) => (
                          <NumberInput
                            label="Value"
                            required
                            min={0}
                            decimalScale={2}
                            value={field.value}
                            onChange={field.onChange}
                            error={discountErrors.discount_value?.message}
                          />
                        )}
                      />
                    </Group>
                    <TextInput
                      label="Reason"
                      error={discountErrors.reason?.message}
                      {...registerDiscount("reason")}
                    />
                    <Button
                      tone="primary"
                      size="xs"
                      type="submit"
                      loading={addDiscountMutation.isPending}
                    >
                      Apply Discount
                    </Button>
                  </Stack>
                )}

                {inv.discount_amount !== "0" && inv.discount_amount !== "0.00" && (
                  <Text size="sm" fw={500} c="orange">
                    Total Discount: {billingAmountText(inv.discount_amount, amountAccess)}
                  </Text>
                )}
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Box className={classes.contextRail}>
            <Stack gap="sm">
              <Stack gap={2}>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  Billing workspace
                </Text>
                <Text size="sm" fw={700}>
                  {inv.invoice_number}
                </Text>
              </Stack>
              <Group gap="xs">
                <OperationalSignal
                  label={invoiceStatusLabel(t, displayStatus)}
                  shape={invoiceSignal.shape}
                  size="xs"
                  tone={invoiceSignal.tone}
                />
                <OperationalSignal
                  label={balanceSignalLabel}
                  shape={balanceSignal.shape}
                  size="xs"
                  tone={balanceSignal.tone}
                />
              </Group>
              <Divider />
              <SimpleGrid cols={{ base: 1, sm: 3, lg: 1 }}>
                <BillingSummaryMetric
                  label="Total"
                  value={billingAmountText(inv.total_amount, amountAccess)}
                />
                <BillingSummaryMetric
                  label="Paid"
                  value={billingAmountText(inv.paid_amount, amountAccess)}
                />
                <BillingSummaryMetric
                  label="Balance"
                  value={billingAmountText(balance, amountAccess)}
                  tone={amountAccess === "hidden" ? undefined : balance > 0 ? "danger" : "success"}
                />
              </SimpleGrid>
              <Divider />
              <Stack gap="xs">
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  Navigate
                </Text>
                <Button
                  tone="secondary"
                  size="xs"
                  component="a"
                  href="#billing-summary"
                  leftSection={<IconFileInvoice size={14} />}
                  fullWidth
                >
                  Summary
                </Button>
                <Button
                  tone="secondary"
                  size="xs"
                  component="a"
                  href="#billing-items"
                  leftSection={<IconTags size={14} />}
                  fullWidth
                >
                  Items
                </Button>
                <Button
                  tone="secondary"
                  size="xs"
                  component="a"
                  href="#billing-payments"
                  leftSection={<IconReceipt size={14} />}
                  fullWidth
                >
                  Payments
                </Button>
                <Button
                  tone="secondary"
                  size="xs"
                  component="a"
                  href="#billing-discounts"
                  leftSection={<IconDiscount2 size={14} />}
                  fullWidth
                >
                  Discounts
                </Button>
              </Stack>
              <Divider />
              <Stack gap="xs">
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  {t("label.actions")}
                </Text>
                {canRecordPayment && (
                  <>
                    <Button
                      tone="primary"
                      size="xs"
                      leftSection={<IconCash size={14} />}
                      onClick={openPaymentForm}
                      fullWidth
                    >
                      {t("button.recordPayment")}
                    </Button>
                    <Button
                      tone="secondary"
                      size="xs"
                      leftSection={<IconCreditCard size={14} />}
                      onClick={gatewayHandlers.open}
                      fullWidth
                    >
                      {t("button.gateway")}
                    </Button>
                  </>
                )}
                {canCreate && inv.status === "draft" && (
                  <>
                    <Button
                      tone="secondary"
                      size="xs"
                      leftSection={<IconPlus size={14} />}
                      onClick={addItemHandlers.toggle}
                      fullWidth
                    >
                      Add Item
                    </Button>
                    <Button
                      tone="secondary"
                      size="xs"
                      leftSection={<IconDiscount2 size={14} />}
                      onClick={discountHandlers.toggle}
                      fullWidth
                    >
                      Add Discount
                    </Button>
                  </>
                )}
                <Button
                  tone="secondary"
                  size="xs"
                  leftSection={<IconShieldCheck size={14} />}
                  onClick={copayHandlers.toggle}
                  fullWidth
                >
                  {copayOpened ? "Close Co-pay" : "Calculate Co-pay"}
                </Button>
                <Button
                  tone="secondary"
                  size="xs"
                  leftSection={<IconFileInvoice size={14} />}
                  onClick={() => navigate(`/billing?tab=invoices&patient_id=${inv.patient_id}`)}
                  fullWidth
                >
                  Patient Ledger
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
