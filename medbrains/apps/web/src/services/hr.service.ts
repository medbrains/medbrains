import { aebasApi } from "@medbrains/api/modules/aebas";
import { hrApi } from "@medbrains/api/modules/hr";

export const hrService = {
  listDutyHours: (...args: Parameters<typeof hrApi.listDutyHours>) => hrApi.listDutyHours(...args),
  getMyShift: (...args: Parameters<typeof hrApi.getMyShift>) => hrApi.getMyShift(...args),
  startShift: (...args: Parameters<typeof hrApi.startShift>) => hrApi.startShift(...args),
  extendShift: (...args: Parameters<typeof hrApi.extendShift>) => hrApi.extendShift(...args),
  pauseShift: (...args: Parameters<typeof hrApi.pauseShift>) => hrApi.pauseShift(...args),
  resumeShift: (...args: Parameters<typeof hrApi.resumeShift>) => hrApi.resumeShift(...args),
  endShift: (...args: Parameters<typeof hrApi.endShift>) => hrApi.endShift(...args),
  getGeofenceSettings: () => hrApi.getGeofenceSettings(),
  setGeofenceMode: (...args: Parameters<typeof hrApi.setGeofenceMode>) =>
    hrApi.setGeofenceMode(...args),
  setCampusFence: (...args: Parameters<typeof hrApi.setCampusFence>) =>
    hrApi.setCampusFence(...args),
  acknowledgeFatigue: (...args: Parameters<typeof hrApi.acknowledgeFatigue>) =>
    hrApi.acknowledgeFatigue(...args),
  importAebasPeriodSummary: (...args: Parameters<typeof aebasApi.importAebasPeriodSummary>) =>
    aebasApi.importAebasPeriodSummary(...args),
  listEmployees: (...args: Parameters<typeof hrApi.listEmployees>) => hrApi.listEmployees(...args),
  getEmployee: (...args: Parameters<typeof hrApi.getEmployee>) => hrApi.getEmployee(...args),
  createEmployee: (...args: Parameters<typeof hrApi.createEmployee>) =>
    hrApi.createEmployee(...args),
  listSalaryStructures: () => hrApi.listSalaryStructures(),
  upsertSalaryStructure: (...args: Parameters<typeof hrApi.upsertSalaryStructure>) =>
    hrApi.upsertSalaryStructure(...args),
  listPayrollRuns: () => hrApi.listPayrollRuns(),
  createPayrollRun: (...args: Parameters<typeof hrApi.createPayrollRun>) =>
    hrApi.createPayrollRun(...args),
  finalizePayrollRun: (id: string) => hrApi.finalizePayrollRun(id),
  listPayslips: (runId: string) => hrApi.listPayslips(runId),
  listDesignations: (...args: Parameters<typeof hrApi.listDesignations>) =>
    hrApi.listDesignations(...args),
  createDesignation: (...args: Parameters<typeof hrApi.createDesignation>) =>
    hrApi.createDesignation(...args),
  listCredentials: (...args: Parameters<typeof hrApi.listCredentials>) =>
    hrApi.listCredentials(...args),
  createCredential: (...args: Parameters<typeof hrApi.createCredential>) =>
    hrApi.createCredential(...args),
  updateCredential: (...args: Parameters<typeof hrApi.updateCredential>) =>
    hrApi.updateCredential(...args),
  listLeaveBalances: (...args: Parameters<typeof hrApi.listLeaveBalances>) =>
    hrApi.listLeaveBalances(...args),
  listAttendance: (...args: Parameters<typeof hrApi.listAttendance>) =>
    hrApi.listAttendance(...args),
  createAttendance: (...args: Parameters<typeof hrApi.createAttendance>) =>
    hrApi.createAttendance(...args),
  listLeaveRequests: (...args: Parameters<typeof hrApi.listLeaveRequests>) =>
    hrApi.listLeaveRequests(...args),
  createLeaveRequest: (...args: Parameters<typeof hrApi.createLeaveRequest>) =>
    hrApi.createLeaveRequest(...args),
  leaveAction: (...args: Parameters<typeof hrApi.leaveAction>) => hrApi.leaveAction(...args),
  cancelLeave: (...args: Parameters<typeof hrApi.cancelLeave>) => hrApi.cancelLeave(...args),
  previewLeaveDays: (...args: Parameters<typeof hrApi.previewLeaveDays>) =>
    hrApi.previewLeaveDays(...args),
  listHolidays: (...args: Parameters<typeof hrApi.listHolidays>) => hrApi.listHolidays(...args),
  createHoliday: (...args: Parameters<typeof hrApi.createHoliday>) => hrApi.createHoliday(...args),
  updateHoliday: (...args: Parameters<typeof hrApi.updateHoliday>) => hrApi.updateHoliday(...args),
  deleteHoliday: (...args: Parameters<typeof hrApi.deleteHoliday>) => hrApi.deleteHoliday(...args),
  setWeeklyOffs: (...args: Parameters<typeof hrApi.setWeeklyOffs>) => hrApi.setWeeklyOffs(...args),
  getMyProfile: () => hrApi.getMyProfile(),
  listMyLeaveRequests: () => hrApi.listMyLeaveRequests(),
  createMyLeaveRequest: (...args: Parameters<typeof hrApi.createMyLeaveRequest>) =>
    hrApi.createMyLeaveRequest(...args),
  listMyLeaveBalances: () => hrApi.listMyLeaveBalances(),
  listMyTeamLeaves: () => hrApi.listMyTeamLeaves(),
  listShifts: (...args: Parameters<typeof hrApi.listShifts>) => hrApi.listShifts(...args),
  createShift: (...args: Parameters<typeof hrApi.createShift>) => hrApi.createShift(...args),
  listRosters: (...args: Parameters<typeof hrApi.listRosters>) => hrApi.listRosters(...args),
  createRoster: (...args: Parameters<typeof hrApi.createRoster>) => hrApi.createRoster(...args),
  listOnCall: (...args: Parameters<typeof hrApi.listOnCall>) => hrApi.listOnCall(...args),
  createOnCall: (...args: Parameters<typeof hrApi.createOnCall>) => hrApi.createOnCall(...args),
  approveSwap: (...args: Parameters<typeof hrApi.approveSwap>) => hrApi.approveSwap(...args),
  listTrainingPrograms: (...args: Parameters<typeof hrApi.listTrainingPrograms>) =>
    hrApi.listTrainingPrograms(...args),
  createTrainingProgram: (...args: Parameters<typeof hrApi.createTrainingProgram>) =>
    hrApi.createTrainingProgram(...args),
  listTrainingRecords: (...args: Parameters<typeof hrApi.listTrainingRecords>) =>
    hrApi.listTrainingRecords(...args),
  createTrainingRecord: (...args: Parameters<typeof hrApi.createTrainingRecord>) =>
    hrApi.createTrainingRecord(...args),
  trainingCompliance: (...args: Parameters<typeof hrApi.trainingCompliance>) =>
    hrApi.trainingCompliance(...args),
  createAppraisal: (...args: Parameters<typeof hrApi.createAppraisal>) =>
    hrApi.createAppraisal(...args),
  listAppraisals: (...args: Parameters<typeof hrApi.listAppraisals>) =>
    hrApi.listAppraisals(...args),
  createStatutoryRecord: (...args: Parameters<typeof hrApi.createStatutoryRecord>) =>
    hrApi.createStatutoryRecord(...args),
  listStatutoryRecords: (...args: Parameters<typeof hrApi.listStatutoryRecords>) =>
    hrApi.listStatutoryRecords(...args),
};
