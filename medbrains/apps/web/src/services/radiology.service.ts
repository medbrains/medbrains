import { bmeApi } from "@medbrains/api/modules/bme";
import { printDataApi } from "@medbrains/api/modules/print-data";
import { publicApi } from "@medbrains/api/modules/public";
import { radiologyApi } from "@medbrains/api/modules/radiology";

export const radiologyService = {
  recordPregnancyCheck: (...args: Parameters<typeof radiologyApi.recordPregnancyCheck>) =>
    radiologyApi.recordPregnancyCheck(...args),
  listReferenceLevels: (...args: Parameters<typeof radiologyApi.listReferenceLevels>) =>
    radiologyApi.listReferenceLevels(...args),
  saveReferenceLevel: (...args: Parameters<typeof radiologyApi.saveReferenceLevel>) =>
    radiologyApi.saveReferenceLevel(...args),
  removeReferenceLevel: (...args: Parameters<typeof radiologyApi.removeReferenceLevel>) =>
    radiologyApi.removeReferenceLevel(...args),
  drlAudit: (...args: Parameters<typeof radiologyApi.drlAudit>) => radiologyApi.drlAudit(...args),
  getPublicShareLink: (...args: Parameters<typeof publicApi.getPublicRadiologyViewer>) =>
    publicApi.getPublicRadiologyViewer(...args),
  sendShareLinkCode: (...args: Parameters<typeof publicApi.sendShareLinkCode>) =>
    publicApi.sendShareLinkCode(...args),
  verifyShareLinkCode: (...args: Parameters<typeof publicApi.verifyShareLinkCode>) =>
    publicApi.verifyShareLinkCode(...args),
  listRadiologyDosimetry: (...args: Parameters<typeof radiologyApi.listRadiologyDosimetry>) =>
    radiologyApi.listRadiologyDosimetry(...args),
  createRadiologyDosimetry: (...args: Parameters<typeof radiologyApi.createRadiologyDosimetry>) =>
    radiologyApi.createRadiologyDosimetry(...args),
  removeRadiologyDosimetry: (...args: Parameters<typeof radiologyApi.removeRadiologyDosimetry>) =>
    radiologyApi.removeRadiologyDosimetry(...args),
  listRadiationEquipment: (...args: Parameters<typeof radiologyApi.listRadiationEquipment>) =>
    radiologyApi.listRadiationEquipment(...args),
  saveRadiationEquipment: (...args: Parameters<typeof radiologyApi.saveRadiationEquipment>) =>
    radiologyApi.saveRadiationEquipment(...args),
  listBmeEquipment: (...args: Parameters<typeof bmeApi.listBmeEquipment>) =>
    bmeApi.listBmeEquipment(...args),
  openStudyViewer: (...args: Parameters<typeof radiologyApi.openStudyViewer>) =>
    radiologyApi.openStudyViewer(...args),
  createRadiologyShareLink: (...args: Parameters<typeof radiologyApi.createRadiologyShareLink>) =>
    radiologyApi.createRadiologyShareLink(...args),
  listStudyShareLinks: (...args: Parameters<typeof radiologyApi.listStudyShareLinks>) =>
    radiologyApi.listStudyShareLinks(...args),
  revokeStudyShareLink: (...args: Parameters<typeof radiologyApi.revokeStudyShareLink>) =>
    radiologyApi.revokeStudyShareLink(...args),
  listRadiologyOrders: (...args: Parameters<typeof radiologyApi.listRadiologyOrders>) =>
    radiologyApi.listRadiologyOrders(...args),
  cancelRadiologyOrder: (...args: Parameters<typeof radiologyApi.cancelRadiologyOrder>) =>
    radiologyApi.cancelRadiologyOrder(...args),
  updateRadiologyOrderStatus: (
    ...args: Parameters<typeof radiologyApi.updateRadiologyOrderStatus>
  ) => radiologyApi.updateRadiologyOrderStatus(...args),
  listRadiologyModalities: (...args: Parameters<typeof radiologyApi.listRadiologyModalities>) =>
    radiologyApi.listRadiologyModalities(...args),
  createRadiologyOrder: (...args: Parameters<typeof radiologyApi.createRadiologyOrder>) =>
    radiologyApi.createRadiologyOrder(...args),
  contrastScreening: (...args: Parameters<typeof radiologyApi.contrastScreening>) =>
    radiologyApi.contrastScreening(...args),
  cumulativeDose: (...args: Parameters<typeof radiologyApi.cumulativeDose>) =>
    radiologyApi.cumulativeDose(...args),
  listUnmatchedStudies: (...args: Parameters<typeof radiologyApi.listUnmatchedStudies>) =>
    radiologyApi.listUnmatchedStudies(...args),
  linkUnmatchedStudy: (...args: Parameters<typeof radiologyApi.linkUnmatchedStudy>) =>
    radiologyApi.linkUnmatchedStudy(...args),
  dismissUnmatchedStudy: (...args: Parameters<typeof radiologyApi.dismissUnmatchedStudy>) =>
    radiologyApi.dismissUnmatchedStudy(...args),
  listPatientDoseRecords: (...args: Parameters<typeof radiologyApi.listPatientDoseRecords>) =>
    radiologyApi.listPatientDoseRecords(...args),
  recordRadiationDose: (...args: Parameters<typeof radiologyApi.recordRadiationDose>) =>
    radiologyApi.recordRadiationDose(...args),
  markRadiationDoseEnteredInError: (
    ...args: Parameters<typeof radiologyApi.markRadiationDoseEnteredInError>
  ) => radiologyApi.markRadiationDoseEnteredInError(...args),
  getRadiologyOrder: (...args: Parameters<typeof radiologyApi.getRadiologyOrder>) =>
    radiologyApi.getRadiologyOrder(...args),
  createRadiologyReport: (...args: Parameters<typeof radiologyApi.createRadiologyReport>) =>
    radiologyApi.createRadiologyReport(...args),
  verifyRadiologyReport: (...args: Parameters<typeof radiologyApi.verifyRadiologyReport>) =>
    radiologyApi.verifyRadiologyReport(...args),
  getRadiologyPrintData: (...args: Parameters<typeof printDataApi.getRadiologyPrintData>) =>
    printDataApi.getRadiologyPrintData(...args),
  createRadiologyModality: (...args: Parameters<typeof radiologyApi.createRadiologyModality>) =>
    radiologyApi.createRadiologyModality(...args),
  listRadiologyExams: (...args: Parameters<typeof radiologyApi.listRadiologyExams>) =>
    radiologyApi.listRadiologyExams(...args),
  createRadiologyExam: (...args: Parameters<typeof radiologyApi.createRadiologyExam>) =>
    radiologyApi.createRadiologyExam(...args),
  updateRadiologyExam: (...args: Parameters<typeof radiologyApi.updateRadiologyExam>) =>
    radiologyApi.updateRadiologyExam(...args),
  deleteRadiologyExam: (...args: Parameters<typeof radiologyApi.deleteRadiologyExam>) =>
    radiologyApi.deleteRadiologyExam(...args),
  updateRadiologyModality: (...args: Parameters<typeof radiologyApi.updateRadiologyModality>) =>
    radiologyApi.updateRadiologyModality(...args),
  deleteRadiologyModality: (...args: Parameters<typeof radiologyApi.deleteRadiologyModality>) =>
    radiologyApi.deleteRadiologyModality(...args),
  listRadiologyAppointments: (...args: Parameters<typeof radiologyApi.listRadiologyAppointments>) =>
    radiologyApi.listRadiologyAppointments(...args),
  createRadiologyAppointment: (
    ...args: Parameters<typeof radiologyApi.createRadiologyAppointment>
  ) => radiologyApi.createRadiologyAppointment(...args),
  listRadiologyDicomStudies: (...args: Parameters<typeof radiologyApi.listRadiologyDicomStudies>) =>
    radiologyApi.listRadiologyDicomStudies(...args),
  getRadiologyPacsConfig: (...args: Parameters<typeof radiologyApi.getRadiologyPacsConfig>) =>
    radiologyApi.getRadiologyPacsConfig(...args),
  updateRadiologyPacsConfig: (...args: Parameters<typeof radiologyApi.updateRadiologyPacsConfig>) =>
    radiologyApi.updateRadiologyPacsConfig(...args),
  getRadiologyTat: (...args: Parameters<typeof radiologyApi.getRadiologyTat>) =>
    radiologyApi.getRadiologyTat(...args),
};
