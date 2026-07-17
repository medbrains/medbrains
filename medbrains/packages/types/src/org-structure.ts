// Org-structure types (Departments, Working Hours, Roles, Modules, Sequences, Tenant Settings) — split from index.ts, barrel-re-exported.
import type { FieldAccessLevel } from "./common";

// Departments
export interface DepartmentRow {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  code: string;
  name: string;
  department_type: string;
  working_hours: WorkingHours;
  is_active: boolean;
}

// Working Hours
export interface TimeSlot {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

export interface DaySchedule {
  morning?: TimeSlot;
  evening?: TimeSlot;
}

export type WorkingHours = Record<string, DaySchedule | null>;

// Roles
export type WidgetAccessLevel = "visible" | "hidden";

export interface CustomRole {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: Record<string, unknown>;
  field_access_defaults: Record<string, FieldAccessLevel>;
  widget_access_defaults: Record<string, WidgetAccessLevel>;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Modules
export type ModuleStatus = "available" | "enabled" | "disabled" | "coming_soon";

export interface ModuleConfig {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description: string | null;
  status: ModuleStatus;
  config: Record<string, unknown>;
  depends_on: string[];
  created_at: string;
  updated_at: string;
}

// Sequences
export interface SequenceRow {
  id: string;
  tenant_id: string;
  seq_type: string;
  prefix: string;
  current_val: number;
  pad_width: number;
}

// Tenant Settings (branding etc.)
export interface TenantSettingsRow {
  id: string;
  tenant_id: string;
  category: string;
  key: string;
  value: unknown;
  created_at: string;
  updated_at: string;
}

export type SecureDeviceSettingsKey =
  | "pacs_dicom"
  | "lab_interface"
  | "biometric"
  | "printing"
  | "queue_display";

export interface SecureTenantSettingRow {
  id: string;
  tenant_id: string;
  category: string;
  key: SecureDeviceSettingsKey;
  value: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  has_secrets: boolean;
  masked_secret_fields: string[];
  is_configured: boolean;
}

export interface UpdateSecureDeviceSettingRequest {
  key: SecureDeviceSettingsKey;
  value: Record<string, unknown>;
}
