import type {
  NhcxClaimDocKind,
  NhcxClaimDocument,
  NhcxDocumentPick,
  PatientDocument,
} from "@medbrains/types";

const KIND_LABELS: Record<NhcxClaimDocKind, string> = {
  discharge_summary: "Discharge summary",
  final_bill: "Final bill",
  lab_report: "Lab report",
  radiology_report: "Radiology report",
  patient_document: "Patient document",
};

export function docKindLabel(kind: NhcxClaimDocKind): string {
  return KIND_LABELS[kind];
}

const KIB = 1024;
const MIB = KIB * KIB;

/** "1.2 MB" / "340 KB"; a stored file whose size was never recorded is unknown. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "size unknown";
  if (bytes >= MIB) return `${(bytes / MIB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / KIB))} KB`;
}

export function docKey(doc: NhcxDocumentPick): string {
  return `${doc.source}:${doc.id}`;
}

/** What the desk will send: every prepared document not unticked, then the
 * stored ones it added (never twice). */
export function claimPicks(
  prepared: NhcxClaimDocument[],
  unticked: ReadonlySet<string>,
  added: PatientDocument[],
): NhcxDocumentPick[] {
  const picks: NhcxDocumentPick[] = prepared
    .filter((d) => !unticked.has(docKey(d)))
    .map((d) => ({ source: d.source, id: d.id }));
  const seen = new Set(picks.map(docKey));
  for (const d of added) {
    const pick: NhcxDocumentPick = { source: "stored", id: d.id };
    if (!seen.has(docKey(pick))) {
      seen.add(docKey(pick));
      picks.push(pick);
    }
  }
  return picks;
}

/** The total of what is ticked; an added file of unknown size counts as 0
 * here — the server measures it and reports it if it does not fit. */
export function picksTotalBytes(
  prepared: NhcxClaimDocument[],
  unticked: ReadonlySet<string>,
  added: PatientDocument[],
): number {
  const rendered = prepared
    .filter((d) => !unticked.has(docKey(d)))
    .reduce((sum, d) => sum + d.size_bytes, 0);
  return rendered + added.reduce((sum, d) => sum + (d.file_size ?? 0), 0);
}
