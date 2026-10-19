/**
 * The text messages a patient receives — read from the SMS outbox, the way
 * the patient reads their phone. No provider sends SMS in a test, and nothing
 * in the API hands a sign-in code to anybody but the phone, so the test reads
 * the queued message from the database (local docker compose).
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const COMPOSE_DIR = fileURLToPath(new URL("../../../../", import.meta.url));

function latestCode(event: string, phone: string): string {
  if (!/^\+?\d{6,15}$/.test(phone)) throw new Error(`not a phone number: ${phone}`);
  const sql =
    "SELECT payload->>'body' FROM outbox_events " +
    `WHERE event_type = '${event}' AND payload->>'to' = '${phone}' ` +
    "ORDER BY created_at DESC LIMIT 1";
  const body = execFileSync(
    "docker",
    ["compose", "exec", "-T", "postgres", "psql", "-U", "medbrains", "-d", "medbrains", "-tAc", sql],
    { cwd: COMPOSE_DIR, encoding: "utf8" },
  );
  const code = /\b(\d{6})\b/.exec(body)?.[1];
  if (!code) throw new Error(`no ${event} code was texted to ${phone}`);
  return code;
}

/** The latest portal sign-in code texted to `phone`. */
export function latestPortalCode(phone: string): string {
  return latestCode("sms.patient_portal_otp", phone);
}

/** The latest home-delivery code texted to `phone`, for the runner at the door. */
export function latestDeliveryCode(phone: string): string {
  return latestCode("sms.pharmacy_delivery_code", phone);
}
