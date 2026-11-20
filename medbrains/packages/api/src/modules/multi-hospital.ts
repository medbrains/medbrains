/** The `/multi-hospital` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AssignHospitalToGroup,
  CreateDoctorRotation,
  CreateGroupTemplate,
  CreateHospitalGroup,
  CreateHospitalRegion,
  CreatePatientTransfer,
  CreateStockTransfer,
  CreateUserHospitalAssignment,
  DoctorRotationDisplay,
  DoctorRotationSchedule,
  GroupDashboard,
  GroupDrugMaster,
  GroupKpiSnapshot,
  GroupTariffMaster,
  GroupTemplate,
  GroupTestMaster,
  HospitalGroup,
  HospitalInGroup,
  HospitalKpiSummary,
  HospitalPriceOverride,
  HospitalRegion,
  PatientTransfer,
  PatientTransferDisplay,
  StockTransfer,
  StockTransferItem,
  UpdateHospitalGroup,
  UpdateTransferStatus,
  UserHospitalAssignment,
  UserWithAssignments,
} from "@medbrains/types";
import { request } from "../client.js";

export const multiHospitalApi = {
  // ══════════════════════════════════════════════════════════════════════════════
  // Multi-Hospital Management
  // ══════════════════════════════════════════════════════════════════════════════

  // Hospital Groups
  listHospitalGroups: () => request<HospitalGroup[]>("/multi-hospital/groups"),

  getHospitalGroup: (id: string) => request<HospitalGroup>(`/multi-hospital/groups/${id}`),

  createHospitalGroup: (data: CreateHospitalGroup) =>
    request<HospitalGroup>("/multi-hospital/groups", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateHospitalGroup: (id: string, data: UpdateHospitalGroup) =>
    request<HospitalGroup>(`/multi-hospital/groups/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteHospitalGroup: (id: string) =>
    request<void>(`/multi-hospital/groups/${id}`, { method: "DELETE" }),

  // Regions
  listHospitalRegions: (groupId: string) => {
    const sp = new URLSearchParams({ group_id: groupId });
    return request<HospitalRegion[]>(`/multi-hospital/regions?${sp.toString()}`);
  },

  getHospitalRegion: (id: string) => request<HospitalRegion>(`/multi-hospital/regions/${id}`),

  createHospitalRegion: (data: CreateHospitalRegion) =>
    request<HospitalRegion>("/multi-hospital/regions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteHospitalRegion: (id: string) =>
    request<void>(`/multi-hospital/regions/${id}`, { method: "DELETE" }),

  // Hospitals in Group
  listAllHospitals: () => request<HospitalInGroup[]>("/multi-hospital/hospitals"),
  listHospitalsInGroup: (groupId: string) =>
    request<HospitalInGroup[]>(`/multi-hospital/groups/${groupId}/hospitals`),

  assignHospitalToGroup: (data: AssignHospitalToGroup) =>
    request<HospitalInGroup>("/multi-hospital/hospital-assignments", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  removeHospitalFromGroup: (tenantId: string) =>
    request<void>(`/multi-hospital/hospital-assignments/${tenantId}`, { method: "DELETE" }),

  // User Assignments
  getUserHospitalAssignments: (userId: string) =>
    request<UserWithAssignments>(`/multi-hospital/users/${userId}/assignments`),

  listMultiHospitalUsers: (groupId: string) => {
    const sp = new URLSearchParams({ group_id: groupId });
    return request<UserWithAssignments[]>(`/multi-hospital/user-assignments?${sp.toString()}`);
  },

  createUserHospitalAssignment: (data: CreateUserHospitalAssignment) =>
    request<UserHospitalAssignment>("/multi-hospital/user-assignments", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteUserHospitalAssignment: (assignmentId: string) =>
    request<void>(`/multi-hospital/user-assignments/${assignmentId}`, { method: "DELETE" }),

  // Patient Transfers
  listOutgoingPatientTransfers: (params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<PatientTransferDisplay[]>(
      `/multi-hospital/transfers/patients/outgoing${qs ? `?${qs}` : ""}`,
    );
  },

  listIncomingPatientTransfers: (params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<PatientTransferDisplay[]>(
      `/multi-hospital/transfers/patients/incoming${qs ? `?${qs}` : ""}`,
    );
  },

  getPatientTransfer: (id: string) =>
    request<PatientTransfer>(`/multi-hospital/transfers/patients/${id}`),

  createPatientTransfer: (data: CreatePatientTransfer) =>
    request<PatientTransfer>("/multi-hospital/transfers/patients", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePatientTransferStatus: (id: string, data: UpdateTransferStatus) =>
    request<PatientTransfer>(`/multi-hospital/transfers/patients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Stock Transfers
  listOutgoingStockTransfers: (params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<StockTransfer[]>(
      `/multi-hospital/transfers/stock/outgoing${qs ? `?${qs}` : ""}`,
    );
  },

  listIncomingStockTransfers: (params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<StockTransfer[]>(
      `/multi-hospital/transfers/stock/incoming${qs ? `?${qs}` : ""}`,
    );
  },

  getStockTransfer: (id: string) => request<StockTransfer>(`/multi-hospital/transfers/stock/${id}`),

  getStockTransferItems: (transferId: string) =>
    request<StockTransferItem[]>(`/multi-hospital/transfers/stock/${transferId}/items`),

  createStockTransfer: (data: CreateStockTransfer) =>
    request<StockTransfer>("/multi-hospital/transfers/stock", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateStockTransferStatus: (id: string, data: UpdateTransferStatus) =>
    request<StockTransfer>(`/multi-hospital/transfers/stock/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Group KPIs & Dashboard
  getGroupDashboard: (groupId: string, params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<GroupDashboard>(
      `/multi-hospital/groups/${groupId}/dashboard${qs ? `?${qs}` : ""}`,
    );
  },

  listGroupKpis: (groupId: string, params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<GroupKpiSnapshot[]>(
      `/multi-hospital/groups/${groupId}/kpis${qs ? `?${qs}` : ""}`,
    );
  },

  getHospitalKpi: (tenantId: string, params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<HospitalKpiSummary>(
      `/multi-hospital/hospitals/${tenantId}/kpi${qs ? `?${qs}` : ""}`,
    );
  },

  // Doctor Rotation
  listDoctorRotations: (groupId: string, params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<DoctorRotationDisplay[]>(
      `/multi-hospital/groups/${groupId}/rotations${qs ? `?${qs}` : ""}`,
    );
  },

  getDoctorRotation: (doctorId: string, params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<DoctorRotationSchedule[]>(
      `/multi-hospital/doctors/${doctorId}/rotations${qs ? `?${qs}` : ""}`,
    );
  },

  createDoctorRotation: (groupId: string, data: CreateDoctorRotation) =>
    request<DoctorRotationSchedule>(`/multi-hospital/groups/${groupId}/rotations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteDoctorRotation: (id: string) =>
    request<void>(`/multi-hospital/rotations/${id}`, { method: "DELETE" }),

  // Group Masters
  listGroupDrugs: (groupId: string) =>
    request<GroupDrugMaster[]>(`/multi-hospital/groups/${groupId}/drugs`),

  listGroupTests: (groupId: string) =>
    request<GroupTestMaster[]>(`/multi-hospital/groups/${groupId}/tests`),

  listGroupTariffs: (groupId: string) =>
    request<GroupTariffMaster[]>(`/multi-hospital/groups/${groupId}/tariffs`),

  listPriceOverrides: () => request<HospitalPriceOverride[]>("/multi-hospital/price-overrides"),

  // Group Templates
  listGroupTemplates: (groupId: string, templateType?: string) => {
    const sp = new URLSearchParams();
    if (templateType) sp.set("period", templateType);
    const qs = sp.toString();
    return request<GroupTemplate[]>(
      `/multi-hospital/groups/${groupId}/templates${qs ? `?${qs}` : ""}`,
    );
  },

  getGroupTemplate: (id: string) => request<GroupTemplate>(`/multi-hospital/templates/${id}`),

  createGroupTemplate: (groupId: string, data: CreateGroupTemplate) =>
    request<GroupTemplate>(`/multi-hospital/groups/${groupId}/templates`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteGroupTemplate: (id: string) =>
    request<void>(`/multi-hospital/templates/${id}`, { method: "DELETE" }),
};
