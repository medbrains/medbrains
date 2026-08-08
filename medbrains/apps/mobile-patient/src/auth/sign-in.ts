/**
 * Patient sign-in.
 *
 * The real path is an SMS code to the number on the patient's record. It issues
 * a portal token, which carries no role and no permissions and is refused by
 * every staff route — see `crates/medbrains-server/src/routes/portal.rs`.
 *
 * The password path is kept for staff-assisted access only. It goes through the
 * STAFF login endpoint and yields a staff token, which is the wrong credential
 * for a patient to be holding; it must not be offered as the ordinary way in.
 *
 * ABHA remains the target state and needs the tenant's NHA gateway.
 */

import type { TenantIdentity } from "@medbrains/mobile-shell";
import type { AuthResponse } from "../api/client.js";
import { loginWithPassword, request } from "../api/client.js";
import { apiConfig } from "../api/config.js";
import { requestPortalOtp, verifyPortalOtp } from "../api/portal.js";

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
      permissions: result.permissions,
      departmentIds: result.department_ids,
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

/**
 * Step one. Deliberately returns nothing useful: the backend answers the same
 * way for a registered and an unregistered number, and branching on the reply
 * would leak exactly what that sameness protects.
 */
export async function requestPatientSignInCode(tenantCode: string, phone: string): Promise<void> {
  await requestPortalOtp(tenantCode, phone);
}

/** Step two. A verified code becomes a portal session. */
export async function patientCodeSignIn(
  tenantCode: string,
  phone: string,
  code: string,
): Promise<{ identity: TenantIdentity }> {
  const session = await verifyPortalOtp(tenantCode, phone, code);
  return {
    identity: {
      tenantId: session.tenant_id,
      userId: session.patient_id,
      jwt: session.token,
      // A patient has neither. Left explicitly empty so nothing downstream
      // mistakes this for a staff identity.
      role: null,
      permissions: [],
      departmentIds: [],
    },
  };
}

export async function patientAbhaSignIn(
  abhaToken: string,
): Promise<{ identity: TenantIdentity; refreshToken?: string }> {
  const result = await request<AuthResponse>(apiConfig, "POST", "/api/portal/abha/login", {
    abha_token: abhaToken,
  });
  return shapeIdentity(result);
}
