/**
 * The text messages a patient receives — read from the SMS outbox, the way
 * the patient reads their phone. No provider sends SMS in a test, and nothing
 * in the API hands a sign-in code to anybody but the phone, so the test reads
 * the queued message from the server's own database (`E2E_DATABASE_URL`).
 */
import { setTimeout as sleep } from "node:timers/promises";
import { dbExec } from "../journeys/support/db";

/** How long a code may take to be queued after the button that sends it is pressed. */
const CODE_WAIT_MS = 15_000;

/**
 * The six-digit code in the latest `event` SMS queued for `phone`, waiting for it to be
 * queued: a test reads it straight after pressing "Send code", while that request is still
 * on its way, so a single read finds nothing.
 */
async function latestCode(event: string, phone: string): Promise<string> {
  if (!/^\+?\d{6,15}$/.test(phone)) throw new Error(`not a phone number: ${phone}`);
  const sql =
    "SELECT payload->>'body' FROM outbox_events " +
    `WHERE event_type = '${event}' AND payload->>'to' = '${phone}' ` +
    "ORDER BY created_at DESC LIMIT 1";
  const deadline = Date.now() + CODE_WAIT_MS;
  for (;;) {
    const code = /\b(\d{6})\b/.exec(dbExec(sql))?.[1];
    if (code) return code;
    if (Date.now() > deadline) throw new Error(`no ${event} code was texted to ${phone}`);
    await sleep(250);
  }
}

/** The latest portal sign-in code texted to `phone`. */
export function latestPortalCode(phone: string): Promise<string> {
  return latestCode("sms.patient_portal_otp", phone);
}

/** The latest home-delivery code texted to `phone`, for the runner at the door. */
export function latestDeliveryCode(phone: string): Promise<string> {
  return latestCode("sms.pharmacy_delivery_code", phone);
}
