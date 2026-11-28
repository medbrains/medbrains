import { doctorsApi } from "@medbrains/api/modules/doctors";
import { opdApi } from "@medbrains/api/modules/opd";
import { signaturesApi } from "@medbrains/api/modules/signatures";

export const signoffService = {
  getMyPendingSignoffs: (...args: Parameters<typeof doctorsApi.getMyPendingSignoffs>) =>
    doctorsApi.getMyPendingSignoffs(...args),
  listVerbalOrders: (...args: Parameters<typeof opdApi.listVerbalOrders>) =>
    opdApi.listVerbalOrders(...args),
  reviewSignature: (...args: Parameters<typeof signaturesApi.reviewSignature>) =>
    signaturesApi.reviewSignature(...args),
  listSignableTypes: () => signaturesApi.listSignableTypes(),
  getMySignatureCredentials: (
    ...args: Parameters<typeof signaturesApi.getMySignatureCredentials>
  ) => signaturesApi.getMySignatureCredentials(...args),
  signRecord: (...args: Parameters<typeof signaturesApi.signRecord>) =>
    signaturesApi.signRecord(...args),
  decideRefillRequest: (...args: Parameters<typeof doctorsApi.decideRefillRequest>) =>
    doctorsApi.decideRefillRequest(...args),
};
