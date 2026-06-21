// Self-contained prescription (rx-suite) model — ported from the MedBrains
// Design System rx-suite. Standalone for now (own formulary + Rx model);
// wires to pharmacy_catalog / OPD prescriptions in a later phase.

export interface Dose {
  /** Day-part key (m/a/e/n) or a custom id. */
  key: string;
  label: string;
  /** HH:MM 24h. */
  time: string;
}

export type CadenceType = "daily" | "interval" | "days" | "weekly" | "monthly";

export interface Repeat {
  type: CadenceType;
  /** interval: every N days (≥2). */
  everyN?: number;
  /** days/weekly: ISO weekday numbers 1=Mon … 7=Sun. */
  days?: number[];
  /** monthly: day-of-month 1–31. */
  dom?: number;
}

export interface RxItem {
  uid: number;
  /** Formulary drug id. */
  id: string;
  name: string;
  form: string; // Tab | Cap | Sachet | …
  strength: string;
  brand: string;
  doses: Dose[];
  /** PRN / as-needed. */
  sos: boolean;
  repeat: Repeat;
  days: number;
  ongoing: boolean;
  food: string;
  note: string;
  /** Administration route. */
  route?: Route;
  /** Nurse-drafted Rx-only item awaiting MD sign-off. */
  pendingMD?: boolean;
}

/** CDSCO drug schedule. X = duplicate Rx + register; H1 = written Rx + register. */
export type DrugSchedule = "H" | "H1" | "X" | "G" | null;
/** WHO AWaRe antibiotic-stewardship class. */
export type AwareClass = "Access" | "Watch" | "Reserve" | null;
export type Route = "oral" | "iv" | "im" | "sc" | "topical" | "inhaled" | "rectal";

export const ROUTES: { v: Route; label: string }[] = [
  { v: "oral", label: "Oral" },
  { v: "iv", label: "IV" },
  { v: "im", label: "IM" },
  { v: "sc", label: "SC" },
  { v: "topical", label: "Topical" },
  { v: "inhaled", label: "Inhaled" },
  { v: "rectal", label: "Rectal" },
];

export interface FormularyDrug {
  id: string;
  name: string;
  salt: string;
  form: string;
  cls: string;
  brands: string[];
  strengths: string[];
  kind: "rx" | "otc";
  penicillin?: boolean;
  crossPen?: boolean;
  sedative?: boolean;
  // ── regulatory (CLAUDE.md §Pharmacology) ──
  /** CDSCO schedule — drives badge + Rx/register rules. */
  schedule?: DrugSchedule;
  /** NDPS controlled substance — register + dual-lock on dispense. */
  controlled?: boolean;
  /** ATC classification code. */
  atc?: string;
  /** WHO AWaRe antibiotic class (antibiotics only). */
  aware?: AwareClass;
  /** Look-alike-sound-alike — tall-man + confirm step. */
  lasa?: boolean;
}

/** Schedule badge label + whether it needs a written Rx / register. */
export function scheduleInfo(s: DrugSchedule): { label: string; strict: boolean } | null {
  if (!s) return null;
  if (s === "X") return { label: "Schedule X", strict: true };
  if (s === "H1") return { label: "Schedule H1", strict: true };
  if (s === "H") return { label: "Schedule H", strict: false };
  return { label: `Schedule ${s}`, strict: false };
}

export type InteractionSeverity = "minor" | "moderate" | "major";
export interface Interaction {
  sev: InteractionSeverity;
  note: string;
}

/** The four standard day-parts (quick-add); custom times allowed beyond these. */
export const SLOTS = [
  { key: "m", label: "Morning", abbr: "Morn", def: "09:00" },
  { key: "a", label: "Noon", abbr: "Noon", def: "14:00" },
  { key: "e", label: "Evening", abbr: "Eve", def: "18:00" },
  { key: "n", label: "Night", abbr: "Night", def: "21:00" },
] as const;

