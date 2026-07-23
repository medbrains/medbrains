/**
 * Identities provisioned through the real API, per test.
 *
 * Nothing is cached and nothing is written to disk. Every identity here is
 * created by a super admin calling `POST /api/setup/users`, the same endpoint
 * an administrator uses, and is deactivated when the test that asked for it
 * finishes. A run leaves behind only deactivated accounts, and two runs never
 * share a login.
 *
 * The bootstrap account is used once per worker and only to mint a
 * run-scoped super admin — no test authenticates as the seeded administrator,
 * so a suite cannot pass because it inherited the seed's privileges.
 */

import type { APIRequestContext } from "@playwright/test";

export const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:3000";

/** Only ever used to create the run's own super admin. */
const BOOTSTRAP_USERNAME = process.env.E2E_BOOTSTRAP_ADMIN_USER ?? "admin";
const BOOTSTRAP_PASSWORD = process.env.E2E_BOOTSTRAP_ADMIN_PASS ?? "admin123";

export interface Session {
  csrf: string;
  cookieHeader: string;
  user: { id: string; username: string; role: string; tenant_id: string };
}

export interface Identity {
  id: string;
  username: string;
  password: string;
  email: string;
  role: string;
  session: Session;
}

export async function login(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<Session> {
  const response = await request.post(`${BACKEND_URL}/api/auth/login`, {
    data: { username, password },
  });
  if (response.status() !== 200) {
    throw new Error(`login failed for ${username}: ${response.status()} ${await response.text()}`);
  }
  const body = await response.json();
  return {
    csrf: body.csrf_token ?? "",
    cookieHeader: cookieHeader(response),
    user: body.user,
  };
}

export function authHeaders(session: Session): Record<string, string> {
  return {
    Cookie: session.cookieHeader,
    "X-CSRF-Token": session.csrf,
    "Content-Type": "application/json",
  };
}

/**
 * The super admin every other identity in this worker is created by.
 *
 * Minted once per worker process rather than per test: it is the entry point,
 * not a subject under test, and re-minting it per test would triple the login
 * traffic without testing anything new.
 */
let workerAdmin: Promise<Identity> | null = null;

export function runAdmin(request: APIRequestContext): Promise<Identity> {
  workerAdmin ??= (async () => {
    const bootstrap = await login(request, BOOTSTRAP_USERNAME, BOOTSTRAP_PASSWORD);
    return createIdentity(request, bootstrap, "super_admin");
  })();
  return workerAdmin;
}

/**
 * Retire the worker's super admin. It cannot retire itself through
 * `retireIdentity`, which asks the worker admin to do the retiring, so the
 * bootstrap account closes it out.
 */
export async function retireRunAdmin(request: APIRequestContext): Promise<void> {
  if (!workerAdmin) return;
  const admin = await workerAdmin;
  workerAdmin = null;
  const bootstrap = await login(request, BOOTSTRAP_USERNAME, BOOTSTRAP_PASSWORD);
  await request.put(`${BACKEND_URL}/api/setup/users/${admin.id}`, {
    headers: authHeaders(bootstrap),
    data: { full_name: `Retired ${admin.username}`, is_active: false },
  });
}

/** A brand-new user in `role`, created by this worker's super admin. */
export async function provisionIdentity(
  request: APIRequestContext,
  role: string,
): Promise<Identity> {
  const admin = await runAdmin(request);
  return createIdentity(request, admin.session, role);
}

/**
 * Deactivate rather than delete: `POST /api/setup/users` is the real creation
 * path and there is no real deletion path, so removing the row would exercise
 * something no administrator can do.
 */
export async function retireIdentity(
  request: APIRequestContext,
  identity: Identity,
): Promise<void> {
  const admin = await runAdmin(request);
  await request.put(`${BACKEND_URL}/api/setup/users/${identity.id}`, {
    headers: authHeaders(admin.session),
    data: { full_name: `Retired ${identity.username}`, is_active: false },
  });
}

async function createIdentity(
  request: APIRequestContext,
  creator: Session,
  role: string,
): Promise<Identity> {
  const suffix = uniqueSuffix();
  const username = `t_${role.replace(/[^a-z0-9]/g, "").slice(0, 14)}_${suffix}`;
  const email = `${username}@test.medbrains.localhost`;
  // Meets the password policy without being derivable from the username.
  const password = `T${suffix}#Aa9zQ`;

  const payload: Record<string, unknown> = {
    username,
    email,
    password,
    full_name: `Test ${role} ${suffix}`,
    role,
  };
  if (role === "doctor") {
    payload.specialization = "General Medicine";
    payload.medical_registration_number = `TEST-${suffix}`;
    payload.qualification = "MBBS";
  }

  const response = await request.post(`${BACKEND_URL}/api/setup/users`, {
    headers: authHeaders(creator),
    data: payload,
  });
  if (response.status() !== 200) {
    throw new Error(`creating a ${role} failed: ${response.status()} ${await response.text()}`);
  }
  const created = await response.json();

  return {
    id: created.id,
    username,
    password,
    email,
    role,
    session: await login(request, username, password),
  };
}

let counter = 0;

/** Unique across workers and runs — the username carries a uniqueness constraint. */
function uniqueSuffix(): string {
  counter += 1;
  const worker = process.env.TEST_PARALLEL_INDEX ?? "0";
  return `${Date.now().toString(36)}${worker}${counter.toString(36)}`;
}

function cookieHeader(response: { headersArray(): { name: string; value: string }[] }): string {
  return response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === "set-cookie")
    .map((header) => header.value.split(";")[0])
    .join("; ");
}
