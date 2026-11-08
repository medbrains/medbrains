import { api } from "@medbrains/api";

export const signoffService = {
  getMyPendingSignoffs: (...args: Parameters<typeof api.getMyPendingSignoffs>) =>
    api.getMyPendingSignoffs(...args),
  listVerbalOrders: (...args: Parameters<typeof api.listVerbalOrders>) =>
    api.listVerbalOrders(...args),
  reviewSignature: (...args: Parameters<typeof api.reviewSignature>) =>
    api.reviewSignature(...args),
  listSignableTypes: () => api.listSignableTypes(),
  getMySignatureCredentials: (...args: Parameters<typeof api.getMySignatureCredentials>) =>
    api.getMySignatureCredentials(...args),
  signRecord: (...args: Parameters<typeof api.signRecord>) => api.signRecord(...args),
  decideRefillRequest: (...args: Parameters<typeof api.decideRefillRequest>) =>
    api.decideRefillRequest(...args),
};
