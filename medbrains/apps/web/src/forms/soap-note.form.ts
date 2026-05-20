import type { SoapNoteFormInput } from "@medbrains/schemas";
import type { Consultation, CreateConsultationRequest } from "@medbrains/types";

export const DEFAULT_SOAP_NOTE_FORM_VALUES: SoapNoteFormInput = {
  chief_complaint: "",
  examination: "",
  history: "",
  plan: "",
  notes: "",
};

const SOAP_COMBINED_SECTIONS: Array<{
  key: keyof SoapNoteFormInput;
  label: string;
}> = [
  { key: "chief_complaint", label: "S" },
  { key: "examination", label: "O" },
  { key: "history", label: "A" },
  { key: "plan", label: "P" },
];

function textValue(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function soapNoteDefaultsFromConsultation(
  consultation?: Partial<Consultation>,
): SoapNoteFormInput {
  return {
    ...DEFAULT_SOAP_NOTE_FORM_VALUES,
    chief_complaint: textValue(consultation?.chief_complaint),
    examination: textValue(consultation?.examination),
    history: textValue(consultation?.history),
    plan: textValue(consultation?.plan),
    notes: textValue(consultation?.notes),
  };
}

export function buildCombinedSoapNote(values: SoapNoteFormInput): string {
  return SOAP_COMBINED_SECTIONS.map((section) => {
    const value = values[section.key].trim();
    return value.length > 0 ? `${section.label}: ${value}` : null;
  })
    .filter((line): line is string => Boolean(line))
    .join("\n\n");
}

export function toSoapNoteRequest(values: SoapNoteFormInput): CreateConsultationRequest {
  const payload: CreateConsultationRequest = {};
  const chiefComplaint = values.chief_complaint.trim();
  const examination = values.examination.trim();
  const history = values.history.trim();
  const plan = values.plan.trim();
  const notes = values.notes.trim();

  if (chiefComplaint.length > 0) payload.chief_complaint = chiefComplaint;
  if (examination.length > 0) payload.examination = examination;
  if (history.length > 0) payload.history = history;
  if (plan.length > 0) payload.plan = plan;
  if (notes.length > 0) payload.notes = notes;

  return payload;
}
