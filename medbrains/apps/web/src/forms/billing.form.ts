import type {
  BillingAdvancePurposeFormValue,
  BillingChargeSourceFormValue,
  BillingCreditPatientStatusFormValue,
  BillingDiscountTypeFormValue,
  BillingErpExportTypeFormValue,
  BillingErpTargetSystemFormValue,
  BillingGstCategoryFormValue,
  BillingGstrReturnTypeFormValue,
  BillingInsuranceClaimTypeFormValue,
  BillingInsuranceSchemeTypeFormValue,
  BillingPaymentModeFormValue,
  BillingServiceCategoryFormValue,
  BillingTdsQuarterFormValue,
  BillingTdsSectionFormValue,
} from "@medbrains/schemas";
import {
  billingAdvancePurposeValues,
  billingChargeSourceValues,
  billingCreditPatientStatusValues,
  billingDiscountTypeValues,
  billingErpExportTypeValues,
  billingErpTargetSystemValues,
  billingGstCategoryValues,
  billingGstrReturnTypeValues,
  billingInsuranceClaimTypeValues,
  billingInsuranceSchemeTypeValues,
  billingPaymentModeValues,
  billingServiceCategoryValues,
  billingTdsQuarterValues,
  billingTdsSectionValues,
  integerFromFormValue,
  numberFromFormValue,
  optionalIntegerFromFormValue,
  optionalNumberFromFormValue,
  optionalTextFromFormValue,
} from "@medbrains/schemas";

const chargeSourceLabels: Record<BillingChargeSourceFormValue, string> = {
  opd: "OPD",
  ipd: "IPD",
  lab: "Lab",
  pharmacy: "Pharmacy",
  radiology: "Radiology",
  procedure: "Procedure",
  ot: "OT",
  emergency: "Emergency",
  diet: "Diet",
  cssd: "CSSD",
  ambulance: "Ambulance",
  manual: "Manual",
};

const paymentModeLabels: Record<BillingPaymentModeFormValue, string> = {
  cash: "Cash",
  card: "Card",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  insurance: "Insurance",
  credit: "Credit",
};

const discountTypeLabels: Record<BillingDiscountTypeFormValue, string> = {
  percentage: "Percentage",
  fixed: "Fixed Amount",
  concession: "Concession",
};

const serviceCategoryLabels: Record<BillingServiceCategoryFormValue, string> = {
  consultation: "Consultation",
  procedure: "Procedure",
  laboratory: "Laboratory",
  radiology: "Radiology",
  pharmacy: "Pharmacy",
  nursing: "Nursing Services",
  room_rent: "Room Rent",
  ot: "Operation Theatre",
  icu: "ICU Charges",
  physiotherapy: "Physiotherapy",
  ambulance: "Ambulance",
  consumables: "Consumables",
  equipment: "Equipment",
  miscellaneous: "Miscellaneous",
};

const gstCategoryLabels: Record<BillingGstCategoryFormValue, string> = {
  healthcare: "Healthcare (Exempt)",
  pharmacy: "Pharmacy (Taxable)",
  room_rent: "Room Rent",
  consumable: "Consumable",
  equipment: "Equipment",
};

const advancePurposeLabels: Record<BillingAdvancePurposeFormValue, string> = {
  general: "General",
  admission: "Admission Deposit",
  prepaid: "Prepaid",
  procedure: "Procedure",
};

const insuranceClaimTypeLabels: Record<BillingInsuranceClaimTypeFormValue, string> = {
  cashless: "Cashless",
  reimbursement: "Reimbursement",
};

const insuranceSchemeTypeLabels: Record<BillingInsuranceSchemeTypeFormValue, string> = {
  private: "Private Insurance",
  tpa: "TPA (Third Party Administrator)",
  cghs: "CGHS (Central Government Health Scheme)",
  echs: "ECHS (Ex-Servicemen Health Scheme)",
  pmjay: "PM-JAY (Ayushman Bharat)",
  esis: "ESIS",
  esic: "ESIC (Employee State Insurance)",
  ayushman_bharat: "Ayushman Bharat (PMJAY)",
  state_scheme: "State Government Scheme",
  corporate: "Corporate Insurance",
  cashless: "Cashless",
  reimbursement: "Reimbursement",
  other: "Other",
};

