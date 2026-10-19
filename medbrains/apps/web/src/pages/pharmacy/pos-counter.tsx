// Pharmacy PosCounterTab — split from pharmacy.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Card,
  Group,
  Modal,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { PharmacyPosSaleFormInput } from "@medbrains/schemas";
import { pharmacyPosSaleFormSchema } from "@medbrains/schemas";
import { useFieldAccess, useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import type { PharmacyCatalog, PharmacyPosSale, PosTenderInput } from "@medbrains/types";
import { P } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import { IconAlertTriangle, IconCash, IconReceipt, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import type { DataTableFilter } from "@/components";
import { DataTable } from "@/components";
import { DrugSearchSelect } from "@/components/DrugSearchSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { PaymentModal, type PaymentModalSettlement } from "@/components/PaymentModal";
import { isSafetyRefusal } from "@/components/Pharmacy/safetyGate";
import { PrintDocumentButton } from "@/components/Print/PrintDocumentButton";
import { Alert, Badge, Button, IconButton, Table, toast } from "@/components/ui";
import {
  formIntegerOrFallback,
  formNumberOrFallback,
  optionalFormText,
  pharmacyPosPaymentModeOptions,
} from "@/forms/pharmacy.form";

import { pharmacyService } from "@/services/pharmacy.service";
import { findAllergyConflicts } from "@/utils/allergyMatch";
import { CounterDrawer, useActiveCashDrawer } from "./counter-drawer";
import { CounterPatientSelect } from "./counter-patient-select";
import { CounterRxFields } from "./counter-rx-fields";
import { CounterSettings } from "./counter-settings";
import {
  type CounterRx,
  EMPTY_COUNTER_RX,
  isPrescriptionOnly,
  needsCounterRx,
  offMrpPercent,
  posCheckoutBlocker,
  posTotals,
} from "./pos-checkout";
import { PosReturnModal } from "./pos-return-modal";
import { ReceiptReturnLookup } from "./receipt-return-lookup";
import {
  canEditPharmacyField,
  canViewPharmacyField,
  PharmacyPatientCell,
  posSaleLinePrice,
  posSaleLineQuantity,
  posSalePayloadPatientId,
  renderPharmacySensitiveCurrency,
  sharedColorBadgeTone,
  statusColors,
} from "./shared";

/** Catalogue facts about a basket line the sale payload does not carry. */
interface PosLineMeta {
  schedule: string | null;
  isControlled: boolean;
  stock: number;
  /** The drug's GST rate from the catalogue (`tax_percent`). */
  gstRate: number;
  /** MRP of the batch FEFO will issue, as the server priced it. */
  mrp: number;
}

/** Tenders a counter takes before the sale exists; a gateway order needs a record. */
const POS_PAYMENT_MODES = ["cash", "upi_qr", "card"] as const;
const NON_CASH_MODES = ["upi_qr", "card"] as const;

/** Part payments the counter takes; credit only against a registered patient. */
const SPLIT_MODES_WALK_IN = ["card", "upi"] as const;
const SPLIT_MODES_PATIENT = ["card", "upi", "credit"] as const;
/** Literal until the permission catalogue is regenerated from Rust. */
const PERM_DISCOUNT_APPROVE = P.PHARMACY.POS_DISCOUNT_APPROVE;
const PERM_COUNTER_PATIENT_SEARCH = P.PHARMACY.PATIENTS_SEARCH;
const PERM_PHARMACY_BILL_PRINT = P.PHARMACY.BILLS_PRINT;

function tenderOf(settlement: PaymentModalSettlement): PosTenderInput[] {
  const parts: PosTenderInput[] = (settlement.parts ?? []).map((part) => ({
    mode: part.mode,
    amount: part.amount,
    reference: part.reference,
  }));
  if (settlement.amount > 0) {
    parts.push({
      mode: settlement.mode,
      amount:
        settlement.mode === "cash" ? (settlement.tendered ?? settlement.amount) : settlement.amount,
      reference: settlement.reference_number,
    });
  }
  return parts;
}

export function PosCounterTab({
  canView,
  canCreate,
  canCancel,
  canReturn,
  canViewPatientRecord,
}: {
  canView: boolean;
  canCreate: boolean;
  canCancel: boolean;
  canReturn: boolean;
  canViewPatientRecord: boolean;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canViewBillingInvoice = useHasPermission(P.BILLING.INVOICES_VIEW);
  const drugSearchRef = useRef<HTMLInputElement>(null);
  const [lineMeta, setLineMeta] = useState<Record<string, PosLineMeta>>({});
  const [completedSale, setCompletedSale] = useState<PharmacyPosSale | null>(null);
  // `null` until a price lookup answers; unknown is not "no limit".
  const [discountLimit, setDiscountLimit] = useState<number | null>(null);
  const [discountReason, setDiscountReason] = useState("");
  // The prescription behind a Schedule H/H1 line: prescriber and address.
  const [counterRx, setCounterRx] = useState<CounterRx>(EMPTY_COUNTER_RX);
  const canApproveDiscount = useHasPermission(PERM_DISCOUNT_APPROVE);
  const canCounterSearch = useHasPermission(PERM_COUNTER_PATIENT_SEARCH);
  const canPrintPharmacyBill = useHasPermission(PERM_PHARMACY_BILL_PRINT);
  const [paymentOpened, { open: openPayment, close: closePayment }] = useDisclosure(false);
  const [saleToCancel, setSaleToCancel] = useState<PharmacyPosSale | null>(null);
  const [returnSaleId, setReturnSaleId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOpened, { open: openCancelModal, close: closeCancelModal }] = useDisclosure(false);
  const walkInNameAccess = useFieldAccess("pharmacy.pos.patient_name");
  const walkInPhoneAccess = useFieldAccess("pharmacy.pos.patient_phone");
  const priceAccess = useFieldAccess("pharmacy.pricing.unit_price");
  const canViewWalkInName = canViewPharmacyField(walkInNameAccess);
  const canViewWalkInPhone = canViewPharmacyField(walkInPhoneAccess);
  const canEditWalkInName = canEditPharmacyField(walkInNameAccess);
  const canEditWalkInPhone = canEditPharmacyField(walkInPhoneAccess);
  const canEditPosAmounts = canEditPharmacyField(priceAccess);
  const posSaleDefaults: PharmacyPosSaleFormInput = {
    patient_id: "",
    patient_name: "",
    patient_phone: "",
    payment_mode: "cash",
    amount_received: 0,
    discount_percent: 0,
    items: [],
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    getValues,
    watch,
    formState: { errors },
  } = useForm<PharmacyPosSaleFormInput>({
    resolver: zodResolver(pharmacyPosSaleFormSchema),
    defaultValues: posSaleDefaults,
  });
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "items",
  });
  const cart = watch("items");
  const discountPercent = watch("discount_percent");
  const registeredPatientId = watch("patient_id");

  // Allergy guard for patient-linked counter sales.
  const [posAllergyReason, setPosAllergyReason] = useState("");
  // The server's medication safety refusal for this basket, if any, and the
  // override reason a pharmacist with the right gives against it.
  const [safetyBlock, setSafetyBlock] = useState<string | null>(null);
  const [safetyReason, setSafetyReason] = useState("");
  const canOverrideSafety = useHasAnyPermission([
    P.PHARMACY.SAFETY.OVERRIDE,
    P.PHARMACY.STEWARDSHIP.APPROVE,
    P.PHARMACY.FORMULARY.APPROVE,
  ]);
  const { data: posPatientAllergies = [] } = useQuery({
    queryKey: ["patient-allergies", registeredPatientId],
    queryFn: () => pharmacyService.listPatientAllergies(registeredPatientId),
    enabled: Boolean(registeredPatientId),
  });
  const posAllergyConflicts = useMemo(() => {
    const allergens = posPatientAllergies
      .filter((a) => a.is_active && a.allergy_type === "drug")
      .map((a) => a.allergen_name);
    if (allergens.length === 0) return [];
    return findAllergyConflicts(
      (cart ?? []).map((c) => c.drug_name ?? ""),
      allergens,
    );
  }, [cart, posPatientAllergies]);
  const posAllergyBlocked = posAllergyConflicts.length > 0 && posAllergyReason.trim().length < 5;

  const { data: daySummary } = useQuery({
    queryKey: ["pharmacy-pos-day-summary"],
    queryFn: () => pharmacyService.getPosDaySummary(),
    enabled: canView,
    refetchInterval: 60_000,
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ["pharmacy-pos-sales"],
    queryFn: () => pharmacyService.listPosSales(),
    enabled: canView || canCancel || canReturn,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => pharmacyService.createPosSale(data),
    onSuccess: (sale, variables) => {
      setCounterRx(EMPTY_COUNTER_RX);
      const patientId = posSalePayloadPatientId(variables);
      const billingInvoiceId = sale.billing_invoice_id;
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-pos"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-pos-day-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-pos-sales"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      if (billingInvoiceId) {
        void queryClient.invalidateQueries({ queryKey: ["invoice-detail", billingInvoiceId] });
      }
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      if (patientId) {
        void queryClient.invalidateQueries({ queryKey: ["patient-context", patientId] });
        void queryClient.invalidateQueries({ queryKey: ["patient-invoices", patientId] });
      }
      reset(posSaleDefaults);
      setLineMeta({});
      setDiscountReason("");
      setCompletedSale(sale);
      drugSearchRef.current?.focus();
      setSafetyBlock(null);
      setSafetyReason("");
      toast.success(
        patientId && billingInvoiceId
          ? "Pharmacy sale recorded and linked to the Billing invoice workbench"
          : "Walk-in sale recorded in Pharmacy POS",
        { title: "Sale Complete" },
      );
    },
    onError: (error: Error) => {
      if (isSafetyRefusal(error)) setSafetyBlock(error.message);
      toast.error(error.message, { title: "Sale not recorded" });
    },
  });

  const cancelSaleMutation = useMutation({
    mutationFn: ({ saleId, reason }: { saleId: string; reason: string }) =>
      pharmacyService.cancelPharmacyPosSale(saleId, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-pos"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-pos-day-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-pos-sales"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      closeCancelSale();
      toast.success("Stock reversal and POS refund entry were recorded", {
        title: "Sale cancelled",
      });
    },
    onError: () => {
      toast.error("The sale may already be cancelled, refunded, or locked by finance controls", {
        title: "Unable to cancel sale",
      });
    },
  });

  const lineGstRate = (catalogItemId: string) => lineMeta[catalogItemId]?.gstRate ?? 0;
  const {
    gross: subtotal,
    discount,
    gst: gstAmount,
    total: totalAmount,
  } = posTotals(
    cart.map((item) => ({
      quantity: posSaleLineQuantity(item),
      unitPrice: posSaleLinePrice(item),
      gstRate: lineGstRate(item.catalog_item_id),
    })),
    formNumberOrFallback(discountPercent, 0),
  );
  // MRP value of the basket: what the strips say, before any discount.
  const mrpValue = cart.reduce(
    (sum, item) =>
      sum +
      posSaleLineQuantity(item) * (lineMeta[item.catalog_item_id]?.mrp || posSaleLinePrice(item)),
    0,
  );
  const { data: activeDrawer, isError: drawerUnknown } = useActiveCashDrawer();
  // Cash goes into a drawer; with none open (or none we can confirm), only
  // UPI and card are offered.
  const paymentModes = activeDrawer && !drawerUnknown ? POS_PAYMENT_MODES : NON_CASH_MODES;
  const rxMeta = cart.map((item) => lineMeta[item.catalog_item_id]).filter(Boolean);
  const hasRxLines = rxMeta.some((m) => m && needsCounterRx(m));
  const hasH1Lines = rxMeta.some((m) => m?.schedule === "H1" && !m.isControlled);
  const checkoutBlocker = posCheckoutBlocker({
    canEditAmounts: canEditPosAmounts,
    rx: {
      ...counterRx,
      patientLinked: Boolean(registeredPatientId),
      name: watch("patient_name") ?? "",
      phone: watch("patient_phone") ?? "",
    },
    lines: cart.map((item) => ({
      drugName: item.drug_name,
      quantity: posSaleLineQuantity(item),
      unitPrice: posSaleLinePrice(item),
      ...lineMeta[item.catalog_item_id],
    })),
    discount: {
      offMrpPercent: offMrpPercent(mrpValue, subtotal - discount),
      limitPercent: discountLimit,
      canApprove: canApproveDiscount,
      reason: discountReason,
    },
    allergyBlocked: posAllergyBlocked,
    safetyBlocked: Boolean(safetyBlock) && (!canOverrideSafety || safetyReason.trim().length < 5),
  });

  /** The server's price for a line: FEFO batch MRP and the drug's GST. */
  async function fetchLinePrice(catalogItemId: string) {
    try {
      const prices = await queryClient.fetchQuery({
        queryKey: ["pos-prices", catalogItemId],
        queryFn: () => pharmacyService.getPosPrices([catalogItemId]),
        staleTime: 30_000,
      });
      setDiscountLimit(Number(prices.discount_limit_percent));
      return prices.lines[0];
    } catch {
      toast.error("Check the price on the line before taking payment.", {
        title: "Price could not be loaded",
      });
      return undefined;
    }
  }

  async function addDrug(drug: PharmacyCatalog) {
    setCompletedSale(null);
    setSafetyBlock(null);
    const price = await fetchLinePrice(drug.id);
    const mrp = Number(price?.mrp ?? drug.base_price) || 0;
    setLineMeta((meta) => ({
      ...meta,
      [drug.id]: {
        schedule: drug.drug_schedule,
        isControlled: drug.is_controlled,
        stock: Number(drug.current_stock),
        gstRate: Number(price?.gst_rate ?? drug.tax_percent) || 0,
        mrp,
      },
    }));
    addToCart(drug.id, drug.name, mrp);
  }

  function addToCart(itemId: string, drugName: string, unitPrice: number) {
    const existingIndex = cart.findIndex((c) => c.catalog_item_id === itemId);
    if (existingIndex >= 0) {
      const existing = cart[existingIndex];
      if (existing) {
        update(existingIndex, { ...existing, quantity: posSaleLineQuantity(existing) + 1 });
      }
      return;
    }
    append({
      catalog_item_id: itemId,
      drug_name: drugName,
      quantity: 1,
      unit_price: unitPrice,
    });
  }

  function updateQuantity(index: number, quantity: number | string) {
    const item = cart[index];
    if (!item) return;
    update(index, { ...item, quantity: formIntegerOrFallback(quantity, 0) });
  }

  function updatePrice(index: number, price: number | string) {
    const item = cart[index];
    if (!item) return;
    update(index, { ...item, unit_price: formNumberOrFallback(price, 0) });
  }

  function submitSale(settlement: PaymentModalSettlement) {
    const values = getValues();
    if (posAllergyBlocked) {
      toast.error("Documented drug allergy — record an override reason to sell.", {
        title: "Allergy conflict",
      });
      return;
    }
    const discountPercentValue = formNumberOrFallback(values.discount_percent, 0);
    createMutation.mutate({
      patient_id: optionalFormText(values.patient_id),
      allergy_override_reason: posAllergyConflicts.length > 0 ? posAllergyReason.trim() : undefined,
      safety_override_reason: safetyBlock && safetyReason.trim() ? safetyReason.trim() : undefined,
      items: values.items.map((c) => ({
        catalog_item_id: c.catalog_item_id,
        drug_name: c.drug_name,
        quantity: posSaleLineQuantity(c),
        mrp: lineMeta[c.catalog_item_id]?.mrp || posSaleLinePrice(c),
        selling_price: posSaleLinePrice(c),
        gst_rate: lineGstRate(c.catalog_item_id),
      })),
      payments: tenderOf(settlement),
      patient_name: canEditWalkInName ? optionalFormText(values.patient_name) : undefined,
      patient_phone: canEditWalkInPhone ? optionalFormText(values.patient_phone) : undefined,
      discount_percent: discountPercentValue || undefined,
      discount_reason: discountReason.trim() || undefined,
      ...(hasRxLines
        ? {
            patient_address: counterRx.address.trim() || undefined,
            prescriber_name: counterRx.prescriberName.trim() || undefined,
            prescriber_registration: counterRx.prescriberRegistration.trim() || undefined,
          }
        : {}),
    });
  }

  function openCancelSale(row: PharmacyPosSale) {
    setSaleToCancel(row);
    setCancelReason("");
    openCancelModal();
  }

  function closeCancelSale() {
    closeCancelModal();
    setSaleToCancel(null);
    setCancelReason("");
  }

  const saleColumns = [
    {
      key: "sale_number",
      label: "Sale #",
      sortable: true,
      searchable: true,
      accessor: (row: PharmacyPosSale) => row.sale_number,
      render: (row: PharmacyPosSale) => (
        <Text size="sm" fw={600}>
          {row.sale_number}
        </Text>
      ),
    },
    {
      key: "patient_name",
      label: "Customer",
      searchable: true,
      accessor: (row: PharmacyPosSale) => row.patient_name ?? "",
      render: (row: PharmacyPosSale) =>
        row.patient_id ? (
          <PharmacyPatientCell
            patientId={row.patient_id}
            canViewPatientRecord={canViewPatientRecord}
            name={row.patient_name}
          />
        ) : (
          <Stack gap={0}>
            <Text size="sm" c={canViewWalkInName ? undefined : "dimmed"}>
              {row.patient_name
                ? fieldAccessText(walkInNameAccess, row.patient_name, "name")
                : "Walk-in"}
            </Text>
            {canViewWalkInPhone && row.patient_phone && (
              <Text size="xs" c="dimmed">
                {fieldAccessText(walkInPhoneAccess, row.patient_phone, "phone")}
              </Text>
            )}
          </Stack>
        ),
    },
    {
      key: "total_amount",
      label: "Total",
      sortable: true,
      sortValue: (row: PharmacyPosSale) => Number(row.total_amount),
      accessor: (row: PharmacyPosSale) => Number(row.total_amount),
      render: (row: PharmacyPosSale) => (
        <Text size="sm" fw={700}>
          {renderPharmacySensitiveCurrency(priceAccess, row.total_amount)}
        </Text>
      ),
    },
    {
      key: "payment_mode",
      label: "Payment",
      accessor: (row: PharmacyPosSale) => row.payment_mode,
      render: (row: PharmacyPosSale) => <Badge size="xs">{row.payment_mode}</Badge>,
    },
    {
      key: "billing_invoice_id",
      label: "Billing",
      render: (row: PharmacyPosSale) =>
        row.billing_invoice_id ? (
          <Stack gap={2}>
            <Badge size="xs" tone="success">
              Posted
            </Badge>
            {row.billing_posted_at && (
              <Text size="xs" c="dimmed">
                {new Date(row.billing_posted_at).toLocaleTimeString()}
              </Text>
            )}
            {canViewBillingInvoice && (
              <Button
                size="compact-xs"
                tone="ghost"
                leftSection={<IconReceipt size={12} />}
                onClick={() => navigate(`/billing/invoices/${row.billing_invoice_id}`)}
              >
                Open invoice
              </Button>
            )}
          </Stack>
        ) : (
          <Badge size="xs" tone="neutral">
            POS only
          </Badge>
        ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: PharmacyPosSale) => {
        const saleStatus = row.status ?? "completed";
        const refundAmount = Number(row.refund_amount ?? 0);
        return (
          <Stack gap={2}>
            <Badge size="xs" tone={sharedColorBadgeTone(statusColors[saleStatus])}>
              {saleStatus.replace(/_/g, " ")}
            </Badge>
            {refundAmount > 0 && (
              <Text size="xs" c="dimmed">
                Refund {renderPharmacySensitiveCurrency(priceAccess, refundAmount)}
              </Text>
            )}
          </Stack>
        );
      },
    },
    {
      key: "created_at",
      label: "Time",
      sortable: true,
      sortValue: (row: PharmacyPosSale) => row.created_at,
      accessor: (row: PharmacyPosSale) => new Date(row.created_at).toLocaleTimeString(),
      render: (row: PharmacyPosSale) => (
        <Text size="sm">{new Date(row.created_at).toLocaleTimeString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: PharmacyPosSale) => {
        const saleStatus = row.status ?? "completed";
        const canCancelSale = canCancel && !["cancelled", "refunded"].includes(saleStatus);
        const canReturnSale = canReturn && !["cancelled", "refunded"].includes(saleStatus);
        return canCancelSale || canReturnSale ? (
          <Group gap={4} wrap="nowrap">
            {canReturnSale && (
              <Tooltip label="Return selected items">
                <IconButton
                  size="sm"
                  tone="default"
                  onClick={() => {
                    setReturnSaleId(row.id);
                  }}
                  aria-label="Return POS sale items"
                >
                  <IconReceipt size={14} />
                </IconButton>
              </Tooltip>
            )}
            {canCancelSale && (
              <Tooltip label="Cancel sale and reverse remaining stock/refund">
                <IconButton
                  size="sm"
                  tone="danger"
                  onClick={() => openCancelSale(row)}
                  aria-label="Cancel POS sale"
                >
                  <IconX size={14} />
                </IconButton>
              </Tooltip>
            )}
          </Group>
        ) : (
          <Text size="xs" c="dimmed">
            Locked
          </Text>
        );
      },
    },
  ];

  const saleFilters: DataTableFilter<PharmacyPosSale>[] = [
    {
      key: "payment_mode",
      label: "Payment",
      options: pharmacyPosPaymentModeOptions.map((option) => ({
        value: option.value,
        label: option.label,
      })),
      matches: (row, value) => row.payment_mode === value,
    },
  ];

  return (
    <Stack>
      <CounterSettings />
      {canView && daySummary && (
        <Group gap="lg">
          <Card withBorder p="xs" style={{ flex: 1 }}>
            <Text size="xs" c="dimmed">
              Sales Today
            </Text>
            <Text size="lg" fw={700}>
              {daySummary.total_sales}
            </Text>
          </Card>
          <Card withBorder p="xs" style={{ flex: 1 }}>
            <Text size="xs" c="dimmed">
              Revenue
            </Text>
            <Text size="lg" fw={700}>
              {renderPharmacySensitiveCurrency(priceAccess, daySummary.total_revenue)}
            </Text>
          </Card>
          <Card withBorder p="xs" style={{ flex: 1 }}>
            <Text size="xs" c="dimmed">
              Cash
            </Text>
            <Text size="lg" fw={700}>
              {renderPharmacySensitiveCurrency(priceAccess, daySummary.cash_total)}
            </Text>
          </Card>
          <Card withBorder p="xs" style={{ flex: 1 }}>
            <Text size="xs" c="dimmed">
              Card/UPI
            </Text>
            <Text size="lg" fw={700}>
              {renderPharmacySensitiveCurrency(
                priceAccess,
                Number(daySummary.card_total) + Number(daySummary.upi_total),
              )}
            </Text>
          </Card>
        </Group>
      )}

      {canCreate && (
        <Card withBorder p="md">
          <Stack
            component="form"
            onSubmit={handleSubmit(() => {
              if (!checkoutBlocker) openPayment();
            })}
          >
            <Text fw={600}>New Sale</Text>
            <CounterDrawer />
            {completedSale && (
              <Alert tone="success" title={`Sale ${completedSale.sale_number} recorded`}>
                <Group justify="space-between" align="center">
                  <Text size="sm">
                    Paid by {completedSale.payment_mode}:{" "}
                    {renderPharmacySensitiveCurrency(priceAccess, completedSale.total_amount)}
                    {Number(completedSale.change_due) > 0 && (
                      <>
                        {" · "}change due{" "}
                        <b>
                          {renderPharmacySensitiveCurrency(priceAccess, completedSale.change_due)}
                        </b>
                      </>
                    )}
                  </Text>
                  <Group gap="xs">
                    <PrintDocumentButton
                      documentKey="pharmacy-pos-receipt"
                      recordId={completedSale.id}
                      label="Print receipt"
                      tone="primary"
                    />
                    {completedSale.billing_invoice_id && (
                      <PrintDocumentButton
                        documentKey={canPrintPharmacyBill ? "pharmacy-bill" : "gst-invoice"}
                        recordId={completedSale.billing_invoice_id}
                        label="Print GST bill"
                      />
                    )}
                  </Group>
                </Group>
              </Alert>
            )}
            <Alert tone={registeredPatientId ? "info" : "neutral"}>
              {registeredPatientId
                ? "Registered patient sale will post a paid invoice into Billing and keep Pharmacy POS as the stock and cash-drawer source."
                : "Walk-in sale stays in Pharmacy POS until a registered patient is selected."}
            </Alert>
            <Group mb="sm" align="flex-end">
              <DrugSearchSelect
                label="Add medicine"
                value=""
                clearOnSelect
                inputRef={drugSearchRef}
                onChange={(_id, drug) => {
                  if (drug) addDrug(drug);
                }}
              />
              <Controller
                control={control}
                name="patient_id"
                render={({ field, fieldState }) =>
                  canCounterSearch ? (
                    <CounterPatientSelect
                      value={field.value}
                      onChange={field.onChange}
                      error={fieldState.error?.message}
                    />
                  ) : (
                    <PatientSearchSelect
                      size="xs"
                      label="Registered patient"
                      value={field.value}
                      onChange={field.onChange}
                      error={fieldState.error?.message}
                    />
                  )
                }
              />
              {canViewWalkInName && (
                <TextInput
                  size="xs"
                  label="Customer"
                  w={160}
                  disabled={!canEditWalkInName}
                  {...register("patient_name")}
                />
              )}
              {canViewWalkInPhone && (
                <TextInput
                  size="xs"
                  label="Phone"
                  w={130}
                  disabled={!canEditWalkInPhone}
                  {...register("patient_phone")}
                />
              )}
            </Group>
            {hasRxLines && (
              <CounterRxFields h1={hasH1Lines} value={counterRx} onChange={setCounterRx} />
            )}

            {posAllergyConflicts.length > 0 && (
              <Alert
                tone="danger"
                icon={<IconAlertTriangle size={16} />}
                title="Documented drug allergy"
              >
                <Stack gap={4}>
                  {posAllergyConflicts.map((c) => (
                    <Text key={c.drug} size="sm">
                      <b>{c.drug}</b> — patient allergic to {c.allergen}
                      {c.cross ? " (cross-reactive)" : ""}
                    </Text>
                  ))}
                  <Textarea
                    label="Override reason"
                    required
                    autosize
                    minRows={2}
                    placeholder="e.g. Prior documented tolerance; prescriber confirmed; no alternative"
                    value={posAllergyReason}
                    onChange={(e) => setPosAllergyReason(e.currentTarget.value)}
                    error={
                      posAllergyBlocked ? "A reason (≥5 chars) is required to sell" : undefined
                    }
                  />
                </Stack>
              </Alert>
            )}

            {safetyBlock && (
              <Alert
                tone="danger"
                icon={<IconAlertTriangle size={16} />}
                title="Stopped by the medication safety check"
                mb="sm"
              >
                <Stack gap={4}>
                  <Text size="sm">{safetyBlock}</Text>
                  {canOverrideSafety ? (
                    <Textarea
                      label="Override reason"
                      required
                      autosize
                      minRows={2}
                      value={safetyReason}
                      onChange={(e) => setSafetyReason(e.currentTarget.value)}
                      error={
                        safetyReason.trim().length < 5
                          ? "A clinical reason (≥5 chars) is needed to sell past this"
                          : undefined
                      }
                    />
                  ) : (
                    <Text size="sm">
                      Only a pharmacist with override rights can sell this. Change the basket or ask
                      them.
                    </Text>
                  )}
                </Stack>
              </Alert>
            )}

            {cart.length > 0 && (
              <Table striped highlightOnHover mb="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Drug</Table.Th>
                    <Table.Th>In stock</Table.Th>
                    <Table.Th>Qty</Table.Th>
                    <Table.Th>Price</Table.Th>
                    <Table.Th>Line Total</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {fields.map((field, index) => {
                    const item = cart[index];
                    if (!item) return null;
                    const meta = lineMeta[item.catalog_item_id];

                    return (
                      <Table.Tr key={field.id}>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <Text size="sm">{item.drug_name}</Text>
                            {meta && isPrescriptionOnly(meta) && (
                              <Badge size="xs" tone="danger">
                                Rx only{meta.schedule ? ` · ${meta.schedule}` : ""}
                              </Badge>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{meta ? meta.stock : "—"}</Text>
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            size="xs"
                            w={70}
                            min={1}
                            aria-label={`Quantity of ${item.drug_name}`}
                            value={posSaleLineQuantity(item)}
                            onChange={(val) => updateQuantity(index, val)}
                            error={errors.items?.[index]?.quantity?.message}
                          />
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            size="xs"
                            w={90}
                            min={0}
                            decimalScale={2}
                            prefix={"\u20B9"}
                            aria-label={`Price of ${item.drug_name}`}
                            value={posSaleLinePrice(item)}
                            disabled={!canEditPosAmounts}
                            onChange={(val) => updatePrice(index, val)}
                            error={errors.items?.[index]?.unit_price?.message}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={600}>
                            {renderPharmacySensitiveCurrency(
                              priceAccess,
                              posSaleLineQuantity(item) * posSaleLinePrice(item),
                            )}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <IconButton
                            size="sm"
                            tone="danger"
                            onClick={() => remove(index)}
                            aria-label="Remove sale line"
                          >
                            <IconX size={14} />
                          </IconButton>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
            {errors.items?.message && (
              <Text size="xs" c="danger">
                {errors.items.message}
              </Text>
            )}

            <Group justify="space-between" align="flex-end">
              {cart.length > 0 ? (
                <Group align="flex-end" gap="sm">
                  <Controller
                    control={control}
                    name="discount_percent"
                    render={({ field, fieldState }) => (
                      <NumberInput
                        size="xs"
                        label="Discount %"
                        w={90}
                        min={0}
                        max={100}
                        value={field.value}
                        onChange={field.onChange}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  {discount > 0 && (
                    <TextInput
                      size="xs"
                      label="Discount reason"
                      description={
                        discountLimit === null
                          ? undefined
                          : `Over ${discountLimit}% off MRP needs a reason and an approver`
                      }
                      w={260}
                      value={discountReason}
                      onChange={(event) => setDiscountReason(event.currentTarget.value)}
                    />
                  )}
                </Group>
              ) : (
                <Box />
              )}
              <Stack gap={4} align="flex-end">
                {mrpValue > totalAmount && (
                  <Text size="sm" data-testid="pos-savings">
                    MRP {renderPharmacySensitiveCurrency(priceAccess, mrpValue)} · you save{" "}
                    {renderPharmacySensitiveCurrency(priceAccess, mrpValue - totalAmount)}
                  </Text>
                )}
                <Text size="sm" c="dimmed">
                  Subtotal {renderPharmacySensitiveCurrency(priceAccess, subtotal)}
                  {discount > 0 &&
                    ` · Discount ${renderPharmacySensitiveCurrency(priceAccess, discount)}`}
                  {" · "}incl. GST {renderPharmacySensitiveCurrency(priceAccess, gstAmount)}
                </Text>
                <Title order={2} data-testid="pos-total">
                  {renderPharmacySensitiveCurrency(priceAccess, totalAmount)}
                </Title>
                <Tooltip label={checkoutBlocker} disabled={!checkoutBlocker} multiline w={260}>
                  <Box component="span">
                    <Button
                      size="lg"
                      tone="primary"
                      type="submit"
                      loading={createMutation.isPending}
                      disabled={Boolean(checkoutBlocker)}
                      aria-describedby={checkoutBlocker ? "pos-checkout-blocker" : undefined}
                      leftSection={<IconCash size={20} />}
                    >
                      Take payment
                    </Button>
                  </Box>
                </Tooltip>
                {checkoutBlocker && (
                  <Text size="sm" c="dimmed" id="pos-checkout-blocker" ta="right" maw={320}>
                    {checkoutBlocker}
                  </Text>
                )}
              </Stack>
            </Group>
            {paymentOpened && (
              <PaymentModal
                opened
                onClose={closePayment}
                amount={totalAmount}
                amountAccess={priceAccess}
                modes={paymentModes}
                splitModes={registeredPatientId ? SPLIT_MODES_PATIENT : SPLIT_MODES_WALK_IN}
                collectPermission={P.PHARMACY.POS_CREATE}
                onSuccess={(_id, settlement) => submitSale(settlement)}
              />
            )}
          </Stack>
        </Card>
      )}

      {canView || canCancel || canReturn ? (
        <>
          {canReturn && <ReceiptReturnLookup onFound={setReturnSaleId} />}
          <Text fw={600} mt="md">
            {canView ? "Today's Sales" : "Today's sales available for POS actions"}
          </Text>
          <DataTable
            columns={saleColumns}
            data={sales}
            loading={salesLoading}
            rowKey={(row) => row.id}
            searchable
            searchPlaceholder="Search sales"
            exportable
            exportFileName="pharmacy-pos-sales"
            filters={saleFilters}
          />
        </>
      ) : (
        <Card withBorder p="md">
          <Text size="sm" c="dimmed">
            POS sale history is not available for your role. You can still complete a new counter
            sale when POS creation is allowed.
          </Text>
        </Card>
      )}
      <PosReturnModal saleId={returnSaleId} onClose={() => setReturnSaleId(null)} />
      <Modal opened={cancelOpened} onClose={closeCancelSale} title="Cancel POS sale" centered>
        <Stack>
          <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
            Cancelling reverses remaining stock and records a POS refund transaction. Use this only
            for same-day voids or cashier-approved sale reversals.
          </Alert>
          {saleToCancel && (
            <Group justify="space-between">
              <Text size="sm" fw={600}>
                {saleToCancel.sale_number}
              </Text>
              <Text size="sm" fw={700}>
                {renderPharmacySensitiveCurrency(priceAccess, saleToCancel.total_amount)}
              </Text>
            </Group>
          )}
          <Textarea
            label="Reason"
            required
            minRows={3}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.currentTarget.value)}
            placeholder="Wrong item, duplicate bill, payment void, or other approved reason"
          />
          <Group justify="flex-end">
            <Button tone="secondary" onClick={closeCancelSale}>
              Keep sale
            </Button>
            <Button
              tone="danger"
              loading={cancelSaleMutation.isPending}
              disabled={!saleToCancel || cancelReason.trim().length < 3}
              leftSection={<IconX size={14} />}
              onClick={() => {
                if (!saleToCancel) return;
                cancelSaleMutation.mutate({
                  saleId: saleToCancel.id,
                  reason: cancelReason.trim(),
                });
              }}
            >
              Cancel sale
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
