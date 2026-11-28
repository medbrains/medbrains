/** The `/admin` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AiSettings,
  ApiKeySummary,
  ApiKeyUsageRow,
  ApprovedMachine,
  ConnectedApp,
  ConnectedAppCredentials,
  ConnectedAppDelivery,
  CoverageAssignment,
  CreateApiKeyInput,
  CreateCoverageRequest,
  CreateDoctorPackageRequest,
  CreateDoctorRequest,
  CreatedApiKey,
  CreateInclusionRequest,
  CreateSsoGroupMappingRequest,
  CreateSsoProviderRequest,
  DeviceBindingCode,
  DevicePairingRequest,
  DictationConfig,
  DoctorPackage,
  DoctorPackageInclusion,
  DoctorProfile,
  DomainOwnership,
  DomainStatus,
  EmailLogEntry,
  EmailSettings,
  ErrorTrackingSummary,
  InfraStatus,
  Invitation,
  IssueCredentialRequest,
  IssueDeviceBindingCodeInput,
  IssuedDeviceBindingCode,
  KanidmPerson,
  KernelHealth,
  MachineList,
  PackageWithInclusions,
  ProvisionDomainResponse,
  RevokeCredentialRequest,
  SignatureCredential,
  SimulatorInbox,
  SimulatorInboxQuery,
  SsoGroupMapping,
  SsoLink,
  SsoProvider,
  UpdateAiSettingsRequest,
  UpdateDoctorPackageRequest,
  UpdateDoctorRequest,
  UpdateEmailSettingsRequest,
  UpdateSsoProviderRequest,
  WebhookDelivery,
  WebhookInput,
  WebhookSubscription,
  WebhookWithSecret,
} from "@medbrains/types";
import { request } from "../client.js";

export const adminApi = {
  getErrorTrackingSummary: () => request<ErrorTrackingSummary>("/admin/error-tracking/summary"),
  getKernelHealth: () => request<KernelHealth>("/admin/kernel"),

  // ── IAM access requests ──
  // ── API keys ──────────────────────────────────────────────────────────────

  listApiKeys: () => request<ApiKeySummary[]>("/admin/api-keys"),

  /**
   * Issue a key. The response carries the secret, once.
   *
   * A 403 here is usually not a missing `admin.api_keys.create` — it is the
   * escalation guard refusing to mint a key holding permissions the caller
   * does not hold themselves. The message names which ones.
   */
  createApiKey: (data: CreateApiKeyInput) =>
    request<CreatedApiKey>("/admin/api-keys", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  revokeApiKey: (id: string, reason?: string) =>
    request<{ revoked: boolean }>(`/admin/api-keys/${id}/revoke`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  /** What the key actually did — the question asked after a leak. */
  getApiKeyUsage: (id: string) => request<ApiKeyUsageRow[]>(`/admin/api-keys/${id}/usage`),
  listWebhooks: () => request<WebhookSubscription[]>("/admin/webhooks"),
  createWebhook: (data: WebhookInput) =>
    request<WebhookWithSecret>("/admin/webhooks", { method: "POST", body: JSON.stringify(data) }),
  updateWebhook: (id: string, data: WebhookInput) =>
    request<WebhookSubscription>(`/admin/webhooks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  rotateWebhookSecret: (id: string) =>
    request<WebhookWithSecret>(`/admin/webhooks/${id}/rotate-secret`, { method: "POST" }),
  listWebhookDeliveries: (id: string) =>
    request<WebhookDelivery[]>(`/admin/webhooks/${id}/deliveries`),

  // ── connected apps (RFC-HOSPITAL-OS C1) ──────────────────────────────────
  listConnectedApps: () => request<ConnectedApp[]>("/admin/connected-apps"),
  /** Register from a manifest. The response carries the credentials, once. */
  registerConnectedApp: (manifest: unknown) =>
    request<ConnectedAppCredentials>("/admin/connected-apps", {
      method: "POST",
      body: JSON.stringify({ manifest }),
    }),
  approveConnectedApp: (id: string) =>
    request<{ approved: boolean }>(`/admin/connected-apps/${id}/approve`, { method: "POST" }),
  /** Cuts the app off at once: its tokens are revoked in the same transaction. */
  revokeConnectedApp: (id: string, reason?: string) =>
    request<{ revoked: boolean; tokens_revoked: number }>(`/admin/connected-apps/${id}/revoke`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  rotateConnectedAppSecret: (id: string) =>
    request<ConnectedAppCredentials>(`/admin/connected-apps/${id}/rotate-secret`, {
      method: "POST",
    }),
  listConnectedAppDeliveries: (id: string) =>
    request<ConnectedAppDelivery[]>(`/admin/connected-apps/${id}/deliveries`),

  // Message simulator (dev/test only; 404 when the simulator is off)
  listSimulatedMessages: (params: SimulatorInboxQuery) =>
    request<SimulatorInbox>(
      `/admin/message-simulator/messages?${new URLSearchParams(
        Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
      )}`,
    ),
  listSsoProviders: () => request<SsoProvider[]>("/admin/sso/providers"),
  createSsoProvider: (data: CreateSsoProviderRequest) =>
    request<SsoProvider>("/admin/sso/providers", { method: "POST", body: JSON.stringify(data) }),
  updateSsoProvider: (id: string, data: UpdateSsoProviderRequest) =>
    request<SsoProvider>(`/admin/sso/providers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteSsoProvider: (id: string) =>
    request<{ deleted: boolean }>(`/admin/sso/providers/${id}`, { method: "DELETE" }),
  listKanidmPeople: (q: string) =>
    request<KanidmPerson[]>(`/admin/identity/kanidm/people?q=${encodeURIComponent(q)}`),
  getUserSsoLink: (userId: string) => request<SsoLink | null>(`/admin/users/${userId}/sso-link`),
  linkUserSso: (userId: string, subject: string) =>
    request<SsoLink>(`/admin/users/${userId}/sso-link`, {
      method: "PUT",
      body: JSON.stringify({ subject }),
    }),
  unlinkUserSso: (userId: string) =>
    request<{ unlinked: boolean }>(`/admin/users/${userId}/sso-link`, { method: "DELETE" }),
  listSsoGroupMappings: (providerId: string) =>
    request<SsoGroupMapping[]>(`/admin/sso/providers/${providerId}/mappings`),
  createSsoGroupMapping: (providerId: string, data: CreateSsoGroupMappingRequest) =>
    request<SsoGroupMapping>(`/admin/sso/providers/${providerId}/mappings`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteSsoGroupMapping: (id: string) =>
    request<{ deleted: boolean }>(`/admin/sso/mappings/${id}`, { method: "DELETE" }),
  getDictationSettings: () => request<DictationConfig>("/admin/dictation/settings"),
  saveDictationSettings: (data: DictationConfig) =>
    request<DictationConfig>("/admin/dictation/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // ── Infrastructure & AI settings ─────────────────────────
  getInfraStatus: () => request<InfraStatus>("/admin/infra-status"),
  getAiSettings: () => request<AiSettings>("/admin/ai-settings"),
  updateAiSettings: (data: UpdateAiSettingsRequest) =>
    request<AiSettings>("/admin/ai-settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getEmailSettings: () => request<EmailSettings>("/admin/email-settings"),
  getDomainStatus: () => request<DomainStatus>("/admin/domain-status"),
  getDomainOwnership: () => request<DomainOwnership>("/admin/domain-ownership"),
  verifyDomainOwnership: () =>
    request<DomainOwnership>("/admin/domain-ownership/verify", { method: "POST", body: "{}" }),
  provisionMailDomain: (domain: string) =>
    request<ProvisionDomainResponse>("/admin/mail/provision-domain", {
      method: "POST",
      body: JSON.stringify({ domain }),
    }),
  createMailbox: (email: string, password: string) =>
    request<{ email: string; created: boolean }>("/admin/mail/mailboxes", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  getEmailLog: () => request<EmailLogEntry[]>("/admin/email-log"),
  sendEmailTest: (to: string) =>
    request<{ status: string }>("/admin/email-test", {
      method: "POST",
      body: JSON.stringify({ to }),
    }),
  // Team invites
  listInvitations: () => request<Invitation[]>("/admin/invitations"),
  createInvitation: (data: { email: string; role: string; full_name?: string }) =>
    request<Invitation>("/admin/invitations", { method: "POST", body: JSON.stringify(data) }),
  revokeInvitation: (id: string) =>
    request<{ status: string }>(`/admin/invitations/${id}`, { method: "DELETE" }),
  updateEmailSettings: (data: UpdateEmailSettingsRequest) =>
    request<EmailSettings>("/admin/email-settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // ── Doctor Activities ─────────────────────────────────────
  adminListDoctors: (params?: {
    specialty_id?: string;
    is_active?: boolean;
    is_visiting?: boolean;
    search?: string;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.specialty_id) qs.set("specialty_id", params.specialty_id);
    if (params?.is_active !== undefined) qs.set("is_active", String(params.is_active));
    if (params?.is_visiting !== undefined) qs.set("is_visiting", String(params.is_visiting));
    if (params?.search) qs.set("search", params.search);
    if (params?.limit) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return request<DoctorProfile[]>(`/admin/doctors${q ? `?${q}` : ""}`);
  },
  adminGetDoctor: (id: string) =>
    request<DoctorProfile>(`/admin/doctors/${encodeURIComponent(id)}`),
  adminCreateDoctor: (data: CreateDoctorRequest) =>
    request<DoctorProfile>("/admin/doctors", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminUpdateDoctor: (id: string, data: UpdateDoctorRequest) =>
    request<DoctorProfile>(`/admin/doctors/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  adminListSignatureCredentials: (params?: {
    doctor_user_id?: string;
    include_revoked?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params?.doctor_user_id) qs.set("doctor_user_id", params.doctor_user_id);
    if (params?.include_revoked) qs.set("include_revoked", "true");
    const q = qs.toString();
    return request<SignatureCredential[]>(`/admin/signature-credentials${q ? `?${q}` : ""}`);
  },
  adminIssueSignatureCredential: (data: IssueCredentialRequest) =>
    request<{ credential: SignatureCredential }>("/admin/signature-credentials", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminRevokeSignatureCredential: (id: string, data: RevokeCredentialRequest) =>
    request<{ revoked: boolean }>(`/admin/signature-credentials/${encodeURIComponent(id)}/revoke`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Doctor Packages (admin)
  adminListDoctorPackages: (params?: { is_active?: boolean; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.is_active !== undefined) qs.set("is_active", String(params.is_active));
    if (params?.search) qs.set("search", params.search);
    const q = qs.toString();
    return request<DoctorPackage[]>(`/admin/doctor-packages${q ? `?${q}` : ""}`);
  },
  adminGetDoctorPackage: (id: string) =>
    request<PackageWithInclusions>(`/admin/doctor-packages/${encodeURIComponent(id)}`),
  adminCreateDoctorPackage: (data: CreateDoctorPackageRequest) =>
    request<PackageWithInclusions>("/admin/doctor-packages", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminUpdateDoctorPackage: (id: string, data: UpdateDoctorPackageRequest) =>
    request<DoctorPackage>(`/admin/doctor-packages/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  adminAddInclusion: (packageId: string, data: CreateInclusionRequest) =>
    request<DoctorPackageInclusion>(
      `/admin/doctor-packages/${encodeURIComponent(packageId)}/inclusions`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  adminRemoveInclusion: (packageId: string, inclusionId: string) =>
    request<{ deleted: boolean }>(
      `/admin/doctor-packages/${encodeURIComponent(packageId)}/inclusions/${encodeURIComponent(inclusionId)}`,
      { method: "DELETE" },
    ),

  // Coverage (admin)
  adminListCoverage: (params?: {
    absent_doctor_id?: string;
    covering_doctor_id?: string;
    active_now?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params?.absent_doctor_id) qs.set("absent_doctor_id", params.absent_doctor_id);
    if (params?.covering_doctor_id) qs.set("covering_doctor_id", params.covering_doctor_id);
    if (params?.active_now) qs.set("active_now", "true");
    const q = qs.toString();
    return request<CoverageAssignment[]>(`/admin/coverage${q ? `?${q}` : ""}`);
  },
  adminCreateCoverage: (data: CreateCoverageRequest) =>
    request<CoverageAssignment>("/admin/coverage", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  adminDeleteCoverage: (id: string) =>
    request<{ deleted: boolean }>(`/admin/coverage/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  // ── Device pairing (mobile / TV / vendor) ────────────────────────
  mintDevicePairingToken: (data: {
    intended_device_label: string;
    /** Surface code: legacy staff/tv/vendor, or a fine surface e.g. "TV-Ward", "Mobile-Doctor". */
    intended_app_variant: string;
    intended_user_id?: string;
    notes?: string;
    department_id?: string;
    location_label?: string;
    location_scope?: Record<string, unknown>;
    station_id?: string;
  }) =>
    request<{
      id: string;
      token: string;
      qr_payload: string;
      expires_at: string;
      intended_device_label: string;
      intended_app_variant: string;
    }>("/admin/device-pairing-tokens", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listPairedDevices: () =>
    request<
      Array<{
        id: string;
        label: string;
        app_variant: string;
        cert_fingerprint: string;
        issued_to_user_id: string | null;
        department_id: string | null;
        location_label: string | null;
        station_id: string | null;
        station_name: string | null;
        board_module: string | null;
        department_name: string | null;
        paired_at: string;
        last_seen_at: string | null;
        revoked_at: string | null;
      }>
    >("/admin/paired-devices"),

  revokePairedDevice: (id: string, reason?: string) =>
    request<{
      id: string;
      label: string;
      app_variant: string;
      cert_fingerprint: string;
      issued_to_user_id: string | null;
      paired_at: string;
      last_seen_at: string | null;
      revoked_at: string | null;
    }>(`/admin/paired-devices/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    }),

  // ── MedBrains OS machines joining this main machine ──
  listMachines: () => request<MachineList>("/admin/machines"),
  approveMachine: (id: string, code: string) =>
    request<ApprovedMachine>(`/admin/machines/requests/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  getMachineConfirmCode: (id: string) =>
    request<ApprovedMachine>(`/admin/machines/${id}/confirm-code`, { method: "POST" }),
  rejectMachine: (id: string) =>
    request<{ id: string }>(`/admin/machines/requests/${id}/reject`, { method: "POST" }),
  removeMachine: (id: string) =>
    request<{ id: string }>(`/admin/machines/${id}`, { method: "DELETE" }),

  // ── Hospital binding QR codes (apps scan one to bind to this hospital) ──
  listDeviceBindingCodes: () => request<DeviceBindingCode[]>("/admin/device-binding-codes"),
  issueDeviceBindingCode: (data: IssueDeviceBindingCodeInput) =>
    request<IssuedDeviceBindingCode>("/admin/device-binding-codes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  revokeDeviceBindingCode: (id: string, reason?: string) =>
    request<DeviceBindingCode>(`/admin/device-binding-codes/${id}/revoke`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  // ── Storage lifecycle (hot/cold/archive tiers) ──────────────────
  listStoragePolicies: () =>
    request<
      Array<{
        id: string;
        document_category: string;
        hot_to_cold_days: number | null;
        cold_to_archive_days: number | null;
        archive_to_delete_days: number | null;
        retention_years: number;
        description: string | null;
        updated_at: string;
      }>
    >("/admin/storage/policies"),

  updateStoragePolicy: (
    category: string,
    body: {
      hot_to_cold_days?: number | null;
      cold_to_archive_days?: number | null;
      archive_to_delete_days?: number | null;
      retention_years?: number;
      description?: string;
    },
  ) =>
    request<{
      id: string;
      document_category: string;
      hot_to_cold_days: number | null;
      cold_to_archive_days: number | null;
      archive_to_delete_days: number | null;
      retention_years: number;
      description: string | null;
      updated_at: string;
    }>(`/admin/storage/policies/${encodeURIComponent(category)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  getStorageUsage: () =>
    request<{
      tiers: Array<{ tier: string; record_count: number; byte_total: number }>;
      breakdown: Array<{
        category: string;
        tier: string;
        record_count: number;
        byte_total: number;
      }>;
    }>("/admin/storage/usage"),

  listStorageTransitions: (params?: { limit?: number; before?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.before) qs.set("before", params.before);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<
      Array<{
        id: string;
        document_id: string;
        document_table: string;
        from_tier: string;
        to_tier: string;
        byte_size: number | null;
        triggered_by: string;
        triggered_at: string;
        hash: string;
      }>
    >(`/admin/storage/transitions${suffix}`);
  },

  requestStorageRestore: (docId: string, reason?: string) =>
    request<{
      document_id: string;
      current_tier: string;
      status: string;
    }>(`/admin/storage/restore/${docId}`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  triggerStorageSweep: () =>
    request<{ status: string }>("/admin/storage/sweep-now", {
      method: "POST",
    }),
  getSystemStateAdmin: () => request<unknown>("/admin/system_state"),
  updateSystemStateAdmin: (data: Record<string, unknown>) =>
    request<unknown>("/admin/system_state", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getDbTopologyAdmin: () => request<unknown>("/admin/db-topology"),
  updateDbTopologyAdmin: (data: Record<string, unknown>) =>
    request<unknown>("/admin/db-topology", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  // ── Simulator control plane (super_admin / hospital_admin) ──
  listSimulatorSchedules: () =>
    request<import("@medbrains/types").SimulatorSchedule[]>("/admin/simulator/schedules"),
  createSimulatorSchedule: (data: import("@medbrains/types").CreateSimulatorScheduleRequest) =>
    request<import("@medbrains/types").SimulatorSchedule>("/admin/simulator/schedules", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getSimulatorSchedule: (id: string) =>
    request<import("@medbrains/types").SimulatorSchedule>(`/admin/simulator/schedules/${id}`),
  updateSimulatorSchedule: (
    id: string,
    data: import("@medbrains/types").UpdateSimulatorScheduleRequest,
  ) =>
    request<import("@medbrains/types").SimulatorSchedule>(`/admin/simulator/schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteSimulatorSchedule: (id: string) =>
    request<void>(`/admin/simulator/schedules/${id}`, { method: "DELETE" }),
  runSimulatorNow: (id: string) =>
    request<import("@medbrains/types").SimulatorRunNowResponse>(
      `/admin/simulator/schedules/${id}/run-now`,
      { method: "POST" },
    ),
  listSimulatorRuns: (params?: { schedule_id?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.schedule_id) qs.set("schedule_id", params.schedule_id);
    if (params?.limit !== undefined) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<import("@medbrains/types").SimulatorRun[]>(`/admin/simulator/runs${suffix}`);
  },
  getSimulatorRun: (id: string) =>
    request<import("@medbrains/types").SimulatorRunDetail>(`/admin/simulator/runs/${id}`),
  previewSimulator: (profile: import("@medbrains/types").SimulatorProfile) =>
    request<import("@medbrains/types").SimulatorPreviewResponse>("/admin/simulator/preview", {
      method: "POST",
      body: JSON.stringify({ profile }),
    }),
  approveSimulatorRun: (id: string) =>
    request<{ approved: true; run_id: string }>(`/admin/simulator/runs/${id}/approve`, {
      method: "POST",
    }),
  rejectSimulatorRun: (id: string) =>
    request<{ rejected: true; run_id: string; deleted_rows: number }>(
      `/admin/simulator/runs/${id}/reject`,
      { method: "POST" },
    ),
  listAllNews: () => request<import("@medbrains/types").NewsArticle[]>("/admin/news"),
  createNewsArticle: (data: import("@medbrains/types").CreateNewsArticleRequest) =>
    request<import("@medbrains/types").NewsArticle>("/admin/news", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateNewsArticle: (id: string, data: import("@medbrains/types").UpdateNewsArticleRequest) =>
    request<import("@medbrains/types").NewsArticle>(`/admin/news/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteNewsArticle: (id: string) => request<void>(`/admin/news/${id}`, { method: "DELETE" }),
  listDevicePairingRequests: () =>
    request<DevicePairingRequest[]>("/admin/device-pairing/requests"),
  approveDevicePairingRequest: (data: {
    /** The waiting screen, from the list. */
    request_id: string;
    /** The code read off that screen; needed to approve, not to deny. */
    user_code?: string;
    deny?: boolean;
    /** A waiting-room screen: the department whose board it shows. */
    department_id?: string;
    /** A waiting-room screen: which board. */
    board_module?: string;
    /** A customer display (`board_module: "counter_display"`): its counter. */
    station_id?: string;
  }) =>
    request<DevicePairingRequest>("/admin/device-pairing/approve", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
