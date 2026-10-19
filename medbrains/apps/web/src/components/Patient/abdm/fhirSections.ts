// Reads an NRCeS FHIR document bundle (as another facility sent it through
// ABDM) into sections a clinician can scan: diagnoses, medicines, results
// with their units and ranges, and attached documents. Bounded — a bundle
// can carry thousands of resources; the screen shows the first few dozen.

/** Sections and items shown per record. */
export const MAX_SECTIONS = 20;
export const MAX_ITEMS = 50;

export interface FhirItem {
  text: string;
  detail?: string;
  /** A document to open: a URL, or a data URL built from inline content. */
  link?: { href: string; label: string; download?: string };
}

export interface FhirSection {
  title: string;
  /** Each item keyed by the reference it was read from. */
  items: (FhirItem & { key: string })[];
}

export interface FhirDocument {
  title: string | null;
  date: string | null;
  author: string | null;
  sections: FhirSection[];
}

type Json = Record<string, unknown>;

const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

/** A CodeableConcept in words: its text, else its first coding's display. */
export function conceptText(v: unknown): string | undefined {
  const c = obj(v);
  return str(c.text) ?? arr(c.coding).map((x) => str(obj(x).display) ?? str(obj(x).code))[0];
}

function quantity(v: unknown): string | undefined {
  const q = obj(v);
  if (typeof q.value !== "number") return undefined;
  return [String(q.value), str(q.unit) ?? str(q.code)].filter(Boolean).join(" ");
}

function range(o: Json): string | undefined {
  const r = obj(arr(o.referenceRange)[0]);
  const low = quantity(r.low);
  const high = quantity(r.high);
  if (str(r.text)) return `Range ${str(r.text)}`;
  return low || high ? `Range ${low ?? "…"} – ${high ?? "…"}` : undefined;
}

function attachmentLink(v: unknown): FhirItem["link"] | undefined {
  const a = obj(v);
  const label = str(a.title) ?? "Open document";
  // Another facility's content: only web links open; anything else
  // (`javascript:`, `file:`) is dropped.
  const url = str(a.url);
  if (url && /^https?:\/\//i.test(url)) return { href: url, label };
  const data = str(a.data);
  if (!data) return undefined;
  const type = str(a.contentType) ?? "application/octet-stream";
  // Always a download, never opened in place.
  return { href: `data:${type};base64,${data}`, label, download: str(a.title) ?? "document" };
}

/** One resource as a line: what it is, and the detail that matters. */
export function describe(resource: unknown): FhirItem {
  const r = obj(resource);
  const type = str(r.resourceType) ?? "Entry";
  switch (type) {
    case "Observation": {
      const value =
        quantity(r.valueQuantity) ?? str(r.valueString) ?? conceptText(r.valueCodeableConcept);
      const flag = conceptText(arr(r.interpretation)[0]);
      return {
        text: [conceptText(r.code) ?? "Observation", value].filter(Boolean).join(": "),
        detail: [range(r), flag].filter(Boolean).join(" · ") || undefined,
      };
    }
    case "MedicationRequest":
    case "MedicationStatement":
      return {
        text: conceptText(r.medicationCodeableConcept) ?? "Medicine",
        detail: str(obj(arr(r.dosageInstruction ?? r.dosage)[0]).text),
      };
    case "DiagnosticReport":
      return { text: conceptText(r.code) ?? "Report", detail: str(r.conclusion) };
    case "DocumentReference": {
      const att = obj(arr(r.content)[0]).attachment;
      return {
        text: conceptText(r.type) ?? str(obj(att).title) ?? "Document",
        link: attachmentLink(att),
      };
    }
    case "Binary":
      return {
        text: "Attached document",
        link: attachmentLink({ data: r.data, contentType: r.contentType }),
      };
    case "Immunization":
      return {
        text: conceptText(r.vaccineCode) ?? "Immunisation",
        detail: str(r.occurrenceDateTime),
      };
    default:
      return {
        text: conceptText(r.code) ?? type,
        detail: conceptText(r.clinicalStatus) ?? str(r.recordedDate),
      };
  }
}

/** Resources by every name a reference may use: fullUrl and `Type/id`. */
function index(bundle: Json): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const e of arr(bundle.entry)) {
    const entry = obj(e);
    const res = obj(entry.resource);
    if (str(entry.fullUrl)) map.set(str(entry.fullUrl) as string, res);
    if (str(res.resourceType) && str(res.id)) map.set(`${res.resourceType}/${res.id}`, res);
  }
  return map;
}

function sectionOf(raw: unknown, byRef: Map<string, unknown>): FhirSection {
  const s = obj(raw);
  const items = arr(s.entry)
    .slice(0, MAX_ITEMS)
    .map((e) => str(obj(e).reference) ?? "")
    .filter((ref) => byRef.has(ref))
    .map((ref, i) => ({ ...describe(byRef.get(ref)), key: `${i}:${ref}` }));
  return { title: str(s.title) ?? conceptText(s.code) ?? "Section", items };
}

/** The document's header and readable sections. */
export function readDocument(bundle: unknown): FhirDocument {
  const b = obj(bundle);
  const byRef = index(b);
  const composition = arr(b.entry)
    .map((e) => obj(obj(e).resource))
    .find((r) => r.resourceType === "Composition");
  const comp = composition ?? {};
  const author = byRef.get(str(obj(arr(comp.author)[0]).reference) ?? "");
  const sections = arr(comp.section)
    .slice(0, MAX_SECTIONS)
    .map((s) => sectionOf(s, byRef))
    .filter((s) => s.items.length > 0);
  return {
    title: str(comp.title) ?? null,
    date: str(comp.date) ?? null,
    author: str(obj(arr(obj(author).name)[0]).text) ?? str(obj(author).name) ?? null,
    sections,
  };
}
