/**
 * The storefront's rules as the screens apply them: what can go in a cart,
 * which prescription an order rides on, how statuses read. Pure, so the
 * portal, the public store and the pharmacist's review agree with the tests.
 * The server decides; this only shapes what is shown and sent.
 */

import type {
  PortalDeliveryChoice,
  PortalPerson,
  PortalRefill,
  PortalVerifyResult,
  StoreCart,
  StoreCheckoutRequest,
  StorefrontLineDecision,
  StoreItem,
  StoreOrderLine,
  StoreOrderStatus,
  StoreRejectReason,
  StoreStock,
} from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";

export const STOCK_VIEW: Record<StoreStock, { label: string; tone: BadgeTone }> = {
  available: { label: "In stock", tone: "success" },
  low: { label: "Few left", tone: "warning" },
  out: { label: "Out of stock", tone: "neutral" },
};

export const ORDER_STATUS_VIEW: Record<StoreOrderStatus, { label: string; tone: BadgeTone }> = {
  awaiting_verification: { label: "With the pharmacist", tone: "info" },
  released: { label: "Being prepared", tone: "success" },
  rejected: { label: "Not approved", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  closed: { label: "Closed", tone: "neutral" },
};

export const REJECT_REASONS: { value: StoreRejectReason; label: string }[] = [
  { value: "expired", label: "Prescription expired" },
  { value: "illegible", label: "Can't be read" },
  { value: "not_on_prescription", label: "Not on the prescription" },
  { value: "quantity_exceeds_prescription", label: "More than prescribed" },
  { value: "needs_consultation", label: "Needs a consultation" },
  { value: "other", label: "Other" },
];

export function rejectReasonLabel(reason: StoreRejectReason | null): string | null {
  return REJECT_REASONS.find((r) => r.value === reason)?.label ?? null;
}

/** Whether a signed-in patient can put this in the cart now. */
export function canAdd(item: StoreItem): boolean {
  return (
    item.on_sale &&
    item.sale_class !== "counter_only" &&
    item.price !== null &&
    item.stock !== "out"
  );
}

/** A quantity within 1 and the item's limit. */
export function clampQuantity(n: number, item: StoreItem): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(Math.round(n), 1), Math.max(item.max_quantity, 1));
}

/** The patient's prescriptions an order may ride on: not expired today. */
export function usablePrescriptions(refills: PortalRefill[], today: string): PortalRefill[] {
  return refills.filter((r) => r.valid_until === null || r.valid_until >= today);
}

export interface PrescriptionChoice {
  /** A hospital prescription picked, when any. */
  hospitalId: string | null;
  uploaded: boolean;
}

/**
 * The checkout body, or why it can't be placed yet. A cart with nothing
 * needing a prescription goes without one; otherwise the hospital
 * prescription picked wins over an upload.
 */
export function checkoutBody(
  cart: StoreCart,
  rx: PrescriptionChoice,
  delivery?: PortalDeliveryChoice,
): { body: StoreCheckoutRequest } | { problem: string } {
  if (cart.lines.length === 0) return { problem: "Your cart is empty" };
  if (cart.lines.some((l) => !l.item.on_sale)) {
    return { problem: "Take out what can't be ordered online" };
  }
  const extra = delivery ? { delivery } : {};
  if (!cart.prescription_needed) return { body: { prescription_source: "none", ...extra } };
  if (rx.hospitalId) {
    return {
      body: { prescription_source: "hospital", prescription_id: rx.hospitalId, ...extra },
    };
  }
  if (rx.uploaded) return { body: { prescription_source: "upload", ...extra } };
  return { problem: "Choose one of your prescriptions, or upload one" };
}

/** Anything in the cart that has to be collected rather than delivered. */
export function pickupOnly(cart: StoreCart): string[] {
  return cart.lines.filter((l) => l.item.pickup_only).map((l) => l.item.name);
}

export function isChoose(result: PortalVerifyResult): result is { choose: PortalPerson[] } {
  return "choose" in result;
}

export function personLabel(p: PortalPerson): string {
  return p.birth_year ? `${p.name} (born ${p.birth_year})` : p.name;
}

/** What the pharmacist's review starts at: every waiting line approved in full. */
export function defaultDecisions(lines: StoreOrderLine[]): StorefrontLineDecision[] {
  return lines
    .filter((l) => l.status === "pending")
    .map((l) => ({ catalog_item_id: l.catalog_item_id, approve: true, quantity: l.quantity }));
}

/** The first thing wrong with the review, as the server would say it. */
export function decisionProblem(
  decisions: StorefrontLineDecision[],
  lines: StoreOrderLine[],
): string | null {
  for (const d of decisions) {
    const line = lines.find((l) => l.catalog_item_id === d.catalog_item_id);
    if (!line) continue;
    if (d.approve && (d.quantity === undefined || d.quantity < 1 || d.quantity > line.quantity)) {
      return `${line.drug_name}: approve between 1 and ${line.quantity}`;
    }
    if (!d.approve && !d.reason) return `${line.drug_name}: choose why it is refused`;
  }
  return null;
}
