/**
 * The locale profile's fields as the settings screen shows and edits them
 * (RFC-WORLD-READY §2.2). Which scope may set which field mirrors
 * `Field::settable_at` in `crates/medbrains-country/src/profile.rs`; the
 * server checks it again, this only keeps the form honest.
 */
import type { KnowledgeRowFields, LocaleProfileValues } from "@medbrains/types";

export type ProfileScope = "hospital" | "facility";
export type ProfileKey = keyof LocaleProfileValues;
export type FieldKind =
  | "country"
  | "text"
  | "zone"
  | "currency"
  | "select"
  | "list"
  | "month"
  | "calendars";

export interface ProfileField {
  key: ProfileKey;
  label: string;
  kind: FieldKind;
  scopes: ProfileScope[];
  description?: string;
  options?: { value: string; label: string }[];
}

const BOTH: ProfileScope[] = ["hospital", "facility"];
const HOSPITAL: ProfileScope[] = ["hospital"];

/** Months for the fiscal year start. */
export const MONTH_OPTIONS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
].map((label, i) => ({ value: String(i + 1), label }));

/** Calendars shown beside the Gregorian date; `DISPLAY_CALENDARS` in profile.rs. */
export const CALENDAR_OPTIONS = [
  { value: "islamic-umalqura", label: "Hijri (Umm al-Qura)" },
  { value: "islamic-civil", label: "Hijri (civil)" },
  { value: "persian", label: "Persian" },
  { value: "buddhist", label: "Thai Buddhist" },
  { value: "hebrew", label: "Hebrew" },
  { value: "indian", label: "Indian national (Saka)" },
  { value: "ethiopic", label: "Ethiopian" },
  { value: "japanese", label: "Japanese" },
];

export const PROFILE_FIELDS: ProfileField[] = [
  { key: "country", label: "Country", kind: "country", scopes: HOSPITAL },
  {
    key: "region",
    label: "Region",
    kind: "text",
    scopes: BOTH,
    description: "ISO 3166-2, where rules differ inside the country (AE-DU)",
  },
  { key: "currency", label: "Currency", kind: "currency", scopes: HOSPITAL },
  { key: "timezone", label: "Time zone", kind: "zone", scopes: BOTH },
  {
    key: "locale",
    label: "Formatting locale",
    kind: "text",
    scopes: BOTH,
    description: "BCP 47 tag: how numbers and dates are written (en-IN, ar-AE)",
  },
  {
    key: "languages",
    label: "Languages",
    kind: "list",
    scopes: BOTH,
    description: "Language codes in order, first is the default (en, hi)",
  },
  {
    key: "hour_cycle",
    label: "Clock",
    kind: "select",
    scopes: BOTH,
    options: [
      { value: "h12", label: "12-hour" },
      { value: "h23", label: "24-hour" },
    ],
  },
  {
    key: "week_start",
    label: "Week starts on",
    kind: "select",
    scopes: HOSPITAL,
    options: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => ({
      value: d,
      label: d[0]?.toUpperCase() + d.slice(1),
    })),
  },
  { key: "calendars", label: "Also show dates in", kind: "calendars", scopes: BOTH },
  { key: "fiscal_year_start", label: "Fiscal year starts", kind: "month", scopes: HOSPITAL },
  {
    key: "name_order",
    label: "Name order",
    kind: "select",
    scopes: HOSPITAL,
    options: [
      { value: "given_family", label: "Given name, then family name" },
      { value: "family_given", label: "Family name, then given name" },
    ],
  },
];

/** Fields the hospital must always have; `HOSPITAL_REQUIRED` in the adapter. */
export const HOSPITAL_REQUIRED: ProfileKey[] = [
  "country",
  "currency",
  "timezone",
  "locale",
  "fiscal_year_start",
];

/** Form state: every field as text, empty meaning "inherit". */
export type ProfileForm = Record<ProfileKey, string>;

/** A stored value as the form's text. */
export function toFormText(key: ProfileKey, value: unknown): string {
  if (value == null) return "";
  if (key === "languages" && Array.isArray(value)) return value.join(", ");
  if (key === "calendars" && typeof value === "object") {
    return ((value as { also?: string[] }).also ?? []).join(",");
  }
  return String(value);
}

/** The form's text as the stored value; `null` unsets the field at this scope. */
export function fromFormText(key: ProfileKey, text: string): KnowledgeRowFields[string] {
  const t = text.trim();
  if (t === "") return null;
  if (key === "fiscal_year_start") return Number(t);
  if (key === "languages") {
    return t
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (key === "calendars") return { primary: "gregory", also: t.split(",").filter(Boolean) };
  return t;
}

/** The change-set row for one scope: its id and every field this scope may set. */
export function toRow(scope: ProfileScope, scopeId: string, form: ProfileForm): KnowledgeRowFields {
  const row: KnowledgeRowFields = { scope_id: scopeId };
  for (const f of PROFILE_FIELDS) {
    if (f.scopes.includes(scope)) row[f.key] = fromFormText(f.key, form[f.key]);
  }
  return row;
}

/** A value for a table cell: text, or "inherited" when this scope sets nothing. */
export function cellText(key: ProfileKey, value: unknown): string {
  const text = toFormText(key, value);
  if (key === "fiscal_year_start" && text) {
    return MONTH_OPTIONS[Number(text) - 1]?.label ?? text;
  }
  return text || "inherited";
}
