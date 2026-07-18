// Shared pharmacy helpers — pure field-access masking + currency formatting used across many
// tabs, extracted from pharmacy.tsx so tab components can be split into their own files.

import { Text } from "@mantine/core";
import type {
  PharmacyOrderFormInput,
  PharmacyOrderItemFormInput,
  PharmacyRxReviewFormInput,
} from "@medbrains/schemas";
import type {
  CreatePharmacyOrderRequest,
  FieldAccessLevel,
  PharmacyOrderItem,
  PharmacyOrderItemInput,
  PharmacyReturnStatusType,
  PharmacyRxDetailItem,
  PharmacyRxReviewItemInput,
} from "@medbrains/types";
import {
  pharmacyRxPriorityLabelKey,
  pharmacyRxPrioritySignal,
  pharmacyRxSourceLabelKey,
  pharmacyRxSourceSignal,
  pharmacyRxStatusLabelKey,
  pharmacyRxStatusSignal,
  pharmacyRxPriorityLabel as sharedPharmacyRxPriorityLabel,
  pharmacyRxSourceLabel as sharedPharmacyRxSourceLabel,
  pharmacyRxStatusLabel as sharedPharmacyRxStatusLabel,
} from "@medbrains/types";
import { IconCheck, IconClock, IconShoppingCart, IconX } from "@tabler/icons-react";
import type { useTranslation } from "react-i18next";
import type { MedicineOrderLineValue } from "@/components/Pharmacy/MedicineOrderLineCard";
import {
  formIntegerOrFallback,
  formNumberOrFallback,
  optionalFormText,
} from "@/forms/pharmacy.form";
import type { pharmacyService } from "@/services/pharmacy.service";

type PharmacyTranslate = ReturnType<typeof useTranslation>["t"];

import { fieldAccessText } from "@medbrains/utils";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientNameCell } from "@/components/PatientNameCell";
import { Alert, type BadgeTone } from "@/components/ui";

export function formatInr(value: number) {
  return `₹${Number.isFinite(value) ? value.toFixed(2) : "0.00"}`;
}

export function canViewPharmacyField(access: FieldAccessLevel) {
  return access !== "hidden";
}

export function canEditPharmacyField(access: FieldAccessLevel) {
  return access === "edit";
}

export function renderPharmacySensitiveValue(
  access: FieldAccessLevel,
  value: string | null | undefined,
) {
  return fieldAccessText(access, value);
}

export function renderPharmacySensitiveIdentifier(
  access: FieldAccessLevel,
  value: string | null | undefined,
) {
  return fieldAccessText(access, value, "identifier");
}

export function renderPharmacySensitiveShortIdentifier(
  access: FieldAccessLevel,
  value: string | null | undefined,
) {
  if (access === "edit" || access === "view") return value?.slice(0, 8) ?? "\u2014";
  return renderPharmacySensitiveIdentifier(access, value);
}

export function renderPharmacySensitiveNumber(
  access: FieldAccessLevel,
  value: string | number | null | undefined,
) {
  if (value === null || value === undefined || value === "") {
    return "\u2014";
  }
  return fieldAccessText(access, String(value));
}

export function renderPharmacySensitiveCurrency(
  access: FieldAccessLevel,
  value: string | number | null | undefined,
) {
  if (value === null || value === undefined || value === "") {
    return "\u2014";
  }
  return fieldAccessText(access, formatInr(Number(value)), "amount");
}

export function ExpiryCell({ date }: { date: string }) {
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  const color = days < 0 ? "danger" : days < 30 ? "danger" : days < 60 ? "orange" : undefined;
  return (
    <Text size="xs" c={color} fw={days < 60 ? 600 : 400}>
      {date}
      {days >= 0 ? ` (${days}d)` : " (expired)"}
    </Text>
  );
}

export const SHARED_COLOR_BADGE_TONES: Record<string, BadgeTone> = {
  success: "success",
  primary: "primary",
  danger: "danger",
  warning: "warning",
  info: "info",
  indigo: "accent",
  orange: "warning",
  yellow: "warning",
  green: "success",
  teal: "success",
  blue: "info",
  red: "danger",
  gray: "neutral",
};

export function sharedColorBadgeTone(color: string | undefined): BadgeTone {
  return (color ? SHARED_COLOR_BADGE_TONES[color] : undefined) ?? "neutral";
}

export function PharmacyRestrictedValue() {
  return (
    <Text span size="sm" c="dimmed">
      Restricted
    </Text>
  );
}

