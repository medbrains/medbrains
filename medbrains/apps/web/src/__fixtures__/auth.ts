import { SEED } from "./seed";

/**
 * Canonical authentication state for Vitest tests.
 * Mirrors the shape returned by GET /api/auth/me in the live backend.
 */
export const authMeFixture = {
  user: {
    id: SEED.admin_user,
    tenant_id: SEED.tenant,
    username: "admin",
    full_name: "Admin User",
    email: "admin@medbrains.local",
    role: "super_admin",
    role_display: "Super Admin",
    department_ids: [],
    is_active: true,
  },
  permissions: [],
  csrf_token: "test-csrf-token",
};
