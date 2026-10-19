import type { PatientIdentity } from "./medication-timing";
import type { PortalDeliveryChoice } from "./pharmacy-delivery";
import type { PortalSession } from "./token-board-surfaces";

/** How an item may be sold online. */
export type StoreSaleClass = "otc" | "prescription" | "counter_only";
/** Stock as a patient sees it: never a count. */
export type StoreStock = "available" | "low" | "out";

/** An item in the storefront, as a patient or a guest sees it. */
export interface StoreItem {
  id: string;
  name: string;
  /** The generic (INN) name. */
  inn: string | null;
  manufacturer: string | null;
  category: string | null;
  pack: string | null;
  schedule: string | null;
  sale_class: StoreSaleClass;
  prescription_needed: boolean;
  /** Why it can't be ordered online, or must be collected. */
  note: string | null;
  pickup_only: boolean;
  stock: StoreStock;
  mrp: string | null;
  price: string | null;
  max_quantity: number;
  on_sale: boolean;
}

export interface StoreSearchResult {
  items: StoreItem[];
  categories: string[];
}

export interface StoreItemPage {
  item: StoreItem;
  /** Same INN, for comparison: never substituted without consent. */
  substitutes: StoreItem[];
}

export interface StoreGrievanceOfficer {
  name: string;
  email: string;
  phone: string;
}

/** The storefront's legal footer, and whether it takes orders. */
export interface StoreAbout {
  open: boolean;
  missing: string[];
  pharmacy_name: string;
  address: string | null;
  drug_licence: string | null;
  gstin: string | null;
  pharmacist_name: string | null;
  pharmacist_registration: string | null;
  grievance_officer: StoreGrievanceOfficer | null;
  return_window_days: number;
}

/** Somebody a shared mobile belongs to: enough to pick themselves. */
export interface PortalPerson {
  id: string;
  name: string;
  birth_year: number | null;
}

/** A portal sign-in: the session, or who to choose between. */
export type PortalVerifyResult = PortalSession | { choose: PortalPerson[] };

export interface StoreNewCustomer {
  name: string;
  address?: string;
  pincode?: string;
  date_of_birth?: string;
  gender?: "male" | "female" | "other";
}

export interface StoreSignInRequest {
  phone: string;
  code: string;
  patient_id?: string;
  customer?: StoreNewCustomer;
}

export interface StoreSignIn {
  session: PortalSession | null;
  needs_details: boolean;
  choose: PortalPerson[];
}

export interface StoreCartLine {
  item: StoreItem;
  quantity: number;
  from_prescription: boolean;
  line_total: string | null;
}

export interface StoreCart {
  lines: StoreCartLine[];
  total: string;
  prescription_needed: boolean;
  prescription_uploaded: boolean;
  max_lines: number;
}

export type StorePrescriptionSource = "none" | "hospital" | "upload";

export interface StoreCheckoutRequest {
  prescription_source: StorePrescriptionSource;
  prescription_id?: string;
  delivery?: PortalDeliveryChoice;
}

export type StoreOrderStatus = "awaiting_verification" | "released" | "rejected" | "cancelled";
export type StoreLineStatus = "pending" | "approved" | "rejected";
export type StoreRejectReason =
  | "expired"
  | "illegible"
  | "not_on_prescription"
  | "quantity_exceeds_prescription"
  | "needs_consultation"
  | "other";

export interface StoreOrderLine {
  catalog_item_id: string;
  drug_name: string;
  quantity: number;
  unit_price: string | null;
  status: StoreLineStatus;
  approved_quantity: number | null;
  reject_reason: StoreRejectReason | null;
}

export interface StoreOrder {
  id: string;
  status: StoreOrderStatus;
  rx_source: StorePrescriptionSource;
  fulfilment: "pickup" | "delivery";
  delivery_payment: string | null;
  placed_at: string | null;
  decision_note: string | null;
  /** Where the pharmacy is with it once released. */
  pharmacy_stage: string | null;
  lines: StoreOrderLine[];
  total: string;
}

export interface StoreOrderedPrescription {
  prescription_id: string;
  cart: StoreCart;
  left_out: { drug_name: string; reason: string }[];
}

/** An order in the pharmacist's verification queue. */
export interface StorefrontQueueRow extends StoreOrder {
  patient_id: string;
  has_prescription: boolean;
  prescription_reused: boolean;
  prescription_id: string | null;
  record_address: string | null;
  prescriber_name: string | null;
  prescriber_registration: string | null;
  verified_at: string | null;
}

export interface StorefrontQueue {
  orders: StorefrontQueueRow[];
  patients: PatientIdentity[];
}

export interface StorefrontLineDecision {
  catalog_item_id: string;
  approve: boolean;
  quantity?: number;
  reason?: StoreRejectReason;
}

export interface StorefrontVerifyRequest {
  lines: StorefrontLineDecision[];
  note?: string;
  prescriber_name?: string;
  prescriber_registration?: string;
  patient_address?: string;
}

export interface StorefrontSettings {
  enabled: boolean;
  discounts: { rx: string | number; otc: string | number };
  min_shelf_life_days: number;
  restricted_max_units: number;
  pharmacist_in_charge: string | null;
  grievance_officer: StoreGrievanceOfficer | null;
  return_window_days: number;
  /** Read only: whether patients can order, and what is still needed. */
  open?: boolean;
  missing?: string[];
}

export interface StorefrontListing {
  sold_online?: boolean;
  habit_forming?: boolean;
}

/** One line of the Schedule H1 register. */
export interface H1RegisterEntry {
  dispensed_at: string | null;
  order_id: string;
  drug_name: string;
  batch_number: string | null;
  expiry_date: string | null;
  quantity: number;
  patient_name: string | null;
  patient_address: string | null;
  prescriber_name: string | null;
  prescriber_registration: string | null;
  bill_number: string | null;
}
