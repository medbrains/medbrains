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
  cumulativeDose: (...args: Parameters<typeof api.cumulativeDose>) => api.cumulativeDose(...args),
  listPatientDoseRecords: (...args: Parameters<typeof api.listPatientDoseRecords>) =>
    api.listPatientDoseRecords(...args),
  recordRadiationDose: (...args: Parameters<typeof api.recordRadiationDose>) =>
    api.recordRadiationDose(...args),
  markRadiationDoseEnteredInError: (
    ...args: Parameters<typeof api.markRadiationDoseEnteredInError>
  ) => api.markRadiationDoseEnteredInError(...args),
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
  listRadiologyExams: (...args: Parameters<typeof api.listRadiologyExams>) =>
    api.listRadiologyExams(...args),
  createRadiologyExam: (...args: Parameters<typeof api.createRadiologyExam>) =>
    api.createRadiologyExam(...args),
  updateRadiologyExam: (...args: Parameters<typeof api.updateRadiologyExam>) =>
    api.updateRadiologyExam(...args),
  deleteRadiologyExam: (...args: Parameters<typeof api.deleteRadiologyExam>) =>
    api.deleteRadiologyExam(...args),
  updateRadiologyModality: (...args: Parameters<typeof api.updateRadiologyModality>) =>
    api.updateRadiologyModality(...args),
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
  updateRadiologyPacsConfig: (...args: Parameters<typeof api.updateRadiologyPacsConfig>) =>
    api.updateRadiologyPacsConfig(...args),
  getRadiologyTat: (...args: Parameters<typeof api.getRadiologyTat>) =>
    api.getRadiologyTat(...args),
};
