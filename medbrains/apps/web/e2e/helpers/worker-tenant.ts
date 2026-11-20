/**
 * One hospital per Playwright worker.
 *
 * Workers run spec files side by side. On one shared hospital they saw each other's
 * patients, queues and settings, so a test's result depended on what ran next to it, and
 * the suite ran on one worker. Global setup provisions hospital `E2E-W<slot>` for each worker
 * slot (`/api/debug/e2e/tenant`, debug builds only), and everything a worker signs in as
 * lives in that hospital: its administrator, its role users, its browser session.
 *
 * The slot is Playwright's `TEST_PARALLEL_INDEX`: stable for the run and reused when a worker
 * restarts after a failure, so a restarted worker lands back in its own hospital.
 */

import type { APIRequestContext } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const authRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.auth");

/** Workers per run, and so hospitals per run: `E2E_WORKERS`, default 4. */
export const E2E_WORKERS = Math.max(1, Number(process.env.E2E_WORKERS ?? 4));

export interface WorkerTenant {
  slot: number;
  code: string;
  tenantId: string;
  adminUsername: string;
  adminPassword: string;
}

/** This process's worker slot; 0 outside a worker (config load in the runner, teardown). */
export function workerSlot(): number {
  return Number(process.env.TEST_PARALLEL_INDEX ?? 0);
}

/** The directory a slot keeps its hospital, users and browser session in. */
export function slotAuthDir(slot: number): string {
  return path.join(authRoot, `w${slot}`);
}

/**
 * The address a slot's requests come from. The server limits sign-ins per client address
 * (five a minute), and trusts `X-Forwarded-For` only from `TRUSTED_PROXIES`; with loopback
 * listed, as CI does, each worker is its own client, like separate machines in a hospital.
 */
export function slotForwardedFor(slot: number): string {
  return `10.77.0.${slot + 1}`;
}

/** The slots a run with `workers` workers uses. */
export function allSlots(workers: number): number[] {
  return Array.from({ length: workers }, (_, slot) => slot);
}

/** Read the hospital global setup provisioned for `slot`. */
export function loadWorkerTenant(slot = workerSlot()): WorkerTenant {
  const file = path.join(slotAuthDir(slot), "tenant.json");
  if (!existsSync(file)) {
    throw new Error(
      `No E2E hospital for worker slot ${slot} at ${file}. Run with project dependencies so global setup provisions one per worker (E2E_WORKERS).`,
    );
  }
  return JSON.parse(readFileSync(file, "utf8")) as WorkerTenant;
}

/**
 * Create or refresh `slot`'s hospital, signed in as the bootstrap super admin.
 *
 * Idempotent on the server by hospital code, so reruns reuse the hospital and its seed.
 */
export async function provisionWorkerTenant(
  request: APIRequestContext,
  backendUrl: string,
  bootstrapHeaders: Record<string, string>,
  slot: number,
  runId: string,
): Promise<WorkerTenant> {
  const code = `E2E-W${slot}`;
  const adminUsername = `e2e_w${slot}_admin`;
  const adminPassword = `E2eAdm#${runId}Aa9`;
  const response = await request.post(`${backendUrl}/api/debug/e2e/tenant`, {
    headers: bootstrapHeaders,
    data: { code, name: `E2E hospital ${slot}`, admin_username: adminUsername, admin_password: adminPassword },
    timeout: 120_000,
  });
  if (response.status() !== 200) {
    throw new Error(`provisioning ${code} failed: ${response.status()} ${await response.text()}`);
  }
  const { tenant_id: tenantId } = (await response.json()) as { tenant_id: string };
  const tenant = { slot, code, tenantId, adminUsername, adminPassword };
  await mkdir(slotAuthDir(slot), { recursive: true });
  await writeFile(path.join(slotAuthDir(slot), "tenant.json"), `${JSON.stringify(tenant, null, 2)}\n`);
  return tenant;
}

/**
 * Headers that make one request come from a client address of its own, in this worker's range.
 *
 * Staff sign in from their own workstations. The suite signed every one of a hospital's staff
 * in from one address, met the five-a-minute sign-in limiter, and slept 15 s at a time waiting
 * it out; the API matrix specs met the 600-a-minute limiter the same way. The limiters are not
 * under test there, so each such request comes from its own address.
 */
export function ownClientHeaders(): Record<string, string> {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  return { "X-Forwarded-For": `10.${100 + workerSlot()}.${octet()}.${octet()}` };
}
