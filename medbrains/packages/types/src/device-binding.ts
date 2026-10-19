/** A signed QR that binds a staff or patient app to this hospital. */
export interface DeviceBindingCode {
  id: string;
  label: string;
  max_uses: number;
  use_count: number;
  expires_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  issued_by_name: string | null;
  created_at: string;
}

export interface IssueDeviceBindingCodeInput {
  label: string;
  expires_in_hours: number;
  max_uses: number;
}

/** Answered once, at issue: the QR text is not kept and cannot be shown again. */
export interface IssuedDeviceBindingCode {
  id: string;
  label: string;
  max_uses: number;
  expires_at: string;
  tenant_name: string;
  /** `medbrains://bind?t=<signed token>` */
  qr: string;
}
