/** The `/sharing` API area. Moved from `client.ts`; one module per first path segment. */
import { request } from "../client.js";

export const sharingApi = {
  // ── Sharing API (per-resource grants) ──
  createSharingGrant: (data: {
    object_type: string;
    object_id: string;
    relation: string;
    subject: { type: "user" | "role" | "department" | "group"; id: string };
    expires_at?: string;
    reason?: string;
  }) =>
    request<{
      tuple_id: string;
      object_type: string;
      object_id: string;
      relation: string;
      status: string;
    }>("/sharing/grants", { method: "POST", body: JSON.stringify(data) }),

  revokeSharingGrant: (data: {
    object_type: string;
    object_id: string;
    relation: string;
    subject: { type: "user" | "role" | "department" | "group"; id: string };
  }) =>
    request<{ status: string }>("/sharing/grants", {
      method: "DELETE",
      body: JSON.stringify(data),
    }),

  listSharingGrants: (object_type: string, object_id: string) =>
    request<
      Array<{
        object_type: string;
        object_id: string;
        relation: string;
        subject_type: string;
        subject_id: string;
        expires_at: string | null;
      }>
    >(
      `/sharing/grants?object_type=${encodeURIComponent(object_type)}&object_id=${encodeURIComponent(object_id)}`,
    ),

  listGrantedToMe: () =>
    request<
      Array<{
        object_type: string;
        object_id: string;
        relation: string;
        subject_type: string;
        subject_id: string;
        expires_at: string | null;
      }>
    >("/sharing/granted-to-me"),
  listSharingSubjects: () =>
    request<{
      users: Array<{ id: string; label: string; subtitle: string | null }>;
      roles: Array<{ id: string; label: string; subtitle: string | null }>;
      departments: Array<{ id: string; label: string; subtitle: string | null }>;
      groups: Array<{ id: string; label: string; subtitle: string | null }>;
    }>("/sharing/subjects"),
};
