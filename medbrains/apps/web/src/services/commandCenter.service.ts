import { commandCenterApi } from "@medbrains/api/modules/command-center";

export type CreateTransportInput = Parameters<typeof commandCenterApi.createTransportRequest>[0];
export type AssignTransportInput = Parameters<typeof commandCenterApi.assignTransport>[1];
export type CreateAlertThresholdInput = Parameters<typeof commandCenterApi.createAlertThreshold>[0];
export type UpdateAlertThresholdInput = Parameters<typeof commandCenterApi.updateAlertThreshold>[1];

export const commandCenterService = {
  getKpis: () => commandCenterApi.getKpis(),
  getPatientFlow: () => commandCenterApi.getPatientFlow(),
  getDepartmentLoad: () => commandCenterApi.getDepartmentLoad(),
  getActiveAlerts: () => commandCenterApi.getActiveAlerts(),
  acknowledgeAlert: (id: string) => commandCenterApi.acknowledgeDeptAlert(id),
  getTurnaroundStats: () => commandCenterApi.getTurnaroundStats(),
  getBedTurnaround: () => commandCenterApi.getBedTurnaround(),
  listPendingDischarges: () => commandCenterApi.listPendingDischarges(),
  listTransportRequests: () => commandCenterApi.listTransportRequests(),
  createTransportRequest: (data: CreateTransportInput) =>
    commandCenterApi.createTransportRequest(data),
  assignTransport: (id: string, data: AssignTransportInput) =>
    commandCenterApi.assignTransport(id, data),
  completeTransport: (id: string) => commandCenterApi.completeTransport(id),
  listAlertThresholds: () => commandCenterApi.listAlertThresholds(),
  createAlertThreshold: (data: CreateAlertThresholdInput) =>
    commandCenterApi.createAlertThreshold(data),
  updateAlertThreshold: (id: string, data: UpdateAlertThresholdInput) =>
    commandCenterApi.updateAlertThreshold(id, data),
};
