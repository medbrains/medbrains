// Pure helpers for the scanned-bill review screen (#4861). Kept free of React
// so the rules the reviewer depends on are tested on their own.

import type { GrnScanDraftFormInput, GrnScanLineFormInput } from "@medbrains/schemas";
import type {
  GrnIssue,
  GrnItemSuggestion,
  GrnScanDraft,
  GrnScanDraftLine,
  SupplierScanAccuracy,
} from "@medbrains/types";

/** Draft-line fields the reviewer edits on screen. */
export const EDITABLE_LINE_FIELDS = [
  "product_name",
  "catalog_item_id",
  "batch_number",
  "expiry_date",
  "manufacture_date",
  "hsn_code",
  "mrp",
  "rate",
  "gst_rate",
  "discount_amount",
  "quantity",
  "free_quantity",
  "quantity_rejected",
] as const;

type EditableField = (typeof EDITABLE_LINE_FIELDS)[number];

/** The GRN line names the server uses, as the draft names them. */
const SERVER_FIELD_ALIASES: Record<string, EditableField> = {
  unit_price: "rate",
  quantity_accepted: "quantity",
  quantity_received: "quantity",
};

export interface LineMessage {
  line: number;
  field: string;
  message: string;
  severity: "block" | "warn";
}

const LINE_PATH = /^(?:items|lines)\[(\d+)\]\.(\w+)$/;

/** Split a server field path into (line, field), or null for a header path. */
export function parseLinePath(path: string): { line: number; field: string } | null {
  const match = LINE_PATH.exec(path);
  if (!match?.[1] || !match[2]) return null;
  return { line: Number(match[1]), field: SERVER_FIELD_ALIASES[match[2]] ?? match[2] };
}

/** Validator findings keyed `${line}.${field}`; header findings under `header`. */
export function groupIssues(issues: GrnIssue[]): Map<string, LineMessage[]> {
  const out = new Map<string, LineMessage[]>();
  for (const issue of issues) {
    const at = parseLinePath(issue.field);
    const key = at ? `${at.line}.${at.field}` : "header";
    const list = out.get(key) ?? [];
    list.push({
      line: at?.line ?? -1,
      field: at?.field ?? issue.field,
      message: issue.message,
      severity: issue.severity,
    });
    out.set(key, list);
  }
  return out;
}

/** A field the reader was unsure of, or could not read at all. */
export function needsCheck(
  confidence: Record<string, number>,
  path: string,
  threshold: number,
): boolean {
  const value = confidence[path];
  return value !== undefined && value < threshold;
}

export function confidenceLabel(confidence: Record<string, number>, path: string): string | null {
  const value = confidence[path];
  if (value === undefined) return null;
  return value === 0
    ? "Could not be read — enter it"
    : `Read at ${Math.round(value * 100)}% — check`;
}

/** Suggestions for one line, best first. */
export function suggestionsFor(all: GrnItemSuggestion[], line: number): GrnItemSuggestion[] {
  return all.filter((s) => s.line === line).sort((a, b) => b.score - a.score);
}

const text = (value: string | number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

function lineToForm(line: GrnScanDraftLine, index: number): GrnScanLineFormInput {
  return {
    source_index: index,
    product_name: text(line.product_name),
    catalog_item_id: text(line.catalog_item_id),
    batch_number: text(line.batch_number),
    expiry_date: text(line.expiry_date),
    manufacture_date: text(line.manufacture_date),
    hsn_code: text(line.hsn_code),
    mrp: text(line.mrp),
    rate: text(line.rate),
    gst_rate: text(line.gst_rate),
    discount_amount: text(line.discount_amount),
    quantity: text(line.quantity),
    free_quantity: text(line.free_quantity),
    quantity_rejected: text(line.quantity_rejected),
  };
}

export function toForm(draft: GrnScanDraft): GrnScanDraftFormInput {
  const h = draft.header;
  return {
    vendor_id: text(h.vendor_id),
    po_id: text(h.po_id),
    store_location_id: text(h.store_location_id),
    invoice_number: text(h.invoice_number),
    invoice_date: text(h.invoice_date),
    invoice_amount: text(h.invoice_amount),
    remember_matches: true,
    lines: draft.lines.map(lineToForm),
  };
}

const orNull = (value: string | number) => {
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
};
const intOrNull = (value: string | number) => {
  const v = orNull(value);
  return v === null ? null : Number.parseInt(v, 10);
};

const EMPTY_LINE: GrnScanDraftLine = {
  product_name: null,
  supplier_code: null,
  pack: null,
  strength: null,
  dosage_form: null,
  manufacturer: null,
  inn_name: null,
  hsn_code: null,
  batch_number: null,
  expiry_date: null,
  manufacture_date: null,
  mrp: null,
  ptr: null,
  rate: null,
  quantity: null,
  free_quantity: null,
  discount_amount: null,
  gst_rate: null,
  quantity_rejected: null,
  catalog_item_id: null,
  suggested_item_id: null,
  po_item_id: null,
};

/** The edited form laid back over the stored draft: fields the screen does
 * not edit (pack, strength, the system's suggestion) are kept as they were. */
export function fromForm(form: GrnScanDraftFormInput, original: GrnScanDraft): GrnScanDraft {
  return {
    header: {
      ...original.header,
      vendor_id: orNull(form.vendor_id),
      po_id: orNull(form.po_id),
      store_location_id: orNull(form.store_location_id),
      invoice_number: orNull(form.invoice_number),
      invoice_date: orNull(form.invoice_date),
      invoice_amount: orNull(form.invoice_amount),
    },
    lines: form.lines.map((line) => ({
      ...(original.lines[line.source_index] ?? EMPTY_LINE),
      product_name: orNull(line.product_name),
      catalog_item_id: orNull(line.catalog_item_id),
      batch_number: orNull(line.batch_number),
      expiry_date: orNull(line.expiry_date),
      manufacture_date: orNull(line.manufacture_date),
      hsn_code: orNull(line.hsn_code),
      mrp: orNull(line.mrp),
      rate: orNull(line.rate),
      gst_rate: orNull(line.gst_rate),
      discount_amount: orNull(line.discount_amount),
      quantity: intOrNull(line.quantity),
      free_quantity: intOrNull(line.free_quantity),
      quantity_rejected: intOrNull(line.quantity_rejected),
    })),
    confidence: original.confidence,
  };
}

/** SHA-256 of the file, hex — the server refuses the same file twice. */
export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Per-supplier accuracy as percentages; null where there is nothing to measure. */
export function accuracyOf(row: SupplierScanAccuracy): {
  fields: number | null;
  matches: number | null;
} {
  const remembered = row.lines_auto_matched + row.lines_rematched;
  return {
    fields:
      row.fields_total > 0
        ? Math.round(((row.fields_total - row.fields_corrected) / row.fields_total) * 100)
        : null,
    matches: remembered > 0 ? Math.round((row.lines_auto_matched / remembered) * 100) : null,
  };
}
