// The patient record's tabs, and which of them this hospital and user see.

import {
  IconAlertTriangle,
  IconCalendar,
  IconChartLine,
  IconEye,
  IconFile,
  IconFlask,
  IconGitMerge,
  IconLink,
  IconPill,
  IconReceipt,
  IconReportMedical,
  IconStethoscope,
  IconTent,
  IconTimeline,
  IconUser,
  IconVaccine,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { PatientDetailTabValue } from "../patient-detail-workspace";

export interface DetailTab {
  value: PatientDetailTabValue;
  label: string;
  section: string;
  icon: ReactNode;
  /** The brick that owns the tab: switched off, the tab is not shown. */
  brick?: string;
}

const DETAIL_TABS: DetailTab[] = [
  { value: "overview", label: "Overview", section: "Profile", icon: <IconUser size={14} /> },
  {
    value: "allergies",
    label: "Allergies",
    section: "Profile",
    icon: <IconAlertTriangle size={14} />,
  },
  {
    value: "immunizations",
    label: "Immunisations",
    section: "Profile",
    icon: <IconVaccine size={14} />,
  },
  { value: "growth", label: "Growth", section: "Profile", icon: <IconChartLine size={14} /> },
  { value: "timeline", label: "Timeline", section: "Clinical", icon: <IconTimeline size={14} /> },
  { value: "visits", label: "Visits", section: "Clinical", icon: <IconStethoscope size={14} /> },
  {
    value: "prescriptions",
    label: "Prescriptions",
    section: "Clinical",
    icon: <IconPill size={14} />,
    brick: "opd",
  },
  {
    value: "lab",
    label: "Lab Orders",
    section: "Clinical",
    icon: <IconFlask size={14} />,
    brick: "lab",
  },
  {
    value: "imaging",
    label: "Imaging",
    section: "Clinical",
    icon: <IconEye size={14} />,
    brick: "radiology",
  },
  {
    value: "billing",
    label: "Billing",
    section: "Finance",
    icon: <IconReceipt size={14} />,
    brick: "billing",
  },
  {
    value: "appointments",
    label: "Appointments",
    section: "Workflow",
    icon: <IconCalendar size={14} />,
    brick: "opd",
  },
  {
    value: "camps",
    label: "Camps",
    section: "Workflow",
    icon: <IconTent size={14} />,
    brick: "camp",
  },
  { value: "family", label: "Family", section: "Records", icon: <IconLink size={14} /> },
  { value: "documents", label: "Documents", section: "Records", icon: <IconFile size={14} /> },
  {
    value: "chronic",
    label: "Chronic Care",
    section: "Programs",
    icon: <IconReportMedical size={14} />,
    brick: "opd",
  },
  {
    value: "packages",
    label: "Packages",
    section: "Programs",
    icon: <IconReportMedical size={14} />,
    brick: "billing",
  },
  { value: "notes", label: "Notes", section: "Records", icon: <IconReportMedical size={14} /> },
  { value: "merge", label: "Merge", section: "Admin", icon: <IconGitMerge size={14} /> },
];

/** Growth charts run to 18 years. */
export function isChild(dateOfBirth: string | null): boolean {
  if (!dateOfBirth) return false;
  const years = (Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 86_400_000);
  return years <= 18;
}

interface VisibleTabsOptions {
  /** Whether the hospital runs this brick. */
  isBrickOn: (brick?: string) => boolean;
  showGrowth: boolean;
  showNotes: boolean;
}

/**
 * The tabs shown, in order: a tab whose brick is switched off is hidden, not
 * greyed, and Growth and Notes appear only where they apply.
 */
export function visibleDetailTabs({ isBrickOn, showGrowth, showNotes }: VisibleTabsOptions) {
  return DETAIL_TABS.filter(
    (tab) =>
      isBrickOn(tab.brick) &&
      (tab.value !== "growth" || showGrowth) &&
      (tab.value !== "notes" || showNotes),
  );
}
