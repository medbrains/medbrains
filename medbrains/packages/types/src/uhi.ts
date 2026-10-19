// UHI (Unified Health Interface) — this hospital as a provider (HSPA) that
// patient apps book through. Mirrors `crates/medbrains-server/src/routes/uhi`.

export type UhiService = "teleconsultation" | "blood_bank" | "ambulance";
export type UhiEnvironment = "sandbox" | "production";

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
  /** The subscriber URL to register; null until the public address is set. */
  subscriber_url: string | null;
  /** Active doctors with an HPR ID — the ones teleconsultation search offers. */
  doctors_with_hpr: number;
}

export interface SaveUhiSettings {
  environment: UhiEnvironment;
  subscriber_id: string;
  unique_key_id: string;
  services: UhiService[];
  facility_id: string | null;
  city_code: string | null;
  is_active: boolean;
}

export type UhiRequestState = "pending" | "confirmed" | "declined" | "cancelled";

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
}