export const MAX_DOSES = 6;
export const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const CADENCE: { v: CadenceType; label: string }[] = [
  { v: "daily", label: "Every day" },
  { v: "interval", label: "Alternate / every N days" },
  { v: "days", label: "Specific weekdays" },
  { v: "weekly", label: "Weekly" },
  { v: "monthly", label: "Monthly" },
];

export const FOODS = ["after food", "before food", "with food", "empty stomach", "at bedtime"];

function ord(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  const suffix = s[(v - 20) % 10] ?? s[v] ?? s[0] ?? "th";
  return `${n}${suffix}`;
}

/** Human label for a cadence (e.g. "Alternate days", "Mon, Wed", "Monthly · 1st"). */
export function repeatLabel(r?: Repeat): string {
  if (!r || r.type === "daily") return "Every day";
  if (r.type === "interval")
    return (r.everyN || 2) === 2 ? "Alternate days" : `Every ${r.everyN} days`;
  if (r.type === "days") {
    return r.days?.length
      ? r.days
          .slice()
          .sort((a, b) => a - b)
          .map((d) => WEEK[d - 1])
          .join(", ")
      : "Pick days";
  }
  if (r.type === "weekly") return `Weekly · ${WEEK[(r.days?.[0] || 1) - 1]}`;
  if (r.type === "monthly") return `Monthly · ${ord(r.dom || 1)}`;
  return "Every day";
}

/** 24h HH:MM → 12h "9:00 AM". */
export function fmt12(t: string): string {
  if (!t) return "";
  const [h = 0, m = 0] = t.split(":").map(Number);
  const ap = h < 12 ? "AM" : "PM";
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}

/** Clinical frequency code from the dose count: OD/BD/TID/QID/SOS. */
export function dosesFreqCode(doses: Dose[], sos: boolean): string {
  if (sos) return "SOS";
  if (!doses || !doses.length) return "—";
  const codes: Record<number, string> = { 1: "OD", 2: "BD", 3: "TID", 4: "QID" };
  return codes[doses.length] ?? `${doses.length}×/day`;
}

/** Stable key for an unordered drug pair. */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

export const byTime = (a: Dose, b: Dose): number => (a.time || "").localeCompare(b.time || "");

