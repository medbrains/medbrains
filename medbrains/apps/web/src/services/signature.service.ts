import { api } from "@medbrains/api";

export const signatureService = {
  verifySignature: (...args: Parameters<typeof api.verifySignature>) =>
    api.verifySignature(...args),
  listSignaturesForRecord: (...args: Parameters<typeof api.listSignaturesForRecord>) =>
    api.listSignaturesForRecord(...args),
  verifySignatureLink: (...args: Parameters<typeof api.verifySignatureLink>) =>
    api.verifySignatureLink(...args),
  issueSignatureVerifyLink: (...args: Parameters<typeof api.issueSignatureVerifyLink>) =>
    api.issueSignatureVerifyLink(...args),
  revokeSignatureVerifyLink: (...args: Parameters<typeof api.revokeSignatureVerifyLink>) =>
    api.revokeSignatureVerifyLink(...args),
};
