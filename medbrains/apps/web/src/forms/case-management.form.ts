import type {
  CaseMgmtPriorityFormValue,
  CaseMgmtStatusFormValue,
  CaseReferralStatusFormValue,
  CaseReferralTypeFormValue,
  DischargeBarrierTypeFormValue,
} from "@medbrains/schemas";
import {
  caseMgmtPriorityFormSchema,
  caseMgmtPriorityValues,
  caseMgmtStatusFormSchema,
  caseMgmtStatusValues,
  caseReferralStatusFormSchema,
  caseReferralStatusValues,
  caseReferralTypeValues,
  dischargeBarrierTypeValues,
  optionalTextFromFormValue,
} from "@medbrains/schemas";
import { z } from "zod";

const priorityLabels: Record<CaseMgmtPriorityFormValue, string> = {
  routine: "Routine",
  urgent: "Urgent",
  complex: "Complex",
};

const statusLabels: Record<CaseMgmtStatusFormValue, string> = {
  assigned: "Assigned",
  active: "Active",
  pending_discharge: "Pending Discharge",
  discharged: "Discharged",
  closed: "Closed",
};

const barrierTypeLabels: Record<DischargeBarrierTypeFormValue, string> = {
  insurance_auth: "Insurance Auth",
  placement: "Placement",
  equipment: "Equipment",
  family: "Family",
  transport: "Transport",
  financial: "Financial",
  clinical: "Clinical",
  documentation: "Documentation",
  other: "Other",
};

const referralTypeLabels: Record<CaseReferralTypeFormValue, string> = {
  post_acute: "Post Acute",
  rehab: "Rehab",
  home_health: "Home Health",
  social_work: "Social Work",
  hospice: "Hospice",
  snf: "SNF",
  other: "Other",
};

const referralStatusLabels: Record<CaseReferralStatusFormValue, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const casePriorityOptions = caseMgmtPriorityValues.map((value) => ({
  value,
  label: priorityLabels[value],
}));

export const caseStatusOptions = caseMgmtStatusValues.map((value) => ({
  value,
  label: statusLabels[value],
}));

export const dischargeBarrierTypeOptions = dischargeBarrierTypeValues.map((value) => ({
  value,
  label: barrierTypeLabels[value],
}));

export const caseReferralTypeOptions = caseReferralTypeValues.map((value) => ({
  value,
  label: referralTypeLabels[value],
}));

export const caseReferralStatusOptions = caseReferralStatusValues.map((value) => ({
  value,
  label: referralStatusLabels[value],
}));

export function caseOptionalText(value: string): string | undefined {
  return optionalTextFromFormValue(value);
}

export function toCasePriorityFormValue(value: string | null | undefined) {
  return caseMgmtPriorityFormSchema
    .or(z.literal(""))
    .catch("")
    .parse(value ?? "");
}

export function toCaseStatusFormValue(value: string | null | undefined) {
  return caseMgmtStatusFormSchema
    .or(z.literal(""))
    .catch("")
    .parse(value ?? "");
}

export function toCaseReferralStatusFormValue(value: string | null | undefined) {
  return caseReferralStatusFormSchema
    .or(z.literal(""))
    .catch("")
    .parse(value ?? "");
}
