// ABDM Scan & Share — counter QR codes and the registration desk's queue of
// shared ABHA profiles. Mirrors
// crates/medbrains-server/src/routes/abdm/scan_share.rs.

export interface AbdmCounterQr {
  facility_id: string;
  facility_name: string;
  /** The campus's HFR facility ID, which ABDM calls the HIP ID. */
  hip_id: string;
  /** What the QR encodes; null only for a blank HIP ID or counter code. */
  payload: string | null;
}

export interface AbdmScanShareCounter {
  station_id: string;
  /** The counter's code, carried in the QR; it never changes. */
  code: string;
  name: string;
  station_type: string;
  qr_codes: AbdmCounterQr[];
}

export interface AbdmScanShareCounters {
  hospital_name: string;
  environment: "sandbox" | "production";
  counters: AbdmScanShareCounter[];
}

export type AbdmProfileShareStatus = "waiting" | "linked" | "registered" | "expired" | "dismissed";

/** The ABHA profile as the patient shared it. */
export interface AbdmSharedProfile {
  abha_number: string | null;
  abha_address: string;
  full_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  /** `male`, `female` or `other`. */
  gender: string | null;
  /** YYYY-MM-DD when the whole date was shared. */
  date_of_birth: string | null;
  year_of_birth: string | null;
  mobile: string | null;
  address: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  counter: string | null;
}

export interface AbdmProfileShare {
  id: string;
  station_id: string | null;
  counter_name: string | null;
  token_number: string | null;
  status: AbdmProfileShareStatus;
  abha_number: string | null;
  abha_address: string;
  profile: AbdmSharedProfile;
  /** The patient whose verified ABHA this is, or who was registered from it. */
  patient_id: string | null;
  patient_uhid: string | null;
  patient_name: string | null;
  expires_at: string;
  created_at: string;
}

export interface CompleteAbdmProfileShare {
  patient_id: string;
}
