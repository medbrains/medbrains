import type { HistoryImportKind, HistoryImportStatus } from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";

export const KIND_LABEL: Record<HistoryImportKind, string> = {
  patient: "Patients",
  visit: "OPD visits",
  admission: "Admissions",
  lab_order: "Lab orders",
  dispense: "Dispenses",
  invoice: "Bills",
  claim: "Claims",
};

export const STATUS: Record<HistoryImportStatus, { label: string; tone: BadgeTone }> = {
  validated: { label: "Checked", tone: "info" },
  refused: { label: "Refused", tone: "danger" },
  committed: { label: "Imported", tone: "success" },
};
