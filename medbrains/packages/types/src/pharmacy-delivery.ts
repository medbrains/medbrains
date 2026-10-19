import type { PatientIdentity } from "./medication-timing";

export type DeliveryMode = "runner" | "courier";
export type DeliveryPayment = "prepaid" | "cash_on_delivery";
export type DeliveryStatus = "arranged" | "out_for_delivery" | "delivered" | "failed" | "cancelled";

/** A pharmacy order on its way to the patient's home. */
export interface PharmacyDelivery {
  id: string;
  order_id: string;
  patient_id: string;
  mode: DeliveryMode;
  address: string;
  landmark: string | null;
  pincode: string | null;
  contact_phone: string;
  runner_id: string | null;
  courier_name: string | null;
  tracking_ref: string | null;
  payment: DeliveryPayment;
  delivery_fee: string;
  /** What the runner collects at the door, for cash on delivery. */
  amount_due: string;
  status: DeliveryStatus;
  dispatched_at: string | null;
  delivered_at: string | null;
  cash_collected: string | null;
  failure_reason: string | null;
  /** The patient's refill request, when they asked for it from the portal. */
  refill_request_id: string | null;
  preferred_slot: DeliverySlot | null;
  created_at: string;
}

export interface PharmacyDeliveryList {
  deliveries: PharmacyDelivery[];
  patients: PatientIdentity[];
}

/** What an order may go out as, with the patient's address to prefill. */
export interface DeliveryOptions {
  address: string;
  pincode: string | null;
  contact_phone: string;
  runner_blockers: string[];
  courier_blockers: string[];
  cash_on_delivery: boolean;
  cash_on_delivery_reason: string | null;
  delivery_fee: string;
  bill_balance: string;
}

export interface ArrangeDeliveryRequest {
  order_id: string;
  mode: DeliveryMode;
  address: string;
  landmark?: string;
  pincode?: string;
  contact_phone: string;
  runner_id?: string;
  courier_name?: string;
  tracking_ref?: string;
  payment: DeliveryPayment;
}

export interface DeliveryRunner {
  id: string;
  full_name: string;
}

/** Give a delivery waiting to go to a runner or a courier. */
export interface AssignDeliveryRequest {
  mode: DeliveryMode;
  runner_id?: string;
  courier_name?: string;
  tracking_ref?: string;
}

/** When the patient would like it to come; a preference, not a promise. */
export type DeliverySlot = "morning" | "afternoon" | "evening";

export interface PortalSavedAddress {
  label: string;
  address: string;
  pincode: string | null;
}

/** What a patient may choose for a refill of one prescription. */
export interface PortalDeliveryOffer {
  available: boolean;
  /** Why home delivery isn't offered, in the patient's words. */
  reason: string | null;
  payments: DeliveryPayment[];
  addresses: PortalSavedAddress[];
  contact_phone: string;
  delivery_fee: string;
  slots: DeliverySlot[];
}

/** The patient's home-delivery choice, sent with the refill request. */
export interface PortalDeliveryChoice {
  address: string;
  landmark?: string;
  pincode?: string;
  contact_phone: string;
  preferred_slot?: DeliverySlot;
  payment: DeliveryPayment;
}

export type PortalDeliveryStage =
  | "requested"
  | "awaiting_payment"
  | "being_prepared"
  | "out_for_delivery"
  | "delivered"
  | "failed"
  | "cancelled"
  | "declined"
  | "not_deliverable";

/** A delivery the patient asked for, as they follow it. */
export interface PortalDelivery {
  /** The refill request's id. */
  id: string;
  prescription_id: string;
  drugs: string[];
  stage: PortalDeliveryStage;
  address: string | null;
  preferred_slot: DeliverySlot | null;
  payment: DeliveryPayment | null;
  requested_at: string;
  prepared_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  /** Why it failed, or why the pharmacy couldn't send it. */
  note: string | null;
  /** The runner's first name, or the courier's name. */
  carrier: string | null;
  tracking_ref: string | null;
  /** To pay at the door. */
  amount_due: string | null;
  /** To pay now, at payment_url. */
  pay_amount: string | null;
  payment_url: string | null;
  /** The code to give the runner, while it is on its way. */
  handover_code: string | null;
}
