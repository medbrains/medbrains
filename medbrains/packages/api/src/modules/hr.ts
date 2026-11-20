/** The `/hr` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  Appraisal,
  AttendanceRecord,
  CampusFence,
  CreateAppraisalRequest,
  CreateAttendanceRequest,
  CreateCredentialRequest,
  CreateDesignationRequest,
  CreateEmployeeRequest,
  CreateLeaveRequestInput,
  CreateOnCallRequest,
  CreatePayrollRunRequest,
  CreateRosterRequest,
  CreateShiftRequest,
  CreateStatutoryRecordRequest,
  CreateTrainingProgramRequest,
  CreateTrainingRecordRequest,
  Designation,
  DutyHoursRow,
  DutyRoster,
  Employee,
  EmployeeCredential,
  GeofenceMode,
  GeofenceSettings,
  Holiday,
  HolidayCalendar,
  HolidayInput,
  LeaveActionRequest,
  LeaveBalance,
  LeaveDayCount,
  LeaveListRow,
  LeaveRequest,
  MyProfileResponse,
  MyShiftResponse,
  OnCallSchedule,
  PayrollRun,
  Payslip,
  PunchFix,
  SalaryStructure,
  SetCampusFenceRequest,
  ShiftDefinition,
  StatutoryRecord,
  TeamLeaveResponse,
  TrainingComplianceRow,
  TrainingProgram,
  TrainingRecord,
  UpdateCredentialRequest,
  UpdateDesignationRequest,
  UpdateEmployeeRequest,
  UpdateMyProfileRequest,
  UpdateShiftRequest,
  UpsertSalaryStructureRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const hrApi = {
  // ── HR & Staff Management ──────────────────────────────

  // Designations
  listDesignations: () => request<Designation[]>("/hr/designations"),

  createDesignation: (data: CreateDesignationRequest) =>
    request<Designation>("/hr/designations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateDesignation: (id: string, data: UpdateDesignationRequest) =>
    request<Designation>(`/hr/designations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Employees
  listEmployees: (params?: {
    search?: string;
    department_id?: string;
    status?: string;
    employment_type?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.department_id) qs.set("department_id", params.department_id);
    if (params?.status) qs.set("status", params.status);
    if (params?.employment_type) qs.set("employment_type", params.employment_type);
    const q = qs.toString();
    return request<Employee[]>(`/hr/employees${q ? `?${q}` : ""}`);
  },

  getEmployee: (id: string) => request<Employee>(`/hr/employees/${id}`),

  // HR — Payroll
  listSalaryStructures: () => request<SalaryStructure[]>("/hr/payroll/structures"),
  upsertSalaryStructure: (data: UpsertSalaryStructureRequest) =>
    request<SalaryStructure>("/hr/payroll/structures", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listPayrollRuns: () => request<PayrollRun[]>("/hr/payroll/runs"),
  createPayrollRun: (data: CreatePayrollRunRequest) =>
    request<PayrollRun>("/hr/payroll/runs", { method: "POST", body: JSON.stringify(data) }),
  finalizePayrollRun: (id: string) =>
    request<PayrollRun>(`/hr/payroll/runs/${id}/finalize`, { method: "POST" }),
  listPayslips: (runId: string) => request<Payslip[]>(`/hr/payroll/payslips?run_id=${runId}`),

  // Self-service: the signed-in staff member's own employee profile.
  getMyProfile: () => request<MyProfileResponse>("/hr/me/profile"),
  updateMyProfile: (data: UpdateMyProfileRequest) =>
    request<MyProfileResponse>("/hr/me/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  createEmployee: (data: CreateEmployeeRequest) =>
    request<Employee>("/hr/employees", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateEmployee: (id: string, data: UpdateEmployeeRequest) =>
    request<Employee>(`/hr/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Credentials
  listCredentials: (employeeId: string) =>
    request<EmployeeCredential[]>(`/hr/employees/${employeeId}/credentials`),

  createCredential: (employeeId: string, data: CreateCredentialRequest) =>
    request<EmployeeCredential>(`/hr/employees/${employeeId}/credentials`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCredential: (employeeId: string, credentialId: string, data: UpdateCredentialRequest) =>
    request<EmployeeCredential>(`/hr/employees/${employeeId}/credentials/${credentialId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Shifts
  listShifts: () => request<ShiftDefinition[]>("/hr/shifts"),

  createShift: (data: CreateShiftRequest) =>
    request<ShiftDefinition>("/hr/shifts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateShift: (id: string, data: UpdateShiftRequest) =>
    request<ShiftDefinition>(`/hr/shifts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Duty Rosters
  listRosters: (params?: { department_id?: string; date_from?: string; date_to?: string }) => {
    const qs = new URLSearchParams();
    if (params?.department_id) qs.set("department_id", params.department_id);
    if (params?.date_from) qs.set("date_from", params.date_from);
    if (params?.date_to) qs.set("date_to", params.date_to);
    const q = qs.toString();
    return request<DutyRoster[]>(`/hr/rosters${q ? `?${q}` : ""}`);
  },

  createRoster: (data: CreateRosterRequest) =>
    request<DutyRoster>("/hr/rosters", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  approveSwap: (id: string) =>
    request<DutyRoster>(`/hr/rosters/${id}/approve-swap`, {
      method: "PUT",
    }),

  // Attendance
  listAttendance: (params?: {
    department_id?: string;
    date_from?: string;
    date_to?: string;
    employee_id?: string;
    flagged?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params?.department_id) qs.set("department_id", params.department_id);
    if (params?.date_from) qs.set("date_from", params.date_from);
    if (params?.date_to) qs.set("date_to", params.date_to);
    if (params?.employee_id) qs.set("employee_id", params.employee_id);
    if (params?.flagged) qs.set("flagged", "true");
    const q = qs.toString();
    return request<AttendanceRecord[]>(`/hr/attendance${q ? `?${q}` : ""}`);
  },

  createAttendance: (data: CreateAttendanceRequest) =>
    request<AttendanceRecord>("/hr/attendance", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listDutyHours: () => request<DutyHoursRow[]>("/hr/duty-hours"),
  getMyShift: () => request<MyShiftResponse | null>("/hr/my-shift"),
  getGeofenceSettings: () => request<GeofenceSettings>("/hr/attendance/geofence"),
  setGeofenceMode: (mode: GeofenceMode) =>
    request<{ mode: GeofenceMode }>("/hr/attendance/geofence/mode", {
      method: "PUT",
      body: JSON.stringify({ mode }),
    }),
  setCampusFence: (id: string, data: SetCampusFenceRequest) =>
    request<CampusFence>(`/hr/attendance/geofence/campuses/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  /** A punch with no fix (location denied) still sends a body. */
  startShift: (fix?: PunchFix | null) =>
    request<MyShiftResponse>("/hr/my-shift/start", {
      method: "POST",
      body: JSON.stringify(fix ?? {}),
    }),
  extendShift: (data: { hours: number; reason?: string }) =>
    request<MyShiftResponse>("/hr/my-shift/extend", { method: "POST", body: JSON.stringify(data) }),
  pauseShift: () => request<MyShiftResponse>("/hr/my-shift/pause", { method: "POST" }),
  resumeShift: () => request<MyShiftResponse>("/hr/my-shift/resume", { method: "POST" }),
  endShift: (fix?: PunchFix | null) =>
    request<MyShiftResponse>("/hr/my-shift/end", {
      method: "POST",
      body: JSON.stringify(fix ?? {}),
    }),
  acknowledgeFatigue: (data: { reason?: string }) =>
    request<MyShiftResponse>("/hr/my-shift/acknowledge-fatigue", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Leave Balances
  listLeaveBalances: (employeeId: string) =>
    request<LeaveBalance[]>(`/hr/employees/${employeeId}/leave-balances`),

  // Leave Requests
  /** `status` may list several, comma-separated; `from`/`to` return leave overlapping the window. */
  listLeaveRequests: (params?: {
    employee_id?: string;
    status?: string;
    from?: string;
    to?: string;
    department_id?: string;
  }) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v) qs.set(k, v);
    const q = qs.toString();
    return request<LeaveListRow[]>(`/hr/leaves${q ? `?${q}` : ""}`);
  },

  createLeaveRequest: (data: CreateLeaveRequestInput) =>
    request<LeaveRequest>("/hr/leaves", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  leaveAction: (id: string, data: LeaveActionRequest) =>
    request<LeaveRequest>(`/hr/leaves/${id}/action`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  cancelLeave: (id: string) =>
    request<LeaveRequest>(`/hr/leaves/${id}/cancel`, {
      method: "PUT",
    }),

  /** The days a leave of these dates would take — the same rule that files it. */
  previewLeaveDays: (params: {
    leave_type: string;
    start_date: string;
    end_date: string;
    is_half_day: boolean;
  }) => {
    const qs = new URLSearchParams({ ...params, is_half_day: String(params.is_half_day) });
    return request<LeaveDayCount>(`/hr/leaves/preview?${qs}`);
  },

  // Holidays and weekly offs (HR → Holidays)
  listHolidays: (from: string, to: string) =>
    request<HolidayCalendar>(`/hr/holidays?${new URLSearchParams({ from, to })}`),

  createHoliday: (data: HolidayInput) =>
    request<Holiday>("/hr/holidays", { method: "POST", body: JSON.stringify(data) }),

  updateHoliday: (id: string, data: HolidayInput) =>
    request<Holiday>(`/hr/holidays/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteHoliday: (id: string) => request<Holiday>(`/hr/holidays/${id}`, { method: "DELETE" }),

  setWeeklyOffs: (weeklyOffs: number[]) =>
    request<{ weekly_offs: number[] }>("/hr/weekly-offs", {
      method: "PUT",
      body: JSON.stringify({ weekly_offs: weeklyOffs }),
    }),

  // Leave — self-service (the caller's own employee record)
  listMyLeaveRequests: () => request<LeaveRequest[]>("/hr/me/leaves"),

  createMyLeaveRequest: (data: Omit<CreateLeaveRequestInput, "employee_id">) =>
    request<LeaveRequest>("/hr/me/leaves", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listMyLeaveBalances: () => request<LeaveBalance[]>("/hr/me/leave-balances"),

  /** Leave of the departments the caller heads — the head's approval queue. */
  listMyTeamLeaves: () => request<TeamLeaveResponse>("/hr/me/team-leaves"),

  // On-Call
  listOnCall: (params?: { department_id?: string; schedule_date?: string }) => {
    const qs = new URLSearchParams();
    if (params?.department_id) qs.set("department_id", params.department_id);
    if (params?.schedule_date) qs.set("schedule_date", params.schedule_date);
    const q = qs.toString();
    return request<OnCallSchedule[]>(`/hr/on-call${q ? `?${q}` : ""}`);
  },

  createOnCall: (data: CreateOnCallRequest) =>
    request<OnCallSchedule>("/hr/on-call", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Training Programs
  listTrainingPrograms: () => request<TrainingProgram[]>("/hr/training-programs"),

  createTrainingProgram: (data: CreateTrainingProgramRequest) =>
    request<TrainingProgram>("/hr/training-programs", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Training Records
  listTrainingRecords: (employeeId: string) =>
    request<TrainingRecord[]>(`/hr/employees/${employeeId}/training-records`),

  createTrainingRecord: (data: CreateTrainingRecordRequest) =>
    request<TrainingRecord>("/hr/training-records", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Appraisals
  listAppraisals: (employeeId: string) =>
    request<Appraisal[]>(`/hr/employees/${employeeId}/appraisals`),

  createAppraisal: (data: CreateAppraisalRequest) =>
    request<Appraisal>("/hr/appraisals", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Statutory Records
  listStatutoryRecords: (employeeId: string) =>
    request<StatutoryRecord[]>(`/hr/employees/${employeeId}/statutory-records`),

  createStatutoryRecord: (data: CreateStatutoryRecordRequest) =>
    request<StatutoryRecord>("/hr/statutory-records", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — HR (extended)
  // ══════════════════════════════════════════════════════════

  trainingCompliance: () => request<TrainingComplianceRow[]>("/hr/training/compliance"),
};
