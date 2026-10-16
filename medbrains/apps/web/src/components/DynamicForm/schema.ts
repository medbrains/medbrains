import type { FormAnswers, FormDefinition, FormFieldSpec } from "@medbrains/types";
import { z } from "zod";

/** What the form holds while it is being filled — every key present. */
export type DraftAnswers = Record<string, string | number | boolean | string[] | null>;

const MAX_TEXT = 5000;

function fieldSchema(field: FormFieldSpec): z.ZodType {
  const required = `${field.label} is required`;
  switch (field.kind) {
    case "text":
    case "textarea": {
      const text = z.string().trim().max(MAX_TEXT);
      return field.required ? text.min(1, required) : text;
    }
    case "number":
      return field.required ? z.number({ error: required }) : z.number().nullable();
    case "date":
      return field.required ? z.string().min(1, required) : z.string();
    case "yes_no":
      return field.required ? z.boolean({ error: required }) : z.boolean().nullable();
    case "select":
    case "radio": {
      const choice = z.string().refine((v) => v === "" || field.options.includes(v));
      return field.required ? choice.refine((v) => v !== "", required) : choice;
    }
    case "multiselect": {
      const many = z.array(z.string().refine((v) => field.options.includes(v)));
      return field.required ? many.min(1, required) : many;
    }
  }
}

/** The same rules the server applies, for feedback before saving. */
export function buildAnswersSchema(definition: FormDefinition) {
  const shape: Record<string, z.ZodType> = {};
  for (const section of definition.sections) {
    for (const field of section.fields) shape[field.key] = fieldSchema(field);
  }
  return z.object(shape);
}

function emptyFor(field: FormFieldSpec): DraftAnswers[string] {
  if (field.kind === "multiselect") return [];
  if (field.kind === "number" || field.kind === "yes_no") return null;
  return "";
}

export function emptyAnswers(definition: FormDefinition, given: FormAnswers = {}): DraftAnswers {
  const values: DraftAnswers = {};
  for (const section of definition.sections) {
    for (const field of section.fields) values[field.key] = given[field.key] ?? emptyFor(field);
  }
  return values;
}

/** Blank answers are left out: an unanswered question is not an answer of "". */
export function cleanAnswers(values: DraftAnswers): FormAnswers {
  const clean: FormAnswers = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) continue;
    clean[key] = typeof value === "string" ? value.trim() : value;
  }
  return clean;
}
