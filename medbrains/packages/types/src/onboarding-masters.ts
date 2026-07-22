// Onboarding master types (Services, Bed Types, Tax Categories, Payment Methods).
// Split out of index.ts — re-exported from the @medbrains/types barrel.

// ── Services ─────────────────────────────────────────────

/**
 * Mirrors the `service_type` Postgres enum. `services.service_type` is that
 * enum and the onboarding insert casts to it (`$4::service_type`), so a value
 * outside this set fails the whole onboarding submission.
 */
export type ServiceType =
  | "consultation"
  | "procedure"
  | "investigation"
  | "surgery"
  | "therapy"
  | "nursing"
  | "support"
  | "administrative";

export interface ServiceRow {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  service_type: ServiceType;
  base_price: number;
  department_id: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Bed Types ────────────────────────────────────────────

export interface BedTypeRow {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  daily_rate: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Tax Categories ───────────────────────────────────────

export type TaxApplicability = "taxable" | "exempt" | "zero_rated";

export interface TaxCategoryRow {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  rate_percent: number;
  applicability: TaxApplicability;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Payment Methods ──────────────────────────────────────

export interface PaymentMethodRow {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
