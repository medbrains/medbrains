import { abdmApi } from "@medbrains/api/modules/abdm";

export const abhaService = {
  status: () => abdmApi.getAbhaStatus(),
  start: (...args: Parameters<typeof abdmApi.startAbhaVerification>) =>
    abdmApi.startAbhaVerification(...args),
  resend: (...args: Parameters<typeof abdmApi.resendAbhaOtp>) => abdmApi.resendAbhaOtp(...args),
  submitOtp: (...args: Parameters<typeof abdmApi.submitAbhaOtp>) => abdmApi.submitAbhaOtp(...args),
  chooseAccount: (...args: Parameters<typeof abdmApi.chooseAbhaAccount>) =>
    abdmApi.chooseAbhaAccount(...args),
  startEnrolment: (...args: Parameters<typeof abdmApi.startAbhaEnrolment>) =>
    abdmApi.startAbhaEnrolment(...args),
  enrolmentOtp: (...args: Parameters<typeof abdmApi.submitAbhaEnrolmentOtp>) =>
    abdmApi.submitAbhaEnrolmentOtp(...args),
  resendEnrolment: (...args: Parameters<typeof abdmApi.resendAbhaEnrolmentOtp>) =>
    abdmApi.resendAbhaEnrolmentOtp(...args),
  enrolmentMobileOtp: (...args: Parameters<typeof abdmApi.submitAbhaEnrolmentMobileOtp>) =>
    abdmApi.submitAbhaEnrolmentMobileOtp(...args),
  chooseAddress: (...args: Parameters<typeof abdmApi.chooseAbhaAddress>) =>
    abdmApi.chooseAbhaAddress(...args),
  qrUrl: (id: string) => abdmApi.abhaQrUrl(id),
  requestMobileChange: (...args: Parameters<typeof abdmApi.requestAbhaMobileChange>) =>
    abdmApi.requestAbhaMobileChange(...args),
  verifyMobileChange: (...args: Parameters<typeof abdmApi.verifyAbhaMobileChange>) =>
    abdmApi.verifyAbhaMobileChange(...args),
  requestEmailLink: (...args: Parameters<typeof abdmApi.requestAbhaEmailLink>) =>
    abdmApi.requestAbhaEmailLink(...args),
  cardUrl: (id: string) => abdmApi.abhaCardUrl(id),
  link: (...args: Parameters<typeof abdmApi.linkAbhaToPatient>) =>
    abdmApi.linkAbhaToPatient(...args),
  readQr: (payload: string) => abdmApi.readAbhaQr(payload),
  requestReKyc: (id: string) => abdmApi.requestAbhaReKyc(id),
  verifyReKyc: (...args: Parameters<typeof abdmApi.verifyAbhaReKyc>) =>
    abdmApi.verifyAbhaReKyc(...args),
  updatePhoto: (...args: Parameters<typeof abdmApi.updateAbhaPhoto>) =>
    abdmApi.updateAbhaPhoto(...args),
  requestClose: (...args: Parameters<typeof abdmApi.requestAbhaClose>) =>
    abdmApi.requestAbhaClose(...args),
  verifyClose: (...args: Parameters<typeof abdmApi.verifyAbhaClose>) =>
    abdmApi.verifyAbhaClose(...args),
  optOut: (...args: Parameters<typeof abdmApi.optOutAbha>) => abdmApi.optOutAbha(...args),
};
