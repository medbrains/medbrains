import {
  formNumberValue,
  integerFromFormValue,
  optionalTextFromFormValue,
} from "@medbrains/schemas";
import type { ApproveRejectRequest, RetrospectiveSettings } from "@medbrains/types";
import { z } from "zod";

const backdateHours = formNumberValue.refine((value) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 720;
}, "Backdate window must be between 1 and 720 hours");

export const retrospectiveReviewFormSchema = z.object({
  review_notes: z.string().max(1000, "Review notes are too long"),
});

export const retrospectiveSettingsFormSchema = z.object({
  max_backdate_hours: backdateHours,
  requires_approval: z.boolean(),
});

export type RetrospectiveReviewFormInput = z.infer<typeof retrospectiveReviewFormSchema>;
export type RetrospectiveSettingsFormInput = z.infer<typeof retrospectiveSettingsFormSchema>;

export const DEFAULT_RETROSPECTIVE_REVIEW_FORM_VALUES: RetrospectiveReviewFormInput = {
  review_notes: "",
};

export const DEFAULT_RETROSPECTIVE_SETTINGS_FORM_VALUES: RetrospectiveSettingsFormInput = {
  max_backdate_hours: 72,
  requires_approval: true,
};

export function toRetrospectiveReviewRequest(
  values: RetrospectiveReviewFormInput,
): ApproveRejectRequest {
  return {
    review_notes: optionalTextFromFormValue(values.review_notes),
  };
}

export function toRetrospectiveSettingsFormValues(
  settings: RetrospectiveSettings | undefined,
): RetrospectiveSettingsFormInput {
  if (!settings) return DEFAULT_RETROSPECTIVE_SETTINGS_FORM_VALUES;
  return {
    max_backdate_hours: settings.max_backdate_hours,
    requires_approval: settings.requires_approval,
  };
}

export function toRetrospectiveSettingsRequest(
  values: RetrospectiveSettingsFormInput,
): Partial<RetrospectiveSettings> {
  return {
    max_backdate_hours: integerFromFormValue(values.max_backdate_hours, 72),
    requires_approval: values.requires_approval,
  };
}