const creditPatientStatusLabels: Record<BillingCreditPatientStatusFormValue, string> = {
  active: "Active",
  overdue: "Overdue",
  suspended: "Suspended",
  closed: "Closed",
};

const tdsSectionLabels: Record<BillingTdsSectionFormValue, string> = {
  "194J": "194J",
  "194C": "194C",
  "194H": "194H",
  "194I": "194I",
  "194A": "194A",
  "194Q": "194Q",
};

const tdsQuarterLabels: Record<BillingTdsQuarterFormValue, string> = {
  Q1: "Q1",
  Q2: "Q2",
  Q3: "Q3",
  Q4: "Q4",
};

const gstrReturnTypeLabels: Record<BillingGstrReturnTypeFormValue, string> = {
  "GSTR-1": "GSTR-1",
  "GSTR-2B": "GSTR-2B",
  "GSTR-3B": "GSTR-3B",
};

const erpTargetSystemLabels: Record<BillingErpTargetSystemFormValue, string> = {
  tally: "Tally ERP",
  sap: "SAP",
  odoo: "Odoo",
  zoho: "Zoho Books",
};

const erpExportTypeLabels: Record<BillingErpExportTypeFormValue, string> = {
  invoices: "Invoices",
  payments: "Payments",
  journal_entries: "Journal Entries",
  all: "All Financial Data",
};

export const billingChargeSourceOptions = billingChargeSourceValues.map((value) => ({
  value,
  label: chargeSourceLabels[value],
}));

export const billingPaymentModeOptions = billingPaymentModeValues.map((value) => ({
  value,
  label: paymentModeLabels[value],
}));

export const billingDiscountTypeOptions = billingDiscountTypeValues.map((value) => ({
  value,
  label: discountTypeLabels[value],
}));

export const billingServiceCategoryOptions = billingServiceCategoryValues.map((value) => ({
  value,
  label: serviceCategoryLabels[value],
}));

export const billingGstCategoryOptions = billingGstCategoryValues.map((value) => ({
  value,
  label: gstCategoryLabels[value],
}));

export const billingAdvancePurposeOptions = billingAdvancePurposeValues.map((value) => ({
  value,
  label: advancePurposeLabels[value],
}));

export const billingInsuranceClaimTypeOptions = billingInsuranceClaimTypeValues.map((value) => ({
  value,
  label: insuranceClaimTypeLabels[value],
}));

export const billingInsuranceSchemeTypeOptions = billingInsuranceSchemeTypeValues.map((value) => ({
  value,
  label: insuranceSchemeTypeLabels[value],
}));

export const billingCreditPatientStatusOptions = billingCreditPatientStatusValues.map((value) => ({
  value,
  label: creditPatientStatusLabels[value],
}));

export const billingTdsSectionOptions = billingTdsSectionValues.map((value) => ({
  value,
  label: tdsSectionLabels[value],
}));

export const billingTdsQuarterOptions = billingTdsQuarterValues.map((value) => ({
  value,
  label: tdsQuarterLabels[value],
}));

export const billingGstrReturnTypeOptions = billingGstrReturnTypeValues.map((value) => ({
  value,
  label: gstrReturnTypeLabels[value],
}));

export const billingErpTargetSystemOptions = billingErpTargetSystemValues.map((value) => ({
  value,
  label: erpTargetSystemLabels[value],
}));

export const billingErpExportTypeOptions = billingErpExportTypeValues.map((value) => ({
  value,
  label: erpExportTypeLabels[value],
}));

export function billingNumberOrFallback(value: number | string, fallback: number): number {
  return numberFromFormValue(value, fallback);
}

export function billingIntegerOrFallback(value: number | string, fallback: number): number {
  return integerFromFormValue(value, fallback);
}

export function billingOptionalNumber(value: number | string): number | undefined {
  return optionalNumberFromFormValue(value);
}

export function billingOptionalInteger(value: number | string): number | undefined {
  return optionalIntegerFromFormValue(value);
}

export function billingOptionalText(value: string): string | undefined {
  return optionalTextFromFormValue(value);
}
