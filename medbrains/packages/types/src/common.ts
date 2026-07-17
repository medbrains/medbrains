// Shared scalar/field types used across many domains — kept in one place so domain files can import them without an index.ts cycle.

export type FieldDataType =
  | "text"
  | "email"
  | "phone"
  | "date"
  | "datetime"
  | "time"
  | "select"
  | "multiselect"
  | "checkbox"
  | "radio"
  | "textarea"
  | "number"
  | "decimal"
  | "file"
  | "hidden"
  | "computed"
  | "boolean"
  | "uuid_fk"
  | "json";

export type RequirementLevel = "mandatory" | "conditional" | "recommended" | "optional";

export type FieldAccessLevel = "edit" | "view" | "mask" | "hidden";

export type FormStatus = "draft" | "active" | "deprecated";

export interface FieldValidation {
  min_length?: number;
  max_length?: number;
  min?: number;
  max?: number;
  regex?: string;
  options?: string[];
  fk_table?: string;
  fk_column?: string;
  fk_display?: string;
  custom?: string;
}
