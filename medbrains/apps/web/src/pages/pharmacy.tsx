import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Loader,
  Modal,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  PharmacyCatalogFormInput,
  PharmacyNdpsEntryFormInput,
  PharmacyOrderFormInput,
  PharmacyOrderItemFormInput,
  PharmacyPosReturnFormInput,
  PharmacyPosSaleFormInput,
  PharmacyReturnRequestFormInput,
  PharmacyRxReviewFormInput,
} from "@medbrains/schemas";
import {
  pharmacyCatalogFormSchema,
  pharmacyNdpsEntryFormSchema,
  pharmacyOrderFormSchema,
  pharmacyPosReturnFormSchema,
  pharmacyPosSaleFormSchema,
  pharmacyReturnRequestFormSchema,
  pharmacyRxReviewFormSchema,
} from "@medbrains/schemas";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import type {
  ClinicalEventName,
  ClinicalJourneyContext,
  ComplianceSettings,
  CreateNdpsEntryRequest,
  CreateOtcSaleRequest,
  CreatePharmacyBatchRequest,
  CreatePharmacyCatalogRequest,
  CreatePharmacyOrderRequest,
  DrugInteractionCheckRequest,
  DrugInteractionResult,
  DrugUtilizationRow,
  FieldAccessLevel,
  FormularyCheckResult,
  NdpsRegisterEntry,
  NearExpiryRow,
  PharmacyAbcVedRow,
  PharmacyBatch,
  PharmacyCatalog,
  PharmacyConsumptionRow,
  PharmacyDeadStockRow,
  PharmacyOrder,
  PharmacyOrderDetailResponse,
  PharmacyOrderItem,
  PharmacyOrderItemInput,
  PharmacyPosSale,
  PharmacyPosSaleItem,
  PharmacyReturn,
  PharmacyReturnStatusType,
  PharmacyRxDetailItem,
  PharmacyRxDetailResponse,
  PharmacyRxReviewItemInput,
  PharmacyStoreAssignment,
  PharmacyTransferRequest,
  PrescriptionAuditEntry,
  PrescriptionWithItems,
  RxQueueRow,
  TenantSettingsRow,
} from "@medbrains/types";
import { P, PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCashRegister,
  IconCheck,
  IconClipboardList,
  IconClock,
  IconDeviceFloppy,
  IconEye,
  IconLock,
  IconPackage,
  IconPencil,
  IconPill,
  IconPlus,
  IconPrescription,
  IconReceipt,
  IconShieldCheck,
  IconShoppingCart,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  ClinicalEventProvider,
  type Column,
  DataTable,
  PageHeader,
  PrescriptionViews,
  StatusDot,
  TableValueBadge,
  useClinicalEmit,
} from "@/components";
import { DrugSearchSelect } from "@/components/DrugSearchSelect";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { PatientJourneyActions } from "@/components/Patient/PatientJourneyActions";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { CreditNotesTab } from "@/components/Pharmacy/CreditNotesTab";
import {
  MedicineOrderLineCard,
  type MedicineOrderLineValue,
} from "@/components/Pharmacy/MedicineOrderLineCard";
import { PharmacyDispensingView } from "@/components/Pharmacy/PharmacyDispensingView";
import { PharmacyLabel } from "@/components/Pharmacy/PharmacyLabel";
import { StoreIndentsTab } from "@/components/Pharmacy/StoreIndentsTab";
import {
  awareCategoryOptions,
  drugScheduleOptions,
  formIntegerOrFallback,
  formNumberOrFallback,
  formularyStatusOptions,
  ndpsActionOptions,
  optionalFormText,
  pharmacyPosPaymentModeOptions,
} from "@/forms/pharmacy.form";
import { usePatientName } from "@/hooks/usePatientName";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { instructionsDisplayText } from "@/lib/medication-timing-utils";
import { pharmacyService } from "@/services/pharmacy.service";
import styles from "./pharmacy.module.scss";

const statusColors: Record<string, string> = {
  completed: "success",
  ordered: "primary",
  dispensed: "success",
  cancelled: "danger",
  partially_cancelled: "warning",
  refunded: "indigo",
  returned: "orange",
};

const dispensingTypeLabels: Record<string, string> = {
  prescription: "Rx",
  otc: "OTC",
  discharge: "Discharge",
  package: "Package",
  emergency: "Emergency",
};

const PHARMACY_ORDER_STATUS_OPTIONS = [
  { value: "ordered", label: "Ordered" },
  { value: "dispensed", label: "Dispensed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returned", label: "Returned" },
] as const;

type DraftPharmacyOrderItem = PharmacyOrderItemInput & {
  row_id: string;
  catalog_item_id?: string;
  tax_percent?: number;
};

type PharmacyOrderPricingLine = Pick<
  MedicineOrderLineValue,
  "catalog_item_id" | "drug_name" | "quantity" | "unit_price" | "tax_percent"
>;

type PharmacyPosSaleLine = PharmacyPosSaleFormInput["items"][number];
type PharmacyPosReturnLine = PharmacyPosReturnFormInput["items"][number];

function formatInr(value: number) {
  return `₹${Number.isFinite(value) ? value.toFixed(2) : "0.00"}`;
}

type PatientOrderForReturnLookup = Awaited<
  ReturnType<typeof pharmacyService.listPatientOrdersForReturn>
>[number];

