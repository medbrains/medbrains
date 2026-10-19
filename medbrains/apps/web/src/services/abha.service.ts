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
};
