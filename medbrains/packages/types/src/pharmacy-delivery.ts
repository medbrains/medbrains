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
