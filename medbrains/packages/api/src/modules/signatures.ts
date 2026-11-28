/** The `/signatures` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  SetMyCredentialRequest,
  SetMyCredentialResponse,
  SignableTypeInfo,
  SignatureCredential,
  SignatureVerifyLink,
  SignedRecord,
  SignPreviewRequest,
  SignPreviewResponse,
  SignRequest,
  SignResponse,
  VerifyRequest,
  VerifyResponse,
} from "@medbrains/types";
import { request } from "../client.js";

export const signaturesApi = {
  getMySignatureCredentials: () => request<SignatureCredential[]>("/signatures/my-credentials"),
  /** Set or replace the caller's own signature; asks for the password again (step-up). */
  setMySignatureCredential: (data: SetMyCredentialRequest) =>
    request<SetMyCredentialResponse>("/signatures/my-credentials", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Open a record to sign it: its canonical snapshot, and the review is recorded. */
  reviewSignature: (data: SignPreviewRequest) =>
    request<SignPreviewResponse>("/signatures/review", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** The record types the server signs, so no screen offers one it refuses. */
  listSignableTypes: () => request<SignableTypeInfo[]>("/signatures/types"),
  signRecord: (data: SignRequest) =>
    request<SignResponse>("/signatures/sign", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listSignaturesForRecord: (record_type: string, record_id: string) => {
    const qs = new URLSearchParams({ record_type, record_id });
    return request<SignedRecord[]>(`/signatures/list?${qs.toString()}`);
  },
  verifySignature: (data: VerifyRequest) =>
    request<VerifyResponse>("/signatures/verify", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** The signed record's live public check link, minted if the last was withdrawn. */
  issueSignatureVerifyLink: (signedRecordId: string) =>
    request<SignatureVerifyLink>(`/signatures/${encodeURIComponent(signedRecordId)}/verify-link`, {
      method: "POST",
    }),
  /** Withdraw the record's public check link; printed copies then say "withdrawn". */
  revokeSignatureVerifyLink: (signedRecordId: string, reason: string) =>
    request<{ revoked: boolean }>(
      `/signatures/${encodeURIComponent(signedRecordId)}/verify-link/revoke`,
      { method: "POST", body: JSON.stringify({ reason }) },
    ),
};
