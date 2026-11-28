/** The `/print-data` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AbdmConsentPrintData,
  AdrReportPrintData,
  AdvanceReceiptPrintData,
  AebasAttendanceReportPrintData,
  AgeEstimationPrintData,
  AmaFormPrintData,
  AmcContractPrintData,
  AnesthesiaRecordPrintData,
  AntiRaggingUndertakingPrintData,
  AppointmentSlipPrintData,
  BirthRegisterPrintData,
  BloodDonorFormPrintData,
  CalibrationCertificatePrintData,
  CapaFormPrintData,
  CaseSheetCoverPrintData,
  CashlessClaimPrintData,
  CmeCertificatePrintData,
  ComponentSlipPrintData,
  ConsentPrintData,
  CreditNotePrintData,
  CrossMatchRequisitionPrintData,
  CrossmatchReportPrintData,
  CumulativeLabReportPrintData,
  DeathCertificatePrintData,
  DeathDeclarationPrintData,
  DeathRegisterPrintData,
  DgUpsRunLogPrintData,
  DisabilityAccommodationPlanPrintData,
  DischargeChecklistPrintData,
  DischargeSummaryPrintData,
  DispensingLabelPrintData,
  DnrConsentPrintData,
  DpdpConsentPrintData,
  DrugExpiryAlertPrintData,
  DrugLicenseReportPrintData,
  DutyRosterPrintData,
  EmployeeIdCardPrintData,
  EquipmentBreakdownReportPrintData,
  EquipmentCondemnationPrintData,
  EquipmentHistoryCardPrintData,
  EstimatePrintData,
  ExamHallTicketPrintData,
  FallRiskAssessmentPrintData,
  FireEquipmentInspectionPrintData,
  FireMockDrillReportPrintData,
  FluidBalanceChartPrintData,
  GcsChartPrintData,
  GrnPrintData,
  GstInvoicePrintData,
  HistopathReportPrintData,
  HospitalBrandingPrintData,
  HostelAllotmentOrderPrintData,
  IecApprovalCertificatePrintData,
  IncidentReportPrintData,
  IndentFormPrintData,
  InfantWristbandPrintData,
  InsuranceClaimPrintData,
  InsurancePreauthPrintData,
  InternalAssessmentMarksPrintData,
  InternRotationSchedulePrintData,
  InternshipCompletionCertificatePrintData,
  InvestigationRequisitionPrintData,
  IoChartPrintData,
  IpdFinalBillPrintData,
  IpdInterimBillPrintData,
  LabReportFullPrintData,
  LabReportPrintData,
  LeaveApplicationPrintData,
  MarPrintData,
  MaterialIssueVoucherPrintData,
  MateriovigilanceReportPrintData,
  MgpsDailyLogPrintData,
  MlcDocumentationPrintData,
  MlcPoliceIntimationPrintData,
  MlcRegisterPrintData,
  MlcRegisterSummaryPrintData,
  NabhQualityReportPrintData,
  NablQualityReportPrintData,
  NdpsRegisterPrintData,
  NmcComplianceReportPrintData,
  NursingAssessmentPrintData,
  OpdBillPrintData,
  OpdCardPrintData,
  OpdCertificatePrintData,
  OpdPrescriptionPrintData,
  OpdProcedureConsentPrintData,
  OperationNotesPrintData,
  OrganDonationConsentPrintData,
  OsceScoringSheetPrintData,
  OtRegisterPrintData,
  PackageBillPrintData,
  PackageEstimatePrintData,
  PainAssessmentPrintData,
  PatientCardPrintData,
  PcpndtFormFPrintData,
  PcpndtReportPrintData,
  PesoComplianceReportPrintData,
  PgLogbookEntryPrintData,
  PmChecklistPrintData,
  PostopOrdersPrintData,
  PreopAssessmentPrintData,
  PrescriptionPrintData,
  PressureUlcerRiskPrintData,
  ProgressNotePrintData,
  PurchaseOrderPrintData,
  RadiologyReportFullPrintData,
  RadiologyReportPrintData,
  RcaTemplatePrintData,
  ReceiptPrintData,
  RefundReceiptPrintData,
  RegistrationCardPrintData,
  ResearchConsentPrintData,
  ResearchProposalFormPrintData,
  RestraintDocumentationPrintData,
  ServiceBondAgreementPrintData,
  SimulationDebriefingPrintData,
  SpcbBmwReturnsPrintData,
  StaffAttendanceReportPrintData,
  StaffCredentialFormPrintData,
  StipendPaymentAdvicePrintData,
  StockTransferNotePrintData,
  StudentAdmissionFormPrintData,
  SurgicalSafetyChecklistPrintData,
  TeachingConsentPrintData,
  TokenSlipPrintData,
  TrainingCertificatePrintData,
  TransferSummaryPrintData,
  TransfusionMonitoringPrintData,
  TransfusionReactionPrintData,
  TransfusionRequisitionPrintData,
  TreatmentChartPrintData,
  VideoConsentPrintData,
  VisitorPassPrintData,
  VisitorRegisterPrintData,
  VitalsChartPrintData,
  WaterQualityTestPrintData,
  WorkOrderPrintData,
  WoundCertificatePrintData,
  WristbandPrintData,
} from "@medbrains/types";
import { request } from "../client.js";

export const printDataApi = {
  // ══════════════════════════════════════════════════════════
  //  Print Data
  // ══════════════════════════════════════════════════════════

  getPrescriptionPrintData: (encounterId: string) =>
    request<PrescriptionPrintData>(`/print-data/prescription/${encounterId}`),

  getLabReportPrintData: (orderId: string) =>
    request<LabReportPrintData>(`/print-data/lab-report/${orderId}`),

  getRadiologyPrintData: (orderId: string) =>
    request<RadiologyReportPrintData>(`/print-data/radiology-report/${orderId}`),

  getPatientCardPrintData: (patientId: string) =>
    request<PatientCardPrintData>(`/print-data/patient-card/${patientId}`),

  getWristbandPrintData: (admissionId: string, params?: { reprintReason?: string }) => {
    const sp = new URLSearchParams();
    if (params?.reprintReason) sp.set("reprint_reason", params.reprintReason);
    const qs = sp.toString();
    return request<WristbandPrintData>(`/print-data/wristband/${admissionId}${qs ? `?${qs}` : ""}`);
  },

  getOpdCertificatePrintData: (certificateId: string, params?: { reprintReason?: string }) => {
    const sp = new URLSearchParams();
    if (params?.reprintReason) sp.set("reprint_reason", params.reprintReason);
    const qs = sp.toString();
    return request<OpdCertificatePrintData>(
      `/print-data/opd-certificate/${certificateId}${qs ? `?${qs}` : ""}`,
    );
  },

  getOpdConsentPrintData: (consentId: string, params?: { reprintReason?: string }) => {
    const sp = new URLSearchParams();
    if (params?.reprintReason) sp.set("reprint_reason", params.reprintReason);
    const qs = sp.toString();
    return request<OpdProcedureConsentPrintData>(
      `/print-data/opd-consent/${consentId}${qs ? `?${qs}` : ""}`,
    );
  },

  getDeathCertPrintData: (admissionId: string) =>
    request<DeathCertificatePrintData>(`/print-data/death-certificate/${admissionId}`),

  getDischargePrintData: (admissionId: string) =>
    request<DischargeSummaryPrintData>(`/print-data/discharge/${admissionId}`),

  getReceiptPrintData: (paymentId: string, params?: { reprintReason?: string }) => {
    const sp = new URLSearchParams();
    if (params?.reprintReason) sp.set("reprint_reason", params.reprintReason);
    const qs = sp.toString();
    return request<ReceiptPrintData>(`/print-data/receipt/${paymentId}${qs ? `?${qs}` : ""}`);
  },

  getEstimatePrintData: (invoiceId: string) =>
    request<EstimatePrintData>(`/print-data/estimate/${invoiceId}`),

  getCreditNotePrintData: (id: string) =>
    request<CreditNotePrintData>(`/print-data/credit-note/${id}`),

  getPharmacyBillPrintData: (invoiceId: string) =>
    request<GstInvoicePrintData>(`/print-data/pharmacy-bill/${invoiceId}`),
  getGstInvoicePrintData: (invoiceId: string) =>
    request<GstInvoicePrintData>(`/print-data/gst-invoice/${invoiceId}`),

  // ── Consent Form Print Data ─────────────────────────────

  getGeneralConsentPrintData: (admissionId: string) =>
    request<ConsentPrintData>(`/print-data/consent/general/${admissionId}`),

  getSurgicalConsentPrintData: (bookingId: string) =>
    request<ConsentPrintData>(`/print-data/consent/surgical/${bookingId}`),

  getAnesthesiaConsentPrintData: (bookingId: string) =>
    request<ConsentPrintData>(`/print-data/consent/anesthesia/${bookingId}`),

  getBloodConsentPrintData: (admissionId: string) =>
    request<ConsentPrintData>(`/print-data/consent/blood/${admissionId}`),

  getHivConsentPrintData: (patientId: string) =>
    request<ConsentPrintData>(`/print-data/consent/hiv/${patientId}`),

  getAmaConsentPrintData: (admissionId: string) =>
    request<ConsentPrintData>(`/print-data/consent/ama/${admissionId}`),

  getPhotoConsentPrintData: (patientId: string) =>
    request<ConsentPrintData>(`/print-data/consent/photo/${patientId}`),

  // ── MRD Form Print Data ─────────────────────────────────

  getProgressNotePrintData: (admissionId: string) =>
    request<ProgressNotePrintData>(`/print-data/mrd/progress-note/${admissionId}`),

  getNursingAssessmentPrintData: (admissionId: string) =>
    request<NursingAssessmentPrintData>(`/print-data/mrd/nursing-assessment/${admissionId}`),

  getMarPrintData: (admissionId: string) =>
    request<MarPrintData>(`/print-data/mrd/mar/${admissionId}`),

  getVitalsChartPrintData: (admissionId: string) =>
    request<VitalsChartPrintData>(`/print-data/mrd/vitals-chart/${admissionId}`),

  getIoChartPrintData: (admissionId: string) =>
    request<IoChartPrintData>(`/print-data/mrd/io-chart/${admissionId}`),

  getDischargeChecklistPrintData: (admissionId: string) =>
    request<DischargeChecklistPrintData>(`/print-data/mrd/discharge-checklist/${admissionId}`),

  // ── Token Slip & Visitor Pass ───────────────────────────

  getTokenSlipPrintData: (tokenId: string) =>
    request<TokenSlipPrintData>(`/print-data/token-slip/${tokenId}`),

  getVisitorPassPrintData: (passId: string) =>
    request<VisitorPassPrintData>(`/print-data/visitor-pass/${passId}`),

  // ── Phase 2: Billing Print Data ────────────────────────────

  getOpdBillPrintData: (invoiceId: string) =>
    request<OpdBillPrintData>(`/print-data/opd-bill/${invoiceId}`),

  getIpdInterimBillPrintData: (admissionId: string) =>
    request<IpdInterimBillPrintData>(`/print-data/ipd-interim-bill/${admissionId}`),

  getIpdFinalBillPrintData: (invoiceId: string) =>
    request<IpdFinalBillPrintData>(`/print-data/ipd-final-bill/${invoiceId}`),
  getAdmissionConsolidatedBillPrintData: (admissionId: string) =>
    request<IpdFinalBillPrintData>(`/print-data/admission-consolidated-bill/${admissionId}`),

  getAdvanceReceiptPrintData: (advanceId: string) =>
    request<AdvanceReceiptPrintData>(`/print-data/advance-receipt/${advanceId}`),

  getRefundReceiptPrintData: (refundId: string) =>
    request<RefundReceiptPrintData>(`/print-data/refund-receipt/${refundId}`),

  getInsurancePreauthPrintData: (requestId: string) =>
    request<InsurancePreauthPrintData>(`/print-data/insurance-preauth/${requestId}`),

  getCashlessClaimPrintData: (claimId: string) =>
    request<CashlessClaimPrintData>(`/print-data/cashless-claim/${claimId}`),

  getPackageEstimatePrintData: (packageId: string) =>
    request<PackageEstimatePrintData>(`/print-data/package-estimate/${packageId}`),

  // ── Phase 2: Lab & Blood Bank Report Print Data ────────────

  getHistopathReportPrintData: (orderId: string) =>
    request<HistopathReportPrintData>(`/print-data/histopath-report/${orderId}`),

  getCrossmatchReportPrintData: (requestId: string) =>
    request<CrossmatchReportPrintData>(`/print-data/crossmatch-report/${requestId}`),

  getComponentSlipPrintData: (issueId: string) =>
    request<ComponentSlipPrintData>(`/print-data/component-slip/${issueId}`),

  getInvestigationRequisitionPrintData: (orderId: string) =>
    request<InvestigationRequisitionPrintData>(`/print-data/investigation-requisition/${orderId}`),

  // ── Phase 2: Additional Consent Print Data ─────────────────

  getDnrConsentPrintData: (admissionId: string) =>
    request<DnrConsentPrintData>(`/print-data/consent/dnr/${admissionId}`),

  getOrganDonationConsentPrintData: (patientId: string) =>
    request<OrganDonationConsentPrintData>(`/print-data/consent/organ-donation/${patientId}`),

  getResearchConsentPrintData: (consentId: string) =>
    request<ResearchConsentPrintData>(`/print-data/consent/research/${consentId}`),

  getAbdmConsentPrintData: (patientId: string) =>
    request<AbdmConsentPrintData>(`/print-data/consent/abdm/${patientId}`),

  getTeachingConsentPrintData: (admissionId: string) =>
    request<TeachingConsentPrintData>(`/print-data/consent/teaching/${admissionId}`),

  // ── Phase 2: Clinical & Identity Print Data ────────────────

  getTreatmentChartPrintData: (admissionId: string) =>
    request<TreatmentChartPrintData>(`/print-data/treatment-chart/${admissionId}`),

  getTransferSummaryPrintData: (transferLogId: string) =>
    request<TransferSummaryPrintData>(`/print-data/transfer-summary/${transferLogId}`),

  getRegistrationCardPrintData: (patientId: string) =>
    request<RegistrationCardPrintData>(`/print-data/registration-card/${patientId}`),

  /** The OPD card for a patient, on the hospital's own letterhead. */
  getOpdCardPrintData: (patientId: string) =>
    request<OpdCardPrintData>(`/print-data/opd-card/${patientId}`),

  /** The OPD card for one visit: identity plus token, department and doctor. */
  getOpdVisitCardPrintData: (encounterId: string) =>
    request<OpdCardPrintData>(`/print-data/opd-visit-card/${encounterId}`),

  getInfantWristbandPrintData: (newbornId: string) =>
    request<InfantWristbandPrintData>(`/print-data/infant-wristband/${newbornId}`),

  // ── Phase 3: Surgical & OT Print Data ──
  getCaseSheetCoverPrintData: (admissionId: string) =>
    request<CaseSheetCoverPrintData>(`/print-data/case-sheet-cover/${admissionId}`),

  getPreopAssessmentPrintData: (bookingId: string) =>
    request<PreopAssessmentPrintData>(`/print-data/preop-assessment/${bookingId}`),

  // The OT booking, not a surgery: the checklist rows hang off the booking.
  getSurgicalSafetyChecklistPrintData: (bookingId: string) =>
    request<SurgicalSafetyChecklistPrintData>(`/print-data/surgical-safety-checklist/${bookingId}`),

  getAnesthesiaRecordPrintData: (bookingId: string) =>
    request<AnesthesiaRecordPrintData>(`/print-data/anesthesia-record/${bookingId}`),

  getOperationNotesPrintData: (bookingId: string) =>
    request<OperationNotesPrintData>(`/print-data/operation-notes/${bookingId}`),

  getPostopOrdersPrintData: (bookingId: string) =>
    request<PostopOrdersPrintData>(`/print-data/postop-orders/${bookingId}`),

  getTransfusionMonitoringPrintData: (transfusionId: string) =>
    request<TransfusionMonitoringPrintData>(`/print-data/transfusion-monitoring/${transfusionId}`),

  // ── Phase 3: Clinical Charts Print Data ──
  getFluidBalanceChartPrintData: (admissionId: string) =>
    request<FluidBalanceChartPrintData>(`/print-data/fluid-balance-chart/${admissionId}`),

  getPainAssessmentPrintData: (admissionId: string) =>
    request<PainAssessmentPrintData>(`/print-data/pain-assessment/${admissionId}`),

  getFallRiskAssessmentPrintData: (admissionId: string) =>
    request<FallRiskAssessmentPrintData>(`/print-data/fall-risk-assessment/${admissionId}`),

  getPressureUlcerRiskPrintData: (admissionId: string) =>
    request<PressureUlcerRiskPrintData>(`/print-data/pressure-ulcer-risk/${admissionId}`),

  getGcsChartPrintData: (admissionId: string) =>
    request<GcsChartPrintData>(`/print-data/gcs-chart/${admissionId}`),

  getTransfusionRequisitionPrintData: (requestId: string) =>
    request<TransfusionRequisitionPrintData>(`/print-data/transfusion-requisition/${requestId}`),

  // ── Phase 3: Medico-Legal Print Data ──
  getAmaFormPrintData: (admissionId: string) =>
    request<AmaFormPrintData>(`/print-data/ama-form/${admissionId}`),

  getMlcRegisterPrintData: (caseId: string, params?: { reprint_reason?: string }) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<MlcRegisterPrintData>(`/print-data/mlc-register/${caseId}${qs}`);
  },

  getMlcPoliceIntimationPrintData: (intimationId: string, params?: { reprint_reason?: string }) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<MlcPoliceIntimationPrintData>(
      `/print-data/mlc-police-intimation/${intimationId}${qs}`,
    );
  },

  getWoundCertificatePrintData: (caseId: string) =>
    request<WoundCertificatePrintData>(`/print-data/wound-certificate/${caseId}`),

  getAgeEstimationPrintData: (documentId: string) =>
    request<AgeEstimationPrintData>(`/print-data/age-estimation/${documentId}`),

  getDeathDeclarationPrintData: (patientId: string) =>
    request<DeathDeclarationPrintData>(`/print-data/death-declaration/${patientId}`),

  getMlcDocumentationPrintData: (caseId: string, params?: { reprint_reason?: string }) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<MlcDocumentationPrintData>(`/print-data/mlc-documentation/${caseId}${qs}`);
  },

  // ── Phase 3: Quality & Safety Print Data ──
  getIncidentReportPrintData: (incidentId: string) =>
    request<IncidentReportPrintData>(`/print-data/incident-report/${incidentId}`),

  getRcaTemplatePrintData: (incidentId: string) =>
    request<RcaTemplatePrintData>(`/print-data/rca-template/${incidentId}`),

  getCapaFormPrintData: (capaId: string) =>
    request<CapaFormPrintData>(`/print-data/capa-form/${capaId}`),

  getAdrReportPrintData: (reportId: string) =>
    request<AdrReportPrintData>(`/print-data/adr-report/${reportId}`),

  getTransfusionReactionPrintData: (transfusionId: string) =>
    request<TransfusionReactionPrintData>(`/print-data/transfusion-reaction/${transfusionId}`),

  getOpdPrescriptionPrintData: (encounterId: string) =>
    request<OpdPrescriptionPrintData>(`/print-data/opd-prescription/${encounterId}`),

  getLabReportFullPrintData: (orderId: string) =>
    request<LabReportFullPrintData>(`/print-data/lab-report-full/${orderId}`),

  getCumulativeLabReportPrintData: (patientId: string) =>
    request<CumulativeLabReportPrintData>(`/print-data/cumulative-lab-report/${patientId}`),

  getRadiologyReportFullPrintData: (orderId: string) =>
    request<RadiologyReportFullPrintData>(`/print-data/radiology-report-full/${orderId}`),

  // ── Phase 4: Billing Print Data ───────────────────────────
  getCreditNoteFullPrintData: (creditNoteId: string) =>
    request<CreditNotePrintData>(`/print-data/credit-note/${creditNoteId}`),

  getPackageBillPrintData: (subscriptionId: string) =>
    request<PackageBillPrintData>(`/print-data/package-bill/${subscriptionId}`),

  getInsuranceClaimPrintData: (claimId: string) =>
    request<InsuranceClaimPrintData>(`/print-data/insurance-claim/${claimId}`),

  // ── Phase 4: Regulatory Print Data ────────────────────────
  getNabhQualityReportPrintData: (period: string) =>
    request<NabhQualityReportPrintData>(`/print-data/nabh-quality-report/${period}`),

  getNmcComplianceReportPrintData: (period: string) =>
    request<NmcComplianceReportPrintData>(`/print-data/nmc-compliance-report/${period}`),

  getNablQualityReportPrintData: (period: string) =>
    request<NablQualityReportPrintData>(`/print-data/nabl-quality-report/${period}`),

  getSpcbBmwReturnsPrintData: (quarter: string) =>
    request<SpcbBmwReturnsPrintData>(`/print-data/spcb-bmw-returns/${quarter}`),

  getPesoCompliancePrintData: (year: string) =>
    request<PesoComplianceReportPrintData>(`/print-data/peso-compliance/${year}`),

  getDrugLicenseReportPrintData: (licenseId: string) =>
    request<DrugLicenseReportPrintData>(`/print-data/drug-license-report/${licenseId}`),

  getPcpndtFormFPrintData: (id: string) =>
    request<PcpndtFormFPrintData>(`/print-data/pcpndt-form-f/${id}`),
  getPcpndtReportPrintData: (period: string) =>
    request<PcpndtReportPrintData>(`/print-data/pcpndt-report/${period}`),

  getBirthRegisterPrintData: (period: string) =>
    request<BirthRegisterPrintData>(`/print-data/birth-register/${period}`),

  getDeathRegisterPrintData: (period: string) =>
    request<DeathRegisterPrintData>(`/print-data/death-register/${period}`),

  getMlcRegisterSummaryPrintData: (period: string) =>
    request<MlcRegisterSummaryPrintData>(`/print-data/mlc-register-summary/${period}`),

  getAebasAttendancePrintData: (period: string) =>
    request<AebasAttendanceReportPrintData>(`/print-data/aebas-attendance/${period}`),

  // ── Phase 4: Admin & Procurement Print Data ───────────────
  getIndentFormPrintData: (indentId: string) =>
    request<IndentFormPrintData>(`/print-data/indent-form/${indentId}`),

  getPurchaseOrderPrintData: (poId: string) =>
    request<PurchaseOrderPrintData>(`/print-data/purchase-order/${poId}`),

  getGrnPrintData: (grnId: string) => request<GrnPrintData>(`/print-data/grn/${grnId}`),

  getMaterialIssueVoucherPrintData: (indentId: string) =>
    request<MaterialIssueVoucherPrintData>(`/print-data/material-issue-voucher/${indentId}`),

  getStockTransferNotePrintData: (transferId: string) =>
    request<StockTransferNotePrintData>(`/print-data/stock-transfer-note/${transferId}`),

  getNdpsRegisterPrintData: (period: string) =>
    request<NdpsRegisterPrintData>(`/print-data/ndps-register/${period}`),

  // One label per dispensed line, not per order: a bag of three medicines
  // needs three labels, each with its own directions.
  getDispensingLabelPrintData: (orderItemId: string) =>
    request<DispensingLabelPrintData>(`/print-data/dispensing-label/${orderItemId}`),

  getDrugExpiryAlertPrintData: (storeId: string) =>
    request<DrugExpiryAlertPrintData>(`/print-data/drug-expiry-alert/${storeId}`),

  getEquipmentCondemnationPrintData: (condemnationId: string) =>
    request<EquipmentCondemnationPrintData>(`/print-data/equipment-condemnation/${condemnationId}`),

  getWorkOrderPrintData: (workOrderId: string) =>
    request<WorkOrderPrintData>(`/print-data/work-order/${workOrderId}`),

  getPmChecklistPrintData: (workOrderId: string) =>
    request<PmChecklistPrintData>(`/print-data/pm-checklist/${workOrderId}`),

  // ══════════════════════════════════════════════════════════
  //  Phase 5: Admin/HR, BME, Blood Bank, OT, Clinical Print Data
  // ══════════════════════════════════════════════════════════

  // ── Admin/HR Forms ──────────────────────────────────────────
  getEmployeeIdCardPrintData: (employeeId: string) =>
    request<EmployeeIdCardPrintData>(`/print-data/employee-id-card/${employeeId}`),

  getDutyRosterPrintData: (departmentId: string, period: string) =>
    request<DutyRosterPrintData>(`/print-data/duty-roster/${departmentId}/${period}`),

  getLeaveApplicationPrintData: (leaveId: string) =>
    request<LeaveApplicationPrintData>(`/print-data/leave-application/${leaveId}`),

  getStaffAttendancePrintData: (departmentId: string, month: number, year: number) =>
    request<StaffAttendanceReportPrintData>(
      `/print-data/staff-attendance/${departmentId}/${month}/${year}`,
    ),

  getTrainingCertificatePrintData: (trainingId: string) =>
    request<TrainingCertificatePrintData>(`/print-data/training-certificate/${trainingId}`),

  getStaffCredentialsPrintData: (employeeId: string) =>
    request<StaffCredentialFormPrintData>(`/print-data/staff-credentials/${employeeId}`),

  getVisitorRegisterPrintData: (date: string) =>
    request<VisitorRegisterPrintData>(`/print-data/visitor-register/${date}`),

  // ── BME/Engineering Forms ───────────────────────────────────
  getAmcContractPrintData: (contractId: string) =>
    request<AmcContractPrintData>(`/print-data/amc-contract/${contractId}`),

  getCalibrationCertificatePrintData: (calibrationId: string) =>
    request<CalibrationCertificatePrintData>(
      `/print-data/calibration-certificate/${calibrationId}`,
    ),

  getEquipmentBreakdownPrintData: (breakdownId: string) =>
    request<EquipmentBreakdownReportPrintData>(`/print-data/equipment-breakdown/${breakdownId}`),

  getEquipmentHistoryPrintData: (equipmentId: string) =>
    request<EquipmentHistoryCardPrintData>(`/print-data/equipment-history/${equipmentId}`),

  getMgpsLogPrintData: (readingId: string) =>
    request<MgpsDailyLogPrintData>(`/print-data/mgps-log/${readingId}`),

  getWaterQualityPrintData: (testId: string) =>
    request<WaterQualityTestPrintData>(`/print-data/water-quality/${testId}`),

  getDgUpsLogPrintData: (readingId: string) =>
    request<DgUpsRunLogPrintData>(`/print-data/dg-ups-log/${readingId}`),

  getFireInspectionPrintData: (inspectionId: string) =>
    request<FireEquipmentInspectionPrintData>(`/print-data/fire-inspection/${inspectionId}`),

  getMateriovigilancePrintData: (reportId: string) =>
    request<MateriovigilanceReportPrintData>(`/print-data/materiovigilance/${reportId}`),

  getFireMockDrillPrintData: (drillId: string) =>
    request<FireMockDrillReportPrintData>(`/print-data/fire-mock-drill/${drillId}`),

  // ── Blood Bank & OT Forms ───────────────────────────────────
  getOtRegisterPrintData: (otRoomId: string, date: string) =>
    request<OtRegisterPrintData>(`/print-data/ot-register/${otRoomId}/${date}`),

  getBloodDonorFormPrintData: (donorId: string) =>
    request<BloodDonorFormPrintData>(`/print-data/blood-donor-form/${donorId}`),

  getCrossMatchRequisitionPrintData: (crossmatchRequestId: string) =>
    request<CrossMatchRequisitionPrintData>(
      `/print-data/cross-match-requisition/${crossmatchRequestId}`,
    ),

  // ── Clinical/Identity Forms ─────────────────────────────────
  getAppointmentSlipPrintData: (appointmentId: string) =>
    request<AppointmentSlipPrintData>(`/print-data/appointment-slip/${appointmentId}`),

  getDpdpConsentPrintData: (consentId: string) =>
    request<DpdpConsentPrintData>(`/print-data/dpdp-consent/${consentId}`),

  getVideoConsentPrintData: (signatureId: string) =>
    request<VideoConsentPrintData>(`/print-data/video-consent/${signatureId}`),

  getRestraintDocumentationPrintData: (restraintDocId: string) =>
    request<RestraintDocumentationPrintData>(
      `/print-data/restraint-documentation/${restraintDocId}`,
    ),

  // ══════════════════════════════════════════════════════════
  // PHASE 6: ACADEMIC/SPECIALTY FORMS & BRANDING
  // ══════════════════════════════════════════════════════════

  // -- Phase 6: Academic/Medical College Forms --
  getStudentAdmissionFormPrintData: (admissionId: string) =>
    request<StudentAdmissionFormPrintData>(`/print-data/student-admission-form/${admissionId}`),

  getInternRotationSchedulePrintData: (scheduleId: string) =>
    request<InternRotationSchedulePrintData>(`/print-data/intern-rotation-schedule/${scheduleId}`),

  getPgLogbookEntryPrintData: (entryId: string) =>
    request<PgLogbookEntryPrintData>(`/print-data/pg-logbook-entry/${entryId}`),

  getInternalAssessmentMarksPrintData: (assessmentId: string) =>
    request<InternalAssessmentMarksPrintData>(
      `/print-data/internal-assessment-marks/${assessmentId}`,
    ),

  getExamHallTicketPrintData: (ticketId: string) =>
    request<ExamHallTicketPrintData>(`/print-data/exam-hall-ticket/${ticketId}`),

  getOsceScoringSheetPrintData: (examId: string, stationNumber: number) =>
    request<OsceScoringSheetPrintData>(`/print-data/osce-scoring-sheet/${examId}/${stationNumber}`),

  getSimulationDebriefingPrintData: (sessionId: string) =>
    request<SimulationDebriefingPrintData>(`/print-data/simulation-debriefing/${sessionId}`),

  getCmeCertificatePrintData: (certificateId: string) =>
    request<CmeCertificatePrintData>(`/print-data/cme-certificate/${certificateId}`),

  getIecApprovalCertificatePrintData: (approvalId: string) =>
    request<IecApprovalCertificatePrintData>(`/print-data/iec-approval-certificate/${approvalId}`),

  getResearchProposalFormPrintData: (proposalId: string) =>
    request<ResearchProposalFormPrintData>(`/print-data/research-proposal-form/${proposalId}`),

  getHostelAllotmentOrderPrintData: (orderId: string) =>
    request<HostelAllotmentOrderPrintData>(`/print-data/hostel-allotment-order/${orderId}`),

  getAntiRaggingUndertakingPrintData: (undertakingId: string) =>
    request<AntiRaggingUndertakingPrintData>(
      `/print-data/anti-ragging-undertaking/${undertakingId}`,
    ),

  getDisabilityAccommodationPlanPrintData: (planId: string) =>
    request<DisabilityAccommodationPlanPrintData>(
      `/print-data/disability-accommodation-plan/${planId}`,
    ),

  getInternshipCompletionCertificatePrintData: (certificateId: string) =>
    request<InternshipCompletionCertificatePrintData>(
      `/print-data/internship-completion-certificate/${certificateId}`,
    ),

  getServiceBondAgreementPrintData: (bondId: string) =>
    request<ServiceBondAgreementPrintData>(`/print-data/service-bond-agreement/${bondId}`),

  getStipendPaymentAdvicePrintData: (adviceId: string) =>
    request<StipendPaymentAdvicePrintData>(`/print-data/stipend-payment-advice/${adviceId}`),

  // -- Phase 6: Hospital Branding --
  getHospitalBrandingPrintData: () =>
    request<HospitalBrandingPrintData>(`/print-data/hospital-branding`),
};
