/**
 * Patient sign-in callbacks. Two paths:
 *
 *   1. Password login (interim) — same `/api/auth/login` the staff
 *      app uses. Used until the tenant's ABHA consumer endpoint is
 *      live for the deployed pilot.
 *   2. ABHA login (target state) — `/api/portal/abha/login`, which
 *      validates the ABHA token via the NHA gateway and issues a
 *      tenant-scoped JWT. Stubbed here pending backend deployment.
 */

import type { TenantIdentity } from "@medbrains/mobile-shell";
import { apiConfig } from "../api/config.js";
import { loginWithPassword, request } from "../api/client.js";
import type { AuthResponse } from "../api/client.js";

function shapeIdentity(result: AuthResponse): {
  identity: TenantIdentity;
  refreshToken?: string;
} {
  return {
    identity: {
      tenantId: result.user.tenant_id,
      userId: result.user.id,
      jwt: result.token,
      role: result.user.role,
      permissions: result.user.permissions,
      departmentIds: result.user.department_ids,
    },
    refreshToken: result.refresh_token,
  };
}

export async function patientPasswordSignIn(
  email: string,
  password: string,
): Promise<{ identity: TenantIdentity; refreshToken?: string }> {
  const result = await loginWithPassword(apiConfig, email, password);
  return shapeIdentity(result);
}

export async function patientAbhaSignIn(
  abhaToken: string,
): Promise<{ identity: TenantIdentity; refreshToken?: string }> {
  const result = await request<AuthResponse>(apiConfig, "POST", "/api/portal/abha/login", {
    abha_token: abhaToken,
  });
  return shapeIdentity(result);
}
