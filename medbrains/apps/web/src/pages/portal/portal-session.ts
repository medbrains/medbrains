/**
 * Holding a patient's portal session in the browser.
 *
 * This is not the staff session and must never be mistaken for one. It speaks
 * for a single patient, carries no role, and is stored under its own key so
 * that signing out of one has nothing to do with the other.
 *
 * `sessionStorage`, not `localStorage`. The phone this runs on gets handed
 * around a waiting room and lent to relatives, and the record behind the token
 * is the whole chart. Closing the tab should end it.
 */

import type { PortalSession } from "@medbrains/types";

const STORAGE_KEY = "medbrains.portal.session";

export interface StoredPortalSession extends PortalSession {
  /** Epoch ms. Compared before use so an expired token is never sent. */
  expiresAt: number;
}

export function storePortalSession(session: PortalSession, now = Date.now()): StoredPortalSession {
  const stored: StoredPortalSession = {
    ...session,
    expiresAt: now + session.expires_in_hours * 60 * 60 * 1000,
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  return stored;
}

/**
 * The live session, or `null`.
 *
 * Expiry is checked here rather than left to the server. A token the browser
 * knows is stale should not be sent at all — the patient gets the sign-in
 * screen instead of a failed request they cannot interpret.
 */
export function readPortalSession(now = Date.now()): StoredPortalSession | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  const parsed = parsePortalSession(raw);
  if (!parsed || parsed.expiresAt <= now) {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
  return parsed;
}

export function clearPortalSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Parse stored JSON, refusing anything that is not a whole session.
 *
 * A half-written or hand-edited entry is discarded rather than partly trusted:
 * a session missing its expiry would otherwise read as one that never expires.
 */
export function parsePortalSession(raw: string): StoredPortalSession | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) {
      return null;
    }
    const candidate = value as Partial<StoredPortalSession>;
    if (
      typeof candidate.token !== "string" ||
      candidate.token.length === 0 ||
      typeof candidate.patient_id !== "string" ||
      typeof candidate.expiresAt !== "number" ||
      !Number.isFinite(candidate.expiresAt)
    ) {
      return null;
    }
    return candidate as StoredPortalSession;
  } catch {
    return null;
  }
}
