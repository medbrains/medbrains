/** The `/access` API area. Moved from `client.ts`; one module per first path segment. */
import { request } from "../client.js";

export const accessApi = {
  // ── Access manifest (single-source-of-truth for roles/groups/screens/policies) ──
  getAccessManifest: () =>
    request<{
      roles: { code: string; name: string; description: string; permission_count: number }[];
      groups: { code: string; name: string; description: string }[];
      screens: {
        code: string;
        label: string;
        route: string;
        module: string;
        required_permission: string | null;
      }[];
      policies: {
        role: string;
        mandatory_dept_types: string[];
        default_groups: string[];
        allow_multiple_depts: boolean;
        min_perm_set: string[];
      }[];
      resources: { object_type: string; relations: string[]; permissions: string[] }[];
      permission_count: number;
    }>("/access/manifest"),
};
