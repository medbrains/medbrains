import { api } from "@medbrains/api";

export const hrService = {
  listDutyHours: (...args: Parameters<typeof api.listDutyHours>) => api.listDutyHours(...args),
  getMyShift: (...args: Parameters<typeof api.getMyShift>) => api.getMyShift(...args),
  startShift: (...args: Parameters<typeof api.startShift>) => api.startShift(...args),
  extendShift: (...args: Parameters<typeof api.extendShift>) => api.extendShift(...args),
  pauseShift: (...args: Parameters<typeof api.pauseShift>) => api.pauseShift(...args),
  resumeShift: (...args: Parameters<typeof api.resumeShift>) => api.resumeShift(...args),
  endShift: (...args: Parameters<typeof api.endShift>) => api.endShift(...args),
  acknowledgeFatigue: (...args: Parameters<typeof api.acknowledgeFatigue>) =>
    api.acknowledgeFatigue(...args),
  listEmployees: (...args: Parameters<typeof api.listEmployees>) => api.listEmployees(...args),
  getEmployee: (...args: Parameters<typeof api.getEmployee>) => api.getEmployee(...args),
  createEmployee: (...args: Parameters<typeof api.createEmployee>) => api.createEmployee(...args),
  listDesignations: (...args: Parameters<typeof api.listDesignations>) =>
    api.listDesignations(...args),
  createDesignation: (...args: Parameters<typeof api.createDesignation>) =>
    api.createDesignation(...args),
  listCredentials: (...args: Parameters<typeof api.listCredentials>) =>
    api.listCredentials(...args),
  createCredential: (...args: Parameters<typeof api.createCredential>) =>
    api.createCredential(...args),
  listLeaveBalances: (...args: Parameters<typeof api.listLeaveBalances>) =>
    api.listLeaveBalances(...args),
  listAttendance: (...args: Parameters<typeof api.listAttendance>) => api.listAttendance(...args),
  createAttendance: (...args: Parameters<typeof api.createAttendance>) =>
    api.createAttendance(...args),
  listLeaveRequests: (...args: Parameters<typeof api.listLeaveRequests>) =>
    api.listLeaveRequests(...args),
  createLeaveRequest: (...args: Parameters<typeof api.createLeaveRequest>) =>
    api.createLeaveRequest(...args),
  leaveAction: (...args: Parameters<typeof api.leaveAction>) => api.leaveAction(...args),
  cancelLeave: (...args: Parameters<typeof api.cancelLeave>) => api.cancelLeave(...args),
  listShifts: (...args: Parameters<typeof api.listShifts>) => api.listShifts(...args),
  createShift: (...args: Parameters<typeof api.createShift>) => api.createShift(...args),
  listRosters: (...args: Parameters<typeof api.listRosters>) => api.listRosters(...args),
  createRoster: (...args: Parameters<typeof api.createRoster>) => api.createRoster(...args),
  listOnCall: (...args: Parameters<typeof api.listOnCall>) => api.listOnCall(...args),
  createOnCall: (...args: Parameters<typeof api.createOnCall>) => api.createOnCall(...args),
  approveSwap: (...args: Parameters<typeof api.approveSwap>) => api.approveSwap(...args),
  listTrainingPrograms: (...args: Parameters<typeof api.listTrainingPrograms>) =>
    api.listTrainingPrograms(...args),
  createTrainingProgram: (...args: Parameters<typeof api.createTrainingProgram>) =>
    api.createTrainingProgram(...args),
  createTrainingRecord: (...args: Parameters<typeof api.createTrainingRecord>) =>
    api.createTrainingRecord(...args),
  trainingCompliance: (...args: Parameters<typeof api.trainingCompliance>) =>
    api.trainingCompliance(...args),
  createAppraisal: (...args: Parameters<typeof api.createAppraisal>) =>
    api.createAppraisal(...args),
  listAppraisals: (...args: Parameters<typeof api.listAppraisals>) =>
    api.listAppraisals(...args),
  createStatutoryRecord: (...args: Parameters<typeof api.createStatutoryRecord>) =>
    api.createStatutoryRecord(...args),
  listStatutoryRecords: (...args: Parameters<typeof api.listStatutoryRecords>) =>
    api.listStatutoryRecords(...args),
};
