import { api } from "@medbrains/api";

export const radiologyService = {
  listRadiologyOrders: (...args: Parameters<typeof api.listRadiologyOrders>) =>
    api.listRadiologyOrders(...args),
  cancelRadiologyOrder: (...args: Parameters<typeof api.cancelRadiologyOrder>) =>
    api.cancelRadiologyOrder(...args),
  updateRadiologyOrderStatus: (...args: Parameters<typeof api.updateRadiologyOrderStatus>) =>
    api.updateRadiologyOrderStatus(...args),
  listRadiologyModalities: (...args: Parameters<typeof api.listRadiologyModalities>) =>
    api.listRadiologyModalities(...args),
  createRadiologyOrder: (...args: Parameters<typeof api.createRadiologyOrder>) =>
    api.createRadiologyOrder(...args),
  contrastScreening: (...args: Parameters<typeof api.contrastScreening>) =>
    api.contrastScreening(...args),
  getRadiologyOrder: (...args: Parameters<typeof api.getRadiologyOrder>) =>
    api.getRadiologyOrder(...args),
  createRadiologyReport: (...args: Parameters<typeof api.createRadiologyReport>) =>
    api.createRadiologyReport(...args),
  verifyRadiologyReport: (...args: Parameters<typeof api.verifyRadiologyReport>) =>
    api.verifyRadiologyReport(...args),
  getRadiologyPrintData: (...args: Parameters<typeof api.getRadiologyPrintData>) =>
    api.getRadiologyPrintData(...args),
  createRadiologyModality: (...args: Parameters<typeof api.createRadiologyModality>) =>
    api.createRadiologyModality(...args),
  deleteRadiologyModality: (...args: Parameters<typeof api.deleteRadiologyModality>) =>
    api.deleteRadiologyModality(...args),
  listRadiologyAppointments: (...args: Parameters<typeof api.listRadiologyAppointments>) =>
    api.listRadiologyAppointments(...args),
  createRadiologyAppointment: (...args: Parameters<typeof api.createRadiologyAppointment>) =>
    api.createRadiologyAppointment(...args),
  listRadiologyDicomStudies: (...args: Parameters<typeof api.listRadiologyDicomStudies>) =>
    api.listRadiologyDicomStudies(...args),
  getRadiologyPacsConfig: (...args: Parameters<typeof api.getRadiologyPacsConfig>) =>
    api.getRadiologyPacsConfig(...args),
  getRadiologyTat: (...args: Parameters<typeof api.getRadiologyTat>) =>
    api.getRadiologyTat(...args),
};
