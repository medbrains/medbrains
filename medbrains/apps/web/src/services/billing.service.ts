import { billingApi } from "@medbrains/api/modules/billing";
import { integrationsApi } from "@medbrains/api/modules/integrations";
import { printDataApi } from "@medbrains/api/modules/print-data";
import { publicApi } from "@medbrains/api/modules/public";
import { setupApi } from "@medbrains/api/modules/setup";

export const billingService = {
  getPayerSplit: (invoiceId: string) => billingApi.getPayerSplit(invoiceId),
  assignItemPayer: (...args: Parameters<typeof billingApi.assignItemPayer>) =>
    billingApi.assignItemPayer(...args),
  applyPayerSplit: (invoiceId: string) => billingApi.applyPayerSplit(invoiceId),
  getNonPayables: () => billingApi.getNonPayables(),
  listExchangeRates: (...args: Parameters<typeof billingApi.listExchangeRates>) =>
    billingApi.listExchangeRates(...args),
  createExchangeRate: (...args: Parameters<typeof billingApi.createExchangeRate>) =>
    billingApi.createExchangeRate(...args),
  verifyBill: (...args: Parameters<typeof publicApi.verifyBill>) => publicApi.verifyBill(...args),
  listInvoices: (...args: Parameters<typeof billingApi.listInvoices>) =>
    billingApi.listInvoices(...args),
  cloneInvoice: (...args: Parameters<typeof billingApi.cloneInvoice>) =>
    billingApi.cloneInvoice(...args),
  createInvoice: (...args: Parameters<typeof billingApi.createInvoice>) =>
    billingApi.createInvoice(...args),
  getInvoice: (...args: Parameters<typeof billingApi.getInvoice>) => billingApi.getInvoice(...args),
  getInvoicePrintData: (...args: Parameters<typeof billingApi.getInvoicePrintData>) =>
    billingApi.getInvoicePrintData(...args),
  issueInvoice: (...args: Parameters<typeof billingApi.issueInvoice>) =>
    billingApi.issueInvoice(...args),
  cancelInvoice: (...args: Parameters<typeof billingApi.cancelInvoice>) =>
    billingApi.cancelInvoice(...args),
  closeZeroInvoice: (...args: Parameters<typeof billingApi.closeZeroInvoice>) =>
    billingApi.closeZeroInvoice(...args),
  addInvoiceItem: (...args: Parameters<typeof billingApi.addInvoiceItem>) =>
    billingApi.addInvoiceItem(...args),
  removeInvoiceItem: (...args: Parameters<typeof billingApi.removeInvoiceItem>) =>
    billingApi.removeInvoiceItem(...args),
  recordPayment: (...args: Parameters<typeof billingApi.recordPayment>) =>
    billingApi.recordPayment(...args),
  getPatientDues: (...args: Parameters<typeof billingApi.getPatientDues>) =>
    billingApi.getPatientDues(...args),
  listCounterOpenToday: () => billingApi.listCounterOpenToday(),
  collectPayment: (...args: Parameters<typeof billingApi.collectPayment>) =>
    billingApi.collectPayment(...args),
  listBillingEntities: () => billingApi.listBillingEntities(),
  createBillingEntity: (...args: Parameters<typeof billingApi.createBillingEntity>) =>
    billingApi.createBillingEntity(...args),
  updateBillingEntity: (...args: Parameters<typeof billingApi.updateBillingEntity>) =>
    billingApi.updateBillingEntity(...args),
  listBillingLanes: () => billingApi.listBillingLanes(),
  updateBillingLane: (...args: Parameters<typeof billingApi.updateBillingLane>) =>
    billingApi.updateBillingLane(...args),
  listInvoiceDiscounts: (...args: Parameters<typeof billingApi.listInvoiceDiscounts>) =>
    billingApi.listInvoiceDiscounts(...args),
  addDiscount: (...args: Parameters<typeof billingApi.addDiscount>) =>
    billingApi.addDiscount(...args),
  removeDiscount: (...args: Parameters<typeof billingApi.removeDiscount>) =>
    billingApi.removeDiscount(...args),
  generateReceipt: (...args: Parameters<typeof billingApi.generateReceipt>) =>
    billingApi.generateReceipt(...args),
  listReceipts: (...args: Parameters<typeof billingApi.listReceipts>) =>
    billingApi.listReceipts(...args),
  getReceiptPrintData: (...args: Parameters<typeof printDataApi.getReceiptPrintData>) =>
    printDataApi.getReceiptPrintData(...args),
  listChargeMaster: (...args: Parameters<typeof billingApi.listChargeMaster>) =>
    billingApi.listChargeMaster(...args),
  createChargeMaster: (...args: Parameters<typeof billingApi.createChargeMaster>) =>
    billingApi.createChargeMaster(...args),
  importChargeMaster: (...args: Parameters<typeof billingApi.importChargeMaster>) =>
    billingApi.importChargeMaster(...args),
  deleteChargeMaster: (...args: Parameters<typeof billingApi.deleteChargeMaster>) =>
    billingApi.deleteChargeMaster(...args),
  erFastInvoice: (...args: Parameters<typeof billingApi.erFastInvoice>) =>
    billingApi.erFastInvoice(...args),
  listPackages: (...args: Parameters<typeof billingApi.listPackages>) =>
    billingApi.listPackages(...args),
  createPackage: (...args: Parameters<typeof billingApi.createPackage>) =>
    billingApi.createPackage(...args),
  deletePackage: (...args: Parameters<typeof billingApi.deletePackage>) =>
    billingApi.deletePackage(...args),
  listRatePlans: (...args: Parameters<typeof billingApi.listRatePlans>) =>
    billingApi.listRatePlans(...args),
  createRatePlan: (...args: Parameters<typeof billingApi.createRatePlan>) =>
    billingApi.createRatePlan(...args),
  deleteRatePlan: (...args: Parameters<typeof billingApi.deleteRatePlan>) =>
    billingApi.deleteRatePlan(...args),
  listRefunds: (...args: Parameters<typeof billingApi.listRefunds>) =>
    billingApi.listRefunds(...args),
  listCreditNotes: (...args: Parameters<typeof billingApi.listCreditNotes>) =>
    billingApi.listCreditNotes(...args),
  createRefund: (...args: Parameters<typeof billingApi.createRefund>) =>
    billingApi.createRefund(...args),
  createCreditNote: (...args: Parameters<typeof billingApi.createCreditNote>) =>
    billingApi.createCreditNote(...args),
  applyCreditNote: (...args: Parameters<typeof billingApi.applyCreditNote>) =>
    billingApi.applyCreditNote(...args),
  listWriteOffs: (...args: Parameters<typeof billingApi.listWriteOffs>) =>
    billingApi.listWriteOffs(...args),
  createWriteOff: (...args: Parameters<typeof billingApi.createWriteOff>) =>
    billingApi.createWriteOff(...args),
  approveWriteOff: (...args: Parameters<typeof billingApi.approveWriteOff>) =>
    billingApi.approveWriteOff(...args),
  listInsuranceClaims: (...args: Parameters<typeof billingApi.listInsuranceClaims>) =>
    billingApi.listInsuranceClaims(...args),
  listNhcxCallbacks: (...args: Parameters<typeof integrationsApi.listNhcxCallbacks>) =>
    integrationsApi.listNhcxCallbacks(...args),
  createInsuranceClaim: (...args: Parameters<typeof billingApi.createInsuranceClaim>) =>
    billingApi.createInsuranceClaim(...args),
  updateInsuranceClaim: (...args: Parameters<typeof billingApi.updateInsuranceClaim>) =>
    billingApi.updateInsuranceClaim(...args),
  listTpaRateCards: (...args: Parameters<typeof billingApi.listTpaRateCards>) =>
    billingApi.listTpaRateCards(...args),
  createTpaRateCard: (...args: Parameters<typeof billingApi.createTpaRateCard>) =>
    billingApi.createTpaRateCard(...args),
  deleteTpaRateCard: (...args: Parameters<typeof billingApi.deleteTpaRateCard>) =>
    billingApi.deleteTpaRateCard(...args),
  getTenantSettings: (...args: Parameters<typeof setupApi.getTenantSettings>) =>
    setupApi.getTenantSettings(...args),
  updateTenantSetting: (...args: Parameters<typeof setupApi.updateTenantSetting>) =>
    setupApi.updateTenantSetting(...args),
  getBillingPaymentSettings: () => billingApi.getBillingPaymentSettings(),
  updateBillingPaymentSettings: (
    ...args: Parameters<typeof billingApi.updateBillingPaymentSettings>
  ) => billingApi.updateBillingPaymentSettings(...args),
  listAdvances: (...args: Parameters<typeof billingApi.listAdvances>) =>
    billingApi.listAdvances(...args),
  createAdvance: (...args: Parameters<typeof billingApi.createAdvance>) =>
    billingApi.createAdvance(...args),
  getFinalBillChecklist: (...args: Parameters<typeof billingApi.getFinalBillChecklist>) =>
    billingApi.getFinalBillChecklist(...args),
  adjustAdvance: (...args: Parameters<typeof billingApi.adjustAdvance>) =>
    billingApi.adjustAdvance(...args),
  refundAdvance: (...args: Parameters<typeof billingApi.refundAdvance>) =>
    billingApi.refundAdvance(...args),
  listCorporates: (...args: Parameters<typeof billingApi.listCorporates>) =>
    billingApi.listCorporates(...args),
  createCorporate: (...args: Parameters<typeof billingApi.createCorporate>) =>
    billingApi.createCorporate(...args),
  getCorporate: (...args: Parameters<typeof billingApi.getCorporate>) =>
    billingApi.getCorporate(...args),
  listCorporateEnrollments: (...args: Parameters<typeof billingApi.listCorporateEnrollments>) =>
    billingApi.listCorporateEnrollments(...args),
  listCorporateInvoices: (...args: Parameters<typeof billingApi.listCorporateInvoices>) =>
    billingApi.listCorporateInvoices(...args),
  updateCorporate: (...args: Parameters<typeof billingApi.updateCorporate>) =>
    billingApi.updateCorporate(...args),
  createCorporateEnrollment: (...args: Parameters<typeof billingApi.createCorporateEnrollment>) =>
    billingApi.createCorporateEnrollment(...args),
  deleteCorporateEnrollment: (...args: Parameters<typeof billingApi.deleteCorporateEnrollment>) =>
    billingApi.deleteCorporateEnrollment(...args),
  billingReportSummary: (...args: Parameters<typeof billingApi.billingReportSummary>) =>
    billingApi.billingReportSummary(...args),
  billingReportDepartmentRevenue: (
    ...args: Parameters<typeof billingApi.billingReportDepartmentRevenue>
  ) => billingApi.billingReportDepartmentRevenue(...args),
  billingReportAging: (...args: Parameters<typeof billingApi.billingReportAging>) =>
    billingApi.billingReportAging(...args),
  billingReportCollectionEfficiency: (
    ...args: Parameters<typeof billingApi.billingReportCollectionEfficiency>
  ) => billingApi.billingReportCollectionEfficiency(...args),
  billingReportDaily: (...args: Parameters<typeof billingApi.billingReportDaily>) =>
    billingApi.billingReportDaily(...args),
  billingReportDoctorRevenue: (...args: Parameters<typeof billingApi.billingReportDoctorRevenue>) =>
    billingApi.billingReportDoctorRevenue(...args),
  billingReportInsurancePanel: (
    ...args: Parameters<typeof billingApi.billingReportInsurancePanel>
  ) => billingApi.billingReportInsurancePanel(...args),
  billingReportReconciliation: (
    ...args: Parameters<typeof billingApi.billingReportReconciliation>
  ) => billingApi.billingReportReconciliation(...args),
  listDayCloses: (...args: Parameters<typeof billingApi.listDayCloses>) =>
    billingApi.listDayCloses(...args),
  createDayClose: (...args: Parameters<typeof billingApi.createDayClose>) =>
    billingApi.createDayClose(...args),
  verifyDayClose: (...args: Parameters<typeof billingApi.verifyDayClose>) =>
    billingApi.verifyDayClose(...args),
  listBillingAuditLog: (...args: Parameters<typeof billingApi.listBillingAuditLog>) =>
    billingApi.listBillingAuditLog(...args),
  listCreditPatients: (...args: Parameters<typeof billingApi.listCreditPatients>) =>
    billingApi.listCreditPatients(...args),
  reportCreditAging: (...args: Parameters<typeof billingApi.reportCreditAging>) =>
    billingApi.reportCreditAging(...args),
  createCreditPatient: (...args: Parameters<typeof billingApi.createCreditPatient>) =>
    billingApi.createCreditPatient(...args),
  updateCreditPatient: (...args: Parameters<typeof billingApi.updateCreditPatient>) =>
    billingApi.updateCreditPatient(...args),
  listGstrSummaries: (...args: Parameters<typeof billingApi.listGstrSummaries>) =>
    billingApi.listGstrSummaries(...args),
  generateGstrSummary: (...args: Parameters<typeof billingApi.generateGstrSummary>) =>
    billingApi.generateGstrSummary(...args),
  fileGstr: (...args: Parameters<typeof billingApi.fileGstr>) => billingApi.fileGstr(...args),
  listTdsDeductions: (...args: Parameters<typeof billingApi.listTdsDeductions>) =>
    billingApi.listTdsDeductions(...args),
  createTdsDeduction: (...args: Parameters<typeof billingApi.createTdsDeduction>) =>
    billingApi.createTdsDeduction(...args),
  depositTds: (...args: Parameters<typeof billingApi.depositTds>) => billingApi.depositTds(...args),
  issueTdsCertificate: (...args: Parameters<typeof billingApi.issueTdsCertificate>) =>
    billingApi.issueTdsCertificate(...args),
  reportHsnSummary: (...args: Parameters<typeof billingApi.reportHsnSummary>) =>
    billingApi.reportHsnSummary(...args),
  listJournalEntries: (...args: Parameters<typeof billingApi.listJournalEntries>) =>
    billingApi.listJournalEntries(...args),
  listGlAccounts: (...args: Parameters<typeof billingApi.listGlAccounts>) =>
    billingApi.listGlAccounts(...args),
  createJournalEntry: (...args: Parameters<typeof billingApi.createJournalEntry>) =>
    billingApi.createJournalEntry(...args),
  postJournalEntry: (...args: Parameters<typeof billingApi.postJournalEntry>) =>
    billingApi.postJournalEntry(...args),
  reverseJournalEntry: (...args: Parameters<typeof billingApi.reverseJournalEntry>) =>
    billingApi.reverseJournalEntry(...args),
  listBankTransactions: (...args: Parameters<typeof billingApi.listBankTransactions>) =>
    billingApi.listBankTransactions(...args),
  importBankTransactions: (...args: Parameters<typeof billingApi.importBankTransactions>) =>
    billingApi.importBankTransactions(...args),
  autoReconcile: (...args: Parameters<typeof billingApi.autoReconcile>) =>
    billingApi.autoReconcile(...args),
  autoMatchBankTransactions: (...args: Parameters<typeof billingApi.autoMatchBankTransactions>) =>
    billingApi.autoMatchBankTransactions(...args),
  listInsuranceReceivablesAging: (
    ...args: Parameters<typeof billingApi.listInsuranceReceivablesAging>
  ) => billingApi.listInsuranceReceivablesAging(...args),
  reportFinancialMis: (...args: Parameters<typeof billingApi.reportFinancialMis>) =>
    billingApi.reportFinancialMis(...args),
  reportProfitLoss: (...args: Parameters<typeof billingApi.reportProfitLoss>) =>
    billingApi.reportProfitLoss(...args),
  listErpExports: (...args: Parameters<typeof billingApi.listErpExports>) =>
    billingApi.listErpExports(...args),
  exportToErp: (...args: Parameters<typeof billingApi.exportToErp>) =>
    billingApi.exportToErp(...args),
  listConcessions: (...args: Parameters<typeof billingApi.listConcessions>) =>
    billingApi.listConcessions(...args),
  createConcession: (...args: Parameters<typeof billingApi.createConcession>) =>
    billingApi.createConcession(...args),
  getAutoConcessionRules: (...args: Parameters<typeof billingApi.getAutoConcessionRules>) =>
    billingApi.getAutoConcessionRules(...args),
  approveConcession: (...args: Parameters<typeof billingApi.approveConcession>) =>
    billingApi.approveConcession(...args),
  rejectConcession: (...args: Parameters<typeof billingApi.rejectConcession>) =>
    billingApi.rejectConcession(...args),
  updateAutoConcessionRules: (...args: Parameters<typeof billingApi.updateAutoConcessionRules>) =>
    billingApi.updateAutoConcessionRules(...args),

  // Insurer settlements — pending postings approved by hand
  listClaimSettlements: (...args: Parameters<typeof billingApi.listClaimSettlements>) =>
    billingApi.listClaimSettlements(...args),
  recordClaimSettlement: (...args: Parameters<typeof billingApi.recordClaimSettlement>) =>
    billingApi.recordClaimSettlement(...args),
  approveClaimSettlement: (...args: Parameters<typeof billingApi.approveClaimSettlement>) =>
    billingApi.approveClaimSettlement(...args),
  rejectClaimSettlement: (...args: Parameters<typeof billingApi.rejectClaimSettlement>) =>
    billingApi.rejectClaimSettlement(...args),
  reverseClaimSettlement: (...args: Parameters<typeof billingApi.reverseClaimSettlement>) =>
    billingApi.reverseClaimSettlement(...args),
  listChargeAttention: (...args: Parameters<typeof billingApi.listChargeAttention>) =>
    billingApi.listChargeAttention(...args),
  postChargeAttention: (...args: Parameters<typeof billingApi.postChargeAttention>) =>
    billingApi.postChargeAttention(...args),
  chargeAttentionSummary: (...args: Parameters<typeof billingApi.chargeAttentionSummary>) =>
    billingApi.chargeAttentionSummary(...args),
  scanUnbilledOrders: () => billingApi.scanUnbilledOrders(),
  dismissChargeAttention: (...args: Parameters<typeof billingApi.dismissChargeAttention>) =>
    billingApi.dismissChargeAttention(...args),
  listRevenueAlerts: (...args: Parameters<typeof billingApi.listRevenueAlerts>) =>
    billingApi.listRevenueAlerts(...args),
  requestPreauthEnhancement: (...args: Parameters<typeof billingApi.requestPreauthEnhancement>) =>
    billingApi.requestPreauthEnhancement(...args),
  dismissPreauthAlert: (...args: Parameters<typeof billingApi.dismissPreauthAlert>) =>
    billingApi.dismissPreauthAlert(...args),
  getPreauthAlertSettings: () => billingApi.getPreauthAlertSettings(),
  updatePreauthAlertSettings: (...args: Parameters<typeof billingApi.updatePreauthAlertSettings>) =>
    billingApi.updatePreauthAlertSettings(...args),
  recordRoomConsent: (...args: Parameters<typeof billingApi.recordRoomConsent>) =>
    billingApi.recordRoomConsent(...args),
  listRoomConsentWitnesses: (...args: Parameters<typeof billingApi.listRoomConsentWitnesses>) =>
    billingApi.listRoomConsentWitnesses(...args),
  namePatientChargeAttention: (...args: Parameters<typeof billingApi.namePatientChargeAttention>) =>
    billingApi.namePatientChargeAttention(...args),
  backfillClaimSettlements: (...args: Parameters<typeof billingApi.backfillClaimSettlements>) =>
    billingApi.backfillClaimSettlements(...args),

  // EMI / Installment Payments
  listInstallments: (...args: Parameters<typeof billingApi.listInstallments>) =>
    billingApi.listInstallments(...args),
  createInstallment: (...args: Parameters<typeof billingApi.createInstallment>) =>
    billingApi.createInstallment(...args),
  getInstallment: (...args: Parameters<typeof billingApi.getInstallment>) =>
    billingApi.getInstallment(...args),
  payInstallmentItem: (...args: Parameters<typeof billingApi.payInstallmentItem>) =>
    billingApi.payInstallmentItem(...args),
  waiveInstallmentItem: (...args: Parameters<typeof billingApi.waiveInstallmentItem>) =>
    billingApi.waiveInstallmentItem(...args),
};
