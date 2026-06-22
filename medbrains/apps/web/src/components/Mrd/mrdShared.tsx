import type { MrdCaseSheetFileFormInput, MrdCaseSheetReprintFormInput } from "@medbrains/schemas";
import type {
  MrdCaseSheetCompletenessResponse,
  MrdCaseSheetPacket,
  MrdCaseSheetPacketStatus,
  MrdCaseSheetPage,
} from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";
import type { PrintCopyRoute } from "@/utils/printCopies";

// ── Helpers ──────────────────────────────────────────────

export const STATUS_COLORS: Record<string, BadgeTone> = {
  active: "success",
  archived: "primary",
  destroyed: "neutral",
  missing: "danger",
  draft: "neutral",
  generated: "primary",
  printed: "warning",
  filed: "success",
  deficient: "danger",
  voided: "neutral",
  available: "success",
  pending: "warning",
  waived: "neutral",
  issued: "warning",
  returned: "success",
  overdue: "danger",
};

export const CASE_SHEET_STATUS_OPTIONS: { value: MrdCaseSheetPacketStatus | ""; label: string }[] =
  [
    { value: "", label: "All case sheets" },
    { value: "generated", label: "Generated" },
    { value: "printed", label: "Printed" },
    { value: "filed", label: "Filed" },
    { value: "deficient", label: "Deficient" },
    { value: "issued", label: "Issued" },
    { value: "returned", label: "Returned" },
    { value: "voided", label: "Voided" },
  ];

export type MrdPrintAction = "print" | "reprint";

export interface MrdCaseSheetPrintPreview {
  action: MrdPrintAction;
  completeness: MrdCaseSheetCompletenessResponse | null;
  copies: readonly PrintCopyRoute[];
  packet: MrdCaseSheetPacket;
  pages: MrdCaseSheetPage[];
  reprintReason?: string;
}

export const MRD_FILE_FORM_DEFAULTS: MrdCaseSheetFileFormInput = {
  storage_location_id: "",
  notes: "",
};

export const MRD_REPRINT_FORM_DEFAULTS: MrdCaseSheetReprintFormInput = {
  reprint_reason: "",
};

export function toCaseSheetStatus(value: string | null): MrdCaseSheetPacketStatus | null {
  switch (value) {
    case "draft":
    case "generated":
    case "printed":
    case "filed":
    case "issued":
    case "returned":
    case "deficient":
    case "voided":
      return value;
    default:
      return null;
  }
}

export function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

/** Generate shelf/rack options: shelves A-F, racks 1-10 */
export const MRD_SHELF_OPTIONS = (() => {
  const options: { value: string; label: string }[] = [];
  for (const shelf of ["A", "B", "C", "D", "E", "F"]) {
    for (let rack = 1; rack <= 10; rack++) {
      const code = `${shelf}-${rack}`;
      options.push({ value: code, label: `Shelf ${shelf}, Rack ${rack}` });
    }
  }
  return options;
})();

export const FILING_METHOD_OPTIONS = [
  { value: "alphabetical", label: "Alphabetical (by patient name)" },
  { value: "terminal_digit", label: "Terminal Digit (last 2 digits of UHID)" },
  { value: "yearly", label: "Yearly (by year of first visit)" },
];
