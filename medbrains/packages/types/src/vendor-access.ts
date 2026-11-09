// MedBrains staff access to this hospital's data, given and watched by the
// hospital (crates/medbrains-it-security/src/vendor_access.rs, migration 1420,
// docs/compliance/vendor-access.md).

export type VendorAccessStatus = "pending_approval" | "active" | "expired" | "revoked";

export interface VendorAccessGrant {
  id: string;
  grantee_user_id: string;
  grantee_email: string;
  grantee_name: string | null;
  reason: string;
  /** Permission modules (`opd`, `lab`, ...) or the one entry `config`. */
  scope: string[];
  is_masked: boolean;
  expires_at: string;
  created_by_name: string | null;
  created_at: string;
  approved_by_name: string | null;
  approved_at: string | null;
  revoked_by_name: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  status: VendorAccessStatus;
  event_count: number;
}

export interface CreateVendorAccessGrant {
  grantee_email: string;
  reason: string;
  scope: string[];
  is_masked: boolean;
  /** 1 to 72; 4 when left out. */
  hours: number;
}

export interface VendorAccessEvent {
  id: string;
  method: string;
  path: string;
  /** Null when the request never answered. */
  status_code: number | null;
  was_masked: boolean;
  created_at: string;
}
