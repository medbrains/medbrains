import { billingApi } from "@medbrains/api/modules/billing";
import { ipdApi } from "@medbrains/api/modules/ipd";
import { opdApi } from "@medbrains/api/modules/opd";
import { otApi } from "@medbrains/api/modules/ot";
import { patientsApi } from "@medbrains/api/modules/patients";
import { printDataApi } from "@medbrains/api/modules/print-data";
import { setupApi } from "@medbrains/api/modules/setup";

export const ipdService = {
  listAdmissions: (...args: Parameters<typeof ipdApi.listAdmissions>) =>
    ipdApi.listAdmissions(...args),
  createAdmission: (...args: Parameters<typeof ipdApi.createAdmission>) =>
    ipdApi.createAdmission(...args),
  getAdmission: (...args: Parameters<typeof ipdApi.getAdmission>) => ipdApi.getAdmission(...args),
  createNursingTask: (...args: Parameters<typeof ipdApi.createNursingTask>) =>
    ipdApi.createNursingTask(...args),
  updateNursingTask: (...args: Parameters<typeof ipdApi.updateNursingTask>) =>
    ipdApi.updateNursingTask(...args),
  listAssessments: (...args: Parameters<typeof ipdApi.listAssessments>) =>
    ipdApi.listAssessments(...args),
  createAssessment: (...args: Parameters<typeof ipdApi.createAssessment>) =>
    ipdApi.createAssessment(...args),
  listMar: (...args: Parameters<typeof ipdApi.listMar>) => ipdApi.listMar(...args),
  listPrescriptions: (...args: Parameters<typeof opdApi.listPrescriptions>) =>
    opdApi.listPrescriptions(...args),
  createPrescription: (...args: Parameters<typeof opdApi.createPrescription>) =>
    opdApi.createPrescription(...args),
  updatePrescription: (...args: Parameters<typeof opdApi.updatePrescription>) =>
    opdApi.updatePrescription(...args),
  listPatientAllergies: (...args: Parameters<typeof patientsApi.listPatientAllergies>) =>
    patientsApi.listPatientAllergies(...args),
  getPatient: (...args: Parameters<typeof patientsApi.getPatient>) =>
    patientsApi.getPatient(...args),
  listIntakeOutput: (...args: Parameters<typeof ipdApi.listIntakeOutput>) =>
    ipdApi.listIntakeOutput(...args),
  getIoBalance: (...args: Parameters<typeof ipdApi.getIoBalance>) => ipdApi.getIoBalance(...args),
  listInfusions: (...args: Parameters<typeof ipdApi.listInfusions>) =>
    ipdApi.listInfusions(...args),
  listBedsideTransfusions: (...args: Parameters<typeof ipdApi.listBedsideTransfusions>) =>
    ipdApi.listBedsideTransfusions(...args),
  startBedsideTransfusion: (...args: Parameters<typeof ipdApi.startBedsideTransfusion>) =>
    ipdApi.startBedsideTransfusion(...args),
  completeBedsideTransfusion: (...args: Parameters<typeof ipdApi.completeBedsideTransfusion>) =>
    ipdApi.completeBedsideTransfusion(...args),
  createInfusion: (...args: Parameters<typeof ipdApi.createInfusion>) =>
    ipdApi.createInfusion(...args),
  updateInfusion: (...args: Parameters<typeof ipdApi.updateInfusion>) =>
    ipdApi.updateInfusion(...args),
  listCarePlans: (...args: Parameters<typeof ipdApi.listCarePlans>) =>
    ipdApi.listCarePlans(...args),
  createCarePlan: (...args: Parameters<typeof ipdApi.createCarePlan>) =>
    ipdApi.createCarePlan(...args),
  updateCarePlan: (...args: Parameters<typeof ipdApi.updateCarePlan>) =>
    ipdApi.updateCarePlan(...args),
  listNursingAssessments: (...args: Parameters<typeof ipdApi.listNursingAssessments>) =>
    ipdApi.listNursingAssessments(...args),
  createNursingAssessment: (...args: Parameters<typeof ipdApi.createNursingAssessment>) =>
    ipdApi.createNursingAssessment(...args),
  listHandovers: (...args: Parameters<typeof ipdApi.listHandovers>) =>
    ipdApi.listHandovers(...args),
  listAttenders: (...args: Parameters<typeof ipdApi.listAttenders>) =>
    ipdApi.listAttenders(...args),
  createAttender: (...args: Parameters<typeof ipdApi.createAttender>) =>
    ipdApi.createAttender(...args),
  deleteAttender: (...args: Parameters<typeof ipdApi.deleteAttender>) =>
    ipdApi.deleteAttender(...args),
  listDischargeTemplates: (...args: Parameters<typeof ipdApi.listDischargeTemplates>) =>
    ipdApi.listDischargeTemplates(...args),
  getDischargeSummary: (...args: Parameters<typeof ipdApi.getDischargeSummary>) =>
    ipdApi.getDischargeSummary(...args),
  createDischargeSummary: (...args: Parameters<typeof ipdApi.createDischargeSummary>) =>
    ipdApi.createDischargeSummary(...args),
  updateDischargeSummary: (...args: Parameters<typeof ipdApi.updateDischargeSummary>) =>
    ipdApi.updateDischargeSummary(...args),
  finalizeDischargeSummary: (...args: Parameters<typeof ipdApi.finalizeDischargeSummary>) =>
    ipdApi.finalizeDischargeSummary(...args),
  getNoDuesCertificate: (...args: Parameters<typeof ipdApi.getNoDuesCertificate>) =>
    ipdApi.getNoDuesCertificate(...args),
  issueNoDuesCertificate: (...args: Parameters<typeof ipdApi.issueNoDuesCertificate>) =>
    ipdApi.issueNoDuesCertificate(...args),
  transferBed: (...args: Parameters<typeof ipdApi.transferBed>) => ipdApi.transferBed(...args),
  listDischargeChecklist: (...args: Parameters<typeof ipdApi.listDischargeChecklist>) =>
    ipdApi.listDischargeChecklist(...args),
  initDischargeChecklist: (...args: Parameters<typeof ipdApi.initDischargeChecklist>) =>
    ipdApi.initDischargeChecklist(...args),
  updateDischargeChecklistItem: (...args: Parameters<typeof ipdApi.updateDischargeChecklistItem>) =>
    ipdApi.updateDischargeChecklistItem(...args),
  dischargePatient: (...args: Parameters<typeof ipdApi.dischargePatient>) =>
    ipdApi.dischargePatient(...args),
  listWards: (...args: Parameters<typeof ipdApi.listWards>) => ipdApi.listWards(...args),
  listAvailableBeds: (...args: Parameters<typeof ipdApi.listAvailableBeds>) =>
    ipdApi.listAvailableBeds(...args),
  createWard: (...args: Parameters<typeof ipdApi.createWard>) => ipdApi.createWard(...args),
  updateWard: (...args: Parameters<typeof ipdApi.updateWard>) => ipdApi.updateWard(...args),
  listWardBeds: (...args: Parameters<typeof ipdApi.listWardBeds>) => ipdApi.listWardBeds(...args),
  assignBedToWard: (...args: Parameters<typeof ipdApi.assignBedToWard>) =>
    ipdApi.assignBedToWard(...args),
  removeBedFromWard: (...args: Parameters<typeof ipdApi.removeBedFromWard>) =>
    ipdApi.removeBedFromWard(...args),
  updateWardBed: (...args: Parameters<typeof ipdApi.updateWardBed>) =>
    ipdApi.updateWardBed(...args),
  listBedTypes: () => setupApi.listBedTypes(),
  listLocations: () => setupApi.listLocations(),
  listIpTypes: (...args: Parameters<typeof ipdApi.listIpTypes>) => ipdApi.listIpTypes(...args),
  updateIpType: (...args: Parameters<typeof ipdApi.updateIpType>) => ipdApi.updateIpType(...args),
  bedDashboardSummary: (...args: Parameters<typeof ipdApi.bedDashboardSummary>) =>
    ipdApi.bedDashboardSummary(...args),
  bedDashboardBeds: (...args: Parameters<typeof ipdApi.bedDashboardBeds>) =>
    ipdApi.bedDashboardBeds(...args),
  updateBedStatus: (...args: Parameters<typeof ipdApi.updateBedStatus>) =>
    ipdApi.updateBedStatus(...args),
  listBedReservations: (...args: Parameters<typeof ipdApi.listBedReservations>) =>
    ipdApi.listBedReservations(...args),
  createBedReservation: (...args: Parameters<typeof ipdApi.createBedReservation>) =>
    ipdApi.createBedReservation(...args),
  updateBedReservationStatus: (...args: Parameters<typeof ipdApi.updateBedReservationStatus>) =>
    ipdApi.updateBedReservationStatus(...args),
  reportCensus: (...args: Parameters<typeof ipdApi.reportCensus>) => ipdApi.reportCensus(...args),
  reportOccupancy: (...args: Parameters<typeof ipdApi.reportOccupancy>) =>
    ipdApi.reportOccupancy(...args),
  reportAlos: (...args: Parameters<typeof ipdApi.reportAlos>) => ipdApi.reportAlos(...args),
  reportDischargeStats: (...args: Parameters<typeof ipdApi.reportDischargeStats>) =>
    ipdApi.reportDischargeStats(...args),
  listClinicalDocs: (...args: Parameters<typeof ipdApi.listClinicalDocs>) =>
    ipdApi.listClinicalDocs(...args),
  createClinicalDoc: (...args: Parameters<typeof ipdApi.createClinicalDoc>) =>
    ipdApi.createClinicalDoc(...args),
  resolveClinicalDoc: (...args: Parameters<typeof ipdApi.resolveClinicalDoc>) =>
    ipdApi.resolveClinicalDoc(...args),
  createRestraintCheck: (...args: Parameters<typeof ipdApi.createRestraintCheck>) =>
    ipdApi.createRestraintCheck(...args),
  listAdmissionChecklist: (...args: Parameters<typeof ipdApi.listAdmissionChecklist>) =>
    ipdApi.listAdmissionChecklist(...args),
  createAdmissionChecklist: (...args: Parameters<typeof ipdApi.createAdmissionChecklist>) =>
    ipdApi.createAdmissionChecklist(...args),
  toggleChecklistItem: (...args: Parameters<typeof ipdApi.toggleChecklistItem>) =>
    ipdApi.toggleChecklistItem(...args),
  listTransfers: (...args: Parameters<typeof ipdApi.listTransfers>) =>
    ipdApi.listTransfers(...args),
  createTransfer: (...args: Parameters<typeof ipdApi.createTransfer>) =>
    ipdApi.createTransfer(...args),
  getDischargeTat: (...args: Parameters<typeof ipdApi.getDischargeTat>) =>
    ipdApi.getDischargeTat(...args),
  initiateDischargeTat: (...args: Parameters<typeof ipdApi.initiateDischargeTat>) =>
    ipdApi.initiateDischargeTat(...args),
  updateDischargeTat: (...args: Parameters<typeof ipdApi.updateDischargeTat>) =>
    ipdApi.updateDischargeTat(...args),
  getAdmissionInvestigations: (...args: Parameters<typeof ipdApi.getAdmissionInvestigations>) =>
    ipdApi.getAdmissionInvestigations(...args),
  getEstimatedCost: (...args: Parameters<typeof ipdApi.getEstimatedCost>) =>
    ipdApi.getEstimatedCost(...args),
  getAdmissionBillingSummary: (...args: Parameters<typeof ipdApi.getAdmissionBillingSummary>) =>
    ipdApi.getAdmissionBillingSummary(...args),
  getAdmissionAdvances: (...args: Parameters<typeof ipdApi.getAdmissionAdvances>) =>
    ipdApi.getAdmissionAdvances(...args),
  getAdmissionPriorAuth: (...args: Parameters<typeof ipdApi.getAdmissionPriorAuth>) =>
    ipdApi.getAdmissionPriorAuth(...args),
  getAdmissionMlc: (...args: Parameters<typeof ipdApi.getAdmissionMlc>) =>
    ipdApi.getAdmissionMlc(...args),
  linkMlc: (...args: Parameters<typeof ipdApi.linkMlc>) => ipdApi.linkMlc(...args),
  getAdmissionDietOrders: (...args: Parameters<typeof ipdApi.getAdmissionDietOrders>) =>
    ipdApi.getAdmissionDietOrders(...args),
  getAdmissionConsents: (...args: Parameters<typeof ipdApi.getAdmissionConsents>) =>
    ipdApi.getAdmissionConsents(...args),
  getAdmissionPrintData: (...args: Parameters<typeof ipdApi.getAdmissionPrintData>) =>
    ipdApi.getAdmissionPrintData(...args),
  getWristbandPrintData: (...args: Parameters<typeof printDataApi.getWristbandPrintData>) =>
    printDataApi.getWristbandPrintData(...args),
  listBedTurnaround: (...args: Parameters<typeof ipdApi.listBedTurnaround>) =>
    ipdApi.listBedTurnaround(...args),
  listRestraintChecks: (...args: Parameters<typeof ipdApi.listRestraintChecks>) =>
    ipdApi.listRestraintChecks(...args),
  getDeathSummary: (...args: Parameters<typeof ipdApi.getDeathSummary>) =>
    ipdApi.getDeathSummary(...args),
  createDeathSummary: (...args: Parameters<typeof ipdApi.createDeathSummary>) =>
    ipdApi.createDeathSummary(...args),
  listBirthRecords: (...args: Parameters<typeof ipdApi.listBirthRecords>) =>
    ipdApi.listBirthRecords(...args),
  createBirthRecord: (...args: Parameters<typeof ipdApi.createBirthRecord>) =>
    ipdApi.createBirthRecord(...args),
  getSurgeonCaseload: (...args: Parameters<typeof otApi.getSurgeonCaseload>) =>
    otApi.getSurgeonCaseload(...args),
  generateDischargeSummary: (...args: Parameters<typeof ipdApi.generateDischargeSummary>) =>
    ipdApi.generateDischargeSummary(...args),
  bedTransfer: (...args: Parameters<typeof ipdApi.bedTransfer>) => ipdApi.bedTransfer(...args),
  checkRoomEligibility: (...args: Parameters<typeof ipdApi.checkRoomEligibility>) =>
    ipdApi.checkRoomEligibility(...args),
  setRoomRentLimit: (...args: Parameters<typeof billingApi.setRoomRentLimit>) =>
    billingApi.setRoomRentLimit(...args),
  listRoomConsentWitnesses: (...args: Parameters<typeof billingApi.listRoomConsentWitnesses>) =>
    billingApi.listRoomConsentWitnesses(...args),
  expectedDischarges: (...args: Parameters<typeof ipdApi.expectedDischarges>) =>
    ipdApi.expectedDischarges(...args),
  listAnesthesiaComplications: (...args: Parameters<typeof otApi.listAnesthesiaComplications>) =>
    otApi.listAnesthesiaComplications(...args),
  getIpdDischargeWorkflow: (...args: Parameters<typeof ipdApi.getIpdDischargeWorkflow>) =>
    ipdApi.getIpdDischargeWorkflow(...args),
  updateIpdDischargeStep: (...args: Parameters<typeof ipdApi.updateIpdDischargeStep>) =>
    ipdApi.updateIpdDischargeStep(...args),
};
