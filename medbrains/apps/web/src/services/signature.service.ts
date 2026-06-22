import { api } from "@medbrains/api";

export const signatureService = {
  verifySignature: (...args: Parameters<typeof api.verifySignature>) =>
    api.verifySignature(...args),
  listSignaturesForRecord: (...args: Parameters<typeof api.listSignaturesForRecord>) =>
    api.listSignaturesForRecord(...args),
};
