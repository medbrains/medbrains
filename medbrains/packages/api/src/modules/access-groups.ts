/** The `/access-groups` API area. Moved from `client.ts`; one module per first path segment. */
import { request } from "../client.js";

export const accessGroupsApi = {
  /** List access_groups (read-only) — for user-create drawer + admin page. */
  listAccessGroups: () =>
    request<
      Array<{
        id: string;
        tenant_id: string;
        code: string;
        name: string;
        description: string | null;
        permissions: string[];
        is_active: boolean;
      }>
    >("/access-groups"),

  createAccessGroup: (data: {
    code: string;
    name: string;
    description?: string;
    permissions?: string[];
  }) =>
    request<{
      id: string;
      tenant_id: string;
      code: string;
      name: string;
      description: string | null;
      permissions: string[];
      is_active: boolean;
    }>("/access-groups", { method: "POST", body: JSON.stringify(data) }),

  updateAccessGroup: (
    id: string,
    data: { code: string; name: string; description?: string; permissions?: string[] },
  ) =>
    request<{
      id: string;
      tenant_id: string;
      code: string;
      name: string;
      description: string | null;
      permissions: string[];
      is_active: boolean;
    }>(`/access-groups/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteAccessGroup: (id: string) =>
    request<{ status: string }>(`/access-groups/${id}`, { method: "DELETE" }),

  listAccessGroupMembers: (groupId: string) =>
    request<
      Array<{
        user_id: string;
        username: string;
        full_name: string;
        role: string;
        expires_at: string | null;
      }>
    >(`/access-groups/${groupId}/members`),

  addAccessGroupMember: (groupId: string, data: { user_id: string; expires_at?: string | null }) =>
    request<{ status: string }>(`/access-groups/${groupId}/members`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  removeAccessGroupMember: (groupId: string, userId: string) =>
    request<{ status: string }>(`/access-groups/${groupId}/members/${userId}`, {
      method: "DELETE",
    }),
};
