/**
 * Login callback wired into `<LoginScreen>` via the `onSubmit` prop.
 * Hits the shared `/api/auth/login` endpoint and reshapes the response
 * into the `TenantIdentity` the shell signs in with.
 */

import type { TenantIdentity } from "@medbrains/mobile-shell";
import { apiConfig } from "../api/config.js";
import { login } from "../api/client.js";

export async function staffSignIn(
  username: string,
  password: string,
): Promise<{ identity: TenantIdentity; refreshToken?: string }> {
  const result = await login(apiConfig, username, password);
  const identity: TenantIdentity = {
    tenantId: result.user.tenant_id,
    userId: result.user.id,
    jwt: result.token,
    role: result.user.role,
    permissions: result.user.permissions,
    departmentIds: result.user.department_ids,
  };
  return { identity, refreshToken: result.refresh_token };
}
