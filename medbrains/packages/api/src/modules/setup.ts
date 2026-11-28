/** The `/setup` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AssignUserFacilitiesRequest,
  BedTypeRow,
  BulkCreateUsersRequest,
  CompletenessCheck,
  ComplianceRow,
  CreateInsuranceProviderRequest,
  CreateMasterItemRequest,
  CsvImportRequest,
  CsvImportResult,
  CustomRole,
  DepartmentRow,
  Facility,
  FieldAccessLevel,
  InsuranceProvider,
  LocationDirectoryRow,
  LocationRow,
  MasterItem,
  ModuleConfig,
  OnboardingWorkbook,
  PaymentMethodRow,
  PrintTemplateRequest,
  SecureTenantSettingRow,
  SeedModuleMastersRequest,
  SeedModuleMastersResponse,
  SequenceRow,
  ServiceRow,
  SetupUser,
  StaffLocationAssignment,
  SystemHealth,
  TaxCategoryRow,
  TenantSettingsRow,
  TenantSummary,
  UpdateInsuranceProviderRequest,
  UpdateMasterItemRequest,
  UpdateSecureDeviceSettingRequest,
  UserFacilityAssignment,
  UserImportResult,
  WidgetAccessLevel,
  WorkbookImportResult,
  WorkbookSheets,
} from "@medbrains/types";
import { request } from "../client.js";

export const setupApi = {
  getOnboardingWorkbook: () => request<OnboardingWorkbook>("/setup/workbook"),
  importOnboardingWorkbook: (data: WorkbookSheets & { dry_run: boolean }) =>
    request<WorkbookImportResult>("/setup/workbook/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Setup — tenant
  getTenant: () => request<TenantSummary>("/setup/tenant"),
  updateTenant: (data: Partial<TenantSummary>) =>
    request<TenantSummary>("/setup/tenant", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  updateTenantGeo: (data: { country_id?: string; state_id?: string; district_id?: string }) =>
    request<{ status: string; defaults_applied?: boolean }>("/setup/tenant/geo", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  createCompliance: (data: {
    facility_id: string;
    regulatory_body_id: string;
    license_number?: string;
    status?: string;
  }) =>
    request<unknown>("/setup/compliance", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Setup — facilities
  listFacilities: () => request<Facility[]>("/setup/facilities"),
  createFacility: (data: {
    code: string;
    name: string;
    facility_type: string;
    parent_id?: string;
    address_line1?: string;
    city?: string;
    phone?: string;
    email?: string;
    bed_count?: number;
    shared_billing?: boolean;
    shared_pharmacy?: boolean;
    shared_lab?: boolean;
    shared_hr?: boolean;
  }) =>
    request<Facility>("/setup/facilities", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateFacility: (id: string, data: Record<string, unknown>) =>
    request<Facility>(`/setup/facilities/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteFacility: (id: string) =>
    request<{ status: string }>(`/setup/facilities/${id}`, {
      method: "DELETE",
    }),

  // Setup — locations
  listLocations: () => request<LocationRow[]>("/setup/locations"),
  listLocationDirectory: () => request<LocationDirectoryRow[]>("/setup/locations/directory"),
  listLocationStaff: (locationId: string) =>
    request<StaffLocationAssignment[]>(`/setup/locations/${locationId}/staff`),
  assignLocationStaff: (
    locationId: string,
    data: { user_id: string; role_label?: string; is_primary?: boolean },
  ) =>
    request<{ status: string }>(`/setup/locations/${locationId}/staff`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removeLocationStaff: (locationId: string, userId: string) =>
    request<{ status: string }>(`/setup/locations/${locationId}/staff/${userId}`, {
      method: "DELETE",
    }),
  createLocation: (data: { parent_id?: string; level: string; code: string; name: string }) =>
    request<LocationRow>("/setup/locations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateLocation: (id: string, data: Record<string, unknown>) =>
    request<LocationRow>(`/setup/locations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteLocation: (id: string) =>
    request<{ status: string }>(`/setup/locations/${id}`, {
      method: "DELETE",
    }),

  // Setup — departments
  listDepartments: () => request<DepartmentRow[]>("/setup/departments"),
  createDepartment: (data: {
    code: string;
    name: string;
    department_type: string;
    parent_id?: string;
  }) =>
    request<DepartmentRow>("/setup/departments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateDepartment: (id: string, data: Record<string, unknown>) =>
    request<DepartmentRow>(`/setup/departments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteDepartment: (id: string) =>
    request<{ status: string }>(`/setup/departments/${id}`, {
      method: "DELETE",
    }),

  // Setup — roles
  listRoles: () => request<CustomRole[]>("/setup/roles"),
  createRole: (data: {
    code: string;
    name: string;
    description?: string;
    permissions?: Record<string, unknown>;
  }) =>
    request<CustomRole>("/setup/roles", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateRole: (
    id: string,
    data: {
      name?: string;
      description?: string;
      permissions?: Record<string, unknown>;
      is_active?: boolean;
    },
  ) =>
    request<CustomRole>(`/setup/roles/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteRole: (id: string) =>
    request<{ status: string }>(`/setup/roles/${id}`, { method: "DELETE" }),
  updateRolePermissions: (id: string, permissions: string[]) =>
    request<CustomRole>(`/setup/roles/${id}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissions }),
    }),
  updateRoleFieldAccess: (id: string, fieldAccess: Record<string, FieldAccessLevel>) =>
    request<CustomRole>(`/setup/roles/${id}/field-access`, {
      method: "PUT",
      body: JSON.stringify({ field_access: fieldAccess }),
    }),
  updateRoleWidgetAccess: (id: string, widgetAccess: Record<string, WidgetAccessLevel>) =>
    request<CustomRole>(`/setup/roles/${id}/widget-access`, {
      method: "PUT",
      body: JSON.stringify({ widget_access: widgetAccess }),
    }),

  // Setup — users
  listSetupUsers: () => request<SetupUser[]>("/setup/users"),
  listDoctors: () => request<SetupUser[]>("/setup/doctors"),

  createSetupUser: (data: {
    username: string;
    email: string;
    password: string;
    full_name: string;
    role: string;
    specialization?: string;
    medical_registration_number?: string;
    qualification?: string;
    consultation_fee?: number;
    department_ids?: string[];
    /** Access-group memberships — each id must exist in `access_groups`. */
    group_ids?: string[];
    /** `{ extra: string[], denied: string[], field_access?: ..., widget_access?: ... }` */
    access_matrix?: Record<string, unknown>;
  }) =>
    request<SetupUser>("/setup/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSetupUser: (id: string, data: Record<string, unknown>) =>
    request<SetupUser>(`/setup/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  setUserSupervisor: (id: string, supervisorId: string | null) =>
    request<{ status: string }>(`/setup/users/${id}/supervisor`, {
      method: "PUT",
      body: JSON.stringify({ supervisor_id: supervisorId }),
    }),
  deleteSetupUser: (id: string) =>
    request<{ status: string }>(`/setup/users/${id}`, { method: "DELETE" }),
  exportTenantConfig: () =>
    request<{
      bundle_version: number;
      exported_at: string;
      settings: { category: string; key: string; value: unknown }[];
      document_templates: unknown[];
    }>("/setup/config-export"),
  importTenantConfig: (data: { bundle: unknown; dry_run?: boolean }) =>
    request<{
      dry_run: boolean;
      total_changes: number;
      changes: { kind: string; item: string; action: string }[];
    }>("/setup/config-import", { method: "POST", body: JSON.stringify(data) }),
  resetSetupUserPassword: (id: string, data: { new_password?: string }) =>
    request<{ status: string; temp_password?: string }>(`/setup/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Setup — user-facility assignments
  listUserFacilities: (userId: string) =>
    request<UserFacilityAssignment[]>(`/setup/users/${userId}/facilities`),
  assignUserFacilities: (userId: string, data: AssignUserFacilitiesRequest) =>
    request<UserFacilityAssignment[]>(`/setup/users/${userId}/facilities`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Setup — auto-create compliance checklist
  autoCreateCompliance: (facilityId: string) =>
    request<ComplianceRow[]>(`/setup/facilities/${facilityId}/auto-compliance`, {
      method: "POST",
    }),

  updateUserAccessMatrix: (
    id: string,
    data: {
      extra_permissions: string[];
      denied_permissions: string[];
      field_access?: Record<string, FieldAccessLevel>;
      widget_access?: Record<string, WidgetAccessLevel>;
    },
  ) =>
    request<{ status: string }>(`/setup/users/${id}/access-matrix`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Setup — modules
  listModules: () => request<ModuleConfig[]>("/setup/modules"),
  updateModule: (code: string, data: { status: string; together?: boolean }) =>
    request<ModuleConfig>(`/setup/modules/${code}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Setup — edition (deployment mode)
  getEdition: () => request<{ hospital_type: string | null }>("/setup/edition"),
  applyEdition: (hospitalType: string) =>
    request<{ hospital_type: string; enabled: number; disabled: number }>("/setup/edition/apply", {
      method: "POST",
      body: JSON.stringify({ hospital_type: hospitalType }),
    }),

  // Setup — sequences
  listSequences: () => request<SequenceRow[]>("/setup/sequences"),
  createSequence: (data: { seq_type: string; prefix: string; pad_width: number }) =>
    request<SequenceRow>("/setup/sequences", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSequence: (seqType: string, data: { prefix?: string; pad_width?: number }) =>
    request<SequenceRow>(`/setup/sequences/${seqType}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteSequence: (seqType: string) =>
    request<{ status: string }>(`/setup/sequences/${seqType}`, { method: "DELETE" }),

  // Setup — services
  listServices: () => request<ServiceRow[]>("/setup/services"),
  createService: (data: {
    code: string;
    name: string;
    service_type: string;
    base_price?: number;
    department_id?: string | null;
    description?: string;
  }) =>
    request<ServiceRow>("/setup/services", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateService: (id: string, data: Record<string, unknown>) =>
    request<ServiceRow>(`/setup/services/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteService: (id: string) =>
    request<{ status: string }>(`/setup/services/${id}`, { method: "DELETE" }),
  importServices: (data: CsvImportRequest) =>
    request<CsvImportResult>("/setup/services/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Setup — bed types
  listBedTypes: () => request<BedTypeRow[]>("/setup/bed-types"),
  createBedType: (data: { code: string; name: string; daily_rate: number; description?: string }) =>
    request<BedTypeRow>("/setup/bed-types", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateBedType: (id: string, data: Record<string, unknown>) =>
    request<BedTypeRow>(`/setup/bed-types/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteBedType: (id: string) =>
    request<{ status: string }>(`/setup/bed-types/${id}`, { method: "DELETE" }),

  // Setup — tax categories
  listTaxCategories: () => request<TaxCategoryRow[]>("/setup/tax-categories"),
  createTaxCategory: (data: {
    code: string;
    name: string;
    rate_percent: number;
    applicability: string;
    description?: string;
  }) =>
    request<TaxCategoryRow>("/setup/tax-categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateTaxCategory: (id: string, data: Record<string, unknown>) =>
    request<TaxCategoryRow>(`/setup/tax-categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteTaxCategory: (id: string) =>
    request<{ status: string }>(`/setup/tax-categories/${id}`, { method: "DELETE" }),

  // Setup — payment methods
  listPaymentMethods: () => request<PaymentMethodRow[]>("/setup/payment-methods"),
  createPaymentMethod: (data: { code: string; name: string; is_default?: boolean }) =>
    request<PaymentMethodRow>("/setup/payment-methods", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePaymentMethod: (id: string, data: Record<string, unknown>) =>
    request<PaymentMethodRow>(`/setup/payment-methods/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deletePaymentMethod: (id: string) =>
    request<{ status: string }>(`/setup/payment-methods/${id}`, { method: "DELETE" }),

  // Setup — branding
  getBranding: () => request<TenantSettingsRow[]>("/setup/branding"),
  updateBranding: (data: { key: string; value: unknown }) =>
    request<TenantSettingsRow>("/setup/branding", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Setup — generic tenant settings
  getTenantSettings: (category: string) =>
    request<TenantSettingsRow[]>(`/setup/settings?category=${encodeURIComponent(category)}`),
  updateTenantSetting: (data: { category: string; key: string; value: unknown }) =>
    request<TenantSettingsRow>("/setup/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getSecureDeviceSettings: () => request<SecureTenantSettingRow[]>("/setup/device-settings"),
  updateSecureDeviceSetting: (data: UpdateSecureDeviceSettingRequest) =>
    request<SecureTenantSettingRow>("/setup/device-settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Setup — module master data seeding
  seedModuleMasters: (data: SeedModuleMastersRequest) =>
    request<SeedModuleMastersResponse>("/setup/module-masters", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  importLocations: (data: CsvImportRequest) =>
    request<CsvImportResult>("/setup/locations/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  importDepartments: (data: CsvImportRequest) =>
    request<CsvImportResult>("/setup/departments/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  importUsers: (data: CsvImportRequest) =>
    request<UserImportResult>("/setup/users/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Setup — print templates
  getPrintTemplates: () => request<TenantSettingsRow[]>("/setup/print-templates"),
  upsertPrintTemplate: (data: PrintTemplateRequest) =>
    request<{ status: string; template_type: string; value: unknown }>("/setup/print-templates", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Masters — Admin CRUD
  adminListReligions: () => request<MasterItem[]>("/setup/masters/religions"),
  adminCreateReligion: (data: CreateMasterItemRequest) =>
    request<MasterItem>("/setup/masters/religions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminUpdateReligion: (id: string, data: UpdateMasterItemRequest) =>
    request<MasterItem>(`/setup/masters/religions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  adminDeleteReligion: (id: string) =>
    request<{ status: string }>(`/setup/masters/religions/${id}`, {
      method: "DELETE",
    }),

  adminListOccupations: () => request<MasterItem[]>("/setup/masters/occupations"),
  adminCreateOccupation: (data: CreateMasterItemRequest) =>
    request<MasterItem>("/setup/masters/occupations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminUpdateOccupation: (id: string, data: UpdateMasterItemRequest) =>
    request<MasterItem>(`/setup/masters/occupations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  adminDeleteOccupation: (id: string) =>
    request<{ status: string }>(`/setup/masters/occupations/${id}`, {
      method: "DELETE",
    }),

  adminListRelations: () => request<MasterItem[]>("/setup/masters/relations"),
  adminCreateRelation: (data: CreateMasterItemRequest) =>
    request<MasterItem>("/setup/masters/relations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminUpdateRelation: (id: string, data: UpdateMasterItemRequest) =>
    request<MasterItem>(`/setup/masters/relations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  adminDeleteRelation: (id: string) =>
    request<{ status: string }>(`/setup/masters/relations/${id}`, {
      method: "DELETE",
    }),

  adminListInsuranceProviders: () =>
    request<InsuranceProvider[]>("/setup/masters/insurance-providers"),
  adminCreateInsuranceProvider: (data: CreateInsuranceProviderRequest) =>
    request<InsuranceProvider>("/setup/masters/insurance-providers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminImportInsuranceProviders: (data: CsvImportRequest) =>
    request<CsvImportResult>("/setup/masters/insurance-providers/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminUpdateInsuranceProvider: (id: string, data: UpdateInsuranceProviderRequest) =>
    request<InsuranceProvider>(`/setup/masters/insurance-providers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  adminDeleteInsuranceProvider: (id: string) =>
    request<{ status: string }>(`/setup/masters/insurance-providers/${id}`, {
      method: "DELETE",
    }),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Setup
  // ══════════════════════════════════════════════════════════

  bulkCreateUsers: (data: BulkCreateUsersRequest) =>
    request<{ created: number }>("/setup/users/bulk", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  seedDepartmentTemplate: () =>
    request<{ created: number }>("/setup/departments/template", { method: "POST" }),

  completenessCheck: () => request<CompletenessCheck>("/setup/completeness"),

  systemHealth: () => request<SystemHealth>("/setup/health"),

  exportConfig: () => request<Record<string, unknown>>("/setup/config/export"),

  importConfig: (data: Record<string, unknown>) =>
    request<{ success: true }>("/setup/config/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Contract coverage for backend-registered operational endpoints ──
  listSetupBrandEntities: () => request<unknown>("/setup/brand-entities"),
  createSetupBrandEntity: (data: Record<string, unknown>) =>
    request<unknown>("/setup/brand-entities", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSetupBrandEntity: (id: string, data: Record<string, unknown>) =>
    request<unknown>(`/setup/brand-entities/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteSetupBrandEntity: (id: string) =>
    request<unknown>(`/setup/brand-entities/${id}`, { method: "DELETE" }),
  listVisibleScreensForUser: (userId: string) =>
    request<unknown>(`/setup/users/${userId}/visible-screens`),
};
