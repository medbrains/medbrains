import { api } from "@medbrains/api";

export const ipdService = {
  listAdmissions: (...args: Parameters<typeof api.listAdmissions>) => api.listAdmissions(...args),
  createAdmission: (...args: Parameters<typeof api.createAdmission>) =>
    api.createAdmission(...args),
  getAdmission: (...args: Parameters<typeof api.getAdmission>) => api.getAdmission(...args),
  createNursingTask: (...args: Parameters<typeof api.createNursingTask>) =>
    api.createNursingTask(...args),
  updateNursingTask: (...args: Parameters<typeof api.updateNursingTask>) =>
    api.updateNursingTask(...args),
  listProgressNotes: (...args: Parameters<typeof api.listProgressNotes>) =>
    api.listProgressNotes(...args),
  createProgressNote: (...args: Parameters<typeof api.createProgressNote>) =>
    api.createProgressNote(...args),
  listAssessments: (...args: Parameters<typeof api.listAssessments>) =>
    api.listAssessments(...args),
  createAssessment: (...args: Parameters<typeof api.createAssessment>) =>
    api.createAssessment(...args),
  listMar: (...args: Parameters<typeof api.listMar>) => api.listMar(...args),
  listPrescriptions: (...args: Parameters<typeof api.listPrescriptions>) =>
    api.listPrescriptions(...args),
  createPrescription: (...args: Parameters<typeof api.createPrescription>) =>
    api.createPrescription(...args),
  updatePrescription: (...args: Parameters<typeof api.updatePrescription>) =>
    api.updatePrescription(...args),
  listPatientAllergies: (...args: Parameters<typeof api.listPatientAllergies>) =>
    api.listPatientAllergies(...args),
  getPatient: (...args: Parameters<typeof api.getPatient>) => api.getPatient(...args),
  listIntakeOutput: (...args: Parameters<typeof api.listIntakeOutput>) =>
    api.listIntakeOutput(...args),
  getIoBalance: (...args: Parameters<typeof api.getIoBalance>) => api.getIoBalance(...args),
  listInfusions: (...args: Parameters<typeof api.listInfusions>) => api.listInfusions(...args),
  createInfusion: (...args: Parameters<typeof api.createInfusion>) => api.createInfusion(...args),
  updateInfusion: (...args: Parameters<typeof api.updateInfusion>) => api.updateInfusion(...args),
  listCarePlans: (...args: Parameters<typeof api.listCarePlans>) => api.listCarePlans(...args),
  listHandovers: (...args: Parameters<typeof api.listHandovers>) => api.listHandovers(...args),
  listAttenders: (...args: Parameters<typeof api.listAttenders>) => api.listAttenders(...args),
  createAttender: (...args: Parameters<typeof api.createAttender>) => api.createAttender(...args),
  deleteAttender: (...args: Parameters<typeof api.deleteAttender>) => api.deleteAttender(...args),
  listDischargeTemplates: (...args: Parameters<typeof api.listDischargeTemplates>) =>
    api.listDischargeTemplates(...args),
  getDischargeSummary: (...args: Parameters<typeof api.getDischargeSummary>) =>
    api.getDischargeSummary(...args),
  createDischargeSummary: (...args: Parameters<typeof api.createDischargeSummary>) =>
    api.createDischargeSummary(...args),
  updateDischargeSummary: (...args: Parameters<typeof api.updateDischargeSummary>) =>
    api.updateDischargeSummary(...args),
  finalizeDischargeSummary: (...args: Parameters<typeof api.finalizeDischargeSummary>) =>
    api.finalizeDischargeSummary(...args),
  transferBed: (...args: Parameters<typeof api.transferBed>) => api.transferBed(...args),
  listDischargeChecklist: (...args: Parameters<typeof api.listDischargeChecklist>) =>
    api.listDischargeChecklist(...args),
  dischargePatient: (...args: Parameters<typeof api.dischargePatient>) =>
    api.dischargePatient(...args),
  listWards: (...args: Parameters<typeof api.listWards>) => api.listWards(...args),
  listAvailableBeds: (...args: Parameters<typeof api.listAvailableBeds>) =>
    api.listAvailableBeds(...args),
  createWard: (...args: Parameters<typeof api.createWard>) => api.createWard(...args),
  updateWard: (...args: Parameters<typeof api.updateWard>) => api.updateWard(...args),
  listWardBeds: (...args: Parameters<typeof api.listWardBeds>) => api.listWardBeds(...args),
  assignBedToWard: (...args: Parameters<typeof api.assignBedToWard>) =>
    api.assignBedToWard(...args),
  removeBedFromWard: (...args: Parameters<typeof api.removeBedFromWard>) =>
    api.removeBedFromWard(...args),
  listIpTypes: (...args: Parameters<typeof api.listIpTypes>) => api.listIpTypes(...args),
  updateIpType: (...args: Parameters<typeof api.updateIpType>) => api.updateIpType(...args),
  bedDashboardSummary: (...args: Parameters<typeof api.bedDashboardSummary>) =>
    api.bedDashboardSummary(...args),
  bedDashboardBeds: (...args: Parameters<typeof api.bedDashboardBeds>) =>
    api.bedDashboardBeds(...args),
  updateBedStatus: (...args: Parameters<typeof api.updateBedStatus>) =>
    api.updateBedStatus(...args),
  reportCensus: (...args: Parameters<typeof api.reportCensus>) => api.reportCensus(...args),
  reportOccupancy: (...args: Parameters<typeof api.reportOccupancy>) =>
    api.reportOccupancy(...args),
  reportAlos: (...args: Parameters<typeof api.reportAlos>) => api.reportAlos(...args),
  reportDischargeStats: (...args: Parameters<typeof api.reportDischargeStats>) =>
    api.reportDischargeStats(...args),
  listClinicalDocs: (...args: Parameters<typeof api.listClinicalDocs>) =>
    api.listClinicalDocs(...args),
  createClinicalDoc: (...args: Parameters<typeof api.createClinicalDoc>) =>
    api.createClinicalDoc(...args),
  resolveClinicalDoc: (...args: Parameters<typeof api.resolveClinicalDoc>) =>
    api.resolveClinicalDoc(...args),
  createRestraintCheck: (...args: Parameters<typeof api.createRestraintCheck>) =>
    api.createRestraintCheck(...args),
  listAdmissionChecklist: (...args: Parameters<typeof api.listAdmissionChecklist>) =>
    api.listAdmissionChecklist(...args),
  createAdmissionChecklist: (...args: Parameters<typeof api.createAdmissionChecklist>) =>
    api.createAdmissionChecklist(...args),
  toggleChecklistItem: (...args: Parameters<typeof api.toggleChecklistItem>) =>
    api.toggleChecklistItem(...args),
  listTransfers: (...args: Parameters<typeof api.listTransfers>) => api.listTransfers(...args),
  createTransfer: (...args: Parameters<typeof api.createTransfer>) => api.createTransfer(...args),
  getDischargeTat: (...args: Parameters<typeof api.getDischargeTat>) =>
    api.getDischargeTat(...args),
  initiateDischargeTat: (...args: Parameters<typeof api.initiateDischargeTat>) =>
    api.initiateDischargeTat(...args),
  updateDischargeTat: (...args: Parameters<typeof api.updateDischargeTat>) =>
    api.updateDischargeTat(...args),
  getAdmissionInvestigations: (...args: Parameters<typeof api.getAdmissionInvestigations>) =>
    api.getAdmissionInvestigations(...args),
  getEstimatedCost: (...args: Parameters<typeof api.getEstimatedCost>) =>
    api.getEstimatedCost(...args),
  getAdmissionBillingSummary: (...args: Parameters<typeof api.getAdmissionBillingSummary>) =>
    api.getAdmissionBillingSummary(...args),
  getAdmissionAdvances: (...args: Parameters<typeof api.getAdmissionAdvances>) =>
    api.getAdmissionAdvances(...args),
  getAdmissionPriorAuth: (...args: Parameters<typeof api.getAdmissionPriorAuth>) =>
    api.getAdmissionPriorAuth(...args),
  getAdmissionMlc: (...args: Parameters<typeof api.getAdmissionMlc>) =>
    api.getAdmissionMlc(...args),
  linkMlc: (...args: Parameters<typeof api.linkMlc>) => api.linkMlc(...args),
  getAdmissionDietOrders: (...args: Parameters<typeof api.getAdmissionDietOrders>) =>
    api.getAdmissionDietOrders(...args),
  getAdmissionConsents: (...args: Parameters<typeof api.getAdmissionConsents>) =>
    api.getAdmissionConsents(...args),
  getAdmissionPrintData: (...args: Parameters<typeof api.getAdmissionPrintData>) =>
    api.getAdmissionPrintData(...args),
  getWristbandPrintData: (...args: Parameters<typeof api.getWristbandPrintData>) =>
    api.getWristbandPrintData(...args),
  listBedTurnaround: (...args: Parameters<typeof api.listBedTurnaround>) =>
    api.listBedTurnaround(...args),
  listRestraintChecks: (...args: Parameters<typeof api.listRestraintChecks>) =>
    api.listRestraintChecks(...args),
  getDeathSummary: (...args: Parameters<typeof api.getDeathSummary>) =>
    api.getDeathSummary(...args),
  createDeathSummary: (...args: Parameters<typeof api.createDeathSummary>) =>
    api.createDeathSummary(...args),
  listBirthRecords: (...args: Parameters<typeof api.listBirthRecords>) =>
    api.listBirthRecords(...args),
  createBirthRecord: (...args: Parameters<typeof api.createBirthRecord>) =>
    api.createBirthRecord(...args),
  getSurgeonCaseload: (...args: Parameters<typeof api.getSurgeonCaseload>) =>
    api.getSurgeonCaseload(...args),
  generateDischargeSummary: (...args: Parameters<typeof api.generateDischargeSummary>) =>
    api.generateDischargeSummary(...args),
  bedTransfer: (...args: Parameters<typeof api.bedTransfer>) => api.bedTransfer(...args),
  expectedDischarges: (...args: Parameters<typeof api.expectedDischarges>) =>
    api.expectedDischarges(...args),
  listAnesthesiaComplications: (...args: Parameters<typeof api.listAnesthesiaComplications>) =>
    api.listAnesthesiaComplications(...args),
  getIpdDischargeWorkflow: (...args: Parameters<typeof api.getIpdDischargeWorkflow>) =>
    api.getIpdDischargeWorkflow(...args),
  updateIpdDischargeStep: (...args: Parameters<typeof api.updateIpdDischargeStep>) =>
    api.updateIpdDischargeStep(...args),
};
