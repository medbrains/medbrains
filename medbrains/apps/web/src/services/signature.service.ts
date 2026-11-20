import { publicApi } from "@medbrains/api/modules/public";
import { signaturesApi } from "@medbrains/api/modules/signatures";

export const signatureService = {
  verifySignature: (...args: Parameters<typeof signaturesApi.verifySignature>) =>
    signaturesApi.verifySignature(...args),
  listSignaturesForRecord: (...args: Parameters<typeof signaturesApi.listSignaturesForRecord>) =>
    signaturesApi.listSignaturesForRecord(...args),
  verifySignatureLink: (...args: Parameters<typeof publicApi.verifySignatureLink>) =>
    publicApi.verifySignatureLink(...args),
  issueSignatureVerifyLink: (...args: Parameters<typeof signaturesApi.issueSignatureVerifyLink>) =>
    signaturesApi.issueSignatureVerifyLink(...args),
  revokeSignatureVerifyLink: (
    ...args: Parameters<typeof signaturesApi.revokeSignatureVerifyLink>
  ) => signaturesApi.revokeSignatureVerifyLink(...args),
};
