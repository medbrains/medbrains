/** The `/nhcx` API area. Moved from `client.ts`; one module per first path segment. */
import type { NhcxParticipant, UpsertNhcxParticipantRequest } from "@medbrains/types";
import { request } from "../client.js";

export const nhcxApi = {
  /** NHCX payer directory (the recipient_code source for claim submission). */
  listNhcxParticipants: (role?: string) =>
    request<NhcxParticipant[]>(`/nhcx/participants${role ? `?role=${role}` : ""}`),

  upsertNhcxParticipant: (data: UpsertNhcxParticipantRequest) =>
    request<NhcxParticipant>("/nhcx/participants", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
