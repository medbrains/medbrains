import { doctorPayoutsApi } from "@medbrains/api/modules/doctor-payouts";

/** Doctor payouts (#4886): every screen's calls, through TanStack Query. */
export const doctorPayoutsService = {
  getDoctorPayoutSettings: (...args: Parameters<typeof doctorPayoutsApi.getDoctorPayoutSettings>) =>
    doctorPayoutsApi.getDoctorPayoutSettings(...args),
  updateDoctorPayoutSettings: (
    ...args: Parameters<typeof doctorPayoutsApi.updateDoctorPayoutSettings>
  ) => doctorPayoutsApi.updateDoctorPayoutSettings(...args),
  setReferralPayoutSwitch: (...args: Parameters<typeof doctorPayoutsApi.setReferralPayoutSwitch>) =>
    doctorPayoutsApi.setReferralPayoutSwitch(...args),
  listDoctorAgreements: (...args: Parameters<typeof doctorPayoutsApi.listDoctorAgreements>) =>
    doctorPayoutsApi.listDoctorAgreements(...args),
  createDoctorAgreement: (...args: Parameters<typeof doctorPayoutsApi.createDoctorAgreement>) =>
    doctorPayoutsApi.createDoctorAgreement(...args),
  updateDoctorAgreement: (...args: Parameters<typeof doctorPayoutsApi.updateDoctorAgreement>) =>
    doctorPayoutsApi.updateDoctorAgreement(...args),
  listPayoutRateCards: (...args: Parameters<typeof doctorPayoutsApi.listPayoutRateCards>) =>
    doctorPayoutsApi.listPayoutRateCards(...args),
  createPayoutRateCard: (...args: Parameters<typeof doctorPayoutsApi.createPayoutRateCard>) =>
    doctorPayoutsApi.createPayoutRateCard(...args),
  newPayoutRateCardVersion: (
    ...args: Parameters<typeof doctorPayoutsApi.newPayoutRateCardVersion>
  ) => doctorPayoutsApi.newPayoutRateCardVersion(...args),
  listPayoutRules: (...args: Parameters<typeof doctorPayoutsApi.listPayoutRules>) =>
    doctorPayoutsApi.listPayoutRules(...args),
  addPayoutRule: (...args: Parameters<typeof doctorPayoutsApi.addPayoutRule>) =>
    doctorPayoutsApi.addPayoutRule(...args),
  removePayoutRule: (...args: Parameters<typeof doctorPayoutsApi.removePayoutRule>) =>
    doctorPayoutsApi.removePayoutRule(...args),
  calculatePayout: (...args: Parameters<typeof doctorPayoutsApi.calculatePayout>) =>
    doctorPayoutsApi.calculatePayout(...args),
  listPayoutLedger: (...args: Parameters<typeof doctorPayoutsApi.listPayoutLedger>) =>
    doctorPayoutsApi.listPayoutLedger(...args),
  listPayoutStatements: (...args: Parameters<typeof doctorPayoutsApi.listPayoutStatements>) =>
    doctorPayoutsApi.listPayoutStatements(...args),
  getPayoutStatement: (...args: Parameters<typeof doctorPayoutsApi.getPayoutStatement>) =>
    doctorPayoutsApi.getPayoutStatement(...args),
  preparePayoutStatement: (...args: Parameters<typeof doctorPayoutsApi.preparePayoutStatement>) =>
    doctorPayoutsApi.preparePayoutStatement(...args),
  adjustPayoutStatement: (...args: Parameters<typeof doctorPayoutsApi.adjustPayoutStatement>) =>
    doctorPayoutsApi.adjustPayoutStatement(...args),
  disputePayoutStatement: (...args: Parameters<typeof doctorPayoutsApi.disputePayoutStatement>) =>
    doctorPayoutsApi.disputePayoutStatement(...args),
  approvePayoutStatement: (...args: Parameters<typeof doctorPayoutsApi.approvePayoutStatement>) =>
    doctorPayoutsApi.approvePayoutStatement(...args),
  listDoctorPayouts: (...args: Parameters<typeof doctorPayoutsApi.listDoctorPayouts>) =>
    doctorPayoutsApi.listDoctorPayouts(...args),
  runDoctorPayouts: (...args: Parameters<typeof doctorPayoutsApi.runDoctorPayouts>) =>
    doctorPayoutsApi.runDoctorPayouts(...args),
  markDoctorPayoutPaid: (...args: Parameters<typeof doctorPayoutsApi.markDoctorPayoutPaid>) =>
    doctorPayoutsApi.markDoctorPayoutPaid(...args),
  markDoctorPayoutFailed: (...args: Parameters<typeof doctorPayoutsApi.markDoctorPayoutFailed>) =>
    doctorPayoutsApi.markDoctorPayoutFailed(...args),
  getPayoutBankFile: (...args: Parameters<typeof doctorPayoutsApi.getPayoutBankFile>) =>
    doctorPayoutsApi.getPayoutBankFile(...args),
  getDaySettlement: (...args: Parameters<typeof doctorPayoutsApi.getDaySettlement>) =>
    doctorPayoutsApi.getDaySettlement(...args),
  settleDoctorDay: (...args: Parameters<typeof doctorPayoutsApi.settleDoctorDay>) =>
    doctorPayoutsApi.settleDoctorDay(...args),
  createReferralStatement: (...args: Parameters<typeof doctorPayoutsApi.createReferralStatement>) =>
    doctorPayoutsApi.createReferralStatement(...args),
  getDoctorPayoutSummary: (...args: Parameters<typeof doctorPayoutsApi.getDoctorPayoutSummary>) =>
    doctorPayoutsApi.getDoctorPayoutSummary(...args),
  getPayoutTdsRegister: (...args: Parameters<typeof doctorPayoutsApi.getPayoutTdsRegister>) =>
    doctorPayoutsApi.getPayoutTdsRegister(...args),
  getReferralCompliance: (...args: Parameters<typeof doctorPayoutsApi.getReferralCompliance>) =>
    doctorPayoutsApi.getReferralCompliance(...args),
  getMyEarnings: (...args: Parameters<typeof doctorPayoutsApi.getMyEarnings>) =>
    doctorPayoutsApi.getMyEarnings(...args),
  getMyPayoutStatements: (...args: Parameters<typeof doctorPayoutsApi.getMyPayoutStatements>) =>
    doctorPayoutsApi.getMyPayoutStatements(...args),
  disputeMyPayoutStatement: (
    ...args: Parameters<typeof doctorPayoutsApi.disputeMyPayoutStatement>
  ) => doctorPayoutsApi.disputeMyPayoutStatement(...args),
};
