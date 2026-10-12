// The registration rules, evaluated on the web exactly as
// crates/medbrains-clinical-core/src/registration/rules.rs evaluates them for
// the server and both native apps. The rules themselves are data
// (registration.generated.ts); this file only reads them, and
// registration-rules.test.ts holds it to the Rust's own fixtures.

export type RegistrationStep =
  | "intake"
  | "contact_identity"
  | "family_address_safety"
  | "preferences_billing";

export type FieldKind =
  | "text"
  | "long_text"
  | "phone"
  | "email"
  | "date"
  | "age"
  | "digits"
  | "number"
  | "segmented"
  | "select"
  | "toggle"
  | "tags"
  | "search"
  | "hidden";

export interface Opt {
  value: string;
  label: string;
}

export type FieldOptions =
  | { source: "none" }
  | { source: "fixed"; options: Opt[] }
  | { source: "departments" | "doctors" | "camps" | "campaigns" | "drug_catalogue" | "icd11" };

export interface Cond {
  field: string;
  is: string[];
}

export type Check =
  | { kind: "required" }
  | { kind: "checked" }
  | { kind: "any_filled"; fields: string[] }
  | { kind: "one_of_options" }
  | { kind: "digits"; min: number; max: number }
  | { kind: "phone_shape" }
  | { kind: "max_len"; max: number }
  | { kind: "int_range"; min: number; max: number }
  | { kind: "email" };

export interface Rule {
  check: Check;
  when: Cond[];
  when_all: Cond[];
  unless: Cond[];
  message: string;
}

export interface CatalogueField {
  id: string;
  label: string;
  step: RegistrationStep;
  kind: FieldKind;
  options: FieldOptions;
  rules: Rule[];
  /** False for desk-only inputs (age, send-to-OPD) that never reach the server as themselves. */
  sent: boolean;
  hint: string | null;
  /** Shown only when any of these match (always, when empty). */
  show_when: Cond[];
  /** Hidden when any of these match. */
  hide_when: Cond[];
  /** What a new draft starts with, if anything. */
  default: string | null;
}

export interface RegistrationCatalogue {
  steps: { step: RegistrationStep; title: string }[];
  fields: CatalogueField[];
}

/** Field id → value as entered; toggles are "true" / "false". */
export type RegistrationDraft = Record<string, string | undefined>;

export interface RegistrationProblem {
  field: string;
  message: string;
}

/**
 * A calendar day as the rules and the server read it (YYYY-MM-DD), in the
 * desk's own time zone — `toISOString()` gives yesterday for a date picked
 * before 05:30 in India.
 */
export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const value = (draft: RegistrationDraft, field: string): string => (draft[field] ?? "").trim();

const matches = (draft: RegistrationDraft, c: Cond): boolean => {
  const v = value(draft, c.field);
  return c.is.some((want) => (want === "*" ? v !== "" : v === want));
};

const applies = (draft: RegistrationDraft, r: Rule): boolean =>
  (r.when.length === 0 || r.when.some((c) => matches(draft, c))) &&
  r.when_all.every((c) => matches(draft, c)) &&
  !r.unless.some((c) => matches(draft, c));

const digitCount = (v: string): number => (v.match(/[0-9]/g) ?? []).length;

const phoneShaped = (v: string): boolean => {
  const body = v.startsWith("+") ? v.slice(1) : v;
  const n = digitCount(v);
  return /^[0-9 ()-]*$/.test(body) && n >= 10 && n <= 15;
};

const emailShaped = (v: string): boolean => {
  const at = v.indexOf("@");
  if (at < 0 || v.includes(" ")) return false;
  const user = v.slice(0, at);
  const domain = v.slice(at + 1);
  return user !== "" && domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".");
};

function passes(draft: RegistrationDraft, field: CatalogueField, check: Check, v: string): boolean {
  switch (check.kind) {
    case "required":
      return v !== "";
    case "checked":
      return v === "true";
    case "any_filled":
      return check.fields.some((f) => value(draft, f) !== "");
    default:
      break;
  }
  if (v === "") return true;
  switch (check.kind) {
    case "one_of_options":
      return field.options.source !== "fixed" || field.options.options.some((o) => o.value === v);
    case "digits": {
      const n = digitCount(v);
      return /^[0-9 -]*$/.test(v) && n >= check.min && n <= check.max;
    }
    case "phone_shape":
      return phoneShaped(v);
    case "max_len":
      return [...v].length <= check.max;
    case "int_range": {
      if (!/^-?[0-9]+$/.test(v)) return false;
      const n = Number(v);
      return n >= check.min && n <= check.max;
    }
    case "email":
      return emailShaped(v);
  }
}

/** Whether `field` is on the screen for this draft — the catalogue's visibility, as the native wizards read it. */
export function isFieldShown(field: CatalogueField, draft: RegistrationDraft): boolean {
  const shown = field.show_when.length === 0 || field.show_when.some((c) => matches(draft, c));
  return shown && !field.hide_when.some((c) => matches(draft, c));
}

/** Every problem with `draft`, in the form's order, at most one per field. */
export function registrationProblems(
  catalogue: RegistrationCatalogue,
  draft: RegistrationDraft,
): RegistrationProblem[] {
  const problems: RegistrationProblem[] = [];
  for (const field of catalogue.fields) {
    const v = value(draft, field.id);
    const failed = field.rules.find((r) => applies(draft, r) && !passes(draft, field, r.check, v));
    if (failed) problems.push({ field: field.id, message: failed.message });
  }
  return problems;
}
