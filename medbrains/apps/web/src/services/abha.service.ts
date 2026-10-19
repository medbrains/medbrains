import { api } from "@medbrains/api";

export const abhaService = {
  status: () => api.getAbhaStatus(),
  start: (...args: Parameters<typeof api.startAbhaVerification>) =>
    api.startAbhaVerification(...args),
  resend: (...args: Parameters<typeof api.resendAbhaOtp>) => api.resendAbhaOtp(...args),
  submitOtp: (...args: Parameters<typeof api.submitAbhaOtp>) => api.submitAbhaOtp(...args),
  chooseAccount: (...args: Parameters<typeof api.chooseAbhaAccount>) =>
    api.chooseAbhaAccount(...args),
  cardUrl: (id: string) => api.abhaCardUrl(id),
  link: (...args: Parameters<typeof api.linkAbhaToPatient>) => api.linkAbhaToPatient(...args),
};
