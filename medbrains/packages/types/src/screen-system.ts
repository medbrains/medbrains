// Screen system types — split from index.ts, barrel-re-exported.

// ── Screen System ──────────────────────────────────────────

export type ScreenType =
  | "form"
  | "list"
  | "detail"
  | "composite"
  | "wizard"
  | "dashboard"
  | "calendar"
  | "kanban";

export type SidecarTrigger =
  | "screen_load"
  | "screen_exit"
  | "form_submit"
  | "form_validate"
  | "form_save_draft"
  | "field_change"
  | "row_select"
  | "row_action"
  | "interval"
  | "step_enter"
  | "step_leave";

export type ScreenStatus = "draft" | "active" | "deprecated";

export interface ScreenMaster {
  id: string;
  tenant_id: string | null;
  code: string;
  name: string;
  description: string | null;
  screen_type: ScreenType;
  module_code: string | null;
  status: ScreenStatus;
  version: number;
  layout: Record<string, unknown>;
  config: Record<string, unknown>;
  route_path: string | null;
  icon: string | null;
  permission_code: string | null;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  published_at: string | null;
  published_by: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScreenSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  screen_type: ScreenType;
  module_code: string | null;
  status: ScreenStatus;
  version: number;
  route_path: string | null;
  icon: string | null;
  permission_code: string | null;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScreenSidecar {
  id: string;
  screen_id: string;
  name: string;
  description: string | null;
  trigger_event: SidecarTrigger;
  trigger_config: Record<string, unknown>;
  pipeline_id: string | null;
  inline_action: Record<string, unknown> | null;
  condition: Record<string, unknown> | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ResolvedSidecar {
  id: string;
  name: string;
  trigger_event: SidecarTrigger;
  trigger_config: Record<string, unknown>;
  pipeline_id: string | null;
  inline_action: Record<string, unknown> | null;
  condition: Record<string, unknown> | null;
}

export interface ResolvedScreen {
  id: string;
  code: string;
  name: string;
  description: string | null;
  screen_type: ScreenType;
  module_code: string | null;
  version: number;
  layout: Record<string, unknown>;
  config: Record<string, unknown>;
  route_path: string | null;
  icon: string | null;
  permission_code: string | null;
  sidecars: ResolvedSidecar[];
}

export interface ScreenVersionSnapshot {
  id: string;
  screen_id: string;
  version: number;
  name: string;
  screen_type: ScreenType;
  status: ScreenStatus;
  layout: Record<string, unknown>;
  config: Record<string, unknown>;
  form_refs: unknown[];
  sidecars: unknown[];
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ScreenVersionSummary {
  id: string;
  screen_id: string;
  version: number;
  name: string;
  screen_type: ScreenType;
  status: ScreenStatus;
  change_summary: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface TenantScreenOverride {
  id: string;
  screen_id: string;
  screen_code: string;
  screen_name: string;
  layout_patch: Record<string, unknown>;
  config_patch: Record<string, unknown>;
  hidden_zones: string[];
  extra_actions: unknown[];
  is_active: boolean;
  created_at: string;
}

export interface CreateScreenRequest {
  code: string;
  name: string;
  description?: string;
  screen_type: ScreenType;
  module_code?: string;
  route_path?: string;
  icon?: string;
  permission_code?: string;
  layout?: Record<string, unknown>;
  config?: Record<string, unknown>;
  sort_order?: number;
}

export interface UpdateScreenRequest {
  name?: string;
  description?: string;
  module_code?: string;
  route_path?: string;
  icon?: string;
  permission_code?: string;
  layout?: Record<string, unknown>;
  config?: Record<string, unknown>;
  sort_order?: number;
}

export interface CreateSidecarRequest {
  name: string;
  description?: string;
  trigger_event: SidecarTrigger;
  trigger_config?: Record<string, unknown>;
  pipeline_id?: string;
  inline_action?: Record<string, unknown>;
  condition?: Record<string, unknown>;
  sort_order?: number;
}

export interface ScreenOverrideRequest {
  layout_patch?: Record<string, unknown>;
  config_patch?: Record<string, unknown>;
  hidden_zones?: string[];
  extra_actions?: unknown[];
}
