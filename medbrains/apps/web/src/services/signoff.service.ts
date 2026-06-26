import { api } from "@medbrains/api";

export const signoffService = {
  getMyPendingSignoffs: (...args: Parameters<typeof api.getMyPendingSignoffs>) =>
    api.getMyPendingSignoffs(...args),
  listVerbalOrders: (...args: Parameters<typeof api.listVerbalOrders>) =>
    api.listVerbalOrders(...args),
  previewSignature: (...args: Parameters<typeof api.previewSignature>) =>
    api.previewSignature(...args),
  getMySignatureCredentials: (...args: Parameters<typeof api.getMySignatureCredentials>) =>
    api.getMySignatureCredentials(...args),
  signRecord: (...args: Parameters<typeof api.signRecord>) => api.signRecord(...args),
};
