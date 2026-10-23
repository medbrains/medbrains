// UHI (Unified Health Interface) — this hospital as a provider (HSPA) that
// patient apps book through. Mirrors `crates/medbrains-server/src/routes/uhi`.

export type UhiService =
  | "teleconsultation"
  | "physical_consultation"
  | "lab_tests"
  | "blood_bank"
  | "ambulance";
export type UhiEnvironment = "sandbox" | "production";
/** The gateway contract: NHA's 28 Sep 2026 set (v2.0.2), or NHA-ABDM/UHI. */
export type UhiGatewaySpec = "v2_0_2" | "s2";

export interface UhiSettingsView {
  configured: boolean;
  environment: UhiEnvironment;
  subscriber_id: string | null;
  unique_key_id: string | null;
  /** Register this with NHA. The private key is never sent. */
  signing_public_key: string | null;
  key_generated_at: string | null;
  services: UhiService[];
  facility_id: string | null;
  hfr_facility_id: string | null;
  city_code: string | null;
  is_active: boolean;
  gateway_spec: UhiGatewaySpec;
  /** The services this hospital may offer as a UHI provider today. */
  available_services: UhiService[];
  /** The callback URL to submit to NHA; null until the public address is set.
   * Known before NHA issues any ID. */
  subscriber_url: string | null;
  /** Active doctors with an HPR ID — the ones consultation search offers. */
  doctors_with_hpr: number;
  /** Where quoted fees come from. */
  fees: UhiFeeSources;
  /** A teleconsultation with a fee is paid online when booked (Razorpay is the
   * active online provider, and the teleconsultation preview is on);
   * otherwise everything is paid at the hospital. */
  online_payment: boolean;
}

export interface UhiFeeSources {
  /** Of the doctors with an HPR ID, those with their own consultation fee. */
  doctors_with_fee: number;
  /** The charge master's TELECONSULT rate, used when a doctor has none. */
  teleconsult_charge: string | null;
  /** Lab tests the catalogue lets patients book from an app. */
  patient_orderable_tests: number;
}

export interface SaveUhiSettings {
  environment: UhiEnvironment;
  gateway_spec: UhiGatewaySpec;
  /** Issued by NHA after registration; null until then. */
  subscriber_id: string | null;
  unique_key_id: string | null;
  services: UhiService[];
  facility_id: string | null;
  city_code: string | null;
  is_active: boolean;
}

export type UhiRequestState =
  | "awaiting_payment"
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "expired";

export type UhiPaymentType = "ON-ORDER" | "ON-FULFILLMENT";
export type UhiPaymentStatus = "PAID" | "NOT-PAID";

export interface UhiRequest {
  id: string;
  service: UhiService;
  state: UhiRequestState;
  customer_name: string | null;
  customer_phone: string | null;
  customer_abha: string | null;
  /** What was asked for, in a line: the doctor and time, the blood, the pickup. */
  summary: string;
  appointment_id: string | null;
  ambulance_trip_id: string | null;
  decline_reason: string | null;
  confirmed_at: string | null;
  responded_at: string | null;
  updated_at: string;
  /** ON-ORDER (paid online) or ON-FULFILLMENT (at the hospital). */
  payment_type: UhiPaymentType | null;
  /** PAID on a cancelled or expired booking means a refund is due. */
  payment_status: UhiPaymentStatus | null;
  amount: string | null;
  /** A held booking lets go of its slot at this time unless paid. */
  hold_expires_at: string | null;
  /** The lab orders an accepted lab request became. */
  lab_order_ids: string[];
  /** A lab request for a home collection (accepting it books one). */
  home_collection: boolean;
}
