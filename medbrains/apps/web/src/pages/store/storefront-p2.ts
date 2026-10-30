/**
 * Storefront part 2's rules as the screens apply them (#4864): substitutes
 * and the consents they need, cancelling and returning, the outside-pharmacy
 * print, quarantine destruction, hold ladders, pincodes and the NPPA sheet.
 * Pure, so the screens agree with the tests; the server decides.
 */

import type {
  HoldTier,
  LineSubstitution,
  NppaImportRow,
  QuarantineRow,
  StoreOrder,
  StoreReturnReason,
  SubstitutionStatus,
} from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";

export const SUBSTITUTION_VIEW: Record<SubstitutionStatus, { label: string; tone: BadgeTone }> = {
  with_doctor: { label: "With the doctor", tone: "info" },
  phone_pending: { label: "Agreed by phone, doctor to confirm", tone: "warning" },
  approved: { label: "Doctor approved", tone: "success" },
  declined: { label: "Declined", tone: "neutral" },
  reverted: { label: "Not confirmed in time", tone: "neutral" },
  lapsed: { label: "Not confirmed in time", tone: "neutral" },
};

/** The patient may still answer this substitute. */
export function awaitsPatient(sub: LineSubstitution | null): boolean {
  return (
    sub !== null &&
    sub.patient_consent === null &&
    ["with_doctor", "phone_pending", "approved"].includes(sub.status)
  );
}

/** The patient may cancel: not yet dispensed or sent. */
export function canCancel(order: StoreOrder): boolean {
  return (
    order.status === "awaiting_verification" ||
    (order.status === "released" && order.pharmacy_stage === "ordered")
  );
}

/** The patient may ask to return: dispensed, and no return already open. */
export function canReturn(order: StoreOrder): boolean {
  const dispensed = ["dispensed", "partially_dispensed"].includes(order.pharmacy_stage ?? "");
  const open = ["requested", "acknowledged"].includes(order.return_status ?? "");
  return order.status === "released" && dispensed && !open && order.return_status !== "received";
}

/** Lines that may still be printed for an outside pharmacy. */
export function printableLines(order: StoreOrder): string[] {
  if (order.status !== "awaiting_verification") return [];
  return order.lines.filter((l) => l.status === "pending").map((l) => l.catalog_item_id);
}

export const RETURN_REASONS: { value: StoreReturnReason; label: string }[] = [
  { value: "wrong_item", label: "Wrong medicine" },
  { value: "damaged", label: "Damaged" },
  { value: "short_dated", label: "Expires too soon" },
  { value: "excess", label: "More than I ordered" },
];

const QUARANTINE_REASONS: Record<string, string> = {
  opened: "Opened",
  expired: "Expired",
  below_shelf_life_floor: "Too close to expiry",
  cold_chain: "Cold chain",
  controlled: "Controlled drug",
  untraceable: "Batch unknown",
  outside_window: "After the return window",
};

export function quarantineReasonLabel(reason: string): string {
  return QUARANTINE_REASONS[reason] ?? reason.replace(/_/g, " ");
}

export interface DestroyForm {
  witnessUserId: string | null;
  witnessName: string;
  cbmwtfName: string;
  manifestNumber: string;
}

/** What stops these quarantined packs being destroyed on one certificate. */
export function destroyProblem(rows: QuarantineRow[], form: DestroyForm): string | null {
  if (rows.length === 0) return "Choose what to destroy";
  if (rows.some((r) => r.status !== "quarantined")) return "Some of those are already destroyed";
  const routes = new Set(rows.map((r) => r.route));
  if (routes.size > 1) {
    return "Destroy controlled drugs and other medicines on separate certificates";
  }
  if (!form.witnessName.trim()) return "Name the witness";
  if (routes.has("ndps") && !form.witnessUserId) {
    return "A controlled drug is destroyed before a second person: choose the witness";
  }
  if (routes.has("bmw") && (!form.cbmwtfName.trim() || !form.manifestNumber.trim())) {
    return "Name the biomedical waste facility and its manifest number";
  }
  return null;
}

/** What is wrong with a hold ladder, as the server would say it. */
export function ladderProblem(tiers: HoldTier[]): string | null {
  const last = tiers[tiers.length - 1];
  if (!last || last.max_available !== null) {
    return "End each hold ladder with a step for any amount of stock";
  }
  if (tiers.some((t) => t.minutes < 1 || t.minutes > 7 * 24 * 60)) {
    return "A hold lasts between a minute and a week";
  }
  const limits = tiers.flatMap((t) => (t.max_available === null ? [] : [t.max_available]));
  if (limits.some((l, i) => l < 0 || (i > 0 && l <= (limits[i - 1] ?? -1)))) {
    return "List the stock limits from smallest to largest";
  }
  return null;
}

const PINCODE = /^[1-9][0-9]{5}$/;

/** Pincodes typed as a list: the good ones, de-duplicated, and the bad. */
export function parsePincodes(text: string): { pincodes: string[]; bad: string[] } {
  const parts = text
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const pincodes = [...new Set(parts.filter((p) => PINCODE.test(p)))].sort();
  return { pincodes, bad: parts.filter((p) => !PINCODE.test(p)) };
}

/** An NPPA ceiling sheet (code, ceiling price, notification), header optional. */
export function parseNppaSheet(text: string): { rows: NppaImportRow[]; problems: string[] } {
  const rows: NppaImportRow[] = [];
  const problems: string[] = [];
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const [code = "", price = "", ...note] = line.split(",").map((c) => c.trim());
      if (i === 0 && Number.isNaN(Number(price))) return;
      const value = Number(price);
      if (!code || !Number.isFinite(value) || value <= 0) {
        problems.push(`Line ${i + 1}: needs a code and a ceiling above zero`);
        return;
      }
      const notification = note.join(",").trim();
      rows.push({ code, ceiling_price: price, ...(notification ? { notification } : {}) });
    });
  return { rows, problems };
}
