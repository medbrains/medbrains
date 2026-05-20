import { api } from "@medbrains/api";

export type CreateTransportInput = Parameters<typeof api.createTransportRequest>[0];
export type AssignTransportInput = Parameters<typeof api.assignTransport>[1];
export type CreateAlertThresholdInput = Parameters<typeof api.createAlertThreshold>[0];
export type UpdateAlertThresholdInput = Parameters<typeof api.updateAlertThreshold>[1];

export const commandCenterService = {
  getKpis: () => api.getKpis(),
  getPatientFlow: () => api.getPatientFlow(),
  getDepartmentLoad: () => api.getDepartmentLoad(),
  getActiveAlerts: () => api.getActiveAlerts(),
  acknowledgeAlert: (id: string) => api.acknowledgeDeptAlert(id),
  getTurnaroundStats: () => api.getTurnaroundStats(),
  getBedTurnaround: () => api.getBedTurnaround(),
  listPendingDischarges: () => api.listPendingDischarges(),
  listTransportRequests: () => api.listTransportRequests(),
  createTransportRequest: (data: CreateTransportInput) => api.createTransportRequest(data),
  assignTransport: (id: string, data: AssignTransportInput) => api.assignTransport(id, data),
  completeTransport: (id: string) => api.completeTransport(id),
  listAlertThresholds: () => api.listAlertThresholds(),
  createAlertThreshold: (data: CreateAlertThresholdInput) => api.createAlertThreshold(data),
  updateAlertThreshold: (id: string, data: UpdateAlertThresholdInput) =>
    api.updateAlertThreshold(id, data),
};
