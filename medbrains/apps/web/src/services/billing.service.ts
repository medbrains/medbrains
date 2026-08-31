import { api } from "@medbrains/api";

export const billingService = {
  listInvoices: (...args: Parameters<typeof api.listInvoices>) => api.listInvoices(...args),
  cloneInvoice: (...args: Parameters<typeof api.cloneInvoice>) => api.cloneInvoice(...args),
  createInvoice: (...args: Parameters<typeof api.createInvoice>) => api.createInvoice(...args),
  getInvoice: (...args: Parameters<typeof api.getInvoice>) => api.getInvoice(...args),
  getInvoicePrintData: (...args: Parameters<typeof api.getInvoicePrintData>) =>
    api.getInvoicePrintData(...args),
  issueInvoice: (...args: Parameters<typeof api.issueInvoice>) => api.issueInvoice(...args),
  cancelInvoice: (...args: Parameters<typeof api.cancelInvoice>) => api.cancelInvoice(...args),
  closeZeroInvoice: (...args: Parameters<typeof api.closeZeroInvoice>) =>
    api.closeZeroInvoice(...args),
  addInvoiceItem: (...args: Parameters<typeof api.addInvoiceItem>) => api.addInvoiceItem(...args),
  removeInvoiceItem: (...args: Parameters<typeof api.removeInvoiceItem>) =>
    api.removeInvoiceItem(...args),
  recordPayment: (...args: Parameters<typeof api.recordPayment>) => api.recordPayment(...args),
  listInvoiceDiscounts: (...args: Parameters<typeof api.listInvoiceDiscounts>) =>
    api.listInvoiceDiscounts(...args),
  addDiscount: (...args: Parameters<typeof api.addDiscount>) => api.addDiscount(...args),
  removeDiscount: (...args: Parameters<typeof api.removeDiscount>) => api.removeDiscount(...args),
  generateReceipt: (...args: Parameters<typeof api.generateReceipt>) =>
    api.generateReceipt(...args),
  listReceipts: (...args: Parameters<typeof api.listReceipts>) => api.listReceipts(...args),
  getReceiptPrintData: (...args: Parameters<typeof api.getReceiptPrintData>) =>
    api.getReceiptPrintData(...args),
  listChargeMaster: (...args: Parameters<typeof api.listChargeMaster>) =>
    api.listChargeMaster(...args),
  createChargeMaster: (...args: Parameters<typeof api.createChargeMaster>) =>
    api.createChargeMaster(...args),
  importChargeMaster: (...args: Parameters<typeof api.importChargeMaster>) =>
    api.importChargeMaster(...args),
  deleteChargeMaster: (...args: Parameters<typeof api.deleteChargeMaster>) =>
    api.deleteChargeMaster(...args),
  calculateCopay: (...args: Parameters<typeof api.calculateCopay>) => api.calculateCopay(...args),
  erFastInvoice: (...args: Parameters<typeof api.erFastInvoice>) => api.erFastInvoice(...args),
  listPackages: (...args: Parameters<typeof api.listPackages>) => api.listPackages(...args),
  createPackage: (...args: Parameters<typeof api.createPackage>) => api.createPackage(...args),
  deletePackage: (...args: Parameters<typeof api.deletePackage>) => api.deletePackage(...args),
  listRatePlans: (...args: Parameters<typeof api.listRatePlans>) => api.listRatePlans(...args),
  createRatePlan: (...args: Parameters<typeof api.createRatePlan>) => api.createRatePlan(...args),
  deleteRatePlan: (...args: Parameters<typeof api.deleteRatePlan>) => api.deleteRatePlan(...args),
  listRefunds: (...args: Parameters<typeof api.listRefunds>) => api.listRefunds(...args),
  listCreditNotes: (...args: Parameters<typeof api.listCreditNotes>) =>
    api.listCreditNotes(...args),
  createRefund: (...args: Parameters<typeof api.createRefund>) => api.createRefund(...args),
  createCreditNote: (...args: Parameters<typeof api.createCreditNote>) =>
    api.createCreditNote(...args),
  applyCreditNote: (...args: Parameters<typeof api.applyCreditNote>) =>
    api.applyCreditNote(...args),
  listWriteOffs: (...args: Parameters<typeof api.listWriteOffs>) => api.listWriteOffs(...args),
  createWriteOff: (...args: Parameters<typeof api.createWriteOff>) => api.createWriteOff(...args),
  approveWriteOff: (...args: Parameters<typeof api.approveWriteOff>) =>
    api.approveWriteOff(...args),
  listInsuranceClaims: (...args: Parameters<typeof api.listInsuranceClaims>) =>
    api.listInsuranceClaims(...args),
  listNhcxCallbacks: (...args: Parameters<typeof api.listNhcxCallbacks>) =>
    api.listNhcxCallbacks(...args),
  createInsuranceClaim: (...args: Parameters<typeof api.createInsuranceClaim>) =>
    api.createInsuranceClaim(...args),
  updateInsuranceClaim: (...args: Parameters<typeof api.updateInsuranceClaim>) =>
    api.updateInsuranceClaim(...args),
  listTpaRateCards: (...args: Parameters<typeof api.listTpaRateCards>) =>
    api.listTpaRateCards(...args),
  createTpaRateCard: (...args: Parameters<typeof api.createTpaRateCard>) =>
    api.createTpaRateCard(...args),
  deleteTpaRateCard: (...args: Parameters<typeof api.deleteTpaRateCard>) =>
    api.deleteTpaRateCard(...args),
  getTenantSettings: (...args: Parameters<typeof api.getTenantSettings>) =>
    api.getTenantSettings(...args),
  updateTenantSetting: (...args: Parameters<typeof api.updateTenantSetting>) =>
    api.updateTenantSetting(...args),
  listAdvances: (...args: Parameters<typeof api.listAdvances>) => api.listAdvances(...args),
  createAdvance: (...args: Parameters<typeof api.createAdvance>) => api.createAdvance(...args),
  adjustAdvance: (...args: Parameters<typeof api.adjustAdvance>) => api.adjustAdvance(...args),
  refundAdvance: (...args: Parameters<typeof api.refundAdvance>) => api.refundAdvance(...args),
  listCorporates: (...args: Parameters<typeof api.listCorporates>) => api.listCorporates(...args),
  createCorporate: (...args: Parameters<typeof api.createCorporate>) =>
    api.createCorporate(...args),
  getCorporate: (...args: Parameters<typeof api.getCorporate>) => api.getCorporate(...args),
  listCorporateEnrollments: (...args: Parameters<typeof api.listCorporateEnrollments>) =>
    api.listCorporateEnrollments(...args),
  listCorporateInvoices: (...args: Parameters<typeof api.listCorporateInvoices>) =>
    api.listCorporateInvoices(...args),
  updateCorporate: (...args: Parameters<typeof api.updateCorporate>) =>
    api.updateCorporate(...args),
  createCorporateEnrollment: (...args: Parameters<typeof api.createCorporateEnrollment>) =>
    api.createCorporateEnrollment(...args),
  deleteCorporateEnrollment: (...args: Parameters<typeof api.deleteCorporateEnrollment>) =>
    api.deleteCorporateEnrollment(...args),
  billingReportSummary: (...args: Parameters<typeof api.billingReportSummary>) =>
    api.billingReportSummary(...args),
  billingReportDepartmentRevenue: (
    ...args: Parameters<typeof api.billingReportDepartmentRevenue>
  ) => api.billingReportDepartmentRevenue(...args),
  billingReportAging: (...args: Parameters<typeof api.billingReportAging>) =>
    api.billingReportAging(...args),
  billingReportCollectionEfficiency: (
    ...args: Parameters<typeof api.billingReportCollectionEfficiency>
  ) => api.billingReportCollectionEfficiency(...args),
  billingReportDaily: (...args: Parameters<typeof api.billingReportDaily>) =>
    api.billingReportDaily(...args),
  billingReportDoctorRevenue: (...args: Parameters<typeof api.billingReportDoctorRevenue>) =>
    api.billingReportDoctorRevenue(...args),
  billingReportInsurancePanel: (...args: Parameters<typeof api.billingReportInsurancePanel>) =>
    api.billingReportInsurancePanel(...args),
  billingReportReconciliation: (...args: Parameters<typeof api.billingReportReconciliation>) =>
    api.billingReportReconciliation(...args),
  listDayCloses: (...args: Parameters<typeof api.listDayCloses>) => api.listDayCloses(...args),
  createDayClose: (...args: Parameters<typeof api.createDayClose>) => api.createDayClose(...args),
  verifyDayClose: (...args: Parameters<typeof api.verifyDayClose>) => api.verifyDayClose(...args),
  listBillingAuditLog: (...args: Parameters<typeof api.listBillingAuditLog>) =>
    api.listBillingAuditLog(...args),
  listCreditPatients: (...args: Parameters<typeof api.listCreditPatients>) =>
    api.listCreditPatients(...args),
  reportCreditAging: (...args: Parameters<typeof api.reportCreditAging>) =>
    api.reportCreditAging(...args),
  createCreditPatient: (...args: Parameters<typeof api.createCreditPatient>) =>
    api.createCreditPatient(...args),
  updateCreditPatient: (...args: Parameters<typeof api.updateCreditPatient>) =>
    api.updateCreditPatient(...args),
  listGstrSummaries: (...args: Parameters<typeof api.listGstrSummaries>) =>
    api.listGstrSummaries(...args),
  generateGstrSummary: (...args: Parameters<typeof api.generateGstrSummary>) =>
    api.generateGstrSummary(...args),
  fileGstr: (...args: Parameters<typeof api.fileGstr>) => api.fileGstr(...args),
  listTdsDeductions: (...args: Parameters<typeof api.listTdsDeductions>) =>
    api.listTdsDeductions(...args),
  createTdsDeduction: (...args: Parameters<typeof api.createTdsDeduction>) =>
    api.createTdsDeduction(...args),
  depositTds: (...args: Parameters<typeof api.depositTds>) => api.depositTds(...args),
  issueTdsCertificate: (...args: Parameters<typeof api.issueTdsCertificate>) =>
    api.issueTdsCertificate(...args),
  reportHsnSummary: (...args: Parameters<typeof api.reportHsnSummary>) =>
    api.reportHsnSummary(...args),
  listJournalEntries: (...args: Parameters<typeof api.listJournalEntries>) =>
    api.listJournalEntries(...args),
  listGlAccounts: (...args: Parameters<typeof api.listGlAccounts>) => api.listGlAccounts(...args),
  createJournalEntry: (...args: Parameters<typeof api.createJournalEntry>) =>
    api.createJournalEntry(...args),
  postJournalEntry: (...args: Parameters<typeof api.postJournalEntry>) =>
    api.postJournalEntry(...args),
  reverseJournalEntry: (...args: Parameters<typeof api.reverseJournalEntry>) =>
    api.reverseJournalEntry(...args),
  listBankTransactions: (...args: Parameters<typeof api.listBankTransactions>) =>
    api.listBankTransactions(...args),
  importBankTransactions: (...args: Parameters<typeof api.importBankTransactions>) =>
    api.importBankTransactions(...args),
  autoReconcile: (...args: Parameters<typeof api.autoReconcile>) => api.autoReconcile(...args),
  autoMatchBankTransactions: (...args: Parameters<typeof api.autoMatchBankTransactions>) =>
    api.autoMatchBankTransactions(...args),
  listInsuranceReceivablesAging: (...args: Parameters<typeof api.listInsuranceReceivablesAging>) =>
    api.listInsuranceReceivablesAging(...args),
  reportFinancialMis: (...args: Parameters<typeof api.reportFinancialMis>) =>
    api.reportFinancialMis(...args),
  reportProfitLoss: (...args: Parameters<typeof api.reportProfitLoss>) =>
    api.reportProfitLoss(...args),
  listErpExports: (...args: Parameters<typeof api.listErpExports>) => api.listErpExports(...args),
  exportToErp: (...args: Parameters<typeof api.exportToErp>) => api.exportToErp(...args),
  listConcessions: (...args: Parameters<typeof api.listConcessions>) =>
    api.listConcessions(...args),
  createConcession: (...args: Parameters<typeof api.createConcession>) =>
    api.createConcession(...args),
  getAutoConcessionRules: (...args: Parameters<typeof api.getAutoConcessionRules>) =>
    api.getAutoConcessionRules(...args),
  approveConcession: (...args: Parameters<typeof api.approveConcession>) =>
    api.approveConcession(...args),
  rejectConcession: (...args: Parameters<typeof api.rejectConcession>) =>
    api.rejectConcession(...args),
  updateAutoConcessionRules: (...args: Parameters<typeof api.updateAutoConcessionRules>) =>
    api.updateAutoConcessionRules(...args),

  // EMI / Installment Payments
  listInstallments: (...args: Parameters<typeof api.listInstallments>) =>
    api.listInstallments(...args),
  createInstallment: (...args: Parameters<typeof api.createInstallment>) =>
    api.createInstallment(...args),
  getInstallment: (...args: Parameters<typeof api.getInstallment>) => api.getInstallment(...args),
  payInstallmentItem: (...args: Parameters<typeof api.payInstallmentItem>) =>
    api.payInstallmentItem(...args),
  waiveInstallmentItem: (...args: Parameters<typeof api.waiveInstallmentItem>) =>
    api.waiveInstallmentItem(...args),
};