export const FORMULARY: FormularyDrug[] = [
  {
    id: "azi",
    name: "Azithromycin",
    salt: "Azithromycin",
    form: "Tab",
    cls: "Macrolide antibiotic",
    brands: ["Azithral 500", "Zithromax"],
    strengths: ["250 mg", "500 mg"],
    kind: "rx",
    schedule: "H",
    atc: "J01FA10",
    aware: "Watch",
  },
  {
    id: "amc",
    name: "Amoxicillin–Clavulanate",
    salt: "Amoxicillin + Clavulanic acid",
    form: "Tab",
    cls: "Penicillin antibiotic",
    brands: ["Augmentin", "Clavam"],
    strengths: ["375 mg", "625 mg"],
    penicillin: true,
    kind: "rx",
    schedule: "H",
    atc: "J01CR02",
    aware: "Access",
  },
  {
    id: "amx",
    name: "Amoxicillin",
    salt: "Amoxicillin",
    form: "Cap",
    cls: "Penicillin antibiotic",
    brands: ["Mox", "Novamox"],
    strengths: ["250 mg", "500 mg"],
    penicillin: true,
    kind: "rx",
    schedule: "H",
    atc: "J01CA04",
    aware: "Access",
  },
  {
    id: "cfx",
    name: "Cefixime",
    salt: "Cefixime",
    form: "Tab",
    cls: "Cephalosporin antibiotic",
    brands: ["Taxim-O", "Zifi"],
    strengths: ["100 mg", "200 mg"],
    crossPen: true,
    kind: "rx",
    schedule: "H",
    atc: "J01DD08",
    aware: "Watch",
  },
  {
    id: "par",
    name: "Paracetamol",
    salt: "Acetaminophen",
    form: "Tab",
    cls: "Analgesic / antipyretic",
    brands: ["Dolo 650", "Calpol"],
    strengths: ["500 mg", "650 mg"],
    kind: "otc",
    schedule: null,
    atc: "N02BE01",
  },
  {
    id: "ibu",
    name: "Ibuprofen",
    salt: "Ibuprofen",
    form: "Tab",
    cls: "NSAID",
    brands: ["Brufen", "Combiflam"],
    strengths: ["200 mg", "400 mg"],
    kind: "otc",
    schedule: null,
    atc: "M01AE01",
  },
  {
    id: "lev",
    name: "Levocetirizine",
    salt: "Levocetirizine",
    form: "Tab",
    cls: "Antihistamine",
    brands: ["Levocet", "Xyzal"],
    strengths: ["5 mg"],
    sedative: true,
    kind: "otc",
    schedule: "H",
    atc: "R06AE09",
    lasa: true,
  },
  {
    id: "cet",
    name: "Cetirizine",
    salt: "Cetirizine",
    form: "Tab",
    cls: "Antihistamine",
    brands: ["Cetzine", "Alerid"],
    strengths: ["10 mg"],
    sedative: true,
    kind: "otc",
    schedule: "H",
    atc: "R06AE07",
  },
  {
    id: "pan",
    name: "Pantoprazole",
    salt: "Pantoprazole",
    form: "Tab",
    cls: "Proton-pump inhibitor",
    brands: ["Pantop 40", "Pan 40"],
    strengths: ["20 mg", "40 mg"],
    kind: "rx",
    schedule: "H",
    atc: "A02BC02",
  },
  {
    id: "mont",
    name: "Montelukast",
    salt: "Montelukast",
    form: "Tab",
    cls: "Leukotriene antagonist",
    brands: ["Montair", "Montek"],
    strengths: ["4 mg", "5 mg", "10 mg"],
    kind: "rx",
    schedule: "H",
    atc: "R03DC03",
  },
  {
    id: "dom",
    name: "Domperidone",
    salt: "Domperidone",
    form: "Tab",
    cls: "Antiemetic / prokinetic",
    brands: ["Domstal"],
    strengths: ["10 mg"],
    kind: "rx",
    schedule: "H",
    atc: "A03FA03",
  },
  {
    id: "alp",
    name: "Alprazolam",
    salt: "Alprazolam",
    form: "Tab",
    cls: "Benzodiazepine",
    brands: ["Alprax", "Restyl"],
    strengths: ["0.25 mg", "0.5 mg"],
    sedative: true,
    kind: "rx",
    schedule: "H1",
    controlled: true,
    atc: "N05BA12",
  },
  {
    id: "ors",
    name: "ORS",
    salt: "Oral rehydration salts",
    form: "Sachet",
    cls: "Electrolyte",
    brands: ["Electral"],
    strengths: ["1 sachet"],
    kind: "otc",
    schedule: null,
    atc: "A07CA",
  },
];

export const FORMULARY_BY_ID: Record<string, FormularyDrug> = Object.fromEntries(
  FORMULARY.map((d) => [d.id, d]),
);

export const INTERACTIONS: Record<string, Interaction> = {
  "azi|lev": { sev: "minor", note: "QT-additive — clinically insignificant at these doses" },
  "azi|pan": { sev: "minor", note: "absorption — space doses by 2 h" },
  "amc|azi": { sev: "minor", note: "overlapping antibiotic cover — confirm intent" },
  "ibu|pan": { sev: "minor", note: "NSAID gastric risk — PPI is protective" },
  "cfx|amc": { sev: "moderate", note: "dual beta-lactam — avoid combination" },
  "ibu|par": { sev: "minor", note: "both antipyretic — avoid stacking" },
};

/** Search a formulary list by name, salt, brand, or class. */
export function searchFormulary(
  formulary: FormularyDrug[],
  query: string,
  limit = 6,
): FormularyDrug[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return formulary
    .filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.salt.toLowerCase().includes(q) ||
        d.brands.some((b) => b.toLowerCase().includes(q)) ||
        d.cls.toLowerCase().includes(q),
    )
    .slice(0, limit);
}