export function PharmacyPatientCell({
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

export function PharmacyPatientContext({
  patientId,
  canViewPatientRecord,
}: {
  patientId: string | null | undefined;
  canViewPatientRecord: boolean;
}) {
  if (!patientId) return null;
  if (!canViewPatientRecord) {
    return (
      <Alert tone="neutral" title="Patient context restricted">
        Patient identity and demographics are hidden for this pharmacy role.
      </Alert>
    );
  }
  return <PatientContextBanner patientId={patientId} hideLoadingState />;
}

export function pharmacyRxTranslatedLabel(
  t: PharmacyTranslate,
  key: string | null,
  fallback: string,
): string {
  return key ? t(key, { defaultValue: fallback }) : fallback;
}

export function rxStatusLabel(t: PharmacyTranslate, status: string): string {
  return pharmacyRxTranslatedLabel(
    t,
    pharmacyRxStatusLabelKey(status),
    sharedPharmacyRxStatusLabel(status),
  );
}

export function rxStatusTone(status: string) {
  return pharmacyRxStatusSignal(status).tone;
}

export function rxStatusShape(status: string) {
  return pharmacyRxStatusSignal(status).shape;
}

export function rxStatusIcon(status: string) {
  switch (status) {
    case "approved":
    case "dispensed":
      return IconCheck;
    case "pending_review":
    case "on_hold":
      return IconClock;
    case "dispensing":
    case "partially_dispensed":
      return IconShoppingCart;
    case "rejected":
    case "cancelled":
      return IconX;
    default:
      return undefined;
  }
}

export function rxPriorityLabel(t: PharmacyTranslate, priority: string): string {
  return pharmacyRxTranslatedLabel(
    t,
    pharmacyRxPriorityLabelKey(priority),
    sharedPharmacyRxPriorityLabel(priority),
  );
}

export function rxPriorityTone(priority: string) {
  return pharmacyRxPrioritySignal(priority).tone;
}

export function rxPriorityShape(priority: string) {
  return pharmacyRxPrioritySignal(priority).shape;
}

export function rxSourceLabel(t: PharmacyTranslate, source: string): string {
  return pharmacyRxTranslatedLabel(
    t,
    pharmacyRxSourceLabelKey(source),
    sharedPharmacyRxSourceLabel(source),
  );
}

export function rxSourceTone(source: string) {
  return pharmacyRxSourceSignal(source).tone;
}

export function rxSourceShape(source: string) {
  return pharmacyRxSourceSignal(source).shape;
}

export function rxReviewInputFromItem(item: PharmacyRxDetailItem): PharmacyRxReviewItemInput {
  return {
    prescription_item_id: item.id,
    catalog_item_id: item.catalog_item_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
  };
}

export type PharmacyRxReviewAction = PharmacyRxReviewFormInput["action"];
export type PharmacyRxReviewFormItem = PharmacyRxReviewFormInput["items"][number];

export const DEFAULT_RX_REVIEW_FORM_VALUES: PharmacyRxReviewFormInput = {
  action: "approved",
  notes: "",
  rejection_reason: "",
  items: [],
};

export function rxReviewInputFromForm(item: PharmacyRxReviewFormItem): PharmacyRxReviewItemInput {
  return {
    prescription_item_id: item.prescription_item_id,
    catalog_item_id: item.catalog_item_id,
    quantity: formIntegerOrFallback(item.quantity, 1),
    unit_price: formNumberOrFallback(item.unit_price, 0),
  };
}

export function rxReviewInputsFromForm(items: PharmacyRxReviewFormInput["items"]) {
  return items.map(rxReviewInputFromForm);
}

export function applyRxReviewItems(
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

export function rxHasPriceOverride(
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

export type DraftPharmacyOrderItem = PharmacyOrderItemInput & {
  row_id: string;
  catalog_item_id?: string;
  tax_percent?: number;
};

export type PharmacyOrderPricingLine = Pick<
  MedicineOrderLineValue,
  "catalog_item_id" | "drug_name" | "quantity" | "unit_price" | "tax_percent"
>;

export function draftItemTaxAmount(item: PharmacyOrderPricingLine) {
  return item.quantity * item.unit_price * ((item.tax_percent ?? 0) / 100);
}

export function draftTotals(items: PharmacyOrderPricingLine[]) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const tax = items.reduce((sum, item) => sum + draftItemTaxAmount(item), 0);
  return {
    subtotal,
    tax,
    total: subtotal + tax,
  };
}

export function newPharmacyOrderFormItem(): PharmacyOrderItemFormInput {
  return {
    catalog_item_id: "",
    drug_name: "",
    quantity: 1,
    unit_price: 0,
    tax_percent: 0,
  };
}

export function pharmacyOrderDefaults(initialPatientId = ""): PharmacyOrderFormInput {
  return {
    patient_id: initialPatientId,
    notes: "",
    safety_override_reason: "",
    items: [newPharmacyOrderFormItem()],
  };
}

export function newDraftPharmacyOrderItem(): DraftPharmacyOrderItem {
  return {
    row_id: crypto.randomUUID(),
    drug_name: "",
    quantity: 1,
    unit_price: 0,
    tax_percent: 0,
  };
}

export function pharmacyOrderLineFromForm(
  item: PharmacyOrderItemFormInput,
): MedicineOrderLineValue {
  return {
    catalog_item_id: optionalFormText(item.catalog_item_id ?? ""),
    drug_name: item.drug_name,
    quantity: formIntegerOrFallback(item.quantity, 1),
    unit_price: formNumberOrFallback(item.unit_price, 0),
    tax_percent: formNumberOrFallback(item.tax_percent, 0),
  };
}

export function draftPharmacyOrderItemsPayload(
  items: PharmacyOrderPricingLine[],
): PharmacyOrderItemInput[] {
  return items.map(({ catalog_item_id, drug_name, quantity, unit_price }) => ({
    catalog_item_id: optionalFormText(catalog_item_id ?? ""),
    drug_name: drug_name.trim(),
    quantity,
    unit_price,
  }));
}

export function pharmacyOrderEventItems(items: PharmacyOrderItem[]) {
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

export function pharmacyOrderPayloadFromForm(
  values: PharmacyOrderFormInput,
): CreatePharmacyOrderRequest {
  const lines = values.items.map(pharmacyOrderLineFromForm);
  return {
    patient_id: values.patient_id,
    notes: optionalFormText(values.notes),
    safety_override_reason: optionalFormText(values.safety_override_reason),
    items: draftPharmacyOrderItemsPayload(lines),
  };
}

export const statusColors: Record<string, string> = {
  completed: "success",
  ordered: "primary",
  dispensed: "success",
  cancelled: "danger",
  partially_cancelled: "warning",
  refunded: "indigo",
  returned: "orange",
};

export const dispensingTypeLabels: Record<string, string> = {
  prescription: "Rx",
  otc: "OTC",
  discharge: "Discharge",
  package: "Package",
  emergency: "Emergency",
};

export const PHARMACY_ORDER_STATUS_OPTIONS = [
  { value: "ordered", label: "Ordered" },
  { value: "dispensed", label: "Dispensed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returned", label: "Returned" },
] as const;

// ── Returns support: parse dispensed-order items into returnable rows ──

export type PatientOrderForReturnLookup = Awaited<
  ReturnType<typeof pharmacyService.listPatientOrdersForReturn>
>[number];

export type ReturnableOrderItem = {
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseJsonArray(value: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function unknownString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function unknownNullableString(value: unknown) {
  const parsed = unknownString(value);
  return parsed.length > 0 ? parsed : null;
}

export function unknownNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function normalizeReturnableItems(
  order: PatientOrderForReturnLookup,
): ReturnableOrderItem[] {
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

// ── Returns display: workspace mode + filter status + badge maps ──

export type ReturnWorkspaceMode = "medicine-returns" | "credit-notes";
export const returnWorkspaceModes: ReturnWorkspaceMode[] = ["medicine-returns", "credit-notes"];

export function isReturnWorkspaceMode(value: string): value is ReturnWorkspaceMode {
  return returnWorkspaceModes.some((mode) => mode === value);
}

export type ReturnFilterStatus = PharmacyReturnStatusType | "all";
export const returnFilterStatuses: ReturnFilterStatus[] = [
  "all",
  "requested",
  "approved",
  "returned_to_stock",
  "destroyed",
  "rejected",
];

export function isReturnFilterStatus(value: string): value is ReturnFilterStatus {
  return returnFilterStatuses.some((status) => status === value);
}

export const returnStatusColors: Record<PharmacyReturnStatusType, string> = {
  requested: "yellow",
  approved: "blue",
  returned_to_stock: "green",
  destroyed: "red",
  rejected: "gray",
};

export const returnStatusLabels: Record<PharmacyReturnStatusType, string> = {
  requested: "Requested",
  approved: "Approved",
  returned_to_stock: "Returned to stock",
  destroyed: "Destroyed",
  rejected: "Rejected",
};
