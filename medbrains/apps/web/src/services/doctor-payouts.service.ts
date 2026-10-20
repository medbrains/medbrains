import { api } from "@medbrains/api";

/** Doctor payouts (#4886): every screen's calls, through TanStack Query. */
export const doctorPayoutsService = {
  getDoctorPayoutSettings: (...args: Parameters<typeof api.getDoctorPayoutSettings>) =>
    api.getDoctorPayoutSettings(...args),
  updateDoctorPayoutSettings: (...args: Parameters<typeof api.updateDoctorPayoutSettings>) =>
    api.updateDoctorPayoutSettings(...args),
  setReferralPayoutSwitch: (...args: Parameters<typeof api.setReferralPayoutSwitch>) =>
    api.setReferralPayoutSwitch(...args),
  listDoctorAgreements: (...args: Parameters<typeof api.listDoctorAgreements>) =>
    api.listDoctorAgreements(...args),
  createDoctorAgreement: (...args: Parameters<typeof api.createDoctorAgreement>) =>
    api.createDoctorAgreement(...args),
  updateDoctorAgreement: (...args: Parameters<typeof api.updateDoctorAgreement>) =>
    api.updateDoctorAgreement(...args),
  listPayoutRateCards: (...args: Parameters<typeof api.listPayoutRateCards>) =>
    api.listPayoutRateCards(...args),
  createPayoutRateCard: (...args: Parameters<typeof api.createPayoutRateCard>) =>
    api.createPayoutRateCard(...args),
  newPayoutRateCardVersion: (...args: Parameters<typeof api.newPayoutRateCardVersion>) =>
    api.newPayoutRateCardVersion(...args),
  listPayoutRules: (...args: Parameters<typeof api.listPayoutRules>) =>
    api.listPayoutRules(...args),
  addPayoutRule: (...args: Parameters<typeof api.addPayoutRule>) => api.addPayoutRule(...args),
  removePayoutRule: (...args: Parameters<typeof api.removePayoutRule>) =>
    api.removePayoutRule(...args),
  calculatePayout: (...args: Parameters<typeof api.calculatePayout>) =>
    api.calculatePayout(...args),
  listPayoutLedger: (...args: Parameters<typeof api.listPayoutLedger>) =>
    api.listPayoutLedger(...args),
  listPayoutStatements: (...args: Parameters<typeof api.listPayoutStatements>) =>
    api.listPayoutStatements(...args),
  getPayoutStatement: (...args: Parameters<typeof api.getPayoutStatement>) =>
    api.getPayoutStatement(...args),
  preparePayoutStatement: (...args: Parameters<typeof api.preparePayoutStatement>) =>
    api.preparePayoutStatement(...args),
  adjustPayoutStatement: (...args: Parameters<typeof api.adjustPayoutStatement>) =>
    api.adjustPayoutStatement(...args),
  disputePayoutStatement: (...args: Parameters<typeof api.disputePayoutStatement>) =>
    api.disputePayoutStatement(...args),
  approvePayoutStatement: (...args: Parameters<typeof api.approvePayoutStatement>) =>
    api.approvePayoutStatement(...args),
  listDoctorPayouts: (...args: Parameters<typeof api.listDoctorPayouts>) =>
    api.listDoctorPayouts(...args),
  runDoctorPayouts: (...args: Parameters<typeof api.runDoctorPayouts>) =>
    api.runDoctorPayouts(...args),
  markDoctorPayoutPaid: (...args: Parameters<typeof api.markDoctorPayoutPaid>) =>
    api.markDoctorPayoutPaid(...args),
  markDoctorPayoutFailed: (...args: Parameters<typeof api.markDoctorPayoutFailed>) =>
    api.markDoctorPayoutFailed(...args),
  getPayoutBankFile: (...args: Parameters<typeof api.getPayoutBankFile>) =>
    api.getPayoutBankFile(...args),
  getDaySettlement: (...args: Parameters<typeof api.getDaySettlement>) =>
    api.getDaySettlement(...args),
  settleDoctorDay: (...args: Parameters<typeof api.settleDoctorDay>) =>
    api.settleDoctorDay(...args),
  createReferralStatement: (...args: Parameters<typeof api.createReferralStatement>) =>
    api.createReferralStatement(...args),
  getDoctorPayoutSummary: (...args: Parameters<typeof api.getDoctorPayoutSummary>) =>
    api.getDoctorPayoutSummary(...args),
  getPayoutTdsRegister: (...args: Parameters<typeof api.getPayoutTdsRegister>) =>
    api.getPayoutTdsRegister(...args),
  getReferralCompliance: (...args: Parameters<typeof api.getReferralCompliance>) =>
    api.getReferralCompliance(...args),
  getMyEarnings: (...args: Parameters<typeof api.getMyEarnings>) => api.getMyEarnings(...args),
  getMyPayoutStatements: (...args: Parameters<typeof api.getMyPayoutStatements>) =>
    api.getMyPayoutStatements(...args),
  disputeMyPayoutStatement: (...args: Parameters<typeof api.disputeMyPayoutStatement>) =>
    api.disputeMyPayoutStatement(...args),
};
