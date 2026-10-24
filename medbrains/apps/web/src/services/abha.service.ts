import { api } from "@medbrains/api";

export const abhaService = {
  status: () => api.getAbhaStatus(),
  start: (...args: Parameters<typeof api.startAbhaVerification>) =>
    api.startAbhaVerification(...args),
  resend: (...args: Parameters<typeof api.resendAbhaOtp>) => api.resendAbhaOtp(...args),
  submitOtp: (...args: Parameters<typeof api.submitAbhaOtp>) => api.submitAbhaOtp(...args),
  chooseAccount: (...args: Parameters<typeof api.chooseAbhaAccount>) =>
    api.chooseAbhaAccount(...args),
  startEnrolment: (...args: Parameters<typeof api.startAbhaEnrolment>) =>
    api.startAbhaEnrolment(...args),
  enrolmentOtp: (...args: Parameters<typeof api.submitAbhaEnrolmentOtp>) =>
    api.submitAbhaEnrolmentOtp(...args),
  resendEnrolment: (...args: Parameters<typeof api.resendAbhaEnrolmentOtp>) =>
    api.resendAbhaEnrolmentOtp(...args),
  enrolmentMobileOtp: (...args: Parameters<typeof api.submitAbhaEnrolmentMobileOtp>) =>
    api.submitAbhaEnrolmentMobileOtp(...args),
  chooseAddress: (...args: Parameters<typeof api.chooseAbhaAddress>) =>
    api.chooseAbhaAddress(...args),
  qrUrl: (id: string) => api.abhaQrUrl(id),
  requestMobileChange: (...args: Parameters<typeof api.requestAbhaMobileChange>) =>
    api.requestAbhaMobileChange(...args),
  verifyMobileChange: (...args: Parameters<typeof api.verifyAbhaMobileChange>) =>
    api.verifyAbhaMobileChange(...args),
  requestEmailLink: (...args: Parameters<typeof api.requestAbhaEmailLink>) =>
    api.requestAbhaEmailLink(...args),
  cardUrl: (id: string) => api.abhaCardUrl(id),
  link: (...args: Parameters<typeof api.linkAbhaToPatient>) => api.linkAbhaToPatient(...args),
  readQr: (payload: string) => api.readAbhaQr(payload),
  requestReKyc: (id: string) => api.requestAbhaReKyc(id),
  verifyReKyc: (...args: Parameters<typeof api.verifyAbhaReKyc>) => api.verifyAbhaReKyc(...args),
  updatePhoto: (...args: Parameters<typeof api.updateAbhaPhoto>) => api.updateAbhaPhoto(...args),
  requestClose: (...args: Parameters<typeof api.requestAbhaClose>) => api.requestAbhaClose(...args),
  verifyClose: (...args: Parameters<typeof api.verifyAbhaClose>) => api.verifyAbhaClose(...args),
  optOut: (...args: Parameters<typeof api.optOutAbha>) => api.optOutAbha(...args),
};
