// What the insurance settlements queue shows about a posting, worked out
// once and tested without a screen.

import type { ClaimSettlementPosting, ClaimSettlementSource } from "@medbrains/types";

const toNumber = (value: string | null | undefined): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export interface SettlementView {
  settled: number;
  tds: number;
  /** What the insurer actually transferred: settled less TDS. */
  net: number;
  open: number;
  /** What approving would post, capped at the bill's open balance. */
  toPost: number;
  excess: number;
  writeOff: number;
  /** What the bill still owes after this posting and its write-off. */
  leftOwing: number;
}

export function settlementView(p: ClaimSettlementPosting): SettlementView {
  const settled = toNumber(p.settled_amount);
  const tds = toNumber(p.tds_amount);
  const open = Math.max(toNumber(p.invoice_total) - toNumber(p.invoice_paid), 0);
  const toPost = Math.min(settled, open);
  const share = (treatment: string) =>
    p.deductions
      .filter((d) => d.treatment === treatment)
      .reduce((sum, d) => sum + toNumber(d.amount), 0);
  return {
    settled,
    tds,
    net: settled - tds,
    open,
    toPost,
    excess: settled - toPost,
    writeOff: share("write_off"),
    leftOwing: Math.max(open - toPost - share("write_off"), 0),
  };
}

/** Maker-checker: whoever recorded a settlement never decides it. */
export function canDecide(p: ClaimSettlementPosting, userId: string | undefined): boolean {
  return p.status === "pending" && (p.recorded_by === null || p.recorded_by !== userId);
}

export const SETTLEMENT_SOURCE_LABELS: Record<ClaimSettlementSource, string> = {
  manual: "Entered by desk",
  nhcx: "NHCX payment notice",
  bank: "Bank statement",
  claim_update: "Claim marked settled",
  import: "Historical import",
  backfill: "Backfill",
};
