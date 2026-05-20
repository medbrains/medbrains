import type { APIRequestContext } from "@playwright/test";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const e2eRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const authDir = path.join(e2eRoot, ".auth");
const manifestPath = path.join(authDir, "e2e-users.json");
export const authStatePath = path.join(authDir, "user.json");

export const E2E_BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:3000";
export const BOOTSTRAP_ADMIN_USERNAME = process.env.E2E_BOOTSTRAP_ADMIN_USER ?? "admin";
export const BOOTSTRAP_ADMIN_PASSWORD = process.env.E2E_BOOTSTRAP_ADMIN_PASS ?? "admin123";

export interface E2ERoleDefinition {
  role: string;
  label: string;
  bypass?: boolean;
}

export interface E2EIdentity extends E2ERoleDefinition {
  id: string;
  username: string;
  password: string;
  email: string;
}

export interface E2EIdentityManifest {
  runId: string;
  createdAt: string;
  users: E2EIdentity[];
}

export interface AuthSession {
  csrf: string;
  cookieHeader: string;
  user: unknown;
}

export const E2E_ROLE_DEFINITIONS: E2ERoleDefinition[] = [
  { role: "super_admin", label: "Super Admin", bypass: true },
  { role: "hospital_admin", label: "Hospital Admin", bypass: true },
  { role: "doctor", label: "Doctor" },
  { role: "nurse", label: "Nurse" },
  { role: "lab_technician", label: "Lab Technician" },
  { role: "pharmacist", label: "Pharmacist" },
  { role: "billing_clerk", label: "Billing Clerk" },
  { role: "receptionist", label: "Receptionist" },
  { role: "audit_officer", label: "Audit Officer" },
  { role: "mrd_officer", label: "MRD Officer" },
  { role: "canteen_staff", label: "Canteen Staff" },
  { role: "dietitian", label: "Dietitian" },
  { role: "security_guard", label: "Security Guard" },
  { role: "biomed_engineer", label: "Biomed Engineer" },
  { role: "ambulance_driver", label: "Ambulance Driver" },
  { role: "radiology_tech", label: "Radiology Technician" },
  { role: "cssd_technician", label: "CSSD Technician" },
  { role: "blood_bank_tech", label: "Blood Bank Technician" },
  { role: "front_office_staff", label: "Front Office Staff" },
  { role: "infection_control_officer", label: "Infection Control Officer" },
  { role: "procurement_officer", label: "Procurement Officer" },
  { role: "store_keeper", label: "Store Keeper" },
  { role: "hr_officer", label: "HR Officer" },
  { role: "camp_coordinator", label: "Camp Coordinator" },
  { role: "insurance_officer", label: "Insurance Officer" },
  { role: "ot_staff", label: "OT Staff" },
];

