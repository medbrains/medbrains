import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPortalSession,
  parsePortalSession,
  readPortalSession,
  storePortalSession,
} from "./portal-session";

const SESSION = {
  token: "a-patient-token",
  patient_id: "patient-1",
  tenant_id: "tenant-1",
  expires_in_hours: 2,
};

beforeEach(() => {
  sessionStorage.clear();
});

describe("portal session", () => {
  it("round-trips a stored session", () => {
    const now = 1_000_000;
    storePortalSession(SESSION, now);
    const read = readPortalSession(now + 1000);
    expect(read?.token).toBe("a-patient-token");
    expect(read?.patient_id).toBe("patient-1");
  });

  /**
   * The browser refuses a token it knows is stale rather than sending it. The
   * patient gets the sign-in screen instead of a failed request they cannot
   * interpret.
   */
  it("treats an expired session as absent, and clears it", () => {
    const now = 1_000_000;
    storePortalSession(SESSION, now);
    const twoHoursLater = now + 2 * 60 * 60 * 1000;

    expect(readPortalSession(twoHoursLater)).toBeNull();
    expect(sessionStorage.getItem("medbrains.portal.session")).toBeNull();
  });

  it("is absent before anyone signs in", () => {
    expect(readPortalSession()).toBeNull();
  });

  it("clears on sign out", () => {
    storePortalSession(SESSION);
    clearPortalSession();
    expect(readPortalSession()).toBeNull();
  });

  /**
   * `sessionStorage`, not `localStorage` — this phone gets handed around a
   * waiting room, and the record behind the token is the whole chart.
   */
  it("does not write to localStorage", () => {
    localStorage.clear();
    storePortalSession(SESSION);
    expect(localStorage.getItem("medbrains.portal.session")).toBeNull();
  });
});

describe("parsePortalSession", () => {
  /**
   * A half-written or hand-edited entry is discarded rather than partly
   * trusted. A session missing its expiry would otherwise read as one that
   * never expires.
   */
  it("refuses anything that is not a whole session", () => {
    expect(parsePortalSession("not json")).toBeNull();
    expect(parsePortalSession("null")).toBeNull();
    expect(parsePortalSession('"a string"')).toBeNull();
    expect(parsePortalSession(JSON.stringify({ token: "t", patient_id: "p" }))).toBeNull();
    expect(parsePortalSession(JSON.stringify({ patient_id: "p", expiresAt: 1 }))).toBeNull();
    expect(
      parsePortalSession(JSON.stringify({ token: "", patient_id: "p", expiresAt: 1 })),
    ).toBeNull();
  });

  it("refuses a non-finite expiry rather than treating it as forever", () => {
    const raw = '{"token":"t","patient_id":"p","expiresAt":null}';
    expect(parsePortalSession(raw)).toBeNull();
  });

  it("accepts a complete session", () => {
    const raw = JSON.stringify({ ...SESSION, expiresAt: 123 });
    expect(parsePortalSession(raw)?.token).toBe("a-patient-token");
  });
});
