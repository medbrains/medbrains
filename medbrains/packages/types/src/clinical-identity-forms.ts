// Clinical / identity form types — split from index.ts, barrel-re-exported.

// ── Clinical/Identity Forms ───────────────────────────────────────────────────

/** What the QR on a printed bill confirms — no patient detail. */
export interface VerifiedBill {
  hospital_name: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: string;
  paid_amount: string;
  status: string;
}
