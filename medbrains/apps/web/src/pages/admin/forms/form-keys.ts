import type { FormFieldKind } from "@medbrains/types";

/** A label turned into a key the server accepts: lower-case, a-z0-9_, starting with a letter. */
export function toKey(label: string): string {
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 63);
  return /^[a-z]/.test(key) ? key : key ? `q_${key}`.slice(0, 63) : "";
}

export const FORM_MODULES = [
  { value: "opd", label: "OPD" },
  { value: "ipd", label: "IPD" },
  { value: "emergency", label: "Emergency" },
  { value: "ot", label: "Operation theatre" },
  { value: "nursing", label: "Nursing" },
  { value: "lab", label: "Laboratory" },
  { value: "radiology", label: "Radiology" },
  { value: "general", label: "General" },
];

export const FIELD_KINDS: { value: FormFieldKind; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "yes_no", label: "Yes / No" },
  { value: "select", label: "Pick one (list)" },
  { value: "radio", label: "Pick one (buttons)" },
  { value: "multiselect", label: "Pick several" },
];

export const CHOICE_KINDS: ReadonlySet<FormFieldKind> = new Set(["select", "radio", "multiselect"]);
