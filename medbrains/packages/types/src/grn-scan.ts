// Supplier-bill scans into GRNs (#4861) — mirrors crates/medbrains-materials/src/grn_scan*.rs.

import type { GrnIssue } from "./procurement-request";

export type GrnScanStatus =
  | "uploaded"
  | "parsing"
  | "parsed"
  | "reviewing"
  | "committed"
  | "failed"
  | "discarded";

export interface PurchaseBillScan {
  id: string;
  tenant_id: string;
  vendor_id: string | null;
  po_id: string | null;
  store_location_id: string | null;
  file_key: string;
  file_sha256: string;
  mime_type: string | null;
  status: GrnScanStatus;
  claimed_by: string | null;
  claimed_until: string | null;
  worker: string | null;
  extracted_json: unknown;
  overall_confidence: number | null;
  parse_error: string | null;
  einvoice: unknown;
  irn: string | null;
  draft_json: unknown;
  grn_id: string | null;
  fields_total: number | null;
  fields_corrected: number | null;
  lines_total: number | null;
  lines_auto_matched: number | null;
  lines_rematched: number | null;
  uploaded_by: string;
  committed_by: string | null;
  committed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GrnScanListItem {
  id: string;
  status: GrnScanStatus;
  vendor_id: string | null;
  vendor_name: string | null;
  invoice_number: string | null;
  overall_confidence: number | null;
  grn_id: string | null;
  grn_number: string | null;
  created_at: string;
}

export interface CreateGrnScanRequest {
  file_key: string;
  file_sha256: string;
  mime_type?: string;
  vendor_id?: string;
  po_id?: string;
  store_location_id?: string;
}

export interface GrnScanDraftHeader {
  vendor_id: string | null;
  po_id: string | null;
  store_location_id: string | null;
  supplier_gstin: string | null;
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  invoice_amount: number | string | null;
  irn: string | null;
}

export interface GrnScanDraftLine {
  product_name: string | null;
  supplier_code: string | null;
  pack: string | null;
  strength: string | null;
  dosage_form: string | null;
  manufacturer: string | null;
  inn_name: string | null;
  hsn_code: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  manufacture_date: string | null;
  mrp: number | string | null;
  ptr: number | string | null;
  rate: number | string | null;
  quantity: number | null;
  free_quantity: number | null;
  discount_amount: number | string | null;
  gst_rate: number | string | null;
  quantity_rejected: number | null;
  catalog_item_id: string | null;
  suggested_item_id: string | null;
  po_item_id: string | null;
}

export interface GrnScanDraft {
  header: GrnScanDraftHeader;
  lines: GrnScanDraftLine[];
  /** Field path (`lines[2].batch_number`) → reader confidence 0–1. */
  confidence: Record<string, number>;
}

export interface GrnItemSuggestion {
  line: number;
  catalog_item_id: string;
  code: string;
  name: string;
  strength: string | null;
  dosage_form: string | null;
  pack_size: number | null;
  manufacturer: string | null;
  drug_schedule: string | null;
  is_controlled: boolean | null;
  score: number;
}

export interface GrnNearDuplicate {
  grn_id: string;
  grn_number: string;
  invoice_number: string | null;
  invoice_date: string | null;
  invoice_amount: number | null;
}

export interface GrnScanReview {
  scan: PurchaseBillScan;
  draft: GrnScanDraft;
  /** Null when this server has no object store configured. */
  image_url: string | null;
  issues: GrnIssue[];
  qr_mismatches: string[];
  duplicate_grn: string | null;
  near_duplicates: GrnNearDuplicate[];
  repeated_lines: { line: number; repeats: number }[];
  suggestions: GrnItemSuggestion[];
  auto_tick_confidence: number;
}

export interface CommitGrnScanRequest {
  remember_matches: boolean;
}

export interface GrnScanClaim {
  scan: PurchaseBillScan;
  image_url: string | null;
  lease_until: string | null;
}

export interface SupplierScanAccuracy {
  vendor_id: string;
  vendor_name: string;
  scans: number;
  fields_total: number;
  fields_corrected: number;
  lines_total: number;
  lines_auto_matched: number;
  lines_rematched: number;
}

export interface CatalogDuplicatePair {
  a_id: string;
  a_code: string;
  a_name: string;
  a_stock: number;
  b_id: string;
  b_code: string;
  b_name: string;
  b_stock: number;
  strength: string | null;
  dosage_form: string | null;
  score: number;
  blocked_reason: string | null;
}

export interface MergeCatalogItemsRequest {
  survivor_id: string;
  merged_id: string;
  reason: string;
}

export interface CatalogMergeRecord {
  id: string;
  survivor_id: string;
  merged_id: string;
  repointed: Record<string, number>;
  stock_moved: number;
  reason: string;
  merged_by: string;
  created_at: string;
}