type ReturnableOrderItem = {
  orderId: string;
  orderDate: string;
  orderStatus: string;
  itemId: string;
  drugName: string;
  batchNumber: string | null;
  quantity: number;
  returnedQuantity: number;
  remainingQuantity: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonArray(value: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function unknownString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function unknownNullableString(value: unknown) {
  const parsed = unknownString(value);
  return parsed.length > 0 ? parsed : null;
}

function unknownNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeReturnableItems(order: PatientOrderForReturnLookup): ReturnableOrderItem[] {
  const rawItems =
    typeof order.items === "string"
      ? parseJsonArray(order.items)
      : Array.isArray(order.items)
        ? order.items
        : [];

  return rawItems
    .filter(isRecord)
    .map((item) => ({
      orderId: order.order_id,
      orderDate: order.order_date,
      orderStatus: order.status,
      itemId: unknownString(item.item_id),
      drugName: unknownString(item.drug_name),
      batchNumber: unknownNullableString(item.batch_number),
      quantity: unknownNumber(item.quantity, 0),
      returnedQuantity: unknownNumber(item.returned_quantity, 0),
      remainingQuantity: unknownNumber(
        item.remaining_quantity,
        unknownNumber(item.quantity, 0) - unknownNumber(item.returned_quantity, 0),
      ),
    }))
    .filter(
      (item) =>
        item.itemId.length > 0 &&
        item.drugName.length > 0 &&
        item.quantity > 0 &&
        item.remainingQuantity > 0,
    );
}

function canViewPharmacyField(access: FieldAccessLevel) {
  return access !== "hidden";
}

function canEditPharmacyField(access: FieldAccessLevel) {
  return access === "edit";
}

function PharmacyRestrictedValue() {
  return (
    <Text span size="sm" c="dimmed">
      Restricted
    </Text>
  );
}

function PharmacyPatientCell({
  patientId,
  canViewPatientRecord,
}: {
  patientId: string | null | undefined;
  canViewPatientRecord: boolean;
}) {
  if (!patientId) {
    return (
      <Text span size="sm" c="dimmed">
        Walk-in
      </Text>
    );
  }
  if (!canViewPatientRecord) {
    return <PharmacyRestrictedValue />;
  }
  return <PatientNameCell patientId={patientId} showUhid={false} />;
}

function PharmacyPatientContext({
  patientId,
  canViewPatientRecord,
}: {
  patientId: string | null | undefined;
  canViewPatientRecord: boolean;
}) {
  if (!patientId) return null;
  if (!canViewPatientRecord) {
    return (
      <Alert color="gray" variant="light" title="Patient context restricted">
        Patient identity and demographics are hidden for this pharmacy role.
      </Alert>
    );
  }
  return <PatientContextBanner patientId={patientId} hideLoadingState />;
}

function renderPharmacySensitiveValue(access: FieldAccessLevel, value: string | null | undefined) {
  return fieldAccessText(access, value);
}

function renderPharmacySensitiveIdentifier(
  access: FieldAccessLevel,
  value: string | null | undefined,
) {
  return fieldAccessText(access, value, "identifier");
}

function renderPharmacySensitiveShortIdentifier(
  access: FieldAccessLevel,
  value: string | null | undefined,
) {
  if (access === "edit" || access === "view") return value?.slice(0, 8) ?? "\u2014";
  return renderPharmacySensitiveIdentifier(access, value);
}

function renderPharmacySensitiveNumber(
  access: FieldAccessLevel,
  value: string | number | null | undefined,
) {
  if (value === null || value === undefined || value === "") {
    return "\u2014";
  }
  return fieldAccessText(access, String(value));
}

function renderPharmacySensitiveCurrency(
  access: FieldAccessLevel,
  value: string | number | null | undefined,
) {
  if (value === null || value === undefined || value === "") {
    return "\u2014";
  }
  return fieldAccessText(access, formatInr(Number(value)), "amount");
}

function posSaleLineQuantity(item: PharmacyPosSaleLine) {
  return formIntegerOrFallback(item.quantity, 1);
}

function posSaleLinePrice(item: PharmacyPosSaleLine) {
  return formNumberOrFallback(item.unit_price, 0);
}

function posSaleItemReturnableQuantity(item: PharmacyPosSaleItem) {
  return Math.max(0, Number(item.quantity ?? 0) - Number(item.cancelled_qty ?? 0));
}

function posReturnLineQuantity(item: PharmacyPosReturnLine) {
  return formIntegerOrFallback(item.return_qty, 0);
}

function posReturnLinePrice(item: PharmacyPosReturnLine) {
  return formNumberOrFallback(item.unit_price, 0);
}

function posSalePayloadPatientId(payload: Record<string, unknown>) {
  const patientId = payload.patient_id;
  return typeof patientId === "string" ? patientId : "";
}

function draftItemTaxAmount(item: PharmacyOrderPricingLine) {
  return item.quantity * item.unit_price * ((item.tax_percent ?? 0) / 100);
}

function draftTotals(items: PharmacyOrderPricingLine[]) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const tax = items.reduce((sum, item) => sum + draftItemTaxAmount(item), 0);
  return {
    subtotal,
    tax,
    total: subtotal + tax,
  };
}

function newPharmacyOrderFormItem(): PharmacyOrderItemFormInput {
  return {
    catalog_item_id: "",
    drug_name: "",
    quantity: 1,
    unit_price: 0,
    tax_percent: 0,
  };
}

function pharmacyOrderDefaults(initialPatientId = ""): PharmacyOrderFormInput {
  return {
    patient_id: initialPatientId,
    notes: "",
    safety_override_reason: "",
    items: [newPharmacyOrderFormItem()],
  };
}

function newDraftPharmacyOrderItem(): DraftPharmacyOrderItem {
  return {
    row_id: crypto.randomUUID(),
    drug_name: "",
    quantity: 1,
    unit_price: 0,
    tax_percent: 0,
  };
}

function pharmacyOrderLineFromForm(item: PharmacyOrderItemFormInput): MedicineOrderLineValue {
  return {
    catalog_item_id: optionalFormText(item.catalog_item_id ?? ""),
    drug_name: item.drug_name,
    quantity: formIntegerOrFallback(item.quantity, 1),
    unit_price: formNumberOrFallback(item.unit_price, 0),
    tax_percent: formNumberOrFallback(item.tax_percent, 0),
  };
}

function draftPharmacyOrderItemsPayload(
  items: PharmacyOrderPricingLine[],
): PharmacyOrderItemInput[] {
  return items.map(({ catalog_item_id, drug_name, quantity, unit_price }) => ({
    catalog_item_id: optionalFormText(catalog_item_id ?? ""),
    drug_name: drug_name.trim(),
    quantity,
    unit_price,
  }));
}

function pharmacyOrderEventItems(items: PharmacyOrderItem[]) {
  return items.map((item) => ({
    batch_number: item.batch_number,
    batch_stock_id: item.batch_stock_id,
    catalog_item_id: item.catalog_item_id,
    drug_name: item.drug_name,
    expiry_date: item.expiry_date,
    item_id: item.id,
    quantity: item.quantity,
  }));
}

function pharmacyOrderPayloadFromForm(values: PharmacyOrderFormInput): CreatePharmacyOrderRequest {
  const lines = values.items.map(pharmacyOrderLineFromForm);
  return {
    patient_id: values.patient_id,
    notes: optionalFormText(values.notes),
    safety_override_reason: optionalFormText(values.safety_override_reason),
    items: draftPharmacyOrderItemsPayload(lines),
  };
}

function rxReviewInputFromItem(item: PharmacyRxDetailItem): PharmacyRxReviewItemInput {
  return {
    prescription_item_id: item.id,
    catalog_item_id: item.catalog_item_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
  };
}

type PharmacyRxReviewAction = PharmacyRxReviewFormInput["action"];
type PharmacyRxReviewFormItem = PharmacyRxReviewFormInput["items"][number];

const DEFAULT_RX_REVIEW_FORM_VALUES: PharmacyRxReviewFormInput = {
  action: "approved",
  notes: "",
  rejection_reason: "",
  items: [],
};

function rxReviewInputFromForm(item: PharmacyRxReviewFormItem): PharmacyRxReviewItemInput {
  return {
    prescription_item_id: item.prescription_item_id,
    catalog_item_id: item.catalog_item_id,
    quantity: formIntegerOrFallback(item.quantity, 1),
    unit_price: formNumberOrFallback(item.unit_price, 0),
  };
}

function rxReviewInputsFromForm(items: PharmacyRxReviewFormInput["items"]) {
  return items.map(rxReviewInputFromForm);
}

function applyRxReviewItems(
  items: PharmacyRxDetailItem[],
  reviewItems: PharmacyRxReviewItemInput[],
) {
  if (reviewItems.length === 0) return items;
  return items.map((item) => {
    const reviewed = reviewItems.find((line) => line.prescription_item_id === item.id);
    if (!reviewed) return item;
    const taxableAmount = reviewed.quantity * reviewed.unit_price;
    const taxAmount = taxableAmount * (Number(item.tax_percent || 0) / 100);
    return {
      ...item,
      quantity: reviewed.quantity,
      unit_price: reviewed.unit_price,
      taxable_amount: taxableAmount,
      tax_amount: taxAmount,
      line_total: taxableAmount + taxAmount,
    };
  });
}

function rxHasPriceOverride(
  items: PharmacyRxDetailItem[],
  reviewItems: PharmacyRxReviewItemInput[],
) {
  if (reviewItems.length === 0) return false;
  return reviewItems.some((line) => {
    const base = items.find((item) => item.id === line.prescription_item_id);
    if (!base) return false;
    return Math.abs(Number(line.unit_price) - Number(base.unit_price)) >= 0.01;
  });
}

type BulkBatchLine = {
  id: string;
  catalog_item_id: string;
  product_name: string;
  tax_percent: number;
  current_stock: number;
  reorder_level: number;
  batch_number: string;
  supplier_batch_number: string;
  expiry_date: string;
  manufacture_date: string;
  grn_reference: string;
  storage_conditions: string;
  rack_bin: string;
  purchase_rate: number | "";
  mrp: number | "";
  paid_quantity: number | "";
  free_quantity: number | "";
};

type BulkBatchHeader = {
  invoice_mode: "cash" | "credit";
  invoice_date: string;
  invoice_number: string;
  invoice_amount: number | "";
  supplier_name: string;
  store_location_id: string;
  payment_terms: string;
};

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function newBulkBatchHeader(): BulkBatchHeader {
  return {
    invoice_mode: "credit",
    invoice_date: todayInputDate(),
    invoice_number: "",
    invoice_amount: "",
    supplier_name: "",
    store_location_id: "",
    payment_terms: "",
  };
}

function newBulkBatchLine(): BulkBatchLine {
  return {
    id: crypto.randomUUID(),
    catalog_item_id: "",
    product_name: "",
    tax_percent: 0,
    current_stock: 0,
    reorder_level: 0,
    batch_number: "",
    supplier_batch_number: "",
    expiry_date: "",
    manufacture_date: "",
    grn_reference: "",
    storage_conditions: "",
    rack_bin: "",
    purchase_rate: "",
    mrp: "",
    paid_quantity: 0,
    free_quantity: 0,
  };
}

function batchLineNumber(value: number | "") {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function batchLineTotalQuantity(row: BulkBatchLine) {
  return batchLineNumber(row.paid_quantity) + batchLineNumber(row.free_quantity);
}

function batchLineTaxableAmount(row: BulkBatchLine) {
  return batchLineNumber(row.paid_quantity) * batchLineNumber(row.purchase_rate);
}

function batchLineTaxAmount(row: BulkBatchLine) {
  return batchLineTaxableAmount(row) * (row.tax_percent / 100);
}

function isBatchLineBelowReorder(row: BulkBatchLine) {
  return row.catalog_item_id.trim().length > 0 && row.current_stock <= row.reorder_level;
}

function isBatchLinePriceValid(row: BulkBatchLine) {
  return row.purchase_rate === "" || row.mrp === "" || row.purchase_rate <= row.mrp;
}

function isBulkBatchLineReady(row: BulkBatchLine) {
  return (
    row.catalog_item_id.trim().length > 0 &&
    row.batch_number.trim().length > 0 &&
    row.expiry_date.trim().length > 0 &&
    batchLineTotalQuantity(row) > 0 &&
    isBatchLinePriceValid(row)
  );
}

function buildBatchPayload(
  row: BulkBatchLine,
  header: BulkBatchHeader,
  access: { canWriteSource: boolean },
): CreatePharmacyBatchRequest {
  const paidQty = batchLineNumber(row.paid_quantity);
  const freeQty = batchLineNumber(row.free_quantity);
  const sourceParts = access.canWriteSource
    ? [
        `Invoice mode: ${header.invoice_mode}`,
        header.invoice_date ? `Invoice date: ${header.invoice_date}` : null,
        header.invoice_number.trim() ? `Invoice: ${header.invoice_number.trim()}` : null,
        header.invoice_amount !== "" ? `Invoice amount: ${header.invoice_amount}` : null,
        header.supplier_name.trim() ? `Supplier: ${header.supplier_name.trim()}` : null,
        header.store_location_id.trim() ? `Store: ${header.store_location_id.trim()}` : null,
        header.payment_terms.trim() ? `Payment terms: ${header.payment_terms.trim()}` : null,
        row.grn_reference.trim() ? `GRN/source: ${row.grn_reference.trim()}` : null,
        row.supplier_batch_number.trim()
          ? `Supplier batch: ${row.supplier_batch_number.trim()}`
          : null,
        row.storage_conditions.trim() ? `Storage: ${row.storage_conditions.trim()}` : null,
        row.rack_bin.trim() ? `Rack/bin: ${row.rack_bin.trim()}` : null,
        `Paid qty: ${paidQty}`,
        `Free qty: ${freeQty}`,
        row.mrp !== "" ? `MRP: ${row.mrp}` : null,
        `GST: ${row.tax_percent}%`,
      ].filter(Boolean)
    : [];
  const sourceInfo = sourceParts.join(" | ");
  return {
    catalog_item_id: row.catalog_item_id,
    batch_number: row.batch_number.trim(),
    expiry_date: row.expiry_date,
    manufacture_date: row.manufacture_date || undefined,
    quantity_received: paidQty + freeQty,
    store_location_id: header.store_location_id.trim() || undefined,
    supplier_info: access.canWriteSource && sourceInfo ? sourceInfo : undefined,
    invoice_number: access.canWriteSource
      ? header.invoice_number.trim() || row.grn_reference.trim() || undefined
      : undefined,
    supplier_batch_number: row.supplier_batch_number.trim() || undefined,
    purchase_rate: row.purchase_rate === "" ? undefined : row.purchase_rate,
    selling_rate: row.mrp === "" ? undefined : row.mrp,
  };
}

// Dropdown options for categorical fields - aligned with ATC classification
const DRUG_CATEGORIES = [
  { value: "alimentary", label: "Alimentary Tract & Metabolism" },
  { value: "blood", label: "Blood & Blood-Forming Organs" },
  { value: "cardiovascular", label: "Cardiovascular System" },
  { value: "dermatologicals", label: "Dermatologicals" },
  { value: "genitourinary", label: "Genitourinary & Sex Hormones" },
  { value: "hormones", label: "Systemic Hormones" },
  { value: "antiinfectives", label: "Antiinfectives for Systemic Use" },
  { value: "antineoplastic", label: "Antineoplastic & Immunomodulating" },
  { value: "musculoskeletal", label: "Musculoskeletal System" },
  { value: "nervous", label: "Nervous System" },
  { value: "antiparasitic", label: "Antiparasitic Products" },
  { value: "respiratory", label: "Respiratory System" },
  { value: "sensory", label: "Sensory Organs" },
  { value: "various", label: "Various" },
  { value: "consumables", label: "Medical Consumables" },
  { value: "other", label: "Other" },
];

const PHARMACY_PAGE_PERMISSIONS = [
  P.PHARMACY.PRESCRIPTIONS_LIST,
  P.PHARMACY.PRESCRIPTIONS_VIEW,
  P.PHARMACY.DISPENSING_CREATE,
  P.PHARMACY.DISPENSING_PARTIAL,
  P.PHARMACY.DISPENSING_CANCEL,
  P.PHARMACY.DISPENSING_VOID,
  P.PHARMACY.RX_QUEUE_LIST,
  P.PHARMACY.RX_QUEUE_REVIEW,
  P.PHARMACY.POS_VIEW,
  P.PHARMACY.POS_CREATE,
  P.PHARMACY.POS_CANCEL,
  P.PHARMACY.POS_RETURN,
  P.PHARMACY.STOCK_MANAGE,
  P.PHARMACY.NDPS_LIST,
  P.PHARMACY.NDPS_MANAGE,
  P.PHARMACY.STORES_LIST,
  P.PHARMACY.STORES_MANAGE,
  P.PHARMACY.ANALYTICS_VIEW,
  P.PHARMACY.RETURNS_LIST,
  P.PHARMACY.RETURNS_REQUEST,
  P.PHARMACY.RETURNS_APPROVE,
  P.PHARMACY.RETURNS_RESTOCK,
  P.PHARMACY.RETURNS_DESTROY,
  P.PHARMACY.RETURNS_REJECT,
  P.PHARMACY.SAFETY_VIEW,
] as const;

export function PharmacyPage() {
  useRequirePermission(PHARMACY_PAGE_PERMISSIONS);

  return (
    <ClinicalEventProvider moduleCode="pharmacy" contextCode="pharmacy-orders">
      <PharmacyPageInner />
    </ClinicalEventProvider>
  );
}

export function PharmacyOrderCreatePage() {
  useRequirePermission(P.PHARMACY.DISPENSING_CREATE);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get("patient_id") ?? "";
  const canViewPatientRecord = useHasPermission(P.PATIENTS.VIEW);

  function ordersPath() {
    const params = new URLSearchParams({ tab: "orders" });
    if (initialPatientId) {
      params.set("patient_id", initialPatientId);
    }
    return `/pharmacy?${params.toString()}`;
  }

  return (
    <ClinicalEventProvider moduleCode="pharmacy" contextCode="pharmacy-order-create">
      <Stack>
        <PageHeader
          title="New Pharmacy Order"
          subtitle="Create a patient-linked medicine order with safety and billing synchronization."
          icon={<IconPill size={20} stroke={1.5} />}
          color="success"
          actions={
            <Button
              variant="light"
              leftSection={<IconArrowLeft size={14} />}
              onClick={() => navigate(ordersPath())}
            >
              Orders
            </Button>
          }
        />
        <PharmacyOrderForm
          initialPatientId={initialPatientId}
          canViewPatientRecord={canViewPatientRecord}
          onCancel={() => navigate(ordersPath())}
          onSuccess={(detail) => navigate(`/pharmacy/orders/${detail.order.id}`)}
        />
      </Stack>
    </ClinicalEventProvider>
  );
}

export function PharmacyOrderDetailPage() {
  useRequirePermission(P.PHARMACY.PRESCRIPTIONS_VIEW);
  const navigate = useNavigate();
  const { orderId } = useParams();
  const canAdjustPartialDispense = useHasPermission(P.PHARMACY.DISPENSING_PARTIAL);
  const canViewReturns = useHasPermission(P.PHARMACY.RETURNS_LIST);
  const canViewPatientRecord = useHasPermission(P.PATIENTS.VIEW);
  const canDispense = useHasPermission(P.PHARMACY.DISPENSING_CREATE);

  return (
    <ClinicalEventProvider moduleCode="pharmacy" contextCode="pharmacy-order-detail">
      <Stack>
        <PageHeader
          title="Pharmacy Order"
          subtitle="Dispensing detail, FEFO hints, labels, and synchronized billing lines."
          icon={<IconPill size={20} stroke={1.5} />}
          color="success"
          actions={
            <Group gap="xs">
              <Button
                variant="light"
                leftSection={<IconArrowLeft size={14} />}
                onClick={() => navigate("/pharmacy?tab=orders")}
              >
                Orders
              </Button>
              {canDispense && (
                <Button
                  leftSection={<IconPlus size={14} />}
                  onClick={() => navigate("/pharmacy/orders/new")}
                >
                  New Order
                </Button>
              )}
            </Group>
          }
        />
        {orderId ? (
          <PharmacyOrderDetail
            orderId={orderId}
            canEditItems={canAdjustPartialDispense}
            canDispense={canDispense}
            canViewReturns={canViewReturns}
            canViewPatientRecord={canViewPatientRecord}
          />
        ) : (
          <Alert color="warning" variant="light">
            Pharmacy order id is missing from the route.
          </Alert>
        )}
      </Stack>
    </ClinicalEventProvider>
  );
}

function PharmacyPageInner() {
  const { t } = useTranslation("pharmacy");
  const [searchParams, setSearchParams] = useSearchParams();
  const canViewOrders = useHasPermission(P.PHARMACY.PRESCRIPTIONS_LIST);
  const canViewOrderDetail = useHasPermission(P.PHARMACY.PRESCRIPTIONS_VIEW);
  const canDispense = useHasPermission(P.PHARMACY.DISPENSING_CREATE);
  const canAdjustPartialDispense = useHasPermission(P.PHARMACY.DISPENSING_PARTIAL);
  const canCancelDispensingOrder = useHasPermission(P.PHARMACY.DISPENSING_CANCEL);
  const canVoidDispensing = useHasPermission(P.PHARMACY.DISPENSING_VOID);
  const canManageStock = useHasPermission(P.PHARMACY.STOCK_MANAGE);
  const canViewNdps = useHasPermission(P.PHARMACY.NDPS_LIST);
  const canManageNdps = useHasPermission(P.PHARMACY.NDPS_MANAGE);
  const canViewStores = useHasPermission(P.PHARMACY.STORES_LIST);
  const canManageStores = useHasPermission(P.PHARMACY.STORES_MANAGE);
  const canViewAnalytics = useHasPermission(P.PHARMACY.ANALYTICS_VIEW);
  const canViewReturns = useHasPermission(P.PHARMACY.RETURNS_LIST);
  const canRequestReturn = useHasPermission(P.PHARMACY.RETURNS_REQUEST);
  const canApproveReturn = useHasPermission(P.PHARMACY.RETURNS_APPROVE);
  const canRestockReturn = useHasPermission(P.PHARMACY.RETURNS_RESTOCK);
  const canDestroyReturn = useHasPermission(P.PHARMACY.RETURNS_DESTROY);
  const canRejectReturn = useHasPermission(P.PHARMACY.RETURNS_REJECT);
  const canWorkReturns =
    canViewReturns ||
    canRequestReturn ||
    canApproveReturn ||
    canRestockReturn ||
    canDestroyReturn ||
    canRejectReturn;
  const canViewReturnQueue =
    canViewReturns || canApproveReturn || canRestockReturn || canDestroyReturn || canRejectReturn;
  const canViewCreditNoteQueue = canViewReturns || canApproveReturn || canRejectReturn;
  const canViewRxQueue = useHasPermission(P.PHARMACY.RX_QUEUE_LIST);
  const canReviewRx = useHasPermission(P.PHARMACY.RX_QUEUE_REVIEW);
  const canOpenRxQueue = canViewRxQueue || canReviewRx;
  const canViewSafety = useHasPermission(P.PHARMACY.SAFETY_VIEW);
  const canViewSafetyChecks = canViewSafety || canViewOrderDetail || canReviewRx;
  const canCreatePos = useHasPermission(P.PHARMACY.POS_CREATE);
  const canViewPos = useHasPermission(P.PHARMACY.POS_VIEW);
  const canCancelPos = useHasPermission(P.PHARMACY.POS_CANCEL);
  const canReturnPos = useHasPermission(P.PHARMACY.POS_RETURN);
  const canManageBillingCredit = useHasPermission(P.BILLING.CREDIT_MANAGE);
  const canViewPatientRecord = useHasPermission(P.PATIENTS.VIEW);
  const canOpenOrders =
    canViewOrders ||
    canViewOrderDetail ||
    canDispense ||
    canAdjustPartialDispense ||
    canCancelDispensingOrder ||
    canViewSafety;
  const canViewDrugCatalog =
    canViewOrders ||
    canViewOrderDetail ||
    canDispense ||
    canAdjustPartialDispense ||
    canManageStock ||
    canManageNdps ||
    canManageStores ||
    canRequestReturn ||
    canViewRxQueue ||
    canReviewRx ||
    canCreatePos ||
    canViewSafety;
  const defaultTab = canOpenRxQueue
    ? "rx-queue"
    : canCreatePos || canViewPos || canCancelPos || canReturnPos
      ? "pos"
      : canOpenOrders
        ? "orders"
        : canViewDrugCatalog
          ? "catalog"
          : canManageStock
            ? "stock"
            : canViewNdps || canManageNdps
              ? "ndps"
              : canViewStores
                ? "stores"
                : canManageStores
                  ? "store-requests"
                  : canViewAnalytics
                    ? "analytics"
                    : canWorkReturns
                      ? "returns"
                      : "rx-queue";
  const visiblePharmacyTabs = new Set<string>([
    ...(canOpenRxQueue ? ["rx-queue"] : []),
    ...(canCreatePos || canViewPos || canCancelPos || canReturnPos ? ["pos"] : []),
    ...(canOpenOrders ? ["orders"] : []),
    ...(canViewDrugCatalog ? ["catalog"] : []),
    ...(canManageStock ? ["stock", "batches"] : []),
    ...(canViewNdps || canManageNdps ? ["ndps"] : []),
    ...(canViewStores || canManageStores ? ["stores", "store-requests"] : []),
    ...(canViewAnalytics ? ["analytics"] : []),
    ...(canWorkReturns ? ["returns"] : []),
  ]);
  const requestedTab = searchParams.get("tab");
  const selectedTab =
    requestedTab && visiblePharmacyTabs.has(requestedTab) ? requestedTab : defaultTab;
  const setSelectedTab = (value: string | null) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", value ?? defaultTab);
    setSearchParams(params, { replace: true });
  };
  const hasVisibleTab =
    canOpenRxQueue ||
    canCreatePos ||
    canViewPos ||
    canCancelPos ||
    canReturnPos ||
    canOpenOrders ||
    canViewDrugCatalog ||
    canManageStock ||
    canViewNdps ||
    canManageNdps ||
    canViewStores ||
    canManageStores ||
    canViewAnalytics ||
    canWorkReturns;

  const { data: complianceRaw = [] } = useQuery<TenantSettingsRow[]>({
    queryKey: ["tenant-settings", "compliance"],
    queryFn: () => pharmacyService.getTenantSettings("compliance"),
    staleTime: 300_000,
  });

  const compliance = useMemo(() => {
    const defaults: ComplianceSettings = {
      enforce_drug_scheduling: false,
      enforce_ndps_tracking: false,
      enforce_formulary: false,
      enforce_drug_interactions: false,
      enforce_antibiotic_stewardship: false,
      enforce_lasa_warnings: false,
      enforce_max_dose_check: false,
      enforce_batch_tracking: false,
      show_schedule_badges: true,
      show_controlled_warnings: true,
      show_formulary_status: true,
      show_aware_category: true,
    };
    for (const row of complianceRaw) {
      const key = row.key as keyof ComplianceSettings;
      if (key in defaults) {
        defaults[key] = row.value === true || row.value === "true";
      }
    }
    return defaults;
  }, [complianceRaw]);

  const [interactionModalOpen, { open: openInteractionModal, close: closeInteractionModal }] =
    useDisclosure(false);
  const [formularyModalOpen, { open: openFormularyModal, close: closeFormularyModal }] =
    useDisclosure(false);

  return (
    <div>
      <PageHeader
        title={t("title.pharmacy")}
        subtitle={t("subtitle.drugInventory&Dispensing")}
        icon={<IconPill size={20} stroke={1.5} />}
        color="success"
      />

      <DrugInteractionModal
        opened={interactionModalOpen}
        onClose={closeInteractionModal}
        canViewPatientRecord={canViewPatientRecord}
      />
      <FormularyCheckModal opened={formularyModalOpen} onClose={closeFormularyModal} />

      {hasVisibleTab ? (
        <Tabs value={selectedTab} onChange={setSelectedTab}>
          <Tabs.List mb="md" className={styles.tabsList}>
            {canOpenRxQueue && (
              <Tabs.Tab value="rx-queue" leftSection={<IconPrescription size={14} />}>
                {t("rxQueue")}
              </Tabs.Tab>
            )}
            {(canCreatePos || canViewPos || canCancelPos || canReturnPos) && (
              <Tabs.Tab value="pos" leftSection={<IconCashRegister size={14} />}>
                {t("posCounter")}
              </Tabs.Tab>
            )}
            {canOpenOrders && <Tabs.Tab value="orders">{t("orders")}</Tabs.Tab>}
            {canViewDrugCatalog && <Tabs.Tab value="catalog">{t("drugCatalog")}</Tabs.Tab>}
            {canManageStock && <Tabs.Tab value="stock">{t("stock")}</Tabs.Tab>}
            {(canViewNdps || canManageNdps) && (
              <Tabs.Tab value="ndps">{t("ndpsRegister")}</Tabs.Tab>
            )}
            {canManageStock && <Tabs.Tab value="batches">{t("batch&Expiry")}</Tabs.Tab>}
            {(canViewStores || canManageStores) && (
              <Tabs.Tab value="stores">{t("stores&Transfers")}</Tabs.Tab>
            )}
            {canViewAnalytics && <Tabs.Tab value="analytics">{t("analytics&Reports")}</Tabs.Tab>}
            {canWorkReturns && (
              <Tabs.Tab value="returns" leftSection={<IconReceipt size={14} />}>
                Returns
              </Tabs.Tab>
            )}
            {(canViewStores || canManageStores) && (
              <Tabs.Tab value="store-requests" leftSection={<IconPackage size={14} />}>
                Store Requests
              </Tabs.Tab>
            )}
          </Tabs.List>

          {canOpenRxQueue && (
            <Tabs.Panel value="rx-queue">
              <RxQueueTab
                canReview={canReviewRx}
                canViewPatientRecord={canViewPatientRecord}
                canViewQueue={canViewRxQueue}
              />
            </Tabs.Panel>
          )}
          {(canCreatePos || canViewPos || canCancelPos || canReturnPos) && (
            <Tabs.Panel value="pos">
              <PosCounterTab
                canView={canViewPos}
                canCreate={canCreatePos}
                canCancel={canCancelPos}
                canReturn={canReturnPos}
                canViewPatientRecord={canViewPatientRecord}
              />
            </Tabs.Panel>
          )}
          {canOpenOrders && (
            <Tabs.Panel value="orders">
              <PharmacyOrdersTab
                canViewOrders={canViewOrders}
                canDispense={canDispense}
                canCancelOrder={canCancelDispensingOrder}
                canViewOrderDetail={canViewOrderDetail}
                canViewPatientRecord={canViewPatientRecord}
                headerActions={
                  canViewSafetyChecks && (
                    <>
                      <Button
                        size="xs"
                        variant="light"
                        color="orange"
                        leftSection={<IconAlertTriangle size={14} />}
                        onClick={openInteractionModal}
                      >
                        Drug Interactions
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        color="info"
                        leftSection={<IconShieldCheck size={14} />}
                        onClick={openFormularyModal}
                      >
                        Formulary Check
                      </Button>
                    </>
                  )
                }
              />
            </Tabs.Panel>
          )}
          {canViewDrugCatalog && (
            <Tabs.Panel value="catalog">
              <PharmacyCatalogTab canManage={canManageStock} compliance={compliance} />
            </Tabs.Panel>
          )}
          {canManageStock && (
            <Tabs.Panel value="stock">
              <StockTab canManage={canManageStock} />
            </Tabs.Panel>
          )}
          {(canViewNdps || canManageNdps) && (
            <Tabs.Panel value="ndps">
              <NdpsRegisterTab />
            </Tabs.Panel>
          )}
          {canManageStock && (
            <Tabs.Panel value="batches">
              <BatchExpiryTab />
            </Tabs.Panel>
          )}
          {(canViewStores || canManageStores) && (
            <Tabs.Panel value="stores">
              <StoresTransfersTab canViewStores={canViewStores} canManageStores={canManageStores} />
            </Tabs.Panel>
          )}
          {canViewAnalytics && (
            <Tabs.Panel value="analytics">
              <AnalyticsTab />
            </Tabs.Panel>
          )}
          {canWorkReturns && (
            <Tabs.Panel value="returns">
              <PharmacyReturnsWorkspace
                canViewQueue={canViewReturnQueue}
                canViewCreditNoteQueue={canViewCreditNoteQueue}
                canRequest={canRequestReturn}
                canApprove={canApproveReturn}
                canVoidDispensing={canVoidDispensing}
                canRestock={canRestockReturn}
                canDestroy={canDestroyReturn}
                canReject={canRejectReturn}
                canSettleCreditNote={canApproveReturn && canManageBillingCredit}
                canViewPatientRecord={canViewPatientRecord}
              />
            </Tabs.Panel>
          )}
          {(canViewStores || canManageStores) && (
            <Tabs.Panel value="store-requests">
              <StoreIndentsTab
                canViewQueue={canViewStores || canManageStores}
                canManage={canManageStores}
              />
            </Tabs.Panel>
          )}
        </Tabs>
      ) : (
        <Text c="dimmed" size="sm">
          No pharmacy work areas are available for your current role.
        </Text>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Orders Tab (enhanced)
// ══════════════════════════════════════════════════════════

function PharmacyOrdersTab({
  canViewOrders,
  canDispense,
  canCancelOrder,
  canViewOrderDetail,
  canViewPatientRecord,
  headerActions,
}: {
  canViewOrders: boolean;
  canDispense: boolean;
  canCancelOrder: boolean;
  canViewOrderDetail: boolean;
  canViewPatientRecord: boolean;
  headerActions?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [otcOpened, { open: openOtc, close: closeOtc }] = useDisclosure(false);
  const patientIdFilter = searchParams.get("patient_id") ?? "";
  const isDispenseHandoff = searchParams.get("action") === "dispense";
  const effectiveFilterStatus = filterStatus ?? (isDispenseHandoff ? "ordered" : null);
  const clearPharmacyHandoff = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
  };
  const setOrderStatusFilter = (value: string | null) => {
    setFilterStatus(value);
    if (isDispenseHandoff) {
      clearPharmacyHandoff();
    }
  };

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (effectiveFilterStatus) params.status = effectiveFilterStatus;
  if (patientIdFilter) params.patient_id = patientIdFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["pharmacy-orders", params],
    queryFn: () => pharmacyService.listPharmacyOrders(params),
    enabled: canViewOrders,
  });

  const emit = useClinicalEmit();

  const dispenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const detail = await pharmacyService.getPharmacyOrder(id);
      const order = await pharmacyService.dispenseOrder(id);
      return { admissionId: detail.admission_id, items: detail.items, order };
    },
    onSuccess: ({ admissionId, items, order }, id) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["invoice"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-invoices", order.patient_id] });
      notifications.show({
        title: "Dispensed",
        message: "Order dispensed and linked billing charges refreshed",
        color: "success",
      });
      emit("pharmacy.order.dispensed", {
        admission_id: admissionId,
        dispensing_type: order.dispensing_type,
        encounter_id: order.encounter_id,
        items: pharmacyOrderEventItems(items),
        order_id: id,
        order_type: "pharmacy",
        patient_id: order.patient_id,
      });
    },
  });
  const orders = data?.orders ?? [];
  const firstDispensableOrder = orders.find((order) => order.status === "ordered");

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const detail = await pharmacyService.getPharmacyOrder(id);
      const order = await pharmacyService.cancelPharmacyOrder(id);
      return { admissionId: detail.admission_id, order };
    },
    onSuccess: ({ admissionId, order }, id) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["invoice"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-invoices", order.patient_id] });
      emit("order.cancelled", {
        admission_id: admissionId,
        dispensing_type: order.dispensing_type,
        encounter_id: order.encounter_id,
        order_id: id,
        order_type: "pharmacy",
        patient_id: order.patient_id,
        reason: "cancelled_from_pharmacy_queue",
      });
    },
  });

  const columns: Column<PharmacyOrder>[] = [
    {
      key: "patient_id",
      label: "Patient",
      requiredPermissions: [P.PHARMACY.PRESCRIPTIONS_LIST],
      fieldAccessKeys: PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
      accessor: (row: PharmacyOrder) => row.patient_id,
      fieldKind: "identifier",
      hiddenLabel: "Patient restricted",
      render: (row: PharmacyOrder) => (
        <PharmacyPatientCell
          patientId={row.patient_id}
          canViewPatientRecord={canViewPatientRecord}
        />
      ),
    },
    {
      key: "dispensing_type",
      label: "Type",
      render: (row: PharmacyOrder) => (
        <TableValueBadge
          value={row.dispensing_type}
          kind="pharmacy"
          label={dispensingTypeLabels[row.dispensing_type] ?? row.dispensing_type}
          size="xs"
          color={
            row.dispensing_type === "otc"
              ? "teal"
              : row.dispensing_type === "emergency"
                ? "danger"
                : "primary"
          }
        />
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: PharmacyOrder) => (
        <StatusDot color={statusColors[row.status] ?? "gray"} label={row.status} />
      ),
    },
    {
      key: "created_at",
      label: "Date",
      render: (row: PharmacyOrder) => (
        <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      requiredPermissions: [
        P.PHARMACY.PRESCRIPTIONS_VIEW,
        P.PHARMACY.DISPENSING_CREATE,
        P.PHARMACY.DISPENSING_CANCEL,
      ],
      permissionMode: "any",
      render: (row: PharmacyOrder) => (
        <Group gap="xs">
          <Tooltip label={canViewOrderDetail ? "View" : "No permission to view order detail"}>
            <ActionIcon
              variant="subtle"
              color="primary"
              disabled={!canViewOrderDetail}
              aria-label="View pharmacy order"
              onClick={() => {
                if (!canViewOrderDetail) return;
                navigate(`/pharmacy/orders/${row.id}`);
              }}
            >
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          {row.status === "ordered" && (
            <Group gap={4} wrap="nowrap">
              {canDispense && (
                <Tooltip label="Dispense">
                  <ActionIcon
                    variant="subtle"
                    color="success"
                    aria-label="Dispense pharmacy order"
                    onClick={() => dispenseMutation.mutate(row.id)}
                  >
                    <IconCheck size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
              {canCancelOrder && (
                <Tooltip label="Cancel">
                  <ActionIcon
                    variant="subtle"
                    color="danger"
                    aria-label="Cancel pharmacy order"
                    onClick={() => cancelMutation.mutate(row.id)}
                  >
                    <IconX size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          )}
        </Group>
      ),
    },
  ] satisfies Column<PharmacyOrder>[];

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        {canViewOrders ? (
          <Select
            placeholder="Status"
            data={PHARMACY_ORDER_STATUS_OPTIONS}
            value={effectiveFilterStatus}
            onChange={setOrderStatusFilter}
            clearable
            w={160}
          />
        ) : (
          <Text size="sm" c="dimmed">
            Order queue requires prescription-list permission.
          </Text>
        )}
        <Group gap="xs">
          {headerActions}
          {canDispense && (
            <>
              <Button
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() =>
                  navigate(
                    patientIdFilter
                      ? `/pharmacy/orders/new?patient_id=${patientIdFilter}`
                      : "/pharmacy/orders/new",
                  )
                }
              >
                New Order
              </Button>
              <Button
                size="xs"
                variant="light"
                color="teal"
                leftSection={<IconShoppingCart size={14} />}
                onClick={openOtc}
              >
                OTC Sale
              </Button>
            </>
          )}
        </Group>
      </Group>

      {canViewOrders ? (
        <Stack>
          {patientIdFilter && (
            <PharmacyPatientContext
              patientId={patientIdFilter}
              canViewPatientRecord={canViewPatientRecord}
            />
          )}
          {isDispenseHandoff && (
            <Alert color="teal" variant="light" title="Dispense handoff">
              <Group justify="space-between" align="center" gap="sm">
                <Text size="sm">
                  Ordered pharmacy items are filtered for this patient. Review FEFO and safety
                  context before dispensing.
                </Text>
                <Group gap="xs">
                  {firstDispensableOrder && canDispense && (
                    <Button
                      size="xs"
                      color="teal"
                      leftSection={<IconCheck size={14} />}
                      loading={dispenseMutation.isPending}
                      onClick={() => dispenseMutation.mutate(firstDispensableOrder.id)}
                    >
                      Dispense First Order
                    </Button>
                  )}
                  {firstDispensableOrder && canViewOrderDetail && (
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconEye size={14} />}
                      onClick={() => navigate(`/pharmacy/orders/${firstDispensableOrder.id}`)}
                    >
                      Open Order
                    </Button>
                  )}
                  <Button size="xs" variant="subtle" onClick={clearPharmacyHandoff}>
                    Dismiss
                  </Button>
                </Group>
              </Group>
            </Alert>
          )}
          <DataTable
            columns={columns}
            data={orders}
            loading={isLoading}
            page={page}
            totalPages={data ? Math.ceil(data.total / data.per_page) : 1}
            onPageChange={setPage}
            rowKey={(row) => row.id}
            virtualized="auto"
            virtualizeAt={40}
            virtualRowHeight={58}
            tableMaxHeight="calc(100vh - 360px)"
          />
        </Stack>
      ) : (
        <Alert color="warning" variant="light">
          This role can create or process pharmacy orders, but the order queue and patient list stay
          hidden until `pharmacy.prescriptions.list` is granted.
        </Alert>
      )}

      <OtcSaleDrawer opened={otcOpened} onClose={closeOtc} />
    </Stack>
  );
}

type ReturnWorkspaceMode = "medicine-returns" | "credit-notes";
const returnWorkspaceModes: ReturnWorkspaceMode[] = ["medicine-returns", "credit-notes"];

function isReturnWorkspaceMode(value: string): value is ReturnWorkspaceMode {
  return returnWorkspaceModes.some((mode) => mode === value);
}

type ReturnFilterStatus = PharmacyReturnStatusType | "all";
const returnFilterStatuses: ReturnFilterStatus[] = [
  "all",
  "requested",
  "approved",
  "returned_to_stock",
  "destroyed",
  "rejected",
];

function isReturnFilterStatus(value: string): value is ReturnFilterStatus {
  return returnFilterStatuses.some((status) => status === value);
}

function PharmacyReturnsWorkspace({
  canViewQueue,
  canViewCreditNoteQueue,
  canRequest,
  canApprove,
  canVoidDispensing,
  canRestock,
  canDestroy,
  canReject,
  canSettleCreditNote,
  canViewPatientRecord,
}: {
  canViewQueue: boolean;
  canViewCreditNoteQueue: boolean;
  canRequest: boolean;
  canApprove: boolean;
  canVoidDispensing: boolean;
  canRestock: boolean;
  canDestroy: boolean;
  canReject: boolean;
  canSettleCreditNote: boolean;
  canViewPatientRecord: boolean;
}) {
  const [mode, setMode] = useState<ReturnWorkspaceMode>("medicine-returns");

  return (
    <Stack>
      <SegmentedControl
        size="xs"
        value={mode}
        onChange={(value) => {
          if (isReturnWorkspaceMode(value)) setMode(value);
        }}
        data={[
          { value: "medicine-returns", label: "Dispensed item returns" },
          { value: "credit-notes", label: "Custom credit notes" },
        ]}
      />
      {mode === "medicine-returns" ? (
        <PharmacyReturnsTab
          canViewQueue={canViewQueue}
          canRequest={canRequest}
          canApprove={canApprove}
          canVoidDispensing={canVoidDispensing}
          canRestock={canRestock}
          canDestroy={canDestroy}
          canReject={canReject}
          canViewPatientRecord={canViewPatientRecord}
        />
      ) : (
        <CreditNotesTab
          canViewQueue={canViewCreditNoteQueue}
          canCreate={canRequest}
          canApprove={canApprove}
          canSettle={canSettleCreditNote}
          canCancel={canReject}
          canViewPatientRecord={canViewPatientRecord}
        />
      )}
    </Stack>
  );
}

const returnStatusColors: Record<PharmacyReturnStatusType, string> = {
  requested: "yellow",
  approved: "blue",
  returned_to_stock: "green",
  destroyed: "red",
  rejected: "gray",
};

const returnStatusLabels: Record<PharmacyReturnStatusType, string> = {
  requested: "Requested",
  approved: "Approved",
  returned_to_stock: "Returned to stock",
  destroyed: "Destroyed",
  rejected: "Rejected",
};

function PharmacyReturnsTab({
  canViewQueue,
  canRequest,
  canApprove,
  canVoidDispensing,
  canRestock,
  canDestroy,
  canReject,
  canViewPatientRecord,
}: {
  canViewQueue: boolean;
  canRequest: boolean;
  canApprove: boolean;
  canVoidDispensing: boolean;
  canRestock: boolean;
  canDestroy: boolean;
  canReject: boolean;
  canViewPatientRecord: boolean;
}) {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<ReturnFilterStatus>("all");
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ["pharmacy-returns"],
    queryFn: () => pharmacyService.listPharmacyReturns(),
    enabled: canViewQueue,
  });

  const processMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PharmacyReturnStatusType }) =>
      pharmacyService.processPharmacyReturn(id, { status }),
    onSuccess: (_row, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-returns"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-order-detail"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-credit-notes"] });
      notifications.show({
        title: returnStatusLabels[variables.status],
        message: "Return queue updated",
        color: returnStatusColors[variables.status],
      });
    },
    onError: (error) => {
      notifications.show({
        title: "Return action failed",
        message: error instanceof Error ? error.message : "Unable to update return",
        color: "danger",
      });
    },
  });

  const filteredReturns = useMemo(
    () => (filterStatus === "all" ? returns : returns.filter((row) => row.status === filterStatus)),
    [filterStatus, returns],
  );
  const requestReturnAction = canRequest ? (
    canViewPatientRecord ? (
      <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreate}>
        Request Return
      </Button>
    ) : (
      <Tooltip label="Patient record access is required to pick the return order">
        <span>
          <Button size="xs" leftSection={<IconLock size={14} />} disabled>
            Request Return
          </Button>
        </span>
      </Tooltip>
    )
  ) : undefined;

  const columns: Column<PharmacyReturn>[] = [
    {
      key: "patient_id",
      label: "Patient",
      fieldAccessKeys: PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
      accessor: (row: PharmacyReturn) => row.patient_id,
      fieldKind: "identifier",
      hiddenLabel: "Patient restricted",
      render: (row: PharmacyReturn) => (
        <PharmacyPatientCell
          patientId={row.patient_id}
          canViewPatientRecord={canViewPatientRecord}
        />
      ),
    },
    {
      key: "order_item_id",
      label: "Order Item",
      render: (row: PharmacyReturn) => (
        <Text size="sm" ff="JetBrains Mono, monospace">
          {row.order_item_id.slice(0, 8)}
        </Text>
      ),
    },
    {
      key: "quantity_returned",
      label: "Qty",
      render: (row: PharmacyReturn) => <Text size="sm">{row.quantity_returned}</Text>,
    },
    {
      key: "reason",
      label: "Reason",
      render: (row: PharmacyReturn) => (
        <Text size="sm" lineClamp={1}>
          {row.reason?.trim() || "—"}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: PharmacyReturn) => (
        <Badge size="xs" variant="light" color={returnStatusColors[row.status]}>
          {returnStatusLabels[row.status]}
        </Badge>
      ),
    },
    {
      key: "created_at",
      label: "Requested",
      render: (row: PharmacyReturn) => (
        <Text size="sm">{new Date(row.created_at).toLocaleString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: PharmacyReturn) => (
        <Group gap={4} wrap="nowrap">
          {row.status === "requested" && (
            <>
              <Tooltip
                label={
                  canApprove && canVoidDispensing
                    ? "Approve post-dispense reversal"
                    : "Return approval and dispensing void permissions required"
                }
              >
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="success"
                  disabled={!canApprove || !canVoidDispensing || processMutation.isPending}
                  onClick={() => processMutation.mutate({ id: row.id, status: "approved" })}
                  aria-label="Approve return"
                >
                  <IconCheck size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={canReject ? "Reject return" : "No reject permission"}>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="danger"
                  disabled={!canReject || processMutation.isPending}
                  onClick={() => processMutation.mutate({ id: row.id, status: "rejected" })}
                  aria-label="Reject return"
                >
                  <IconX size={14} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
          {row.status === "approved" && (
            <>
              <Tooltip label={canRestock ? "Return usable stock" : "No restock permission"}>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="teal"
                  disabled={!canRestock || processMutation.isPending}
                  onClick={() =>
                    processMutation.mutate({ id: row.id, status: "returned_to_stock" })
                  }
                  aria-label="Return to stock"
                >
                  <IconPackage size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={canDestroy ? "Mark as destroyed" : "No destroy permission"}>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="danger"
                  disabled={!canDestroy || processMutation.isPending}
                  onClick={() => processMutation.mutate({ id: row.id, status: "destroyed" })}
                  aria-label="Destroy returned item"
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
          {row.status !== "requested" && row.status !== "approved" && (
            <Text size="xs" c="dimmed">
              Closed
            </Text>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Alert color="blue" variant="light" icon={<IconReceipt size={16} />}>
        Medicine returns are linked to already dispensed/billed order lines. Use Custom credit notes
        for supplier returns, expiry/damage write-off, or manual financial adjustments.
      </Alert>
      {!canViewQueue && (
        <Alert color="gray" variant="light" icon={<IconLock size={16} />}>
          Return queue access requires a return list, approval, restock, destroy, or rejection role.
          You can still request a return if that action is available.
        </Alert>
      )}
      <DataTable
        columns={columns}
        data={filteredReturns}
        loading={canViewQueue && isLoading}
        rowKey={(row) => row.id}
        toolbar={
          <SegmentedControl
            size="xs"
            value={filterStatus}
            disabled={!canViewQueue}
            onChange={(value) => {
              if (isReturnFilterStatus(value)) setFilterStatus(value);
            }}
            data={[
              { value: "all", label: "All" },
              { value: "requested", label: "Requested" },
              { value: "approved", label: "Approved" },
              { value: "returned_to_stock", label: "Restocked" },
              { value: "destroyed", label: "Destroyed" },
              { value: "rejected", label: "Rejected" },
            ]}
          />
        }
        tableActions={requestReturnAction}
      />
      <CreatePharmacyReturnModal
        opened={createOpened}
        onClose={closeCreate}
        canViewPatientRecord={canViewPatientRecord}
      />
    </Stack>
  );
}

function CreatePharmacyReturnModal({
  opened,
  onClose,
  canViewPatientRecord,
}: {
  opened: boolean;
  onClose: () => void;
  canViewPatientRecord: boolean;
}) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<PharmacyReturnRequestFormInput>({
    resolver: zodResolver(pharmacyReturnRequestFormSchema),
    defaultValues: {
      patient_id: "",
      items: [],
    },
  });
  const {
    fields: selectedReturnFields,
    replace: replaceReturnItems,
    remove: removeReturnItem,
  } = useFieldArray({
    control,
    name: "items",
  });

  const patientId = watch("patient_id");
  const selectedReturnItems = watch("items") ?? [];
  const selectedOrderItemIds = selectedReturnItems.map((item) => item.order_item_id);

  const { data: patientOrders = [], isLoading: patientOrdersLoading } = useQuery({
    queryKey: ["pharmacy", "patient-orders", patientId],
    queryFn: () => pharmacyService.listPatientOrdersForReturn(patientId),
    enabled: canViewPatientRecord && patientId.length > 0,
  });

  const returnableItems = useMemo(
    () =>
      patientOrders
        .filter((order) => order.status === "dispensed")
        .flatMap((order) => normalizeReturnableItems(order)),
    [patientOrders],
  );

  const returnableItemById = useMemo(
    () => new Map(returnableItems.map((item) => [item.itemId, item])),
    [returnableItems],
  );
  const returnableItemOptions = useMemo(
    () =>
      returnableItems.map((item) => ({
        value: item.itemId,
        label: `${item.drugName} · remaining ${item.remainingQuantity}/${item.quantity} · ${new Date(
          item.orderDate,
        ).toLocaleDateString()}`,
      })),
    [returnableItems],
  );

  const createMutation = useMutation({
    mutationFn: (values: PharmacyReturnRequestFormInput) =>
      pharmacyService.createPharmacyReturns({
        patient_id: values.patient_id,
        items: values.items.map((item) => ({
          order_item_id: item.order_item_id,
          quantity_returned: formIntegerOrFallback(item.quantity_returned, 1),
          reason: optionalFormText(item.reason),
        })),
      }),
    onSuccess: (rows) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-returns"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-order-detail"] });
      notifications.show({
        title: "Return requested",
        message: `${rows.length} return ${rows.length === 1 ? "line is" : "lines are"} waiting for approval`,
        color: "success",
      });
      reset({ patient_id: "", items: [] });
      onClose();
    },
    onError: (error) => {
      notifications.show({
        title: "Return request failed",
        message: error instanceof Error ? error.message : "Unable to request return",
        color: "danger",
      });
    },
  });

  function handleClose() {
    reset({ patient_id: "", items: [] });
    onClose();
  }

  function submitReturn(values: PharmacyReturnRequestFormInput) {
    for (const item of values.items) {
      const returnableItem = returnableItemById.get(item.order_item_id);
      const returnQuantity = formIntegerOrFallback(item.quantity_returned, 1);
      if (!returnableItem) {
        setError("items", {
          type: "validate",
          message: "One selected medicine is no longer available for return.",
        });
        return;
      }
      if (returnQuantity > returnableItem.remainingQuantity) {
        setError("items", {
          type: "validate",
          message: `${returnableItem.drugName} can return only ${returnableItem.remainingQuantity} more.`,
        });
        return;
      }
    }
    createMutation.mutate(values);
  }

  function updateSelectedMedicineIds(itemIds: string[]) {
    const currentById = new Map(selectedReturnItems.map((item) => [item.order_item_id, item]));
    replaceReturnItems(
      itemIds.map(
        (itemId) =>
          currentById.get(itemId) ?? {
            order_item_id: itemId,
            quantity_returned: 1,
            reason: "",
          },
      ),
    );
    clearErrors("items");
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Request Medicine Return" size="xl">
      {!canViewPatientRecord ? (
        <Stack>
          <Alert color="orange" variant="light" icon={<IconLock size={16} />}>
            Patient record access is required to select the dispensed medicine for a return.
          </Alert>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose}>
              Close
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack component="form" onSubmit={handleSubmit(submitReturn)}>
          <Controller
            control={control}
            name="patient_id"
            render={({ field, fieldState }) => (
              <PatientSearchSelect
                label="Patient"
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  replaceReturnItems([]);
                  setValue("items", []);
                  clearErrors("items");
                }}
                error={fieldState.error?.message}
                required
              />
            )}
          />
          {patientId.length > 0 && (
            <PharmacyPatientContext
              patientId={patientId}
              canViewPatientRecord={canViewPatientRecord}
            />
          )}
          <MultiSelect
            label="Previous billed / dispensed medicines"
            placeholder={
              patientOrdersLoading ? "Loading dispensed medicines..." : "Select medicine lines"
            }
            data={returnableItemOptions}
            value={selectedOrderItemIds}
            onChange={updateSelectedMedicineIds}
            error={typeof errors.items?.message === "string" ? errors.items.message : undefined}
            disabled={!patientId || patientOrdersLoading}
            searchable
            clearable
            required
          />
          {patientId.length > 0 && !patientOrdersLoading && returnableItems.length === 0 && (
            <Alert color="gray" variant="light" icon={<IconClock size={16} />}>
              No dispensed pharmacy medicines are available for return.
            </Alert>
          )}
          {selectedReturnFields.map((field, index) => {
            const selectedLine = selectedReturnItems[index];
            const returnableItem = returnableItemById.get(selectedLine?.order_item_id ?? "");
            return (
              <Card key={field.id} withBorder radius="sm" p="sm">
                <Stack gap="xs">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={2}>
                      <Text size="sm" fw={700}>
                        {returnableItem?.drugName ?? "Selected medicine"}
                      </Text>
                      <Group gap="xs">
                        <Badge size="xs" variant="light" color="blue">
                          {returnableItem
                            ? new Date(returnableItem.orderDate).toLocaleDateString()
                            : "Order"}
                        </Badge>
                        <Badge size="xs" variant="light" color="gray">
                          Batch {returnableItem?.batchNumber ?? "not captured"}
                        </Badge>
                        <Badge size="xs" variant="light" color="teal">
                          Remaining {returnableItem?.remainingQuantity ?? 0}/
                          {returnableItem?.quantity ?? 0}
                        </Badge>
                      </Group>
                    </Stack>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="danger"
                      aria-label="Remove return line"
                      onClick={() => removeReturnItem(index)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                  <Group grow align="flex-start">
                    <Controller
                      control={control}
                      name={`items.${index}.quantity_returned`}
                      render={({ field: quantityField, fieldState }) => (
                        <NumberInput
                          label="Return quantity"
                          min={1}
                          max={returnableItem?.remainingQuantity}
                          value={quantityField.value}
                          onChange={quantityField.onChange}
                          error={fieldState.error?.message}
                          required
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name={`items.${index}.reason`}
                      render={({ field: reasonField, fieldState }) => (
                        <Textarea
                          label="Reason"
                          placeholder="Wrong medicine, adverse event, patient refused, damaged strip..."
                          value={reasonField.value}
                          onChange={reasonField.onChange}
                          error={fieldState.error?.message}
                          autosize
                          minRows={1}
                        />
                      )}
                    />
                  </Group>
                </Stack>
              </Card>
            );
          })}
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending}
              disabled={selectedReturnItems.length === 0}
            >
              Submit {selectedReturnItems.length > 1 ? "Returns" : "Return"}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

function OtcSaleDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftPharmacyOrderItem[]>([newDraftPharmacyOrderItem()]);

  const createMutation = useMutation({
    mutationFn: (data: CreateOtcSaleRequest) => pharmacyService.createOtcSale(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      notifications.show({ title: "OTC Sale", message: "Walk-in sale recorded", color: "teal" });
      onClose();
      setNotes("");
      setItems([newDraftPharmacyOrderItem()]);
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to record OTC sale", color: "danger" });
    },
  });

  return (
    <Drawer opened={opened} onClose={onClose} title="OTC Walk-in Sale" position="right" size="xl">
      <Stack>
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Text fw={600} size="sm">
          Items
        </Text>
        {items.map((item, idx) => (
          <MedicineOrderLineCard
            key={item.row_id}
            value={item}
            index={idx}
            priceLabel="Price"
            className={styles.medicationCard}
            removePermission={P.PHARMACY.POS_CREATE}
            onChange={(next) => {
              const updated = [...items];
              updated[idx] = { ...item, ...next };
              setItems(updated);
            }}
            canRemove={items.length > 1}
            onRemove={() => setItems(items.filter((_, i) => i !== idx))}
          />
        ))}
        <Group>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => setItems([...items, newDraftPharmacyOrderItem()])}
          >
            Add medicine
          </Button>
          <Button
            size="xs"
            color="teal"
            onClick={() =>
              createMutation.mutate({
                items: draftPharmacyOrderItemsPayload(items),
                notes: notes || undefined,
              })
            }
            loading={createMutation.isPending}
          >
            Record OTC Sale
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}

function PharmacyOrderForm({
  initialPatientId,
  canViewPatientRecord,
  onCancel,
  onSuccess,
}: {
  initialPatientId?: string;
  canViewPatientRecord: boolean;
  onCancel: () => void;
  onSuccess: (detail: PharmacyOrderDetailResponse) => void;
}) {
  const queryClient = useQueryClient();
  const emit = useClinicalEmit();
  const canOverrideSafety = useHasPermission(P.PHARMACY.SAFETY_OVERRIDE);
  const priceAccess = useFieldAccess("pharmacy.pricing.unit_price");
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PharmacyOrderFormInput>({
    resolver: zodResolver(pharmacyOrderFormSchema),
    defaultValues: pharmacyOrderDefaults(initialPatientId),
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });
  const patientId = watch("patient_id");
  const items = watch("items");

  const createMutation = useMutation({
    mutationFn: (data: CreatePharmacyOrderRequest) => pharmacyService.createPharmacyOrder(data),
    onSuccess: (detail) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-order-detail", detail.order.id] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({
        queryKey: ["patient-invoices", detail.order.patient_id],
      });
      notifications.show({
        title: "Order created",
        message: "Pharmacy order placed and draft billing indent updated",
        color: "success",
      });
      emit("order.created", {
        admission_id: detail.admission_id,
        dispensing_type: detail.order.dispensing_type,
        encounter_id: detail.order.encounter_id,
        items: pharmacyOrderEventItems(detail.items),
        order_id: detail.order.id,
        order_type: "pharmacy",
        patient_id: detail.order.patient_id,
        prescription_id: detail.order.prescription_id,
      });
      reset(pharmacyOrderDefaults(initialPatientId));
      onSuccess(detail);
    },
    onError: (error) => {
      notifications.show({
        title: "Order blocked",
        message: error instanceof Error ? error.message : "Failed to create order",
        color: "danger",
      });
    },
  });

  const orderTotals = draftTotals(items.map(pharmacyOrderLineFromForm));
  const createError =
    createMutation.error instanceof Error ? createMutation.error.message : undefined;
  const submitOrder = handleSubmit((values) => {
    createMutation.mutate(pharmacyOrderPayloadFromForm(values));
  });

  return (
    <Card withBorder>
      <Stack component="form" onSubmit={submitOrder}>
        <Controller
          control={control}
          name="patient_id"
          render={({ field, fieldState }) => (
            <PatientSearchSelect
              value={field.value}
              onChange={field.onChange}
              required
              error={fieldState.error?.message}
            />
          )}
        />
        <PharmacyPatientContext patientId={patientId} canViewPatientRecord={canViewPatientRecord} />
        {createError && (
          <Alert color="red" icon={<IconAlertTriangle size={16} />}>
            {createError}
          </Alert>
        )}
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <Textarea label="Notes" value={field.value} onChange={field.onChange} />
          )}
        />
        {canOverrideSafety && (
          <Controller
            control={control}
            name="safety_override_reason"
            render={({ field }) => (
              <Textarea
                label="Medication safety override reason"
                value={field.value}
                onChange={field.onChange}
                minRows={2}
              />
            )}
          />
        )}
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Medications
          </Text>
          {fields.map((field, idx) => (
            <Controller
              key={field.id}
              control={control}
              name={`items.${idx}`}
              render={({ field: itemField, fieldState }) => (
                <Stack gap={4}>
                  <MedicineOrderLineCard
                    value={pharmacyOrderLineFromForm(itemField.value)}
                    index={idx}
                    priceLabel="Unit price (ex-GST)"
                    className={styles.medicationCard}
                    removePermission={P.PHARMACY.DISPENSING_CREATE}
                    onChange={(next) => {
                      itemField.onChange({
                        ...itemField.value,
                        catalog_item_id: next.catalog_item_id ?? "",
                        drug_name: next.drug_name,
                        quantity: next.quantity,
                        unit_price: next.unit_price,
                        tax_percent: next.tax_percent ?? 0,
                      });
                    }}
                    canRemove={fields.length > 1}
                    onRemove={() => remove(idx)}
                  />
                  {fieldState.error && (
                    <Text size="xs" c="danger">
                      Complete medicine, quantity, and price before placing the order.
                    </Text>
                  )}
                </Stack>
              )}
            />
          ))}
        </Stack>
        {errors.items?.message && (
          <Text size="xs" c="danger">
            {errors.items.message}
          </Text>
        )}
        <Group justify="space-between">
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => append(newPharmacyOrderFormItem())}
          >
            Add medicine
          </Button>
          <Stack gap={0} align="flex-end">
            <Text size="xs" c="dimmed">
              Subtotal {renderPharmacySensitiveCurrency(priceAccess, orderTotals.subtotal)} · GST{" "}
              {renderPharmacySensitiveCurrency(priceAccess, orderTotals.tax)}
            </Text>
            <Text fw={700}>
              Payable: {renderPharmacySensitiveCurrency(priceAccess, orderTotals.total)}
            </Text>
          </Stack>
        </Group>
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={createMutation.isPending}>
            Place Order
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

function PharmacyOrderDetail({
  orderId,
  canEditItems,
  canDispense,
  canViewReturns,
  canViewPatientRecord,
}: {
  orderId: string;
  canEditItems: boolean;
  canDispense: boolean;
  canViewReturns: boolean;
  canViewPatientRecord: boolean;
}) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAudit, setShowAudit] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "schedule">("schedule");
  const emit = useClinicalEmit();
  const batchNumberAccess = useFieldAccess("pharmacy.batches.batch_number");
  const priceAccess = useFieldAccess("pharmacy.pricing.unit_price");
  const { data } = useQuery({
    queryKey: ["pharmacy-order-detail", orderId],
    queryFn: () => pharmacyService.getPharmacyOrder(orderId),
  });

  // Fetch linked prescription for structured timing data
  const detail = data as PharmacyOrderDetailResponse | undefined;
  const prescriptionId = detail?.order.prescription_id;
  const { data: rxData } = useQuery<PrescriptionWithItems>({
    queryKey: ["prescription-detail", prescriptionId],
    queryFn: () => pharmacyService.getPrescription(prescriptionId as string),
    enabled: !!prescriptionId,
  });

  // Patient identity for labels — UUID slice is medically dangerous on a
  // dispensed-medication label, so resolve to real name + UHID.
  const { data: patientName } = usePatientName(
    canViewPatientRecord ? detail?.order.patient_id : undefined,
  );

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      pharmacyService.updatePharmacyOrderItem(orderId, itemId, { quantity }),
    onSuccess: (next) => {
      queryClient.setQueryData(["pharmacy-order-detail", orderId], next);
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      notifications.show({
        title: "Quantity updated",
        message: "Order item and draft billing line were updated",
        color: "green",
      });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => pharmacyService.removePharmacyOrderItem(orderId, itemId),
    onSuccess: (next) => {
      queryClient.setQueryData(["pharmacy-order-detail", orderId], next);
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      notifications.show({
        title: "Item removed",
        message: "Order item was removed and the draft billing line was reversed",
        color: "green",
      });
    },
  });

  const clearDispenseHandoff = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
  };
  const dispenseMutation = useMutation({
    mutationFn: async () => {
      const currentDetail = await pharmacyService.getPharmacyOrder(orderId);
      const order = await pharmacyService.dispenseOrder(orderId);
      return { admissionId: currentDetail.admission_id, items: currentDetail.items, order };
    },
    onSuccess: ({ admissionId, items, order }) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-order-detail", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["invoice"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-invoices", order.patient_id] });
      notifications.show({
        title: "Dispensed",
        message: "Order dispensed and linked billing charges refreshed",
        color: "success",
      });
      emit("pharmacy.order.dispensed", {
        admission_id: admissionId,
        dispensing_type: order.dispensing_type,
        encounter_id: order.encounter_id,
        items: pharmacyOrderEventItems(items),
        order_id: orderId,
        order_type: "pharmacy",
        patient_id: order.patient_id,
      });
      clearDispenseHandoff();
    },
  });

  if (!detail) return <Text c="dimmed">Loading...</Text>;

  const hasRxItems = rxData && rxData.items.length > 0;
  const canEditOrderItems = canEditItems && detail.order.status === "ordered";
  const isDispenseHandoff = searchParams.get("action") === "dispense";
  const isAwaitingDispense = detail.order.status === "ordered";
  const dispenseHandoffMessage = !isAwaitingDispense
    ? "This order is no longer awaiting dispense."
    : canDispense
      ? "Review FEFO, patient identity, allergies, and label context before dispensing this order."
      : "Dispensing permission is required to complete this handoff.";
  const canPrintMedicationLabels = canViewPatientRecord && hasRxItems;
  const prescriptionPatientName = canViewPatientRecord
    ? (patientName?.full_name ?? "Linked patient")
    : "Patient restricted";
  const prescriptionUhid = canViewPatientRecord ? (patientName?.uhid ?? "") : "";
  const completedEvents: ClinicalEventName[] = ["order.created"];
  if (detail.order.status === "dispensed" || detail.order.dispensed_at) {
    completedEvents.push("pharmacy.order.dispensed");
  }
  const journeyContext: ClinicalJourneyContext = {
    patientId: detail.order.patient_id,
    activeEncounterId: detail.order.encounter_id,
    activeAdmissionId: detail.admission_id,
    activeAdmissionStatus: detail.admission_id ? "admitted" : null,
    activePharmacyOrderId: detail.order.id,
    activeOrderContext: detail.admission_id ? "ipd" : detail.order.encounter_id ? "opd" : null,
    completedEvents,
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={700}>Order: {detail.order.id.slice(0, 8)}...</Text>
        <Group gap="xs">
          <Badge color={statusColors[detail.order.status] ?? "gray"} variant="light" size="lg">
            {detail.order.status}
          </Badge>
          <Badge variant="outline" size="sm">
            {dispensingTypeLabels[detail.order.dispensing_type] ?? detail.order.dispensing_type}
          </Badge>
        </Group>
      </Group>
      {detail.order.dispensed_at && (
        <Text size="xs" c="dimmed">
          Dispensed: {new Date(detail.order.dispensed_at).toLocaleString()}
        </Text>
      )}
      {canEditOrderItems && (
        <Alert color="primary" variant="light" icon={<IconShieldCheck size={16} />}>
          Edit or remove medicines before dispense. Draft billing lines stay synchronized.
        </Alert>
      )}
      <PharmacyPatientContext
        patientId={detail.order.patient_id}
        canViewPatientRecord={canViewPatientRecord}
      />
      <PatientFlowNavigator
        patientId={detail.order.patient_id}
        active="pharmacy"
        activeEncounterId={detail.order.encounter_id ?? null}
        activeAdmissionId={detail.admission_id}
        activePharmacyOrderId={detail.order.id}
        activeOrderContext={detail.admission_id ? "ipd" : detail.order.encounter_id ? "opd" : null}
        completedEvents={completedEvents}
        compact
      />
      {isDispenseHandoff && (
        <Alert color="teal" variant="light" title="Dispense handoff">
          <Group justify="space-between" align="center" gap="sm">
            <Text size="sm">{dispenseHandoffMessage}</Text>
            <Group gap="xs">
              {isAwaitingDispense && canDispense && (
                <Button
                  size="xs"
                  color="teal"
                  leftSection={<IconCheck size={14} />}
                  loading={dispenseMutation.isPending}
                  onClick={() => dispenseMutation.mutate()}
                >
                  Dispense Order
                </Button>
              )}
              <Button size="xs" variant="subtle" onClick={clearDispenseHandoff}>
                Dismiss
              </Button>
            </Group>
          </Group>
        </Alert>
      )}
      <Card withBorder padding="sm">
        <Group justify="space-between" gap="sm" align="center">
          <Stack gap={2}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              Patient handoff
            </Text>
            <Text size="xs" c="dimmed">
              Move from dispensing to clinical context, billing, or follow-up without re-searching.
            </Text>
          </Stack>
          <PatientJourneyActions
            context={journeyContext}
            hiddenActionIds={["pharmacy.open_patient_queue"]}
            size="xs"
          />
        </Group>
      </Card>

      {/* View mode toggle — show schedule view when prescription data is available */}
      {hasRxItems && (
        <SegmentedControl
          size="xs"
          value={viewMode}
          onChange={(v) => setViewMode(v as "table" | "schedule")}
          data={[
            { value: "schedule", label: "Medication Schedule" },
            { value: "table", label: "Order Table" },
          ]}
        />
      )}

      {/* Schedule view — time-grouped with timing/food instructions */}
      {viewMode === "schedule" && hasRxItems ? (
        <PharmacyDispensingView items={rxData.items} />
      ) : (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Drug</Table.Th>
              <Table.Th>Batch</Table.Th>
              <Table.Th>Expiry</Table.Th>
              <Table.Th>Qty</Table.Th>
              <Table.Th>Unit Price</Table.Th>
              <Table.Th>Total</Table.Th>
              {canViewReturns && <Table.Th>Returned</Table.Th>}
              {canEditOrderItems && <Table.Th>Actions</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {detail.items.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.drug_name}</Table.Td>
                <Table.Td>
                  {renderPharmacySensitiveValue(batchNumberAccess, item.batch_number)}
                </Table.Td>
                <Table.Td>
                  {item.expiry_date ? <ExpiryCell date={item.expiry_date} /> : "\u2014"}
                </Table.Td>
                <Table.Td>
                  {canEditOrderItems ? (
                    <EditablePharmacyQuantity
                      key={`${item.id}-${item.quantity}`}
                      item={item}
                      isSaving={updateItemMutation.isPending}
                      onSave={(quantity) =>
                        updateItemMutation.mutate({ itemId: item.id, quantity })
                      }
                    />
                  ) : (
                    item.quantity
                  )}
                </Table.Td>
                <Table.Td>{renderPharmacySensitiveCurrency(priceAccess, item.unit_price)}</Table.Td>
                <Table.Td>
                  {renderPharmacySensitiveCurrency(priceAccess, item.total_price)}
                </Table.Td>
                {canViewReturns && (
                  <Table.Td>{item.quantity_returned > 0 ? item.quantity_returned : "—"}</Table.Td>
                )}
                {canEditOrderItems && (
                  <Table.Td>
                    <Tooltip
                      label={
                        detail.items.length <= 1
                          ? "At least one item must remain"
                          : "Remove item before dispense"
                      }
                    >
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="danger"
                        disabled={detail.items.length <= 1 || removeItemMutation.isPending}
                        onClick={() => removeItemMutation.mutate(item.id)}
                        aria-label={`Remove ${item.drug_name}`}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {/* FEFO assistance: when the order is awaiting dispense, surface
          earliest-expiry batches so the dispenser doesn't need to flip
          to the Batches tab to apply First-Expiry-First-Out. */}
      {detail.order.status === "ordered" && detail.items.length > 0 && (
        <NearExpiryHints drugNames={Array.from(new Set(detail.items.map((i) => i.drug_name)))} />
      )}

      <Group gap="xs">
        <Button
          variant="light"
          size="xs"
          leftSection={<IconClipboardList size={14} />}
          onClick={() => setShowAudit(!showAudit)}
        >
          {showAudit ? "Hide" : "Show"} Prescription Audit Trail
        </Button>
        {canPrintMedicationLabels && (
          <Button variant="light" size="xs" color="teal" onClick={() => setShowLabels(!showLabels)}>
            {showLabels ? "Hide" : "Print"} Medication Labels
          </Button>
        )}
      </Group>
      {showAudit && <PrescriptionAuditTrail prescriptionId={orderId} />}
      {showLabels && canPrintMedicationLabels && (
        <PharmacyLabel
          items={rxData.items}
          patientName={prescriptionPatientName}
          uhid={prescriptionUhid}
          date={new Date().toLocaleDateString()}
        />
      )}

      {hasRxItems && (
        <PrescriptionViews
          prescriptions={[rxData]}
          patientName={prescriptionPatientName}
          uhid={prescriptionUhid}
          allergies={[]}
        />
      )}
    </Stack>
  );
}

function EditablePharmacyQuantity({
  item,
  isSaving,
  onSave,
}: {
  item: PharmacyOrderDetailResponse["items"][number];
  isSaving: boolean;
  onSave: (quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(item.quantity);
  const canSave = Number.isInteger(quantity) && quantity > 0 && quantity !== item.quantity;

  return (
    <Group gap={4} wrap="nowrap">
      <NumberInput
        value={quantity}
        min={1}
        step={1}
        allowDecimal={false}
        clampBehavior="strict"
        hideControls
        size="xs"
        w={72}
        onChange={(value) => {
          const next = typeof value === "number" ? value : Number.parseInt(value || "0", 10);
          setQuantity(Number.isFinite(next) ? next : 0);
        }}
      />
      <Tooltip label="Save quantity">
        <ActionIcon
          size="sm"
          variant="light"
          color="primary"
          disabled={!canSave || isSaving}
          loading={isSaving && canSave}
          onClick={() => onSave(quantity)}
          aria-label={`Save ${item.drug_name} quantity`}
        >
          <IconDeviceFloppy size={14} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

// ── Prescription Audit Trail ──────────────────────────────

function PrescriptionAuditTrail({ prescriptionId }: { prescriptionId: string }) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["prescription-audit", prescriptionId],
    queryFn: () => pharmacyService.prescriptionAudit(prescriptionId),
  });

  if (isLoading)
    return (
      <Text size="sm" c="dimmed">
        Loading audit trail...
      </Text>
    );
  if (entries.length === 0)
    return (
      <Text size="sm" c="dimmed">
        No audit entries found.
      </Text>
    );

  return (
    <Table striped>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Action</Table.Th>
          <Table.Th>Field</Table.Th>
          <Table.Th>Old Value</Table.Th>
          <Table.Th>New Value</Table.Th>
          <Table.Th>Changed By</Table.Th>
          <Table.Th>Time</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {(entries as PrescriptionAuditEntry[]).map((entry) => (
          <Table.Tr key={`${entry.changed_at}-${entry.action}-${entry.field_name}`}>
            <Table.Td>
              <Badge size="xs" variant="light">
                {entry.action}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{entry.field_name}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed">
                {entry.old_value ?? "—"}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{entry.new_value ?? "—"}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{entry.changed_by.slice(0, 8)}...</Text>
            </Table.Td>
            <Table.Td>
              <Text size="xs" c="dimmed">
                {new Date(entry.changed_at).toLocaleString()}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

// ── Drug Interaction Check Modal ──────────────────────────

function DrugInteractionModal({
  opened,
  onClose,
  canViewPatientRecord,
}: {
  opened: boolean;
  onClose: () => void;
  canViewPatientRecord: boolean;
}) {
  const [patientId, setPatientId] = useState("");
  const [drugId, setDrugId] = useState("");

  const checkMutation = useMutation({
    mutationFn: (data: DrugInteractionCheckRequest) => pharmacyService.checkDrugInteractions(data),
  });

  const severityColors: Record<string, string> = {
    severe: "danger",
    moderate: "orange",
    mild: "warning",
    minor: "gray",
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Drug Interaction Check" size="xl">
      <Stack>
        <PatientSearchSelect value={patientId} onChange={setPatientId} required />
        <PharmacyPatientContext patientId={patientId} canViewPatientRecord={canViewPatientRecord} />
        <DrugSearchSelect
          value={drugId}
          onChange={(id) => setDrugId(id)}
          label="Drug to Check"
          required
        />
        <Button
          onClick={() => checkMutation.mutate({ patient_id: patientId, drug_id: drugId })}
          loading={checkMutation.isPending}
          disabled={!patientId.trim() || !drugId.trim()}
        >
          Check Interactions
        </Button>

        {checkMutation.data && (checkMutation.data as DrugInteractionResult[]).length > 0 && (
          <Stack gap="xs">
            <Text fw={600} size="sm">
              Interactions Found:
            </Text>
            {(checkMutation.data as DrugInteractionResult[]).map((r) => (
              <Alert
                key={`${r.interacting_drug}-${r.interaction_type}-${r.severity}`}
                color={severityColors[r.severity] ?? "gray"}
                variant="light"
                title={r.interacting_drug}
              >
                <Group gap="xs" mb={4}>
                  <Badge color={severityColors[r.severity] ?? "gray"} size="sm">
                    {r.severity}
                  </Badge>
                  <Badge variant="outline" size="sm">
                    {r.interaction_type}
                  </Badge>
                </Group>
                <Text size="sm">{r.description}</Text>
              </Alert>
            ))}
          </Stack>
        )}

        {checkMutation.data && (checkMutation.data as DrugInteractionResult[]).length === 0 && (
          <Alert color="success" variant="light" title="No Interactions">
            <Text size="sm">No drug interactions found for this combination.</Text>
          </Alert>
        )}
      </Stack>
    </Modal>
  );
}

// ── Formulary Check Modal ─────────────────────────────────

function FormularyCheckModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [drugId, setDrugId] = useState("");

  const checkMutation = useMutation({
    mutationFn: (data: { drug_id: string }) => pharmacyService.formularyCheck(data),
  });

  const result = checkMutation.data as FormularyCheckResult | undefined;

  return (
    <Modal opened={opened} onClose={onClose} title="Formulary Check" size="lg">
      <Stack>
        <DrugSearchSelect value={drugId} onChange={(id) => setDrugId(id)} label="Drug" required />
        <Button
          onClick={() => checkMutation.mutate({ drug_id: drugId })}
          loading={checkMutation.isPending}
          disabled={!drugId.trim()}
        >
          Check Formulary Status
        </Button>

        {result && (
          <Card withBorder>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={600}>{result.drug_name}</Text>
                <Badge color={result.is_formulary ? "success" : "danger"} variant="filled">
                  {result.is_formulary ? "In Formulary" : "Not in Formulary"}
                </Badge>
              </Group>
              {result.requires_approval && (
                <Alert color="orange" variant="light">
                  <Text size="sm">This drug requires DTC approval before prescribing.</Text>
                </Alert>
              )}
              {result.alternative_drugs?.length > 0 && (
                <Stack gap={4}>
                  <Text size="sm" fw={500}>
                    Formulary Alternatives:
                  </Text>
                  <Group gap={4}>
                    {result.alternative_drugs.map((alt) => (
                      <Badge key={alt} variant="light" color="primary" size="sm">
                        {alt}
                      </Badge>
                    ))}
                  </Group>
                </Stack>
              )}
            </Stack>
          </Card>
        )}
      </Stack>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════
//  Catalog Tab
// ══════════════════════════════════════════════════════════

function PharmacyCatalogTab({
  canManage,
  compliance,
}: {
  canManage: boolean;
  compliance: ComplianceSettings;
}) {
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const [formularyFilter, setFormularyFilter] = useState<string | null>(null);
  const priceAccess = useFieldAccess("pharmacy.catalog.base_price");
  const catalogDefaults: PharmacyCatalogFormInput = {
    code: "",
    name: "",
    generic_name: "",
    category: "",
    manufacturer: "",
    unit: "",
    base_price: 0,
    tax_percent: 0,
    reorder_level: 0,
    drug_schedule: undefined,
    formulary_status: "approved",
    aware_category: undefined,
    inn_name: "",
    atc_code: "",
    is_controlled: false,
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<PharmacyCatalogFormInput>({
    resolver: zodResolver(pharmacyCatalogFormSchema),
    defaultValues: catalogDefaults,
  });

  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ["pharmacy-catalog"],
    queryFn: () => pharmacyService.listPharmacyCatalog(),
  });

  const filtered = useMemo(() => {
    if (!formularyFilter) return catalog;
    return catalog.filter((d) => d.formulary_status === formularyFilter);
  }, [catalog, formularyFilter]);

  const createMutation = useMutation({
    mutationFn: (data: CreatePharmacyCatalogRequest) => pharmacyService.createPharmacyCatalog(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-catalog"] });
      formHandlers.close();
      reset(catalogDefaults);
    },
  });

  const handleCreateCatalog = (values: PharmacyCatalogFormInput) => {
    createMutation.mutate({
      code: values.code.trim(),
      name: values.name.trim(),
      generic_name: optionalFormText(values.generic_name),
      category: optionalFormText(values.category),
      manufacturer: optionalFormText(values.manufacturer),
      unit: optionalFormText(values.unit),
      base_price: formNumberOrFallback(values.base_price, 0),
      tax_percent: formNumberOrFallback(values.tax_percent, 0),
      reorder_level: formIntegerOrFallback(values.reorder_level, 0),
      drug_schedule: values.drug_schedule,
      formulary_status: values.formulary_status,
      aware_category: values.aware_category,
      inn_name: optionalFormText(values.inn_name),
      atc_code: optionalFormText(values.atc_code),
      is_controlled: values.is_controlled || undefined,
    });
  };

  const columns = [
    {
      key: "code",
      label: "Code",
      render: (row: PharmacyCatalog) => <Text fw={500}>{row.code}</Text>,
    },
    {
      key: "name",
      label: "Name",
      render: (row: PharmacyCatalog) => <Text size="sm">{row.name}</Text>,
    },
    {
      key: "generic_name",
      label: "Generic",
      render: (row: PharmacyCatalog) => <Text size="sm">{row.generic_name ?? "\u2014"}</Text>,
    },
    {
      key: "category",
      label: "Category",
      render: (row: PharmacyCatalog) =>
        row.category ? <TableValueBadge value={row.category} kind="pharmacy" /> : "\u2014",
    },
    {
      key: "base_price",
      label: "Price",
      render: (row: PharmacyCatalog) => (
        <Text size="sm">{renderPharmacySensitiveCurrency(priceAccess, row.base_price)}</Text>
      ),
    },
    {
      key: "current_stock",
      label: "Stock",
      render: (row: PharmacyCatalog) => (
        <Text
          size="sm"
          c={row.current_stock < row.reorder_level ? "danger" : undefined}
          fw={row.current_stock < row.reorder_level ? 700 : undefined}
        >
          {row.current_stock}
          {row.current_stock < row.reorder_level && (
            <IconAlertTriangle size={12} style={{ marginLeft: 4, verticalAlign: "middle" }} />
          )}
        </Text>
      ),
    },
    {
      key: "regulatory",
      label: "Regulatory",
      render: (row: PharmacyCatalog) => (
        <Group gap={2}>
          {compliance.show_schedule_badges && row.drug_schedule && (
            <Badge
              size="xs"
              variant="light"
              color={
                row.drug_schedule === "X" || row.drug_schedule === "NDPS"
                  ? "danger"
                  : row.drug_schedule === "H1"
                    ? "orange"
                    : "primary"
              }
            >
              Sch-{row.drug_schedule}
            </Badge>
          )}
          {compliance.show_controlled_warnings && row.is_controlled && (
            <Badge size="xs" variant="filled" color="danger">
              CTRL
            </Badge>
          )}
          {compliance.show_formulary_status && row.formulary_status !== "approved" && (
            <Badge
              size="xs"
              variant="light"
              color={row.formulary_status === "restricted" ? "warning" : "gray"}
            >
              {row.formulary_status === "restricted" ? "Restricted" : "Non-Formulary"}
            </Badge>
          )}
          {compliance.show_aware_category && row.aware_category && (
            <Badge
              size="xs"
              variant="light"
              color={
                row.aware_category === "reserve"
                  ? "danger"
                  : row.aware_category === "watch"
                    ? "orange"
                    : "success"
              }
            >
              AWaRe: {row.aware_category}
            </Badge>
          )}
        </Group>
      ),
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: PharmacyCatalog) =>
        row.is_active ? (
          <IconCheck size={14} color="success" />
        ) : (
          <IconX size={14} color="danger" />
        ),
    },
  ];

  return (
    <Stack>
      <Group>
        {canManage && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={formHandlers.toggle}>
            Add formulary medicine
          </Button>
        )}
        <Select
          placeholder="Formulary filter"
          data={[
            { value: "approved", label: "Approved" },
            { value: "restricted", label: "Restricted" },
            { value: "non_formulary", label: "Non-Formulary" },
          ]}
          value={formularyFilter}
          onChange={setFormularyFilter}
          clearable
          w={180}
        />
      </Group>
      {formOpened && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateCatalog)}>
          <Group grow>
            <TextInput label="Code" required error={errors.code?.message} {...register("code")} />
            <TextInput label="Name" required error={errors.name?.message} {...register("name")} />
          </Group>
          <Group grow>
            <TextInput
              label="Generic Name"
              error={errors.generic_name?.message}
              {...register("generic_name")}
            />
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select
                  label="Category"
                  data={DRUG_CATEGORIES}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.category?.message}
                  clearable
                  searchable
                />
              )}
            />
          </Group>
          <Group grow>
            <TextInput
              label="Manufacturer"
              error={errors.manufacturer?.message}
              {...register("manufacturer")}
            />
            <TextInput label="Unit" error={errors.unit?.message} {...register("unit")} />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="base_price"
              render={({ field }) => (
                <NumberInput
                  label="Base Price"
                  required
                  min={0}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.base_price?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="tax_percent"
              render={({ field }) => (
                <NumberInput
                  label="Tax %"
                  min={0}
                  max={100}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.tax_percent?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="reorder_level"
              render={({ field }) => (
                <NumberInput
                  label="Reorder Level"
                  min={0}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.reorder_level?.message}
                />
              )}
            />
          </Group>
          <Text fw={600} size="sm" mt="xs">
            Regulatory Classification
          </Text>
          <Group grow>
            <Controller
              control={control}
              name="drug_schedule"
              render={({ field }) => (
                <Select
                  label="Drug Schedule"
                  placeholder="Select schedule"
                  data={drugScheduleOptions}
                  value={field.value ?? null}
                  onChange={(value) => field.onChange(value ?? undefined)}
                  error={errors.drug_schedule?.message}
                  clearable
                />
              )}
            />
            <Controller
              control={control}
              name="formulary_status"
              render={({ field }) => (
                <Select
                  label="Formulary Status"
                  placeholder="Select status"
                  data={formularyStatusOptions}
                  value={field.value ?? null}
                  onChange={(value) => field.onChange(value ?? undefined)}
                  error={errors.formulary_status?.message}
                  clearable
                />
              )}
            />
            <Controller
              control={control}
              name="aware_category"
              render={({ field }) => (
                <Select
                  label="AWaRe Category"
                  description="For antibiotics only"
                  placeholder="Select category"
                  data={awareCategoryOptions}
                  value={field.value ?? null}
                  onChange={(value) => field.onChange(value ?? undefined)}
                  error={errors.aware_category?.message}
                  clearable
                />
              )}
            />
          </Group>
          <Group grow>
            <TextInput
              label="INN Name"
              placeholder="International Nonproprietary Name"
              error={errors.inn_name?.message}
              {...register("inn_name")}
            />
            <TextInput
              label="ATC Code"
              placeholder="e.g. J01CA04"
              error={errors.atc_code?.message}
              {...register("atc_code")}
            />
          </Group>
          <Controller
            control={control}
            name="is_controlled"
            render={({ field }) => (
              <Switch
                label="Controlled Substance"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
                error={errors.is_controlled?.message}
              />
            )}
          />
          <Button size="xs" type="submit" loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={filtered} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Stock Tab
// ══════════════════════════════════════════════════════════

function StockTab({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [batchModalOpened, batchModalHandlers] = useDisclosure(false);
  const [bulkBatchOpened, bulkBatchHandlers] = useDisclosure(false);
  const [bulkStep, setBulkStep] = useState<"edit" | "verify">("edit");
  const [selectedStockItem, setSelectedStockItem] = useState<PharmacyCatalog | null>(null);
  const [bulkHeader, setBulkHeader] = useState<BulkBatchHeader>(newBulkBatchHeader());
  const [bulkRows, setBulkRows] = useState<BulkBatchLine[]>([newBulkBatchLine()]);
  const batchNumberAccess = useFieldAccess("pharmacy.batches.batch_number");
  const purchaseRateAccess = useFieldAccess("pharmacy.batches.purchase_rate");
  const sellingRateAccess = useFieldAccess("pharmacy.batches.selling_rate");
  const sourceAccess = useFieldAccess("pharmacy.batches.source");
  const canEditBatchNumbers = canEditPharmacyField(batchNumberAccess);
  const canEditBatchPrices =
    canEditPharmacyField(purchaseRateAccess) && canEditPharmacyField(sellingRateAccess);
  const canEditBatchSource = canEditPharmacyField(sourceAccess);

  const { data: stock = [], isLoading } = useQuery({
    queryKey: ["pharmacy-stock"],
    queryFn: () => pharmacyService.listStock(),
  });
  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ["pharmacy-batches"],
    queryFn: () => pharmacyService.listPharmacyBatches(),
  });
  const { data: storeLocations = [] } = useQuery({
    queryKey: ["store-locations"],
    queryFn: () => pharmacyService.listStoreLocations(),
    staleTime: 10 * 60 * 1000,
  });

  const emit = useClinicalEmit();

  const selectedBatches = useMemo(
    () =>
      selectedStockItem
        ? batches.filter((batch) => batch.catalog_item_id === selectedStockItem.id)
        : [],
    [batches, selectedStockItem],
  );
  const readyBulkRows = useMemo(() => bulkRows.filter(isBulkBatchLineReady), [bulkRows]);
  const storeLocationOptions = useMemo(
    () =>
      storeLocations.map((store) => ({
        value: store.id,
        label: [store.name, store.location_type, store.code].filter(Boolean).join(" - "),
      })),
    [storeLocations],
  );
  const storeLocationById = useMemo(
    () => new Map(storeLocations.map((store) => [store.id, store])),
    [storeLocations],
  );
  const storeSelectionRequired = storeLocations.length > 0;
  const canVerifyBulkRows =
    canEditBatchPrices &&
    canEditBatchNumbers &&
    readyBulkRows.length > 0 &&
    (!storeSelectionRequired || bulkHeader.store_location_id.trim().length > 0);

  const updateBulkRow = (id: string, patch: Partial<BulkBatchLine>) => {
    setBulkRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeBulkRow = (id: string) => {
    setBulkRows((rows) => (rows.length === 1 ? rows : rows.filter((row) => row.id !== id)));
  };

  const resetBulkRows = () => {
    setBulkHeader(newBulkBatchHeader());
    setBulkRows([newBulkBatchLine()]);
    setBulkStep("edit");
  };

  const bulkBatchMutation = useMutation({
    mutationFn: async (rows: BulkBatchLine[]) => {
      const created: PharmacyBatch[] = [];
      for (const row of rows) {
        created.push(
          await pharmacyService.createPharmacyBatch(
            buildBatchPayload(row, bulkHeader, { canWriteSource: canEditBatchSource }),
          ),
        );
      }
      return created;
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-stock"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-catalog"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-batches"] });
      notifications.show({
        title: "Batches added",
        message: `${created.length} batch row(s) verified and posted`,
        color: "success",
      });
      emit("stock.movement", {
        transaction_type: "bulk_batch_receipt",
        quantity: readyBulkRows.reduce((sum, row) => sum + batchLineTotalQuantity(row), 0),
      });
      bulkBatchHandlers.close();
      resetBulkRows();
    },
  });

  const columns = [
    {
      key: "code",
      label: "Code",
      render: (row: PharmacyCatalog) => <Text fw={500}>{row.code}</Text>,
    },
    {
      key: "name",
      label: "Drug Name",
      render: (row: PharmacyCatalog) => <Text size="sm">{row.name}</Text>,
    },
    {
      key: "current_stock",
      label: "Current Stock",
      render: (row: PharmacyCatalog) => (
        <TableValueBadge
          value={row.current_stock < row.reorder_level ? "low_stock" : "stock"}
          kind="stock"
          color={row.current_stock < row.reorder_level ? "danger" : "success"}
          label={String(row.current_stock)}
        />
      ),
    },
    {
      key: "reorder_level",
      label: "Reorder Level",
      render: (row: PharmacyCatalog) => <Text size="sm">{row.reorder_level}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: PharmacyCatalog) =>
        row.current_stock < row.reorder_level ? (
          <TableValueBadge
            value="low_stock"
            kind="stock"
            color="danger"
            label="Low Stock"
            variant="filled"
          />
        ) : (
          <TableValueBadge value="ready" kind="status" color="success" label="OK" />
        ),
    },
    {
      key: "batches",
      label: "Batches",
      render: (row: PharmacyCatalog) => {
        const activeBatches = batches.filter((batch) => batch.catalog_item_id === row.id);
        const earliest = activeBatches[0];
        return (
          <Button
            size="compact-xs"
            variant="light"
            leftSection={<IconEye size={12} />}
            onClick={() => {
              setSelectedStockItem(row);
              batchModalHandlers.open();
            }}
          >
            {activeBatches.length} batch{activeBatches.length === 1 ? "" : "es"}
            {earliest?.expiry_date ? ` · FEFO ${earliest.expiry_date}` : ""}
          </Button>
        );
      },
    },
  ];

  return (
    <Stack>
      {canManage && (!canEditBatchPrices || !canEditBatchNumbers) && (
        <Alert color="orange" variant="light">
          Stock intake requires editable batch identifiers plus purchase and selling rate access.
        </Alert>
      )}
      {canManage && canEditBatchPrices && canEditBatchNumbers && (
        <Group>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              resetBulkRows();
              bulkBatchHandlers.open();
            }}
          >
            Add stock intake
          </Button>
        </Group>
      )}
      <DataTable columns={columns} data={stock} loading={isLoading} rowKey={(row) => row.id} />
      <Modal
        opened={batchModalOpened}
        onClose={batchModalHandlers.close}
        title={selectedStockItem ? `${selectedStockItem.name} batches` : "Batch details"}
        size="xl"
      >
        <Stack gap="sm">
          {batchesLoading ? (
            <Loader size="sm" />
          ) : selectedBatches.length === 0 ? (
            <Text size="sm" c="dimmed">
              No active batch stock recorded for this product.
            </Text>
          ) : (
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Batch</Table.Th>
                  <Table.Th>Expiry</Table.Th>
                  <Table.Th>Qty</Table.Th>
                  <Table.Th>Purchase</Table.Th>
                  <Table.Th>MRP</Table.Th>
                  <Table.Th>GRN / Source</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {selectedBatches.map((batch) => (
                  <Table.Tr key={batch.id}>
                    <Table.Td>
                      {renderPharmacySensitiveValue(batchNumberAccess, batch.batch_number)}
                    </Table.Td>
                    <Table.Td>
                      <ExpiryCell date={batch.expiry_date} />
                    </Table.Td>
                    <Table.Td>
                      {batch.quantity_on_hand} / {batch.quantity_received}
                    </Table.Td>
                    <Table.Td>
                      {renderPharmacySensitiveCurrency(purchaseRateAccess, batch.purchase_rate)}
                    </Table.Td>
                    <Table.Td>
                      {renderPharmacySensitiveCurrency(sellingRateAccess, batch.selling_rate)}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">
                        {renderPharmacySensitiveValue(
                          sourceAccess,
                          batch.grn_id ??
                            batch.supplier_info ??
                            batch.invoice_number ??
                            "Manual intake",
                        )}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Modal>
      <Modal
        opened={bulkBatchOpened}
        onClose={bulkBatchHandlers.close}
        title="Bulk batch intake"
        size="100%"
      >
        <Stack gap="sm">
          {bulkStep === "edit" ? (
            <>
              <Text size="sm" c="dimmed">
                Add multiple received batches in one table, then verify before stock is posted.
              </Text>
              {!canEditBatchSource && (
                <Alert color="gray" variant="light">
                  Supplier, invoice, GRN, and storage-source details are restricted for this role
                  and will not be posted with the batch.
                </Alert>
              )}
              <Stack gap="xs">
                <Group grow>
                  <TextInput
                    label="Supplier name"
                    disabled={!canEditBatchSource}
                    value={bulkHeader.supplier_name}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setBulkHeader((header) => ({
                        ...header,
                        supplier_name: value,
                      }));
                    }}
                    placeholder="Supplier / distributor"
                  />
                  <TextInput
                    label="Supplier invoice number"
                    disabled={!canEditBatchSource}
                    value={bulkHeader.invoice_number}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setBulkHeader((header) => ({
                        ...header,
                        invoice_number: value,
                      }));
                    }}
                    placeholder="Invoice no."
                  />
                </Group>
                <Group grow>
                  <Select
                    label="Receiving store"
                    data={storeLocationOptions}
                    value={bulkHeader.store_location_id}
                    onChange={(value) =>
                      setBulkHeader((header) => ({
                        ...header,
                        store_location_id: value ?? "",
                      }))
                    }
                    placeholder={
                      storeLocationOptions.length > 0 ? "Select store" : "No store configured"
                    }
                    required={storeSelectionRequired}
                    searchable
                  />
                  <Select
                    label="Invoice mode"
                    disabled={!canEditBatchSource}
                    data={[
                      { value: "credit", label: "Credit invoice" },
                      { value: "cash", label: "Cash invoice" },
                    ]}
                    value={bulkHeader.invoice_mode}
                    onChange={(value) =>
                      setBulkHeader((header) => ({
                        ...header,
                        invoice_mode: value === "cash" ? "cash" : "credit",
                      }))
                    }
                  />
                  <TextInput
                    label="Invoice date"
                    type="date"
                    disabled={!canEditBatchSource}
                    value={bulkHeader.invoice_date}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setBulkHeader((header) => ({
                        ...header,
                        invoice_date: value,
                      }));
                    }}
                  />
                </Group>
                <Group grow>
                  <NumberInput
                    label="Invoice amount"
                    min={0}
                    decimalScale={2}
                    disabled={!canEditBatchPrices || !canEditBatchSource}
                    value={bulkHeader.invoice_amount}
                    onChange={(value) =>
                      setBulkHeader((header) => ({
                        ...header,
                        invoice_amount: typeof value === "number" ? value : "",
                      }))
                    }
                  />
                  <TextInput
                    label="Payment terms"
                    disabled={!canEditBatchSource}
                    value={bulkHeader.payment_terms}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setBulkHeader((header) => ({
                        ...header,
                        payment_terms: value,
                      }));
                    }}
                    placeholder="Credit days / cash / sponsor / payable note"
                  />
                </Group>
              </Stack>
              {storeSelectionRequired && !bulkHeader.store_location_id && (
                <Alert color="warning" variant="light">
                  Select the receiving store before verification so stock is posted to the correct
                  pharmacy location.
                </Alert>
              )}
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Product</Table.Th>
                    <Table.Th>Reorder</Table.Th>
                    <Table.Th>Batch</Table.Th>
                    <Table.Th>Supplier batch</Table.Th>
                    <Table.Th>Expiry</Table.Th>
                    <Table.Th>Mfg</Table.Th>
                    <Table.Th>GRN / Source</Table.Th>
                    <Table.Th>Storage</Table.Th>
                    <Table.Th>Rack / bin</Table.Th>
                    <Table.Th>Purchase rate</Table.Th>
                    <Table.Th>MRP</Table.Th>
                    <Table.Th>Tax</Table.Th>
                    <Table.Th>Paid qty</Table.Th>
                    <Table.Th>Free qty</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {bulkRows.map((row) => (
                    <Table.Tr key={row.id}>
                      <Table.Td miw={220}>
                        <DrugSearchSelect
                          value={row.catalog_item_id}
                          onChange={(id, selectedDrug) =>
                            updateBulkRow(row.id, {
                              catalog_item_id: id ?? "",
                              product_name: selectedDrug?.name ?? "",
                              tax_percent: Number(selectedDrug?.tax_percent ?? 0),
                              current_stock: selectedDrug?.current_stock ?? 0,
                              reorder_level: selectedDrug?.reorder_level ?? 0,
                            })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        {row.catalog_item_id ? (
                          <Badge
                            variant={isBatchLineBelowReorder(row) ? "filled" : "light"}
                            color={isBatchLineBelowReorder(row) ? "danger" : "success"}
                          >
                            {isBatchLineBelowReorder(row) ? "Reorder" : "OK"} {row.current_stock}/
                            {row.reorder_level}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          value={row.batch_number}
                          disabled={!canEditBatchNumbers}
                          onChange={(event) =>
                            updateBulkRow(row.id, { batch_number: event.currentTarget.value })
                          }
                          placeholder="Batch no."
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          value={row.supplier_batch_number}
                          disabled={!canEditBatchNumbers}
                          onChange={(event) =>
                            updateBulkRow(row.id, {
                              supplier_batch_number: event.currentTarget.value,
                            })
                          }
                          placeholder="Supplier batch"
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          type="date"
                          value={row.expiry_date}
                          onChange={(event) =>
                            updateBulkRow(row.id, { expiry_date: event.currentTarget.value })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          type="date"
                          value={row.manufacture_date}
                          onChange={(event) =>
                            updateBulkRow(row.id, { manufacture_date: event.currentTarget.value })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          value={row.grn_reference}
                          disabled={!canEditBatchSource}
                          onChange={(event) =>
                            updateBulkRow(row.id, { grn_reference: event.currentTarget.value })
                          }
                          placeholder="GRN / invoice"
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          value={row.storage_conditions}
                          disabled={!canEditBatchSource}
                          onChange={(event) =>
                            updateBulkRow(row.id, {
                              storage_conditions: event.currentTarget.value,
                            })
                          }
                          placeholder="Ambient / cold chain"
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          value={row.rack_bin}
                          disabled={!canEditBatchSource}
                          onChange={(event) =>
                            updateBulkRow(row.id, { rack_bin: event.currentTarget.value })
                          }
                          placeholder="Rack / shelf"
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          min={0}
                          value={row.purchase_rate}
                          disabled={!canEditBatchPrices}
                          error={!isBatchLinePriceValid(row) ? "Cannot exceed MRP" : undefined}
                          onChange={(value) =>
                            updateBulkRow(row.id, {
                              purchase_rate: typeof value === "number" ? value : "",
                            })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          min={0}
                          value={row.mrp}
                          disabled={!canEditBatchPrices}
                          error={
                            !isBatchLinePriceValid(row) ? "MRP must be >= purchase" : undefined
                          }
                          onChange={(value) =>
                            updateBulkRow(row.id, { mrp: typeof value === "number" ? value : "" })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          min={0}
                          max={100}
                          value={row.tax_percent}
                          suffix="%"
                          onChange={(value) =>
                            updateBulkRow(row.id, {
                              tax_percent: typeof value === "number" ? value : 0,
                            })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          min={0}
                          value={row.paid_quantity}
                          onChange={(value) =>
                            updateBulkRow(row.id, {
                              paid_quantity: typeof value === "number" ? value : "",
                            })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          min={0}
                          value={row.free_quantity}
                          onChange={(value) =>
                            updateBulkRow(row.id, {
                              free_quantity: typeof value === "number" ? value : "",
                            })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          variant="subtle"
                          color="danger"
                          onClick={() => removeBulkRow(row.id)}
                          disabled={bulkRows.length === 1}
                          aria-label="Remove batch row"
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Stack gap="xs">
                <Button
                  variant="light"
                  fullWidth
                  leftSection={<IconPlus size={14} />}
                  onClick={() => setBulkRows((rows) => [...rows, newBulkBatchLine()])}
                >
                  Add another batch line
                </Button>
                <Group justify="flex-end">
                  <Button variant="default" onClick={bulkBatchHandlers.close}>
                    Cancel
                  </Button>
                  <Button disabled={!canVerifyBulkRows} onClick={() => setBulkStep("verify")}>
                    Verify {readyBulkRows.length} row{readyBulkRows.length === 1 ? "" : "s"}
                  </Button>
                </Group>
              </Stack>
            </>
          ) : (
            <>
              <Alert color="primary" variant="light">
                Verify product, batch, expiry, paid quantity, and free quantity before posting. This
                will increase pharmacy stock immediately. Purchase rate must be equal to or less
                than MRP.
              </Alert>
              <Table striped withTableBorder>
                <Table.Caption>
                  {bulkHeader.invoice_mode === "cash" ? "Cash invoice" : "Credit invoice"} ·{" "}
                  {bulkHeader.invoice_date || "No date"} ·{" "}
                  {bulkHeader.invoice_number || "No invoice no."} · Supplier{" "}
                  {bulkHeader.supplier_name || "not recorded"} · Store{" "}
                  {storeLocationById.get(bulkHeader.store_location_id)?.name || "not selected"}
                  {bulkHeader.invoice_amount !== "" && (
                    <>
                      {" "}
                      · Invoice amount{" "}
                      {renderPharmacySensitiveCurrency(
                        purchaseRateAccess,
                        bulkHeader.invoice_amount,
                      )}
                    </>
                  )}
                </Table.Caption>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Product</Table.Th>
                    <Table.Th>Reorder</Table.Th>
                    <Table.Th>Batch</Table.Th>
                    <Table.Th>Supplier batch</Table.Th>
                    <Table.Th>Expiry</Table.Th>
                    <Table.Th>Mfg</Table.Th>
                    <Table.Th>Storage / rack</Table.Th>
                    <Table.Th>Paid</Table.Th>
                    <Table.Th>Free</Table.Th>
                    <Table.Th>Total</Table.Th>
                    <Table.Th>Purchase</Table.Th>
                    <Table.Th>MRP</Table.Th>
                    <Table.Th>Tax</Table.Th>
                    <Table.Th>Taxable</Table.Th>
                    <Table.Th>GST</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {readyBulkRows.map((row) => (
                    <Table.Tr key={row.id}>
                      <Table.Td>{row.product_name || row.catalog_item_id}</Table.Td>
                      <Table.Td>
                        <Badge
                          color={isBatchLineBelowReorder(row) ? "danger" : "success"}
                          variant="light"
                        >
                          {isBatchLineBelowReorder(row) ? "Below reorder" : "Above reorder"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {renderPharmacySensitiveIdentifier(batchNumberAccess, row.batch_number)}
                      </Table.Td>
                      <Table.Td>
                        {renderPharmacySensitiveIdentifier(
                          batchNumberAccess,
                          row.supplier_batch_number,
                        )}
                      </Table.Td>
                      <Table.Td>{row.expiry_date}</Table.Td>
                      <Table.Td>{row.manufacture_date || "—"}</Table.Td>
                      <Table.Td>
                        {renderPharmacySensitiveValue(
                          sourceAccess,
                          [row.storage_conditions, row.rack_bin].filter(Boolean).join(" · "),
                        )}
                      </Table.Td>
                      <Table.Td>{batchLineNumber(row.paid_quantity)}</Table.Td>
                      <Table.Td>{batchLineNumber(row.free_quantity)}</Table.Td>
                      <Table.Td>{batchLineTotalQuantity(row)}</Table.Td>
                      <Table.Td>
                        {renderPharmacySensitiveCurrency(purchaseRateAccess, row.purchase_rate)}
                      </Table.Td>
                      <Table.Td>
                        {renderPharmacySensitiveCurrency(sellingRateAccess, row.mrp)}
                      </Table.Td>
                      <Table.Td>{row.tax_percent}%</Table.Td>
                      <Table.Td>
                        {renderPharmacySensitiveCurrency(
                          purchaseRateAccess,
                          batchLineTaxableAmount(row),
                        )}
                      </Table.Td>
                      <Table.Td>
                        {renderPharmacySensitiveCurrency(
                          purchaseRateAccess,
                          batchLineTaxAmount(row),
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Group justify="space-between">
                <Button variant="default" onClick={() => setBulkStep("edit")}>
                  Back to edit
                </Button>
                <Button
                  leftSection={<IconCheck size={14} />}
                  loading={bulkBatchMutation.isPending}
                  onClick={() => bulkBatchMutation.mutate(readyBulkRows)}
                >
                  Submit verified batches
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  NDPS Register Tab
// ══════════════════════════════════════════════════════════

function NdpsRegisterTab() {
  const emit = useClinicalEmit();
  const canManage = useHasPermission(P.PHARMACY.NDPS_MANAGE);
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const balanceAccess = useFieldAccess("pharmacy.ndps.balance_after");
  const userAccess = useFieldAccess("pharmacy.ndps.user_ids");
  const witnessAccess = useFieldAccess("pharmacy.ndps.witnessed_by");
  const canEditWitness = canEditPharmacyField(witnessAccess);
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<PharmacyNdpsEntryFormInput>({
    resolver: zodResolver(pharmacyNdpsEntryFormSchema),
    defaultValues: {
      catalog_item_id: "",
      action: "receipt",
      quantity: 1,
      notes: "",
      witnessed_by: "",
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["pharmacy-ndps"],
    queryFn: () => pharmacyService.listNdpsEntries(),
  });

  const { data: balance } = useQuery({
    queryKey: ["pharmacy-ndps-balance"],
    queryFn: () => pharmacyService.getNdpsBalance(),
  });

  const createMutation = useMutation({
    mutationFn: (d: CreateNdpsEntryRequest) => pharmacyService.createNdpsEntry(d),
    onSuccess: (entry) => {
      emit("pharmacy.ndps.movement.created", {
        action: entry.action,
        catalog_item_id: entry.catalog_item_id,
        created_at: entry.created_at,
        entry_id: entry.id,
        quantity: entry.quantity,
        register_number: entry.register_number,
        source_record_id: entry.id,
      });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-ndps"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-ndps-balance"] });
      notifications.show({
        title: "NDPS Entry",
        message: "Register entry recorded",
        color: "success",
      });
      formHandlers.close();
      reset({
        catalog_item_id: "",
        action: "receipt",
        quantity: 1,
        notes: "",
        witnessed_by: "",
      });
    },
  });

  const handleCreateNdpsEntry = (values: PharmacyNdpsEntryFormInput) => {
    createMutation.mutate({
      catalog_item_id: values.catalog_item_id,
      action: values.action,
      quantity: formIntegerOrFallback(values.quantity, 1),
      notes: values.notes.trim() || undefined,
      witnessed_by: canEditWitness ? values.witnessed_by.trim() || undefined : undefined,
    });
  };

  const actionColors: Record<string, string> = {
    receipt: "success",
    dispensed: "primary",
    destroyed: "danger",
    transferred: "orange",
    adjustment: "gray",
  };

  const columns = [
    {
      key: "action",
      label: "Action",
      render: (row: NdpsRegisterEntry) => (
        <Badge size="xs" color={actionColors[row.action] ?? "gray"}>
          {row.action}
        </Badge>
      ),
    },
    {
      key: "quantity",
      label: "Qty",
      render: (row: NdpsRegisterEntry) => <Text size="sm">{row.quantity}</Text>,
    },
    {
      key: "balance_after",
      label: "Balance",
      render: (row: NdpsRegisterEntry) => (
        <Text size="sm" fw={700}>
          {renderPharmacySensitiveNumber(balanceAccess, row.balance_after)}
        </Text>
      ),
    },
    {
      key: "dispensed_by",
      label: "By",
      render: (row: NdpsRegisterEntry) => (
        <Text size="sm">
          {renderPharmacySensitiveShortIdentifier(userAccess, row.dispensed_by)}
        </Text>
      ),
    },
    {
      key: "witnessed_by",
      label: "Witness",
      render: (row: NdpsRegisterEntry) => (
        <Text size="sm">
          {renderPharmacySensitiveShortIdentifier(witnessAccess, row.witnessed_by)}
        </Text>
      ),
    },
    {
      key: "created_at",
      label: "Date",
      render: (row: NdpsRegisterEntry) => (
        <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text>
      ),
    },
  ];

  return (
    <Stack>
      {balance?.entries && balance.entries.length > 0 && (
        <Group gap="sm">
          {balance.entries.map((b) => (
            <Badge
              key={b.catalog_item_id}
              size="lg"
              variant="light"
              leftSection={<IconLock size={12} />}
            >
              {b.drug_name}: {renderPharmacySensitiveNumber(balanceAccess, b.balance)}
            </Badge>
          ))}
        </Group>
      )}
      {canManage && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={formHandlers.toggle}>
            Manual Entry
          </Button>
        </Group>
      )}
      {formOpened && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateNdpsEntry)}>
          <Controller
            control={control}
            name="catalog_item_id"
            render={({ field }) => (
              <DrugSearchSelect
                value={field.value}
                onChange={field.onChange}
                error={errors.catalog_item_id?.message}
                required
              />
            )}
          />
          <Group grow>
            <Controller
              control={control}
              name="action"
              render={({ field }) => (
                <Select
                  label="Action"
                  data={ndpsActionOptions}
                  value={field.value}
                  onChange={(value) => value && field.onChange(value)}
                />
              )}
            />
            <Controller
              control={control}
              name="quantity"
              render={({ field }) => (
                <NumberInput
                  label="Quantity"
                  required
                  min={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.quantity?.message}
                />
              )}
            />
          </Group>
          {canViewPharmacyField(witnessAccess) && (
            <TextInput
              label="Witnessed by"
              disabled={!canEditWitness}
              {...register("witnessed_by")}
            />
          )}
          <TextInput label="Notes" {...register("notes")} />
          <Button size="xs" type="submit" loading={createMutation.isPending}>
            Record
          </Button>
        </Stack>
      )}
      <DataTable
        columns={columns}
        data={data?.entries ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Batch & Expiry Tab
// ══════════════════════════════════════════════════════════

function BatchExpiryTab() {
  const [view, setView] = useState("batches");

  return (
    <Stack>
      <SegmentedControl
        value={view}
        onChange={setView}
        data={[
          { label: "Batch Ledger", value: "batches" },
          { label: "Near Expiry", value: "near-expiry" },
          { label: "Dead Stock", value: "dead-stock" },
        ]}
      />
      {view === "batches" && <BatchLedgerView />}
      {view === "near-expiry" && <NearExpiryView />}
      {view === "dead-stock" && <DeadStockView />}
    </Stack>
  );
}

function BatchLedgerView() {
  const batchNumberAccess = useFieldAccess("pharmacy.batches.batch_number");
  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["pharmacy-batches"],
    queryFn: () => pharmacyService.listPharmacyBatches(),
  });

  const columns = [
    {
      key: "batch_number",
      label: "Batch #",
      render: (row: PharmacyBatch) => (
        <Text fw={500} size="sm">
          {renderPharmacySensitiveValue(batchNumberAccess, row.batch_number)}
        </Text>
      ),
    },
    {
      key: "expiry_date",
      label: "Expiry",
      render: (row: PharmacyBatch) => {
        const days = Math.ceil((new Date(row.expiry_date).getTime() - Date.now()) / 86400000);
        return (
          <Text size="sm" c={days < 30 ? "danger" : days < 60 ? "orange" : undefined}>
            {row.expiry_date}
          </Text>
        );
      },
    },
    {
      key: "quantity_received",
      label: "Received",
      render: (row: PharmacyBatch) => <Text size="sm">{row.quantity_received}</Text>,
    },
    {
      key: "quantity_dispensed",
      label: "Dispensed",
      render: (row: PharmacyBatch) => <Text size="sm">{row.quantity_dispensed}</Text>,
    },
    {
      key: "quantity_on_hand",
      label: "On Hand",
      render: (row: PharmacyBatch) => (
        <Badge size="sm" color={row.quantity_on_hand <= 0 ? "danger" : "success"} variant="light">
          {row.quantity_on_hand}
        </Badge>
      ),
    },
    {
      key: "store_location_id",
      label: "Location",
      render: (row: PharmacyBatch) => (
        <Text size="sm">{row.store_location_id?.slice(0, 8) ?? "\u2014"}</Text>
      ),
    },
  ];

  return (
    <DataTable columns={columns} data={batches} loading={isLoading} rowKey={(row) => row.id} />
  );
}

// Compact expiry cell for inline use inside order detail tables. Color
// matches the NearExpiryView convention: red < 30d, orange < 60d.
function ExpiryCell({ date }: { date: string }) {
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  const color = days < 0 ? "danger" : days < 30 ? "danger" : days < 60 ? "orange" : undefined;
  return (
    <Text size="xs" c={color} fw={days < 60 ? 600 : 400}>
      {date}
      {days >= 0 ? ` (${days}d)` : " (expired)"}
    </Text>
  );
}

// Surfaces the earliest-expiry batches for the drugs in this order so
// dispensers can apply FEFO at a glance. Filters the global near-expiry
// report by drug_name (NearExpiryRow doesn't carry catalog_item_id).
function NearExpiryHints({ drugNames }: { drugNames: string[] }) {
  const batchNumberAccess = useFieldAccess("pharmacy.batches.batch_number");
  const nameSet = useMemo(() => new Set(drugNames.map((n) => n.toLowerCase())), [drugNames]);
  const { data: rows = [] } = useQuery({
    queryKey: ["pharmacy-near-expiry-hints"],
    queryFn: () => pharmacyService.getNearExpiryReport({ days: "180" }),
    enabled: drugNames.length > 0,
  });
  const relevant = rows.filter((r) => nameSet.has(r.drug_name.toLowerCase())).slice(0, 8);
  if (relevant.length === 0) return null;
  return (
    <Stack gap={4}>
      <Text size="xs" tt="uppercase" fw={700} c="dimmed">
        FEFO suggestions — earliest-expiry batches in stock
      </Text>
      <Table withRowBorders={false}>
        <Table.Tbody>
          {relevant.map((r) => (
            <Table.Tr key={`${r.drug_name}-${r.batch_number}`}>
              <Table.Td>
                <Text size="xs">{r.drug_name}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="xs" ff="monospace">
                  Batch {renderPharmacySensitiveValue(batchNumberAccess, r.batch_number)}
                </Text>
              </Table.Td>
              <Table.Td>
                <ExpiryCell date={r.expiry_date} />
              </Table.Td>
              <Table.Td>
                <Text size="xs">on-hand: {r.quantity_on_hand}</Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

function NearExpiryView() {
  const batchNumberAccess = useFieldAccess("pharmacy.batches.batch_number");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pharmacy-near-expiry"],
    queryFn: () => pharmacyService.getNearExpiryReport({ days: "90" }),
  });

  const columns = [
    {
      key: "drug_name",
      label: "Drug",
      render: (row: NearExpiryRow) => <Text size="sm">{row.drug_name}</Text>,
    },
    {
      key: "batch_number",
      label: "Batch #",
      render: (row: NearExpiryRow) => (
        <Text size="sm">{renderPharmacySensitiveValue(batchNumberAccess, row.batch_number)}</Text>
      ),
    },
    {
      key: "expiry_date",
      label: "Expiry",
      render: (row: NearExpiryRow) => (
        <Text
          size="sm"
          c={
            row.days_until_expiry < 30
              ? "danger"
              : row.days_until_expiry < 60
                ? "orange"
                : "warning"
          }
          fw={700}
        >
          {row.expiry_date}
        </Text>
      ),
    },
    {
      key: "quantity_on_hand",
      label: "On Hand",
      render: (row: NearExpiryRow) => <Text size="sm">{row.quantity_on_hand}</Text>,
    },
    {
      key: "days_until_expiry",
      label: "Days Left",
      render: (row: NearExpiryRow) => (
        <Badge
          size="sm"
          color={
            row.days_until_expiry < 30
              ? "danger"
              : row.days_until_expiry < 60
                ? "orange"
                : "warning"
          }
        >
          {row.days_until_expiry}d
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={isLoading}
      rowKey={(row) => `${row.batch_number}-${row.expiry_date}`}
    />
  );
}

function DeadStockView() {
  const valueAccess = useFieldAccess("pharmacy.analytics.value");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pharmacy-dead-stock"],
    queryFn: () => pharmacyService.getPharmacyDeadStock({ idle_days: "90" }),
  });

  const columns = [
    {
      key: "drug_name",
      label: "Drug",
      render: (row: PharmacyDeadStockRow) => <Text size="sm">{row.drug_name}</Text>,
    },
    {
      key: "current_stock",
      label: "Stock",
      render: (row: PharmacyDeadStockRow) => <Text size="sm">{row.current_stock}</Text>,
    },
    {
      key: "stock_value",
      label: "Value",
      render: (row: PharmacyDeadStockRow) => (
        <Text size="sm">{renderPharmacySensitiveCurrency(valueAccess, row.stock_value)}</Text>
      ),
    },
    {
      key: "last_dispensed_date",
      label: "Last Dispensed",
      render: (row: PharmacyDeadStockRow) => (
        <Text size="sm">
          {row.last_dispensed_date
            ? new Date(row.last_dispensed_date).toLocaleDateString()
            : "Never"}
        </Text>
      ),
    },
    {
      key: "days_idle",
      label: "Days Idle",
      render: (row: PharmacyDeadStockRow) => (
        <Badge size="sm" color="orange">
          {row.days_idle ?? "N/A"}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable columns={columns} data={rows} loading={isLoading} rowKey={(row) => row.drug_name} />
  );
}

// ══════════════════════════════════════════════════════════
//  Stores & Transfers Tab
// ══════════════════════════════════════════════════════════

function StoresTransfersTab({
  canViewStores,
  canManageStores,
}: {
  canViewStores: boolean;
  canManageStores: boolean;
}) {
  const [view, setView] = useState("locations");

  return (
    <Stack>
      <SegmentedControl
        value={view}
        onChange={setView}
        data={[
          { label: "Pharmacy Locations", value: "locations" },
          { label: "Transfers", value: "transfers" },
        ]}
      />
      {view === "locations" && (
        <PharmacyLocationsView canViewStores={canViewStores || canManageStores} />
      )}
      {view === "transfers" && (
        <TransfersView
          canViewStores={canViewStores || canManageStores}
          canManage={canManageStores}
        />
      )}
    </Stack>
  );
}

function PharmacyLocationsView({ canViewStores }: { canViewStores: boolean }) {
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["pharmacy-store-assignments"],
    queryFn: () => pharmacyService.listPharmacyStoreAssignments(),
    enabled: canViewStores,
  });

  const columns = [
    {
      key: "store_location_id",
      label: "Location",
      render: (row: PharmacyStoreAssignment) => (
        <Text size="sm">{row.store_location_id.slice(0, 8)}...</Text>
      ),
    },
    {
      key: "is_central",
      label: "Central",
      render: (row: PharmacyStoreAssignment) =>
        row.is_central ? (
          <Badge color="primary" size="xs">
            Central
          </Badge>
        ) : (
          <Text size="sm">Satellite</Text>
        ),
    },
    {
      key: "serves_departments",
      label: "Departments",
      render: (row: PharmacyStoreAssignment) => (
        <Text size="sm">{row.serves_departments?.length ?? 0} depts</Text>
      ),
    },
    {
      key: "created_at",
      label: "Created",
      render: (row: PharmacyStoreAssignment) => (
        <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text>
      ),
    },
  ];

  return canViewStores ? (
    <DataTable columns={columns} data={assignments} loading={isLoading} rowKey={(row) => row.id} />
  ) : (
    <Alert color="warning" variant="light">
      Store assignment locations require `pharmacy.stores.list` or `pharmacy.stores.manage`.
    </Alert>
  );
}

function TransfersView({
  canViewStores,
  canManage,
}: {
  canViewStores: boolean;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ["pharmacy-transfers"],
    queryFn: () => pharmacyService.listPharmacyTransfers(),
    enabled: canViewStores,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => pharmacyService.approvePharmacyTransfer(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-transfers"] });
      notifications.show({
        title: "Transfer Approved",
        message: "Transfer request approved",
        color: "success",
      });
    },
  });

  const transferStatusColors: Record<string, string> = {
    draft: "gray",
    approved: "primary",
    transferred: "success",
    cancelled: "danger",
  };

  const columns = [
    {
      key: "from_location_id",
      label: "From",
      render: (row: PharmacyTransferRequest) => (
        <Text size="sm">{row.from_location_id.slice(0, 8)}...</Text>
      ),
    },
    {
      key: "to_location_id",
      label: "To",
      render: (row: PharmacyTransferRequest) => (
        <Text size="sm">{row.to_location_id.slice(0, 8)}...</Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: PharmacyTransferRequest) => (
        <TableValueBadge
          value={row.status}
          kind="stock"
          color={transferStatusColors[row.status] ?? "gray"}
          size="xs"
          variant="filled"
        />
      ),
    },
    {
      key: "created_at",
      label: "Date",
      render: (row: PharmacyTransferRequest) => (
        <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: PharmacyTransferRequest) => (
        <Group gap="xs">
          {canManage && row.status === "draft" && (
            <Tooltip label="Approve">
              <ActionIcon
                variant="subtle"
                color="success"
                aria-label="Approve store transfer"
                onClick={() => approveMutation.mutate(row.id)}
              >
                <IconCheck size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return canViewStores ? (
    <DataTable columns={columns} data={transfers} loading={isLoading} rowKey={(row) => row.id} />
  ) : (
    <Alert color="warning" variant="light">
      Transfer queue requires `pharmacy.stores.list` or `pharmacy.stores.manage`.
    </Alert>
  );
}

// ══════════════════════════════════════════════════════════
//  Analytics & Reports Tab
// ══════════════════════════════════════════════════════════

function AnalyticsTab() {
  const [view, setView] = useState("consumption");

  return (
    <Stack>
      <SegmentedControl
        value={view}
        onChange={setView}
        data={[
          { label: "Consumption", value: "consumption" },
          { label: "ABC-VED", value: "abc-ved" },
          { label: "Drug Utilization", value: "utilization" },
        ]}
      />
      {view === "consumption" && <ConsumptionView />}
      {view === "abc-ved" && <AbcVedView />}
      {view === "utilization" && <UtilizationView />}
    </Stack>
  );
}

function ConsumptionView() {
  const valueAccess = useFieldAccess("pharmacy.analytics.value");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pharmacy-consumption"],
    queryFn: () => pharmacyService.getPharmacyConsumption(),
  });

  const columns = [
    {
      key: "drug_name",
      label: "Drug",
      render: (row: PharmacyConsumptionRow) => <Text size="sm">{row.drug_name}</Text>,
    },
    {
      key: "category",
      label: "Category",
      render: (row: PharmacyConsumptionRow) =>
        row.category ? <TableValueBadge value={row.category} kind="pharmacy" /> : "\u2014",
    },
    {
      key: "total_dispensed",
      label: "Total Dispensed",
      render: (row: PharmacyConsumptionRow) => (
        <Text size="sm" fw={700}>
          {row.total_dispensed}
        </Text>
      ),
    },
    {
      key: "total_value",
      label: "Total Value",
      render: (row: PharmacyConsumptionRow) => (
        <Text size="sm">{renderPharmacySensitiveCurrency(valueAccess, row.total_value)}</Text>
      ),
    },
  ];

  return (
    <DataTable columns={columns} data={rows} loading={isLoading} rowKey={(row) => row.drug_name} />
  );
}

function AbcVedView() {
  const valueAccess = useFieldAccess("pharmacy.analytics.value");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pharmacy-abc-ved"],
    queryFn: () => pharmacyService.getPharmacyAbcVed(),
  });

  const abcColors: Record<string, string> = { A: "danger", B: "orange", C: "success" };
  const vedColors: Record<string, string> = { V: "danger", E: "orange", D: "success" };

  const columns = [
    {
      key: "drug_name",
      label: "Drug",
      render: (row: PharmacyAbcVedRow) => <Text size="sm">{row.drug_name}</Text>,
    },
    {
      key: "annual_value",
      label: "Annual Value",
      render: (row: PharmacyAbcVedRow) => (
        <Text size="sm">{renderPharmacySensitiveCurrency(valueAccess, row.annual_value)}</Text>
      ),
    },
    {
      key: "abc_class",
      label: "ABC",
      render: (row: PharmacyAbcVedRow) => (
        <Badge size="xs" color={abcColors[row.abc_class] ?? "gray"}>
          {row.abc_class}
        </Badge>
      ),
    },
    {
      key: "ved_class",
      label: "VED",
      render: (row: PharmacyAbcVedRow) =>
        row.ved_class ? (
          <Badge size="xs" color={vedColors[row.ved_class] ?? "gray"}>
            {row.ved_class}
          </Badge>
        ) : (
          <Text size="sm">{"\u2014"}</Text>
        ),
    },
  ];

  return (
    <DataTable columns={columns} data={rows} loading={isLoading} rowKey={(row) => row.drug_name} />
  );
}

function UtilizationView() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pharmacy-utilization"],
    queryFn: () => pharmacyService.getDrugUtilization(),
  });

  const columns = [
    {
      key: "drug_name",
      label: "Drug",
      render: (row: DrugUtilizationRow) => <Text size="sm">{row.drug_name}</Text>,
    },
    {
      key: "generic_name",
      label: "Generic",
      render: (row: DrugUtilizationRow) => <Text size="sm">{row.generic_name ?? "\u2014"}</Text>,
    },
    {
      key: "aware_category",
      label: "AWaRe",
      render: (row: DrugUtilizationRow) =>
        row.aware_category ? (
          <Badge
            size="xs"
            color={
              row.aware_category === "reserve"
                ? "danger"
                : row.aware_category === "watch"
                  ? "orange"
                  : "success"
            }
          >
            {row.aware_category}
          </Badge>
        ) : (
          <Text size="sm">{"\u2014"}</Text>
        ),
    },
    {
      key: "total_dispensed",
      label: "Dispensed",
      render: (row: DrugUtilizationRow) => (
        <Text size="sm" fw={700}>
          {row.total_dispensed}
        </Text>
      ),
    },
    {
      key: "unique_patients",
      label: "Patients",
      render: (row: DrugUtilizationRow) => <Text size="sm">{row.unique_patients}</Text>,
    },
  ];

  return (
    <DataTable columns={columns} data={rows} loading={isLoading} rowKey={(row) => row.drug_name} />
  );
}

// ══════════════════════════════════════════════════════════
//  Rx Queue Tab (Phase 3)
// ══════════════════════════════════════════════════════════

const rxStatusColors: Record<string, string> = {
  pending_review: "orange",
  approved: "success",
  rejected: "danger",
  on_hold: "gray",
  dispensing: "info",
  dispensed: "primary",
  partially_dispensed: "teal",
  cancelled: "dimmed",
};

function RxQueueTab({
  canReview,
  canViewQueue,
  canViewPatientRecord,
}: {
  canReview: boolean;
  canViewQueue: boolean;
  canViewPatientRecord: boolean;
}) {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewOpened, { open: openReview, close: closeReview }] = useDisclosure(false);
  const {
    control: reviewControl,
    reset: resetReviewForm,
    handleSubmit: handleSubmitReviewForm,
    setValue: setReviewFormValue,
    watch: watchReviewForm,
    formState: { errors: reviewErrors },
  } = useForm<PharmacyRxReviewFormInput>({
    resolver: zodResolver(pharmacyRxReviewFormSchema),
    defaultValues: DEFAULT_RX_REVIEW_FORM_VALUES,
  });
  const reviewAction = watchReviewForm("action");
  const reviewNotes = watchReviewForm("notes");
  const reviewItems = rxReviewInputsFromForm(watchReviewForm("items"));

  function setReviewItems(items: PharmacyRxReviewItemInput[]) {
    setReviewFormValue("items", items, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  const params = filterStatus ? { status: filterStatus } : undefined;
  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["pharmacy-rx-queue", params],
    queryFn: () => pharmacyService.listRxQueue(params),
    refetchInterval: 15_000,
  });

  const reviewMutation = useMutation({
    mutationFn: (data: {
      id: string;
      action: string;
      notes?: string;
      rejection_reason?: string;
      items?: PharmacyRxReviewItemInput[];
    }) =>
      pharmacyService.reviewPrescription(data.id, {
        action: data.action,
        notes: data.notes,
        rejection_reason: data.rejection_reason,
        items: data.items,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharmacy-rx-queue"] });
      queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing-report-daily"] });
      closeReview();
      setSelectedId(null);
      resetReviewForm(DEFAULT_RX_REVIEW_FORM_VALUES);
      notifications.show({
        title: "Prescription reviewed",
        message:
          reviewAction === "approved"
            ? "Pharmacy order and draft billing indent were created"
            : "Queue status updated",
        color: "green",
      });
    },
  });

  const { data: reviewDetail, isLoading: reviewDetailLoading } = useQuery({
    queryKey: ["pharmacy-rx-detail", selectedId],
    queryFn: () => {
      if (!selectedId) throw new Error("No prescription selected");
      return pharmacyService.getRxDetail(selectedId);
    },
    enabled: reviewOpened && reviewAction === "approved" && Boolean(selectedId),
  });

  function closeReviewModal() {
    closeReview();
    setSelectedId(null);
    resetReviewForm(DEFAULT_RX_REVIEW_FORM_VALUES);
  }

  function handleOpenReview(id: string, action: PharmacyRxReviewAction) {
    if (selectedId !== id) {
      resetReviewForm({
        ...DEFAULT_RX_REVIEW_FORM_VALUES,
        action,
      });
    } else {
      setReviewFormValue("action", action, { shouldDirty: true });
    }
    setSelectedId(id);
    openReview();
  }

  function handleSubmitReview(values: PharmacyRxReviewFormInput) {
    if (!selectedId) return;
    const baseItems = reviewDetail?.items ?? [];
    const reviewedItems = rxReviewInputsFromForm(values.items);
    const itemsForApproval =
      values.action === "approved"
        ? reviewedItems.length > 0
          ? reviewedItems
          : baseItems.map(rxReviewInputFromItem)
        : undefined;
    reviewMutation.mutate({
      id: selectedId,
      action: values.action,
      notes: optionalFormText(values.notes),
      rejection_reason:
        values.action === "rejected" ? optionalFormText(values.rejection_reason) : undefined,
      items: itemsForApproval,
    });
  }

  const columns: Column<RxQueueRow>[] = [
    {
      key: "patient_name",
      label: "Patient",
      fieldAccessKeys: PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
      accessor: (row: RxQueueRow) => row.patient_name,
      fieldKind: "name",
      hiddenLabel: "Patient restricted",
      render: (row: RxQueueRow) => (
        <PharmacyPatientCell
          patientId={row.patient_id}
          canViewPatientRecord={canViewPatientRecord}
        />
      ),
    },
    {
      key: "doctor_name",
      label: "Doctor",
      render: (row: RxQueueRow) => <Text size="sm">{row.doctor_name}</Text>,
    },
    {
      key: "source",
      label: "Source",
      render: (row: RxQueueRow) => <TableValueBadge value={row.source} kind="source" size="xs" />,
    },
    {
      key: "priority",
      label: "Priority",
      render: (row: RxQueueRow) => (
        <TableValueBadge
          value={row.priority}
          kind="priority"
          size="xs"
          color={row.priority === "urgent" ? "danger" : row.priority === "high" ? "orange" : "gray"}
          variant="filled"
        />
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: RxQueueRow) => (
        <TableValueBadge
          value={row.status}
          color={rxStatusColors[row.status] ?? "gray"}
          size="xs"
          variant="filled"
        />
      ),
    },
    {
      key: "allergy_count",
      label: "Allergies",
      render: (row: RxQueueRow) =>
        row.allergy_count > 0 ? (
          <TableValueBadge
            value="critical"
            kind="priority"
            size="xs"
            color="danger"
            label={`${row.allergy_count} alerts`}
            variant="filled"
          />
        ) : (
          <Text size="sm" c="dimmed">
            None
          </Text>
        ),
    },
    {
      key: "received_at",
      label: "Received",
      render: (row: RxQueueRow) => (
        <Text size="sm">{new Date(row.received_at).toLocaleTimeString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: RxQueueRow) => (
        <Group gap={4}>
          <Tooltip label="View prescription">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="primary"
              onClick={() => {
                setReviewItems([]);
                setSelectedId(row.id);
              }}
              aria-label="View prescription details"
            >
              <IconEye size={14} />
            </ActionIcon>
          </Tooltip>
          {canReview && row.status === "pending_review" && (
            <>
              <Tooltip label="Approve and create billing indent">
                <ActionIcon
                  size="sm"
                  color="success"
                  variant="light"
                  onClick={() => handleOpenReview(row.id, "approved")}
                  aria-label="Approve prescription review"
                >
                  <IconCheck size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Hold for review">
                <ActionIcon
                  size="sm"
                  color="warning"
                  variant="light"
                  onClick={() => handleOpenReview(row.id, "on_hold")}
                  aria-label="Hold prescription for review"
                >
                  <IconClock size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Reject prescription">
                <ActionIcon
                  size="sm"
                  color="danger"
                  variant="light"
                  onClick={() => handleOpenReview(row.id, "rejected")}
                  aria-label="Reject prescription"
                >
                  <IconX size={14} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
        </Group>
      ),
    },
  ];

  const needsPriceOverrideReason =
    reviewAction === "approved" &&
    rxHasPriceOverride(reviewDetail?.items ?? [], reviewItems) &&
    !reviewNotes.trim();

  return (
    <Stack>
      {!canViewQueue && canReview && (
        <Alert color="blue" variant="light" icon={<IconShieldCheck size={16} />}>
          Review-only access is active. You can inspect pending prescriptions and approve, hold, or
          reject them, but broad queue visibility remains limited to Rx queue list roles.
        </Alert>
      )}
      <Group justify="space-between">
        <Text fw={600}>Prescription Queue</Text>
        <Select
          size="xs"
          placeholder="All statuses"
          clearable
          w={180}
          data={[
            { value: "pending_review", label: "Pending Review" },
            { value: "dispensing", label: "Billing / Dispense" },
            { value: "rejected", label: "Rejected" },
            { value: "on_hold", label: "On Hold" },
          ]}
          value={filterStatus}
          onChange={setFilterStatus}
        />
      </Group>
      <DataTable columns={columns} data={queue} loading={isLoading} rowKey={(row) => row.id} />

      {/* Prescription Detail Drawer */}
      <Drawer
        opened={Boolean(selectedId) && !reviewOpened}
        onClose={() => setSelectedId(null)}
        title="Prescription Detail"
        position="right"
        size="min(100%, 1040px)"
      >
        {selectedId && (
          <RxDetailView
            rxQueueId={selectedId}
            canReview={canReview}
            reviewItems={reviewItems}
            onReviewItemsChange={setReviewItems}
            canViewPatientRecord={canViewPatientRecord}
            onReview={(action) => {
              handleOpenReview(selectedId, action);
            }}
          />
        )}
      </Drawer>

      <Modal
        opened={reviewOpened}
        onClose={closeReviewModal}
        title={`${reviewAction === "approved" ? "Approve and bill" : reviewAction === "rejected" ? "Reject" : "Hold"} Prescription`}
        size="min(100%, 980px)"
      >
        <Stack component="form" onSubmit={handleSubmitReviewForm(handleSubmitReview)}>
          <Controller
            control={reviewControl}
            name="notes"
            render={({ field, fieldState }) => (
              <Textarea
                label={
                  reviewAction === "approved" ? "Review notes / price override reason" : "Notes"
                }
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          {reviewAction === "rejected" && (
            <Controller
              control={reviewControl}
              name="rejection_reason"
              render={({ field, fieldState }) => (
                <Textarea
                  label="Rejection Reason"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
          )}
          {reviewAction === "approved" && (
            <RxBillingEstimate
              items={applyRxReviewItems(reviewDetail?.items ?? [], reviewItems)}
              loading={reviewDetailLoading}
              editable
              reviewItems={
                reviewItems.length > 0
                  ? reviewItems
                  : (reviewDetail?.items ?? []).map(rxReviewInputFromItem)
              }
              onReviewItemsChange={setReviewItems}
            />
          )}
          {needsPriceOverrideReason && (
            <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
              Enter a review note before approving because one or more item prices differ from
              catalog price.
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={closeReviewModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              color={
                reviewAction === "rejected"
                  ? "danger"
                  : reviewAction === "on_hold"
                    ? "warning"
                    : "success"
              }
              loading={reviewMutation.isPending}
              disabled={needsPriceOverrideReason || Boolean(reviewErrors.items?.message)}
            >
              {reviewAction === "approved"
                ? "Approve & Create Billing Indent"
                : reviewAction === "on_hold"
                  ? "Put on Hold"
                  : "Reject"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

/** Detail view for a single Rx queue entry — shows prescription items, allergies, 4 views */
function RxDetailView({
  rxQueueId,
  canReview,
  reviewItems,
  onReviewItemsChange,
  canViewPatientRecord,
  onReview,
}: {
  rxQueueId: string;
  canReview: boolean;
  reviewItems: PharmacyRxReviewItemInput[];
  onReviewItemsChange: (items: PharmacyRxReviewItemInput[]) => void;
  canViewPatientRecord: boolean;
  onReview: (action: PharmacyRxReviewAction) => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["pharmacy-rx-detail", rxQueueId],
    queryFn: () => pharmacyService.getRxDetail(rxQueueId),
    retry: 1,
  });
  const rxDetail = data as PharmacyRxDetailResponse | undefined;
  const rxPatientId = rxDetail?.prescription.patient_id;
  const { data: patientName } = usePatientName(canViewPatientRecord ? rxPatientId : undefined);

  if (isLoading) return <Loader />;
  if (error)
    return (
      <Alert color="danger" variant="light" title="Error">
        {String(error)}
      </Alert>
    );
  if (!rxDetail) return <Text c="dimmed">No prescription data</Text>;

  const { prescription, items: rxItems, allergies } = rxDetail;
  const pricedRxItems = applyRxReviewItems(rxItems, reviewItems);
  const allergyNames = (allergies as { allergen_name: string }[]).map((a) => a.allergen_name);
  const patientId = prescription.patient_id;
  const status = prescription.status;

  // Build PrescriptionWithItems format for the 4-view component
  const rxForViews: PrescriptionWithItems[] = [
    {
      prescription: {
        id: prescription.prescription_id as string,
        tenant_id: prescription.tenant_id,
        encounter_id: prescription.encounter_id,
        doctor_id: prescription.doctor_id,
        notes: null,
        created_at: prescription.received_at,
        updated_at: prescription.received_at,
      },
      items: rxItems.map((it, idx) => ({
        id: `item-${idx}`,
        tenant_id: prescription.tenant_id,
        prescription_id: prescription.prescription_id,
        drug_name: it.drug_name,
        dosage: it.dosage,
        frequency: it.frequency,
        duration: it.duration,
        route: it.route ?? null,
        instructions: it.instructions ?? null,
        created_at: prescription.received_at,
        item_status: "active",
        discontinued_at: null,
        discontinued_by: null,
        discontinue_reason: null,
        catalog_item_id: it.catalog_item_id,
      })),
    },
  ];

  return (
    <Stack>
      <PharmacyPatientContext patientId={patientId} canViewPatientRecord={canViewPatientRecord} />
      {/* Allergy alert */}
      {allergyNames.length > 0 && (
        <Alert
          color="danger"
          variant="light"
          title="Drug Allergies"
          icon={<IconAlertTriangle size={16} />}
        >
          <Group gap={6}>
            {allergyNames.map((a) => (
              <Badge key={a} color="danger" size="sm">
                {a}
              </Badge>
            ))}
          </Group>
        </Alert>
      )}

      <RxBillingEstimate
        items={pricedRxItems}
        editable={canReview && status === "pending_review"}
        reviewItems={reviewItems.length > 0 ? reviewItems : rxItems.map(rxReviewInputFromItem)}
        onReviewItemsChange={onReviewItemsChange}
      />

      {/* Status + actions */}
      <Group justify="space-between">
        <Badge size="lg" color={rxStatusColors[status] ?? "gray"}>
          {status.replace(/_/g, " ")}
        </Badge>
        <Group gap="xs">
          {canReview && status === "pending_review" && (
            <>
              <Button
                size="xs"
                color="success"
                leftSection={<IconCheck size={14} />}
                onClick={() => onReview("approved")}
              >
                Approve & Create Billing
              </Button>
              <Button
                size="xs"
                color="warning"
                variant="light"
                leftSection={<IconClock size={14} />}
                onClick={() => onReview("on_hold")}
              >
                Hold
              </Button>
              <Button
                size="xs"
                color="danger"
                variant="light"
                leftSection={<IconX size={14} />}
                onClick={() => onReview("rejected")}
              >
                Reject
              </Button>
            </>
          )}
          {status === "approved" && (
            <Button size="xs" color="primary" leftSection={<IconShoppingCart size={14} />}>
              Create Dispense Order
            </Button>
          )}
        </Group>
      </Group>

      {/* Prescription items table */}
      <Card withBorder>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>Drug</Table.Th>
              <Table.Th>Dosage</Table.Th>
              <Table.Th>Frequency</Table.Th>
              <Table.Th>Duration</Table.Th>
              <Table.Th>Route</Table.Th>
              <Table.Th>Instructions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rxItems.map((it, idx) => (
              <Table.Tr key={`${it.drug_name}-${it.dosage}-${it.frequency}`}>
                <Table.Td>{idx + 1}</Table.Td>
                <Table.Td fw={600}>{it.drug_name}</Table.Td>
                <Table.Td c="primary">{it.dosage}</Table.Td>
                <Table.Td>
                  <Badge size="xs" variant="light">
                    {it.frequency}
                  </Badge>
                </Table.Td>
                <Table.Td>{it.duration}</Table.Td>
                <Table.Td>{it.route ?? "—"}</Table.Td>
                <Table.Td c="dimmed">{instructionsDisplayText(it.instructions) ?? "—"}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      {/* 4-view prescription display */}
      <PrescriptionViews
        prescriptions={rxForViews}
        patientName={
          canViewPatientRecord ? (patientName?.full_name ?? "Linked patient") : "Patient restricted"
        }
        uhid={canViewPatientRecord ? (patientName?.uhid ?? "") : ""}
        allergies={allergyNames}
      />
    </Stack>
  );
}

function RxBillingEstimate({
  items,
  loading = false,
  editable = false,
  reviewItems,
  onReviewItemsChange,
}: {
  items: PharmacyRxDetailItem[];
  loading?: boolean;
  editable?: boolean;
  reviewItems?: PharmacyRxReviewItemInput[];
  onReviewItemsChange?: (items: PharmacyRxReviewItemInput[]) => void;
}) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const priceAccess = useFieldAccess("pharmacy.pricing.unit_price");
  const subtotal = items.reduce((sum, item) => sum + Number(item.taxable_amount || 0), 0);
  const tax = items.reduce((sum, item) => sum + Number(item.tax_amount || 0), 0);
  const total = items.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
  const unmatchedCount = items.filter((item) => item.price_source === "unmatched").length;
  const canEdit = editable && Boolean(onReviewItemsChange) && canEditPharmacyField(priceAccess);

  function updateReviewLine(item: PharmacyRxDetailItem, patch: Partial<PharmacyRxReviewItemInput>) {
    if (!onReviewItemsChange) return;
    const current = reviewItems?.length ? reviewItems : items.map(rxReviewInputFromItem);
    const next = current.map((line) =>
      line.prescription_item_id === item.id
        ? {
            ...line,
            ...patch,
          }
        : line,
    );
    onReviewItemsChange(next);
  }

  if (loading) {
    return (
      <Card withBorder padding="sm" className={styles.rxEstimateCard}>
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">
            Calculating price and GST...
          </Text>
        </Group>
      </Card>
    );
  }

  return (
    <Card withBorder padding="sm" className={styles.rxEstimateCard}>
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={700}>Price & GST before approval</Text>
          {unmatchedCount > 0 && (
            <Badge color="warning" variant="light">
              {unmatchedCount} unpriced
            </Badge>
          )}
        </Group>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Drug</Table.Th>
              <Table.Th>Qty</Table.Th>
              <Table.Th>Unit</Table.Th>
              <Table.Th>GST</Table.Th>
              <Table.Th>Tax</Table.Th>
              <Table.Th>Total</Table.Th>
              {canEdit && <Table.Th>Actions</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item) => {
              const isEditing = editingItemId === item.id;
              return (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Stack gap={0}>
                      <Text size="sm" fw={600}>
                        {item.drug_name}
                      </Text>
                      {item.price_source === "unmatched" && (
                        <Text size="xs" c="warning">
                          Not matched to formulary/catalog
                        </Text>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    {isEditing ? (
                      <NumberInput
                        value={item.quantity}
                        min={1}
                        step={1}
                        allowDecimal={false}
                        hideControls
                        size="xs"
                        w={72}
                        onChange={(value) => {
                          const next =
                            typeof value === "number" ? value : Number.parseInt(value || "1", 10);
                          updateReviewLine(item, {
                            quantity: Number.isFinite(next) && next > 0 ? next : 1,
                          });
                        }}
                      />
                    ) : (
                      item.quantity
                    )}
                  </Table.Td>
                  <Table.Td>
                    {isEditing ? (
                      <NumberInput
                        value={item.unit_price}
                        min={0}
                        decimalScale={2}
                        prefix="₹"
                        hideControls
                        size="xs"
                        w={110}
                        onChange={(value) => {
                          const next =
                            typeof value === "number" ? value : Number.parseFloat(value || "0");
                          updateReviewLine(item, {
                            unit_price: Number.isFinite(next) && next >= 0 ? next : 0,
                          });
                        }}
                      />
                    ) : (
                      renderPharmacySensitiveCurrency(priceAccess, item.unit_price)
                    )}
                  </Table.Td>
                  <Table.Td>{Number(item.tax_percent || 0).toFixed(2)}%</Table.Td>
                  <Table.Td>
                    {renderPharmacySensitiveCurrency(priceAccess, item.tax_amount)}
                  </Table.Td>
                  <Table.Td fw={700}>
                    {renderPharmacySensitiveCurrency(priceAccess, item.line_total)}
                  </Table.Td>
                  {canEdit && (
                    <Table.Td>
                      <Tooltip label={isEditing ? "Done editing" : "Edit quantity and price"}>
                        <ActionIcon
                          size="sm"
                          variant={isEditing ? "light" : "subtle"}
                          color={isEditing ? "primary" : "gray"}
                          onClick={() => setEditingItemId(isEditing ? null : item.id)}
                          aria-label={`${isEditing ? "Save" : "Edit"} ${item.drug_name}`}
                        >
                          {isEditing ? <IconDeviceFloppy size={14} /> : <IconPencil size={14} />}
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  )}
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
        <Group justify="flex-end" gap="lg" className={styles.billingSummaryBand}>
          <Text size="sm" c="dimmed">
            Subtotal {renderPharmacySensitiveCurrency(priceAccess, subtotal)}
          </Text>
          <Text size="sm" c="dimmed">
            GST {renderPharmacySensitiveCurrency(priceAccess, tax)}
          </Text>
          <Text fw={800}>
            Billing indent total {renderPharmacySensitiveCurrency(priceAccess, total)}
          </Text>
        </Group>
      </Stack>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════
//  POS Counter Tab (Phase 3)
// ══════════════════════════════════════════════════════════

function PosCounterTab({
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
  const [drugSelectValue, setDrugSelectValue] = useState("");
  const [saleToCancel, setSaleToCancel] = useState<PharmacyPosSale | null>(null);
  const [saleToReturn, setSaleToReturn] = useState<PharmacyPosSale | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOpened, { open: openCancelModal, close: closeCancelModal }] = useDisclosure(false);
  const [returnOpened, { open: openReturnModal, close: closeReturnModal }] = useDisclosure(false);
  const [returnItemsLoading, setReturnItemsLoading] = useState(false);
  const walkInNameAccess = useFieldAccess("pharmacy.pos.patient_name");
  const walkInPhoneAccess = useFieldAccess("pharmacy.pos.patient_phone");
  const priceAccess = useFieldAccess("pharmacy.pricing.unit_price");
  const batchNumberAccess = useFieldAccess("pharmacy.batches.batch_number");
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
  const posReturnDefaults: PharmacyPosReturnFormInput = {
    reason: "",
    items: [],
  };
  const {
    control: returnControl,
    reset: resetReturnForm,
    handleSubmit: handleReturnSubmit,
    watch: watchReturn,
    setError: setReturnError,
    formState: { errors: returnErrors },
  } = useForm<PharmacyPosReturnFormInput>({
    resolver: zodResolver(pharmacyPosReturnFormSchema),
    defaultValues: posReturnDefaults,
  });
  const { fields: returnFields } = useFieldArray({
    control: returnControl,
    name: "items",
  });

  const cart = watch("items");
  const amountReceived = watch("amount_received");
  const discountPercent = watch("discount_percent");
  const registeredPatientId = watch("patient_id");

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
      setDrugSelectValue("");
      notifications.show({
        title: "Sale Complete",
        message:
          patientId && billingInvoiceId
            ? "Pharmacy sale recorded and linked to the Billing invoice workbench"
            : "Walk-in sale recorded in Pharmacy POS",
        color: "green",
      });
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
      notifications.show({
        title: "Sale cancelled",
        message: "Stock reversal and POS refund entry were recorded",
        color: "green",
      });
    },
    onError: () => {
      notifications.show({
        title: "Unable to cancel sale",
        message: "The sale may already be cancelled, refunded, or locked by finance controls",
        color: "danger",
      });
    },
  });

  const returnItemsMutation = useMutation({
    mutationFn: ({
      saleId,
      data,
    }: {
      saleId: string;
      data: {
        items: Array<{ item_id: string; return_qty: number; reason?: string }>;
        reason?: string;
      };
    }) => pharmacyService.returnPosItems(saleId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-pos"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-pos-day-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-pos-sales"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      closeReturnSale();
      notifications.show({
        title: "Items returned",
        message: "Partial return, stock reversal, and POS refund entry were recorded",
        color: "green",
      });
    },
    onError: () => {
      notifications.show({
        title: "Unable to return items",
        message: "The sale may already be refunded, cancelled, or locked by finance controls",
        color: "danger",
      });
    },
  });

  const subtotal = cart.reduce(
    (sum, item) => sum + posSaleLineQuantity(item) * posSaleLinePrice(item),
    0,
  );
  const discount = subtotal * (formNumberOrFallback(discountPercent, 0) / 100);
  const gstAmount = (subtotal - discount) * 0.05;
  const totalAmount = subtotal - discount + gstAmount;
  const changeDue = formNumberOrFallback(amountReceived, 0) - totalAmount;

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

  function handleSubmitSale(values: PharmacyPosSaleFormInput) {
    const subtotalValue = values.items.reduce(
      (sum, item) => sum + posSaleLineQuantity(item) * posSaleLinePrice(item),
      0,
    );
    const discountPercentValue = formNumberOrFallback(values.discount_percent, 0);
    const discountValue = subtotalValue * (discountPercentValue / 100);
    createMutation.mutate({
      patient_id: optionalFormText(values.patient_id),
      items: values.items.map((c) => ({
        catalog_item_id: c.catalog_item_id,
        drug_name: c.drug_name,
        quantity: posSaleLineQuantity(c),
        mrp: posSaleLinePrice(c),
        selling_price: posSaleLinePrice(c),
        gst_rate: 5,
      })),
      payment_mode: values.payment_mode,
      amount_received: formNumberOrFallback(values.amount_received, 0),
      patient_name: canEditWalkInName ? optionalFormText(values.patient_name) : undefined,
      patient_phone: canEditWalkInPhone ? optionalFormText(values.patient_phone) : undefined,
      discount_percent: discountPercentValue || undefined,
      discount_amount: discountValue > 0 ? discountValue : undefined,
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

  async function openReturnSale(row: PharmacyPosSale) {
    setSaleToReturn(row);
    resetReturnForm(posReturnDefaults);
    openReturnModal();
    setReturnItemsLoading(true);
    try {
      const items = await queryClient.fetchQuery<PharmacyPosSaleItem[]>({
        queryKey: ["pharmacy-pos-sale-items", row.id],
        queryFn: () => pharmacyService.listPosSaleItems(row.id),
      });
      resetReturnForm({
        reason: "",
        items: items
          .filter((item) => posSaleItemReturnableQuantity(item) > 0)
          .map((item) => ({
            item_id: item.id,
            drug_name: item.drug_name,
            batch_number: item.batch_number ?? "",
            max_qty: posSaleItemReturnableQuantity(item),
            return_qty: 0,
            unit_price: Number(item.selling_price ?? 0),
          })),
      });
    } catch {
      notifications.show({
        title: "Unable to load sale items",
        message: "Check POS return permission and try again",
        color: "danger",
      });
    } finally {
      setReturnItemsLoading(false);
    }
  }

  function closeReturnSale() {
    closeReturnModal();
    setSaleToReturn(null);
    resetReturnForm(posReturnDefaults);
    setReturnItemsLoading(false);
  }

  function submitReturnItems(values: PharmacyPosReturnFormInput) {
    if (!saleToReturn) return;
    const selectedItems = values.items
      .map((item) => ({
        item,
        returnQty: posReturnLineQuantity(item),
      }))
      .filter(({ returnQty }) => returnQty > 0);

    if (selectedItems.length === 0) {
      setReturnError("items", { message: "Select at least one medicine to return" });
      return;
    }

    const invalidIndex = selectedItems.findIndex(
      ({ item, returnQty }) => returnQty > formIntegerOrFallback(item.max_qty, 0),
    );
    if (invalidIndex >= 0) {
      const invalidItem = selectedItems[invalidIndex]?.item;
      const formIndex = values.items.findIndex((item) => item.item_id === invalidItem?.item_id);
      if (formIndex >= 0) {
        setReturnError(`items.${formIndex}.return_qty` as const, {
          message: "Return quantity cannot exceed remaining sale quantity",
        });
      }
      return;
    }

    returnItemsMutation.mutate({
      saleId: saleToReturn.id,
      data: {
        reason: values.reason.trim(),
        items: selectedItems.map(({ item, returnQty }) => ({
          item_id: item.item_id,
          return_qty: returnQty,
        })),
      },
    });
  }

  const returnItems = watchReturn("items");
  const returnRefundTotal = returnItems.reduce(
    (sum, item) => sum + posReturnLineQuantity(item) * posReturnLinePrice(item),
    0,
  );

  const saleColumns = [
    {
      key: "sale_number",
      label: "Sale #",
      render: (row: PharmacyPosSale) => (
        <Text size="sm" fw={600}>
          {row.sale_number}
        </Text>
      ),
    },
    {
      key: "patient_name",
      label: "Customer",
      render: (row: PharmacyPosSale) =>
        row.patient_id ? (
          <PharmacyPatientCell
            patientId={row.patient_id}
            canViewPatientRecord={canViewPatientRecord}
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
      render: (row: PharmacyPosSale) => (
        <Text size="sm" fw={700}>
          {renderPharmacySensitiveCurrency(priceAccess, row.total_amount)}
        </Text>
      ),
    },
    {
      key: "payment_mode",
      label: "Payment",
      render: (row: PharmacyPosSale) => (
        <Badge size="xs" variant="light">
          {row.payment_mode}
        </Badge>
      ),
    },
    {
      key: "billing_invoice_id",
      label: "Billing",
      render: (row: PharmacyPosSale) =>
        row.billing_invoice_id ? (
          <Stack gap={2}>
            <Badge size="xs" color="success" variant="light">
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
                variant="subtle"
                leftSection={<IconReceipt size={12} />}
                onClick={() => navigate(`/billing/invoices/${row.billing_invoice_id}`)}
              >
                Open invoice
              </Button>
            )}
          </Stack>
        ) : (
          <Badge size="xs" color="gray" variant="light">
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
            <Badge size="xs" color={statusColors[saleStatus] ?? "gray"} variant="light">
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
                <ActionIcon
                  size="sm"
                  color="orange"
                  variant="light"
                  onClick={() => {
                    void openReturnSale(row);
                  }}
                  aria-label="Return POS sale items"
                >
                  <IconReceipt size={14} />
                </ActionIcon>
              </Tooltip>
            )}
            {canCancelSale && (
              <Tooltip label="Cancel sale and reverse remaining stock/refund">
                <ActionIcon
                  size="sm"
                  color="danger"
                  variant="light"
                  onClick={() => openCancelSale(row)}
                  aria-label="Cancel POS sale"
                >
                  <IconX size={14} />
                </ActionIcon>
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

  return (
    <Stack>
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
          <Stack component="form" onSubmit={handleSubmit(handleSubmitSale)}>
            <Text fw={600}>New Sale</Text>
            <Alert color={registeredPatientId ? "primary" : "gray"} variant="light">
              {registeredPatientId
                ? "Registered patient sale will post a paid invoice into Billing and keep Pharmacy POS as the stock and cash-drawer source."
                : "Walk-in sale stays in Pharmacy POS until a registered patient is selected."}
            </Alert>
            <Group mb="sm" align="flex-end">
              <DrugSearchSelect
                label="Add medicine"
                value={drugSelectValue}
                onChange={(id: string, drug) => {
                  setDrugSelectValue("");
                  addToCart(id, drug?.name ?? id, Number(drug?.base_price ?? 0));
                }}
              />
              <Controller
                control={control}
                name="patient_id"
                render={({ field, fieldState }) => (
                  <PatientSearchSelect
                    size="xs"
                    label="Registered patient"
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
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

            {cart.length > 0 && (
              <Table striped highlightOnHover mb="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Drug</Table.Th>
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

                    return (
                      <Table.Tr key={field.id}>
                        <Table.Td>
                          <Text size="sm">{item.drug_name}</Text>
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            size="xs"
                            w={70}
                            min={1}
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
                          <ActionIcon
                            size="sm"
                            color="red"
                            variant="light"
                            onClick={() => remove(index)}
                            aria-label="Remove sale line"
                          >
                            <IconX size={14} />
                          </ActionIcon>
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

            {cart.length > 0 && (
              <Group justify="space-between" align="flex-end">
                <Group gap="sm">
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
                  <Controller
                    control={control}
                    name="payment_mode"
                    render={({ field, fieldState }) => (
                      <Select
                        size="xs"
                        label="Payment"
                        w={130}
                        data={pharmacyPosPaymentModeOptions}
                        value={field.value}
                        onChange={(value) => field.onChange(value ?? "cash")}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="amount_received"
                    render={({ field, fieldState }) => (
                      <NumberInput
                        size="xs"
                        label="Received"
                        w={120}
                        min={0}
                        decimalScale={2}
                        prefix={"\u20B9"}
                        value={field.value}
                        disabled={!canEditPosAmounts}
                        onChange={field.onChange}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </Group>
                <Stack gap={2} align="flex-end">
                  <Text size="sm">
                    Subtotal: {renderPharmacySensitiveCurrency(priceAccess, subtotal)} | GST:{" "}
                    {renderPharmacySensitiveCurrency(priceAccess, gstAmount)} | Total:{" "}
                    <b>{renderPharmacySensitiveCurrency(priceAccess, totalAmount)}</b>
                  </Text>
                  {changeDue > 0 && (
                    <Text size="xs" c="green">
                      Change: {renderPharmacySensitiveCurrency(priceAccess, changeDue)}
                    </Text>
                  )}
                  <Button
                    size="xs"
                    color="primary"
                    loading={createMutation.isPending}
                    type="submit"
                    disabled={
                      !canEditPosAmounts ||
                      cart.length === 0 ||
                      formNumberOrFallback(amountReceived, 0) < totalAmount
                    }
                    leftSection={<IconShoppingCart size={14} />}
                  >
                    Complete Sale
                  </Button>
                </Stack>
              </Group>
            )}
          </Stack>
        </Card>
      )}

      {canView || canCancel || canReturn ? (
        <>
          <Text fw={600} mt="md">
            {canView ? "Today's Sales" : "Today's sales available for POS actions"}
          </Text>
          <DataTable
            columns={saleColumns}
            data={sales}
            loading={salesLoading}
            rowKey={(row) => row.id}
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
      <Modal
        opened={returnOpened}
        onClose={closeReturnSale}
        title="Return POS sale items"
        size="lg"
      >
        <Stack component="form" onSubmit={handleReturnSubmit(submitReturnItems)}>
          <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
            Return only the medicines actually coming back to pharmacy. This posts a partial POS
            refund and restores stock for the selected quantities.
          </Alert>
          {saleToReturn && (
            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="sm" fw={600}>
                  {saleToReturn.sale_number}
                </Text>
                <Text size="xs" c="dimmed">
                  {new Date(saleToReturn.created_at).toLocaleString()}
                </Text>
              </Stack>
              <Text size="sm" fw={700}>
                {renderPharmacySensitiveCurrency(priceAccess, saleToReturn.total_amount)}
              </Text>
            </Group>
          )}

          {returnItemsLoading ? (
            <Group gap="xs">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                Loading sale items...
              </Text>
            </Group>
          ) : returnFields.length > 0 ? (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Medicine</Table.Th>
                  <Table.Th>Batch</Table.Th>
                  <Table.Th>Remaining</Table.Th>
                  <Table.Th>Return</Table.Th>
                  <Table.Th>Refund</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {returnFields.map((field, index) => {
                  const item = returnItems[index];
                  if (!item) return null;
                  const returnQty = posReturnLineQuantity(item);
                  const refund = returnQty * posReturnLinePrice(item);
                  return (
                    <Table.Tr key={field.id}>
                      <Table.Td>
                        <Text size="sm" fw={600}>
                          {item.drug_name}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {renderPharmacySensitiveValue(batchNumberAccess, item.batch_number)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light">{formIntegerOrFallback(item.max_qty, 0)}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Controller
                          control={returnControl}
                          name={`items.${index}.return_qty` as const}
                          render={({ field: qtyField }) => (
                            <NumberInput
                              size="xs"
                              min={0}
                              max={formIntegerOrFallback(item.max_qty, 0)}
                              value={qtyField.value}
                              onChange={qtyField.onChange}
                              error={returnErrors.items?.[index]?.return_qty?.message}
                              w={100}
                            />
                          )}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={600}>
                          {renderPharmacySensitiveCurrency(priceAccess, refund)}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          ) : (
            <Alert color="gray" variant="light">
              No returnable items remain on this sale.
            </Alert>
          )}
          {returnErrors.items?.message && (
            <Text size="xs" c="danger">
              {returnErrors.items.message}
            </Text>
          )}
          <Controller
            control={returnControl}
            name="reason"
            render={({ field, fieldState }) => (
              <Textarea
                label="Return reason"
                required
                minRows={3}
                placeholder="Patient returned medicine, wrong item, damaged strip..."
                error={fieldState.error?.message}
                {...field}
              />
            )}
          />
          <Group justify="space-between">
            <Text fw={700}>
              Refund: {renderPharmacySensitiveCurrency(priceAccess, returnRefundTotal)}
            </Text>
            <Group>
              <Button variant="default" onClick={closeReturnSale}>
                Keep sale
              </Button>
              <Button
                color="orange"
                type="submit"
                loading={returnItemsMutation.isPending}
                disabled={returnItemsLoading || returnFields.length === 0}
                leftSection={<IconReceipt size={14} />}
              >
                Return selected items
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
      <Modal opened={cancelOpened} onClose={closeCancelSale} title="Cancel POS sale" centered>
        <Stack>
          <Alert color="warning" variant="light" icon={<IconAlertTriangle size={16} />}>
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
            <Button variant="default" onClick={closeCancelSale}>
              Keep sale
            </Button>
            <Button
              color="danger"
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
