// NHCX — Settings → NHCX, the setup status and the payer directory.

export type NhcxEnvironment = "sandbox" | "production";

/** What is saved for NHCX. Secrets are never returned — only whether one is saved. */
export interface NhcxSettingsView {
  environment: NhcxEnvironment;
  participant_code: string | null;
  client_id: string | null;
  has_client_secret: boolean;
  has_private_key: boolean;
  public_cert_pem: string | null;
  gateway_jwt_public_key_pem: string | null;
  /** `settings` when saved here, `env` when the server's ABDM keys are used, `none` otherwise. */
  credentials_source: "settings" | "env" | "none";
}

/** Blank `client_secret` / `private_key_pem` keep the saved ones. */
export interface SaveNhcxSettings {
  environment: NhcxEnvironment;
  participant_code: string;
  client_id?: string;
  client_secret?: string;
  private_key_pem?: string;
  public_cert_pem?: string;
  gateway_jwt_public_key_pem?: string;
}

export interface NhcxConnectionTest {
  ok: boolean;
  message: string;
}

export interface NhcxStatus {
  ready: boolean;
  environment: NhcxEnvironment;
  /** What is still to be set up, in words. */
  missing: string[];
}

export interface NhcxParticipant {
  id: string;
  participant_code: string;
  participant_name: string;
  role: string;
  is_active: boolean;
  has_encryption_cert: boolean;
}

export interface UpsertNhcxParticipantRequest {
  participant_code: string;
  participant_name: string;
  role?: string;
  /** PEM. Blank keeps the saved certificate. */
  encryption_cert?: string;
}

export interface NhcxQueuedResponse {
  claim_id: string;
  queued: boolean;
  correlation_id: string;
  outbox_event_id: string;
}
