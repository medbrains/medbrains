// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  OPD_QUEUE_ROW_ACTIONS,
  type OpdQueueRowActionPermissions,
  resolveOpdQueueRowActions,
} from "./opd-queue-actions";

const allPermissions: OpdQueueRowActionPermissions = {
  canManageToken: true,
  canOpenVisit: true,
  canRecordVitals: true,
};

function action(status: string, id: string, permissions = allPermissions) {
  const resolved = resolveOpdQueueRowActions({ status }, permissions);
  const match = resolved.find((item) => item.id === id);
  if (!match) {
    throw new Error(`Missing action ${id}`);
  }
  return match;
}

describe("OPD queue row actions", () => {
  it("exposes activation events and permission metadata for every action", () => {
    expect(OPD_QUEUE_ROW_ACTIONS).toHaveLength(6);
    for (const definition of OPD_QUEUE_ROW_ACTIONS) {
      expect(definition.activatesAfter).toEqual(["opd.encounter.created"]);
      expect(definition.requiredPermissions.length).toBeGreaterThan(0);
    }
  });

  it("keeps open visit visible but disabled until patient is called", () => {
    const waiting = action("waiting", "open_visit");
    expect(waiting.visible).toBe(true);
    expect(waiting.enabled).toBe(false);
    expect(waiting.disabledReasonText).toBe("Call patient before opening OPD visit");

    const called = action("called", "open_visit");
    expect(called.visible).toBe(true);
    expect(called.enabled).toBe(true);
  });

  it("moves token actions through waiting, called, and consultation states", () => {
    expect(action("waiting", "call_patient").enabled).toBe(true);
    expect(action("waiting", "start_consultation").visible).toBe(false);
    expect(action("called", "start_consultation").enabled).toBe(true);
    expect(action("called", "call_patient").visible).toBe(false);
    expect(action("in_consultation", "complete_visit").enabled).toBe(true);
    expect(action("completed", "complete_visit").visible).toBe(false);
  });

  it("hides permission-denied workflow actions", () => {
    const permissions: OpdQueueRowActionPermissions = {
      canManageToken: false,
      canOpenVisit: true,
      canRecordVitals: false,
    };

    expect(action("waiting", "record_vitals", permissions).visible).toBe(false);
    expect(action("waiting", "call_patient", permissions).visible).toBe(false);
    expect(action("called", "open_visit", permissions).visible).toBe(true);
  });
});
