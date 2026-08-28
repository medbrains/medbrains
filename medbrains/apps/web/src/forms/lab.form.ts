import type {
  LabB2bClientTypeFormValue,
  LabBethesdaCategoryFormValue,
  LabCollectionCenterTypeFormValue,
  LabContainerFormValue,
  LabEqasEvaluationFormValue,
  LabMethodFormValue,
  LabMolecularResultInterpretationFormValue,
  LabMolecularTestMethodFormValue,
  LabNablDocumentTypeFormValue,
  LabSampleTypeFormValue,
} from "@medbrains/schemas";
import {
  labB2bClientTypeValues,
  labBethesdaCategoryValues,
  labCollectionCenterTypeValues,
  labContainerValues,
  labEqasEvaluationValues,
  labMethodValues,
  labMolecularResultInterpretationValues,
  labMolecularTestMethodValues,
  labNablDocumentTypeValues,
  labSampleTypeValues,
  numberFromFormValue,
  optionalIntegerFromFormValue,
  optionalNumberFromFormValue,
  optionalTextFromFormValue,
} from "@medbrains/schemas";

// Named by colour as well as additive: the colour is what a phlebotomist
// reaches for at the trolley, and the additive is what the assay needs.
const containerLabels: Record<LabContainerFormValue, string> = {
  edta_lavender: "Lavender — K2/K3 EDTA",
  plain_red: "Red — plain, no additive",
  sst_gel_yellow: "Yellow — SST, clot activator + gel",
  fluoride_grey: "Grey — sodium fluoride / potassium oxalate",
  citrate_blue: "Blue — 3.2% sodium citrate (9:1 fill)",
  heparin_green: "Green — lithium/sodium heparin",
  sterile_container: "Sterile universal container",
  blood_culture_bottle: "Blood culture bottle",
  other: "Other",
};

const sampleTypeLabels: Record<LabSampleTypeFormValue, string> = {
  blood: "Blood",
  serum: "Serum",
  plasma: "Plasma",
  urine: "Urine",
  stool: "Stool",
  swab: "Swab",
  csf: "CSF (Cerebrospinal Fluid)",
  sputum: "Sputum",
  tissue: "Tissue",
  aspirate: "Aspirate",
  other: "Other",
};

const labMethodLabels: Record<LabMethodFormValue, string> = {
  photometry: "Photometry",
  elisa: "ELISA",
  pcr: "PCR",
  rt_pcr: "RT-PCR",
  chromatography: "Chromatography",
  immunoassay: "Immunoassay",
  spectrophotometry: "Spectrophotometry",
  electrophoresis: "Electrophoresis",
  microscopy: "Microscopy",
  culture: "Culture",
  flow_cytometry: "Flow Cytometry",
  sequencing: "Sequencing",
  other: "Other",
};

const collectionCenterTypeLabels: Record<LabCollectionCenterTypeFormValue, string> = {
  hospital: "Hospital",
  satellite: "Satellite",
  partner: "Partner",
  camp: "Camp",
};

const eqasEvaluationLabels: Record<LabEqasEvaluationFormValue, string> = {
  acceptable: "Acceptable",
  marginal: "Marginal",
  unacceptable: "Unacceptable",
  pending: "Pending",
};

const nablDocumentTypeLabels: Record<LabNablDocumentTypeFormValue, string> = {
  sop: "SOP",
  manual: "Manual",
  form: "Form",
  policy: "Policy",
  work_instruction: "Work Instruction",
  record: "Record",
  other: "Other",
};

const bethesdaCategoryLabels: Record<LabBethesdaCategoryFormValue, string> = {
  NILM: "NILM",
  "ASC-US": "ASC-US",
  "ASC-H": "ASC-H",
  LSIL: "LSIL",
  HSIL: "HSIL",
  SCC: "SCC",
  AGC: "AGC",
  AIS: "AIS",
};

const molecularTestMethodLabels: Record<LabMolecularTestMethodFormValue, string> = {
  rt_pcr: "RT-PCR",
  pcr: "PCR",
  sequencing: "Sequencing (NGS)",
  microarray: "Microarray",
  fish: "FISH",
  western_blot: "Western Blot",
  southern_blot: "Southern Blot",
  other: "Other",
};

const molecularResultInterpretationLabels: Record<
  LabMolecularResultInterpretationFormValue,
  string
> = {
  positive: "Positive",
  negative: "Negative",
  indeterminate: "Indeterminate",
  invalid: "Invalid",
  detected: "Detected",
  not_detected: "Not Detected",
};

const b2bClientTypeLabels: Record<LabB2bClientTypeFormValue, string> = {
  clinic: "Clinic",
  laboratory: "Laboratory",
  hospital: "Hospital",
  pharmacy: "Pharmacy",
  diagnostic_center: "Diagnostic Center",
  other: "Other",
};

export const labContainerOptions = labContainerValues.map((value) => ({
  value,
  label: containerLabels[value],
}));

export const labSampleTypeOptions = labSampleTypeValues.map((value) => ({
  value,
  label: sampleTypeLabels[value],
}));

export const labMethodOptions = labMethodValues.map((value) => ({
  value,
  label: labMethodLabels[value],
}));

export const labCollectionCenterTypeOptions = labCollectionCenterTypeValues.map((value) => ({
  value,
  label: collectionCenterTypeLabels[value],
}));

export const labEqasEvaluationOptions = labEqasEvaluationValues.map((value) => ({
  value,
  label: eqasEvaluationLabels[value],
}));

export const labNablDocumentTypeOptions = labNablDocumentTypeValues.map((value) => ({
  value,
  label: nablDocumentTypeLabels[value],
}));

export const labBethesdaCategoryOptions = labBethesdaCategoryValues.map((value) => ({
  value,
  label: bethesdaCategoryLabels[value],
}));

export const labMolecularTestMethodOptions = labMolecularTestMethodValues.map((value) => ({
  value,
  label: molecularTestMethodLabels[value],
}));

export const labMolecularResultInterpretationOptions = labMolecularResultInterpretationValues.map(
  (value) => ({
    value,
    label: molecularResultInterpretationLabels[value],
  }),
);

export const labB2bClientTypeOptions = labB2bClientTypeValues.map((value) => ({
  value,
  label: b2bClientTypeLabels[value],
}));

export function labNumberOrFallback(value: number | string, fallback: number): number {
  return numberFromFormValue(value, fallback);
}

export function labOptionalNumber(value: number | string): number | undefined {
  return optionalNumberFromFormValue(value);
}

export function labOptionalInteger(value: number | string): number | undefined {
  return optionalIntegerFromFormValue(value);
}

export function labOptionalText(value: string): string | undefined {
  return optionalTextFromFormValue(value);
}
