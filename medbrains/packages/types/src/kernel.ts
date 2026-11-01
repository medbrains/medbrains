/** The nightly audit-chain job's last verdict (`audit_chain_verifications`). */
export interface ChainVerdict {
  completed_at: string | null;
  valid: boolean;
  rows_checked: number;
  broken_at: string | null;
}

/** The database role requests run as, and whether row level security binds it. */
export interface RlsMode {
  role: string;
  enforced: boolean;
}

/** One crate and how far it has moved onto the kernel facade. */
export interface FacadeCrate {
  name: string;
  status: "on_facade" | "partial" | "not_yet";
}

/** `GET /api/admin/kernel` — kernel health for operators (RFC-HOSPITAL-OS K1). */
export interface KernelHealth {
  /** Null when the chain has never been verified. */
  audit_chain: ChainVerdict | null;
  rls: RlsMode;
  /** `postgres` or `spicedb`. */
  authz_backend: string;
  /** Scopes the config resolver reads today, most specific first. */
  config_scopes: string[];
  crates: FacadeCrate[];
}
