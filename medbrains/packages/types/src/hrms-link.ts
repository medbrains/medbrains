// External HRMS link (RFC-HRMS-INTEGRATIONS §9) — mirrors
// `crates/medbrains-hrms-gateway/src/routes.rs`.

/** The Humanex connection as a screen may see it: never the key itself. */
export interface HumanexConfigView {
  base_url: string | null;
  enabled: boolean;
  system_user_id: string | null;
  api_key_set: boolean;
}

export interface HumanexConfigInput {
  base_url: string;
  /** Omit to keep the stored key. */
  api_key?: string;
  enabled: boolean;
  system_user_id: string;
}

export interface HrmsEntityOutcome {
  entity: string;
  upserted: number;
  failed: number;
  error: string | null;
}

export interface HrmsSyncStateRow {
  entity: string;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  upserted: number;
  failed: number;
}

export interface HrmsSyncException {
  id: string;
  entity: string;
  record_key: string | null;
  error: string;
  created_at: string;
}

export interface HrmsSyncStatus {
  entities: HrmsSyncStateRow[];
  recent_exceptions: HrmsSyncException[];
}
