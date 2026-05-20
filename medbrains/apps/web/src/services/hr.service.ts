import { api } from "@medbrains/api";

export const hrService = {
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
  createStatutoryRecord: (...args: Parameters<typeof api.createStatutoryRecord>) =>
    api.createStatutoryRecord(...args),
};
