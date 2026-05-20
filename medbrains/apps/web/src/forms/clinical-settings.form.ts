import type {
  ClinicalProtocolCategoryFormValue,
  ClinicalProtocolFormInput,
  CriticalValueRuleFormInput,
  DrugInteractionFormInput,
  DrugInteractionSeverityFormValue,
} from "@medbrains/schemas";
import {
  clinicalProtocolCategoryValues,
  optionalNumberFromFormValue,
  optionalTextFromFormValue,
} from "@medbrains/schemas";
import type {
  CreateClinicalProtocolRequest,
  CreateCriticalValueRuleRequest,
  CreateDrugInteractionRequest,
} from "@medbrains/types";

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

export const DEFAULT_CRITICAL_VALUE_RULE_FORM_VALUES: CriticalValueRuleFormInput = {
  test_code: "",
  test_name: "",
  low_critical: "",
  high_critical: "",
  unit: "",
  gender: null,
  alert_message: "",
};

export const DEFAULT_DRUG_INTERACTION_FORM_VALUES: DrugInteractionFormInput = {
  drug_a_name: "",
  drug_b_name: "",
  severity: "moderate",
  description: "",
  mechanism: "",
  management: "",
};

export const DEFAULT_CLINICAL_PROTOCOL_FORM_VALUES: ClinicalProtocolFormInput = {
  name: "",
  code: "",
  category: "other",
  description: "",
};

const clinicalProtocolCategoryLabels: Record<ClinicalProtocolCategoryFormValue, string> = {
  sepsis: "Sepsis Bundle",
  dvt_prophylaxis: "DVT Prophylaxis",
  diabetes: "Diabetes Management",
  hypertension: "Hypertension",
  cardiac: "Cardiac",
  respiratory: "Respiratory",
  renal: "Renal",
  infection: "Infection Control",
  surgical: "Surgical",
  other: "Other",
};

export const CLINICAL_PROTOCOL_CATEGORY_OPTIONS: Array<
  SelectOption<ClinicalProtocolCategoryFormValue>
> = clinicalProtocolCategoryValues.map((value) => ({
  value,
  label: clinicalProtocolCategoryLabels[value],
}));

export const DRUG_INTERACTION_SEVERITY_OPTIONS: Array<
  SelectOption<DrugInteractionSeverityFormValue>
> = [
  { value: "minor", label: "Minor" },
  { value: "moderate", label: "Moderate" },
  { value: "major", label: "Major" },
  { value: "contraindicated", label: "Contraindicated" },
];

export const CRITICAL_VALUE_GENDER_OPTIONS: Array<SelectOption<"male" | "female">> = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

export function toCreateCriticalValueRuleRequest(
  values: CriticalValueRuleFormInput,
): CreateCriticalValueRuleRequest {
  return {
    test_code: values.test_code.trim(),
    test_name: values.test_name.trim(),
    low_critical: optionalNumberFromFormValue(values.low_critical),
    high_critical: optionalNumberFromFormValue(values.high_critical),
    unit: optionalTextFromFormValue(values.unit),
    gender: values.gender ?? undefined,
    alert_message: values.alert_message.trim(),
  };
}

export function toCreateDrugInteractionRequest(
  values: DrugInteractionFormInput,
): CreateDrugInteractionRequest {
  return {
    drug_a_name: values.drug_a_name.trim(),
    drug_b_name: values.drug_b_name.trim(),
    severity: values.severity,
    description: values.description.trim(),
    mechanism: optionalTextFromFormValue(values.mechanism),
    management: optionalTextFromFormValue(values.management),
  };
}

export function toCreateClinicalProtocolRequest(
  values: ClinicalProtocolFormInput,
): CreateClinicalProtocolRequest {
  return {
    name: values.name.trim(),
    code: optionalTextFromFormValue(values.code),
    category: values.category,
    description: optionalTextFromFormValue(values.description),
  };
}