export async function loginForSession(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<AuthSession> {
  const resp = await request.post(`${E2E_BACKEND_URL}/api/auth/login`, {
    data: { username, password },
  });
  if (resp.status() !== 200) {
    throw new Error(`E2E login failed for ${username}: ${resp.status()} ${await resp.text()}`);
  }
  const body = await resp.json();
  return {
    csrf: body.csrf_token ?? "",
    cookieHeader: cookieHeaderFromResponse(resp),
    user: body.user,
  };
}

export async function ensureE2EIdentities(
  request: APIRequestContext,
): Promise<E2EIdentityManifest> {
  await mkdir(authDir, { recursive: true });
  const existing = await readManifest();
  if (existing && existing.users.length >= E2E_ROLE_DEFINITIONS.length) {
    return existing;
  }

  const runId = process.env.E2E_RUN_ID ?? Date.now().toString(36);
  const usernameRunId = compactRunId(runId);
  const password = process.env.E2E_TEMP_PASSWORD ?? `E2eTemp#${runId}Aa9`;
  const admin = await loginForSession(request, BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_PASSWORD);
  const created: E2EIdentity[] = [];

  try {
    for (const roleDef of E2E_ROLE_DEFINITIONS) {
      const username = `e2e_${compactRoleSlug(roleDef.role)}_${usernameRunId}`;
      const email = `${username}@e2e.medbrains.local`;
      const payload: Record<string, unknown> = {
        username,
        email,
        password,
        full_name: `E2E ${roleDef.label} ${runId}`,
        role: roleDef.role,
      };
      if (roleDef.role === "doctor") {
        payload.specialization = "General Medicine";
        payload.medical_registration_number = `E2E-${runId}`;
        payload.qualification = "MBBS";
      }

      const resp = await request.post(`${E2E_BACKEND_URL}/api/setup/users`, {
        headers: authHeaders(admin),
        data: payload,
      });
      if (resp.status() !== 200) {
        throw new Error(
          `create ${roleDef.role} E2E user failed: ${resp.status()} ${await resp.text()}`,
        );
      }
      const user = await resp.json();
      created.push({
        ...roleDef,
        id: user.id,
        username,
        password,
        email,
      });
    }
  } catch (error) {
    await cleanupIdentities(request, { runId, createdAt: new Date().toISOString(), users: created });
    throw error;
  }

  const manifest = { runId, createdAt: new Date().toISOString(), users: created };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

export function loadE2EIdentities(): E2EIdentityManifest {
  if (!existsSync(manifestPath)) {
    throw new Error(
      `Missing E2E temp credentials at ${manifestPath}. Run Playwright with project dependencies enabled so global-setup can create them.`,
    );
  }
  return JSON.parse(readFileSync(manifestPath, "utf8")) as E2EIdentityManifest;
}

export function getE2EIdentity(role: string): E2EIdentity {
  const identity = loadE2EIdentities().users.find((user) => user.role === role);
  if (!identity) {
    throw new Error(`No E2E temp credential found for role ${role}`);
  }
  return identity;
}

export function getE2ERoleUsers(roles?: string[]): E2EIdentity[] {
  const users = loadE2EIdentities().users;
  if (!roles) return users;
  return roles.map(getE2EIdentity);
}

export async function cleanupStoredE2EIdentities(request: APIRequestContext): Promise<void> {
  const manifest = await readManifest();
  if (!manifest) return;
  await cleanupIdentities(request, manifest);
  await unlink(manifestPath).catch(() => {});
  await unlink(authStatePath).catch(() => {});
}

export async function cleanupIdentities(
  request: APIRequestContext,
  manifest: E2EIdentityManifest,
): Promise<void> {
  if (manifest.users.length === 0) return;
  const admin = await loginForSession(request, BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_PASSWORD);
  for (const user of [...manifest.users].reverse()) {
    await request.put(`${E2E_BACKEND_URL}/api/setup/users/${user.id}`, {
      headers: authHeaders(admin),
      data: {
        full_name: `Inactive E2E ${user.label} ${manifest.runId}`,
        is_active: false,
      },
    });
  }
}

export function browserCookiesFromLogin(session: AuthSession) {
  const domains = cookieDomainsForCurrentRun();
  return session.cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((nameVal) => {
      const eqIdx = nameVal.indexOf("=");
      if (eqIdx < 0) return [];
      const name = nameVal.slice(0, eqIdx);
      const value = nameVal.slice(eqIdx + 1);
      return domains.map((domain) => ({
        name,
        value,
        domain,
        path: "/",
        httpOnly: name !== "csrf_token",
        secure: isHttpsTestHost(domain),
        sameSite: "Lax" as const,
      }));
    });
}

function cookieDomainsForCurrentRun(): string[] {
  const domains = new Set(["127.0.0.1", "localhost"]);
  for (const envUrl of [
    process.env.E2E_BASE_URL,
    process.env.E2E_BACKEND_URL,
    E2E_BACKEND_URL,
  ]) {
    if (!envUrl) continue;
    try {
      const { hostname } = new URL(envUrl);
      if (hostname) domains.add(hostname);
    } catch {
      // Ignore non-URL env values; the fixed loopback domains above still work.
    }
  }
  return [...domains];
}

function isHttpsTestHost(domain: string): boolean {
  for (const envUrl of [process.env.E2E_BASE_URL, process.env.E2E_BACKEND_URL]) {
    if (!envUrl) continue;
    try {
      const url = new URL(envUrl);
      if (url.hostname === domain) return url.protocol === "https:";
    } catch {
      // Ignore invalid env values.
    }
  }
  return false;
}

function authHeaders(session: AuthSession): Record<string, string> {
  return {
    cookie: session.cookieHeader,
    "x-csrf-token": session.csrf,
  };
}

function cookieHeaderFromResponse(resp: {
  headersArray: () => Array<{ name: string; value: string }>;
}): string {
  return resp
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value.split(";")[0])
    .join("; ");
}

async function readManifest(): Promise<E2EIdentityManifest | null> {
  try {
    return JSON.parse(await readFile(manifestPath, "utf8")) as E2EIdentityManifest;
  } catch {
    return null;
  }
}

function compactRoleSlug(role: string): string {
  return role.replace(/[^a-z0-9]/g, "").slice(0, 14);
}

function compactRunId(runId: string): string {
  const normalized = runId.replace(/[^a-zA-Z0-9]/g, "");
  return normalized.slice(-8) || Date.now().toString(36).slice(-8);
}
