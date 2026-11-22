/**
 * The text messages a patient receives — read from the SMS outbox, the way
 * the patient reads their phone. No provider sends SMS in a test, and nothing
 * in the API hands a sign-in code to anybody but the phone, so the test reads
 * the queued message from the server's own database (`E2E_DATABASE_URL`).
 */
import { dbExec } from "../journeys/support/db";

/** The six-digit code in the latest `event` SMS queued for `phone`. */
function latestCode(event: string, phone: string): string {
  if (!/^\+?\d{6,15}$/.test(phone)) throw new Error(`not a phone number: ${phone}`);
  const sql =
    "SELECT payload->>'body' FROM outbox_events " +
    `WHERE event_type = '${event}' AND payload->>'to' = '${phone}' ` +
    "ORDER BY created_at DESC LIMIT 1";
  const body = dbExec(sql);
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
