/**
 * Identities provisioned through the real API, per run.
 *
 * The staff shell renders one stack screen per module the signed-in user may
 * reach, opens on the first, and offers no switcher — so which module a spec
 * can test is decided entirely by who it signs in as. The seeded `admin` is a
 * bypass role holding every module, which means it lands on Doctor and can
 * never get to Nurse.
 *
 * This mirrors `apps/web/e2e/helpers/identities.ts`: created by a real super
 * admin through `POST /api/setup/users`, never a static credential checked into
 * the repo. A test account that outlives its test is an account somebody
 * eventually logs into.
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "https://medbrains.localhost";
const BOOTSTRAP_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
const BOOTSTRAP_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123";

export const E2E_BACKEND_URL = BACKEND_URL;

export interface Identity {
  id: string;
  username: string;
  password: string;
  role: string;
}

export interface Session {
  cookieHeader: string;
  csrf: string;
}

/**
 * The API is cookie-based, not bearer.
 *
 * `POST /api/auth/login` sets `access_token` as an httpOnly cookie and returns
 * the CSRF token in the body; a `Bearer` header is not a credential this server
 * recognises. Every mutating call therefore needs both the cookie and
 * `X-CSRF-Token`, which is what `authHeaders` builds.
 */
export async function signInForApi(username: string, password: string): Promise<Session> {
  return login(username, password);
}

/** Headers for a mutating call as `session`: cookie plus CSRF, never bearer. */
export function apiHeaders(session: Session): Record<string, string> {
  return authHeaders(session);
}

async function login(username: string, password: string): Promise<Session> {
  const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
    body: JSON.stringify({ password, username }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`login as ${username} failed: ${response.status}`);
  }
  const body = (await response.json()) as { csrf_token?: string };
  const csrf = body.csrf_token;
  if (!csrf) {
    throw new Error(`login as ${username} returned no csrf token`);
  }
  return { cookieHeader: cookieHeader(response), csrf };
}

/** `name=value` pairs from every Set-Cookie, which is what the server expects back. */
function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

function authHeaders(session: Session): Record<string, string> {
  return {
    "content-type": "application/json",
    cookie: session.cookieHeader,
    "x-csrf-token": session.csrf,
  };
}

/**
 * One bootstrap login per process, reused.
 *
 * Provisioning and retiring each signed in as the seeded admin, so a run of
 * five suites made ten admin logins and the last of them came back 429. The
 * rate limiter is right -- repeatedly authenticating the most privileged
 * account is exactly what it is there to notice -- so the harness stops doing
 * it rather than asking for an exemption.
 */
let adminSession: Promise<Session> | null = null;

function admin(): Promise<Session> {
  adminSession ??= login(BOOTSTRAP_USERNAME, BOOTSTRAP_PASSWORD);
  return adminSession;
}

let counter = 0;

/** Unique across runs — the username carries a uniqueness constraint. */
function uniqueSuffix(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter.toString(36)}`;
}

/** A brand-new user in `role`, created by the seeded super admin. */
export async function provisionIdentity(role: string): Promise<Identity> {
  const session = await admin();
  const suffix = uniqueSuffix();
  const username = `e2e_${role.replace(/[^a-z0-9]/g, "").slice(0, 12)}_${suffix}`;
  // Meets the password policy without being derivable from the username.
  const password = `T${suffix}#Aa9zQ`;

  const payload: Record<string, unknown> = {
    email: `${username}@test.medbrains.localhost`,
    full_name: `E2E ${role} ${suffix}`,
    password,
    role,
    username,
  };
  if (role === "doctor") {
    payload.medical_registration_number = `E2E-${suffix}`;
    payload.qualification = "MBBS";
    payload.specialization = "General Medicine";
  }

  const response = await fetch(`${BACKEND_URL}/api/setup/users`, {
    body: JSON.stringify(payload),
    headers: authHeaders(session),
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`creating a ${role} failed: ${response.status} ${await response.text()}`);
  }
  const created = (await response.json()) as { id: string };
  return { id: created.id, password, role, username };
}

/**
 * Deactivate rather than delete.
 *
 * `POST /api/setup/users` is the real creation path and there is no real
 * deletion path, so removing the row would exercise something no administrator
 * can do.
 */
export async function retireIdentity(identity: Identity): Promise<void> {
  const session = await admin();
  await fetch(`${BACKEND_URL}/api/setup/users/${identity.id}`, {
    body: JSON.stringify({ full_name: `Retired ${identity.username}`, is_active: false }),
    headers: authHeaders(session),
    method: "PUT",
  });
}
