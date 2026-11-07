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

/**
 * What the QR on a signed print confirms: who signed which kind of document,
 * when, whether the key still stands, and whether the record is unchanged.
 * Never the patient or the clinical content.
 */
export interface CheckedSignedDocument {
  status: "unchanged" | "changed";
  document_type: string;
  signer_name: string;
  signer_registration: string | null;
  signer_council: string | null;
  facility: string;
  signed_at: string;
  key_status: "active" | "revoked" | "unknown";
  key_revoked_on: string | null;
  unchanged: boolean;
}

/** The hospital withdrew this document's public check link. */
export interface WithdrawnSignatureLink {
  status: "withdrawn";
  withdrawn_on: string;
}

export type PublicSignatureCheck = CheckedSignedDocument | WithdrawnSignatureLink;

/** A signed record's live public check link. */
export interface SignatureVerifyLink {
  token: string;
}
