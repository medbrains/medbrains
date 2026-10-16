// Hospital-built forms (#220) — mirrors medbrains_core::form_template.

export type FormFieldKind =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "yes_no"
  | "select"
  | "radio"
  | "multiselect";

export interface FormFieldSpec {
  key: string;
  label: string;
  kind: FormFieldKind;
  required: boolean;
  options: string[];
  help?: string | null;
}

export interface FormSectionSpec {
  title: string;
  fields: FormFieldSpec[];
}

export interface FormDefinition {
  sections: FormSectionSpec[];
}

export type FormAnswers = Record<string, string | number | boolean | string[]>;

export interface FormTemplate {
  id: string;
  code: string;
  name: string;
  module: string;
  draft: FormDefinition;
  published_version: number | null;
  status: "draft" | "published" | "retired";
  created_at: string;
  updated_at: string;
}

export interface FormTemplateListItem {
  id: string | null;
  code: string;
  name: string;
  module: string;
  status: "draft" | "published" | "retired" | "built_in";
  published_version: number | null;
  built_in: boolean;
}

export interface FormTemplateVersion {
  id: string;
  template_id: string;
  version: number;
  definition: FormDefinition;
  published_by: string;
  published_at: string;
}

export interface FormTemplateDetail {
  template: FormTemplate;
  versions: FormTemplateVersion[];
}

export interface LiveForm {
  code: string;
  version_id: string | null;
  version: number | null;
  definition: FormDefinition;
}

export interface CreateFormTemplateRequest {
  code: string;
  name: string;
  module: string;
}

export interface UpdateFormTemplateRequest {
  name: string;
  draft: FormDefinition;
}
