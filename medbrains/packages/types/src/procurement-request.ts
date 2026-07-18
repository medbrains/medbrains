// Procurement request types — split from index.ts, barrel-re-exported.
import type {
  GoodsReceiptNote,
  GrnItem,
  PurchaseOrder,
  PurchaseOrderItem,
  RateContract,
  RateContractItem,
  VendorStatus,
} from "./index";

// ── Procurement Request Types ─────────────────────────────

export interface CreateVendorRequest {
  code: string;
  name: string;
  display_name?: string;
  vendor_type?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  website?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  gst_number?: string;
  pan_number?: string;
  drug_license_number?: string;
  fssai_license?: string;
  bank_name?: string;
  bank_account?: string;
  bank_ifsc?: string;
  payment_terms?: string;
  credit_limit?: number;
  credit_days?: number;
  categories?: unknown[];
  notes?: string;
  supply_categories?: string[];
  is_pharmacy_vendor?: boolean;
  product_lines?: string;
}

export interface UpdateVendorRequest {
  name?: string;
  display_name?: string;
  vendor_type?: string;
  status?: VendorStatus;
  contact_person?: string;
  phone?: string;
  email?: string;
  website?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  gst_number?: string;
  pan_number?: string;
  drug_license_number?: string;
  fssai_license?: string;
  bank_name?: string;
  bank_account?: string;
  bank_ifsc?: string;
  payment_terms?: string;
  credit_limit?: number;
  credit_days?: number;
  categories?: unknown[];
  notes?: string;
  is_active?: boolean;
}

export interface CreateStoreLocationRequest {
  code: string;
  name: string;
  location_type?: string;
  department_id?: string;
  facility_id?: string;
  address?: string;
}

export interface UpdateStoreLocationRequest {
  name?: string;
  location_type?: string;
  department_id?: string;
  facility_id?: string;
  address?: string;
  is_active?: boolean;
}

export interface CreatePoItemInput {
  catalog_item_id?: string;
  item_name: string;
  item_code?: string;
  unit?: string;
  quantity_ordered: number;
  unit_price: number;
  tax_percent?: number;
  discount_percent?: number;
  indent_item_id?: string;
  notes?: string;
}

export interface CreatePurchaseOrderRequest {
  vendor_id: string;
  store_location_id?: string;
  indent_requisition_id?: string;
  rate_contract_id?: string;
  expected_delivery?: string;
  payment_terms?: string;
  delivery_terms?: string;
  notes?: string;
  items: CreatePoItemInput[];
}

export interface PoDetailResponse {
  purchase_order: PurchaseOrder;
  items: PurchaseOrderItem[];
}

export interface PoListResponse {
  purchase_orders: PurchaseOrder[];
  total: number;
  page: number;
  per_page: number;
}

export interface CreateGrnItemInput {
  po_item_id?: string;
  catalog_item_id?: string;
  item_name: string;
  quantity_received: number;
  quantity_accepted: number;
  quantity_rejected?: number;
  batch_number?: string;
  expiry_date?: string;
  manufacture_date?: string;
  unit_price: number;
  rejection_reason?: string;
  notes?: string;
}

export interface CreateGrnRequest {
  po_id: string;
  store_location_id?: string;
  invoice_number?: string;
  invoice_date?: string;
  invoice_amount?: number;
  notes?: string;
  items: CreateGrnItemInput[];
}

export interface GrnDetailResponse {
  grn: GoodsReceiptNote;
  items: GrnItem[];
}

export interface GrnListResponse {
  grns: GoodsReceiptNote[];
  total: number;
  page: number;
  per_page: number;
}

export interface CreateRcItemInput {
  catalog_item_id: string;
  contracted_price: number;
  max_quantity?: number;
  notes?: string;
}

export interface CreateRateContractRequest {
  vendor_id: string;
  start_date: string;
  end_date: string;
  payment_terms?: string;
  notes?: string;
  items: CreateRcItemInput[];
}

export interface RcDetailResponse {
  contract: RateContract;
  items: RateContractItem[];
}
