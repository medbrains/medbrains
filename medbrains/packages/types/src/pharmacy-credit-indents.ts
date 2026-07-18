// Pharmacy credit notes & store indent types — split from index.ts, barrel-re-exported.

// ── Pharmacy Credit Notes & Store Indents ──────────────────

export type PharmacyCreditNoteType =
  | "customer_return"
  | "supplier_return"
  | "expiry_write_off"
  | "damage";
export type PharmacyCreditNoteStatus = "draft" | "approved" | "settled" | "cancelled";
export type PharmacyStoreIndentStatus =
  | "pending"
  | "approved"
  | "issued"
  | "received"
  | "rejected"
  | "cancelled";

export interface PharmacyCreditNote {
  id: string;
  tenant_id: string;
  credit_note_number: string;
  note_type: PharmacyCreditNoteType;
  reference_type: string | null;
  reference_id: string | null;
  patient_id: string | null;
  vendor_id: string | null;
  items: Array<{
    drug_id: string;
    drug_name: string;
    batch_number: string;
    quantity: number;
    unit_price: number;
    amount: number;
    reason: string;
  }>;
  total_amount: number;
  gst_amount: number;
  net_amount: number;
  status: PharmacyCreditNoteStatus;
  approved_by: string | null;
  approved_at: string | null;
  settled_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePharmacyCreditNoteRequest {
  note_type: PharmacyCreditNoteType;
  reference_type?: string;
  reference_id?: string;
  patient_id?: string;
  vendor_id?: string;
  items: Array<{
    drug_id: string;
    drug_name: string;
    batch_number: string;
    quantity: number;
    unit_price: number;
    amount: number;
    reason: string;
  }>;
  total_amount: number;
  gst_amount?: number;
  notes?: string;
}

export interface PharmacyStoreIndent {
  id: string;
  tenant_id: string;
  indent_number: string;
  from_store_id: string | null;
  to_store_id: string | null;
  status: PharmacyStoreIndentStatus;
  items: Array<{
    item_id?: string;
    name: string;
    quantity: number;
    unit: string;
  }>;
  total_items: number;
  notes: string | null;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  issued_by: string | null;
  issued_at: string | null;
  received_by: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStoreIndentRequest {
  from_store_id?: string;
  to_store_id?: string;
  items: Array<{ item_id?: string; name: string; quantity: number; unit: string }>;
  notes?: string;
}
