import type { SoapNoteFormInput } from "@medbrains/schemas";
import { IconBrain, IconClipboardList, IconEye, IconMessage } from "@tabler/icons-react";
import type { ReactNode } from "react";

export type SoapSectionKey = Exclude<keyof SoapNoteFormInput, "notes">;

export interface SoapSection {
  key: SoapSectionKey;
  letter: string;
  labelKey: string;
  fullLabelKey: string;
  color: string;
  icon: ReactNode;
  placeholderKey: string;
  formatHint: string;
  timelineEmpty: string;
}

/** The four parts of a SOAP note, in the order a doctor writes them. */
export const SOAP_SECTIONS: SoapSection[] = [
  {
    key: "chief_complaint",
    letter: "S",
    labelKey: "soap.subjective",
    fullLabelKey: "soap.chiefComplaint",
    color: "blue",
    icon: <IconMessage size={16} />,
    placeholderKey: "soap.placeholderSubjective",
    formatHint:
      "Date, time, provider, chief concern, HPI, ROS, PMH, current medicines, allergies, social and family history.",
    timelineEmpty: "No prior subjective note has been captured.",
  },
  {
    key: "examination",
    letter: "O",
    labelKey: "soap.objective",
    fullLabelKey: "soap.examination",
    color: "teal",
    icon: <IconEye size={16} />,
    placeholderKey: "soap.placeholderObjective",
    formatHint:
      "Vitals, general appearance, system examination, focused findings, reviewed labs and imaging.",
    timelineEmpty: "No prior objective note has been captured.",
  },
  {
    key: "history",
    letter: "A",
    labelKey: "soap.assessment",
    fullLabelKey: "soap.clinicalAssessment",
    color: "violet",
    icon: <IconBrain size={16} />,
    placeholderKey: "soap.placeholderAssessment",
    formatHint: "Clinical impression, problem list, diagnosis, differential, severity and risk.",
    timelineEmpty: "No prior assessment note has been captured.",
  },
  {
    key: "plan",
    letter: "P",
    labelKey: "soap.plan",
    fullLabelKey: "soap.treatmentPlan",
    color: "green",
    icon: <IconClipboardList size={16} />,
    placeholderKey: "soap.placeholderPlan",
    formatHint: "Labs, imaging, medications, patient education, safety advice and follow-up.",
    timelineEmpty: "No prior plan note has been captured.",
  },
];
