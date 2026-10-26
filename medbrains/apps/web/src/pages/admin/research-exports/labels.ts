import type { ResearchDataset, ResearchExportStatus } from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";

export const DATASET_LABEL: Record<ResearchDataset, string> = {
  visits: "Visits",
  diagnoses: "Diagnoses",
  admissions: "Admissions",
  labs: "Lab results",
  medicines: "Medicines dispensed",
  vitals: "Vitals (banded)",
};

export const STATUS: Record<ResearchExportStatus, { label: string; tone: BadgeTone }> = {
  requested: { label: "Waiting for approval", tone: "warning" },
  rejected: { label: "Rejected", tone: "danger" },
  ready: { label: "Ready", tone: "success" },
  expired: { label: "Expired", tone: "neutral" },
  failed: { label: "Could not build", tone: "danger" },
};
