// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  type ClinicalJourneyContext,
  CORE_PATIENT_JOURNEY_ACTIONS,
  resolveClinicalJourneyActions,
} from "./event-actions";

/**
 * This decides which clinical journey actions a user is offered on a patient
 * — edit, admit, prescribe, bill. It gates on permissions and on context
 * (living patient, active encounter), and had no tests.
 */

const patient = (over: Partial<ClinicalJourneyContext> = {}): ClinicalJourneyContext => ({
  patientId: "pat-1",
  ...over,
});

const allow = () => true;
const deny = () => false;
const only =
  (...codes: string[]) =>
  (code: string) =>
    codes.includes(code);

describe("permission gating", () => {
  /**
   * The default is to omit rather than disable: an action the user may not
   * perform is absent from the list entirely, so a caller cannot render it by
   * accident. Surfacing it greyed-out is opt-in.
   */
  it("omits permission-denied actions entirely by default", () => {
    expect(resolveClinicalJourneyActions(patient(), deny)).toHaveLength(0);
  });

  it("includes them, marked denied, only when asked", () => {
    const resolved = resolveClinicalJourneyActions(patient(), deny, "web", {
      includePermissionDenied: true,
    });
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved.every((a) => a.permissionAllowed === false)).toBe(true);
    expect(resolved.every((a) => a.enabled === false)).toBe(true);
  });

  it("marks an action permission-allowed once its codes are held", () => {
    const edit = resolveClinicalJourneyActions(patient(), allow).find(
      (a) => a.id === "patient.edit",
    );
    expect(edit?.permissionAllowed).toBe(true);
  });

  it("returns only the actions whose permissions are held", () => {
    const editPerm = CORE_PATIENT_JOURNEY_ACTIONS.find((a) => a.id === "patient.edit")
      ?.requiredPermissions[0];
    expect(editPerm).toBeDefined();

    const resolved = resolveClinicalJourneyActions(patient(), only(editPerm as string));
    expect(resolved.every((a) => a.permissionAllowed)).toBe(true);
    expect(resolved.some((a) => a.id === "patient.edit")).toBe(true);
    // The full-permission list is strictly larger.
    expect(resolveClinicalJourneyActions(patient(), allow).length).toBeGreaterThan(resolved.length);
  });

  it("reports permission as the blocking reason when it is the cause", () => {
    const blocked = resolveClinicalJourneyActions(patient(), deny, "web", {
      includePermissionDenied: true,
    }).find((a) => a.blockedReason === "permission");
    expect(blocked?.permissionDisabledReasonText).toBeTruthy();
  });
});

describe("permission mode", () => {
  /**
   * QUIRK, currently latent: the two modes disagree on an empty permission
   * list. "all" uses every, which is true for an empty array, so the action is
   * allowed; "any" uses some, which is false, so it is denied. An action
   * declaring no permissions would therefore be visible or hidden purely by
   * which mode it happened to set.
   *
   * Nothing hits this today — every one of the 21 permission lists in this
   * file is non-empty — so this documents the asymmetry rather than reporting
   * a live defect. It is the same every/some split already pinned in
   * evaluateCondition and the permission store.
   */
  it("QUIRK: every and some disagree on an empty permission list", () => {
    const empty: string[] = [];
    expect(empty.every(() => false)).toBe(true); // "all" mode would allow
    expect(empty.some(() => true)).toBe(false); // "any" mode would deny
  });

  it("no action ships with an empty permission list, so the split stays latent", () => {
    for (const action of CORE_PATIENT_JOURNEY_ACTIONS) {
      expect(action.requiredPermissions.length).toBeGreaterThan(0);
    }
  });
});

describe("surface filtering", () => {
  it("returns only actions declared for the requested surface", () => {
    for (const surface of ["web", "mobile", "tv", "kiosk"] as const) {
      const resolved = resolveClinicalJourneyActions(patient(), allow, surface);
      expect(resolved.every((a) => a.surfaces.includes(surface))).toBe(true);
    }
  });

  it("web offers at least as much as kiosk, which is the constrained surface", () => {
    const web = resolveClinicalJourneyActions(patient(), allow, "web");
    const kiosk = resolveClinicalJourneyActions(patient(), allow, "kiosk");
    expect(web.length).toBeGreaterThanOrEqual(kiosk.length);
  });

  it("defaults to web when no surface is given", () => {
    expect(resolveClinicalJourneyActions(patient(), allow)).toEqual(
      resolveClinicalJourneyActions(patient(), allow, "web"),
    );
  });
});

describe("context gating", () => {
  /**
   * A deceased patient must not be editable or admittable. Permission is
   * fully granted here, so anything still disabled is disabled by context —
   * which is the point.
   */
  it("blocks living-patient actions once the patient is deceased", () => {
    const living = resolveClinicalJourneyActions(patient({ isDeceased: false }), allow);
    const deceased = resolveClinicalJourneyActions(patient({ isDeceased: true }), allow);

    const edit = (list: typeof living) => list.find((a) => a.id === "patient.edit");
    expect(edit(living)?.enabled).toBe(true);
    expect(edit(deceased)?.enabled).toBe(false);
    expect(edit(deceased)?.blockedReason).toBe("context");
  });

  it("reports permission first when both permission and context block", () => {
    const edit = resolveClinicalJourneyActions(patient({ isDeceased: true }), deny, "web", {
      includePermissionDenied: true,
    }).find((a) => a.id === "patient.edit");
    expect(edit?.blockedReason).toBe("permission");
    expect(edit?.permissionAllowed).toBe(false);
  });

  it("enabled requires both permission and an unblocked context", () => {
    for (const action of resolveClinicalJourneyActions(patient({ isDeceased: true }), allow)) {
      if (action.enabled) {
        expect(action.permissionAllowed).toBe(true);
        expect(action.blockedReason).toBeNull();
      }
    }
  });
});
