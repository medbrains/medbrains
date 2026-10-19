import type {
  NhcxAdjudication,
  NhcxClaimItem,
  NhcxPayment,
  NhcxTask,
  NhcxTaskKind,
} from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";

/** One row of the adjudication table: the line sent, and what the payer did with it. */
export interface AdjudicationRow {
  sequence: number;
  description: string;
  submitted: string | null;
  approved: string | null;
  deducted: string | null;
  reasons: string[];
  /** Approved less than claimed. */
  isCut: boolean;
}

/** Join the payer's lines to the lines sent, by sequence. A line the payer
 * did not mention stays in the table with no decision, never as approved. */
export function adjudicationRows(
  items: NhcxClaimItem[],
  adjudication: NhcxAdjudication | null,
): AdjudicationRow[] {
  const byLine = new Map((adjudication?.lines ?? []).map((l) => [l.sequence, l]));
  const sent = new Map(items.map((i) => [i.sequence, i]));
  const sequences = [...new Set([...sent.keys(), ...byLine.keys()])].sort((a, b) => a - b);
  return sequences.map((sequence) => {
    const item = sent.get(sequence);
    const line = byLine.get(sequence);
    const deducted = line?.deducted ?? null;
    return {
      sequence,
      description: item?.description ?? `Line ${sequence}`,
      submitted: line?.submitted ?? item?.net ?? null,
      approved: line?.approved ?? null,
      deducted,
      reasons: line?.reasons ?? [],
      isCut: deducted !== null && Number(deducted) > 0,
    };
  });
}

const TASK_LABELS: Record<NhcxTaskKind, string> = {
  status: "Status check",
  search: "Search",
  cancel: "Cancellation",
  reprocess: "Reprocess request",
};

export function taskLabel(kind: NhcxTaskKind): string {
  return TASK_LABELS[kind];
}

/** The payer's answer to a Task in words; `null` while it has not answered. */
export function taskAnswer(task: NhcxTask): string | null {
  const r = task.result;
  if (!r) return null;
  if (r.error) return `Error: ${r.error}`;
  const claim = r.claims[0];
  const parts = [
    r.task_status && `Task ${r.task_status}`,
    r.outcome,
    claim?.outcome && `claim ${claim.outcome}`,
    claim?.approved && `approved ₹${claim.approved}`,
    claim?.disposition,
  ].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(" · ") : "Answered";
}

/** What finance should do about a payment, if anything. */
export function paymentFlag(p: NhcxPayment): { label: string; tone: BadgeTone } {
  if (p.status === "unmatched") return { label: "No claim matched", tone: "danger" };
  if (p.is_mismatch) return { label: "Differs from approved", tone: "warning" };
  return { label: "Matches approved", tone: "success" };
}

export const rupees = (v: string | null | undefined): string => (v ? `₹${v}` : "—");
