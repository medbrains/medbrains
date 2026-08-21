import { describe, expect, it } from "vitest";
import type { BedsideTransfusion, TransfusionObservation } from "../../api/transfusion.js";
import {
  canStartTransfusion,
  hasSuspectedReaction,
  isRunning,
  phaseStates,
} from "./transfusion.js";

const START = "2026-08-21T10:00:00.000Z";
const startMs = Date.parse(START);

function unit(overrides: Partial<BedsideTransfusion> = {}): BedsideTransfusion {
  return {
    admission_id: "adm",
    adverse_reaction: false,
    bag_number: "BAG-1",
    blood_group: "O",
    consent_on_file: true,
    crossmatch_compatible: true,
    expiry_date: "2026-09-01",
    id: "t1",
    patient_verified_by_id: "n1",
    product_type: "PRBC",
    product_verified_by_id: "n2",
    reaction_type: null,
    rh_factor: "positive",
    total_volume_infused_ml: null,
    transfusion_date: "2026-08-21",
    transfusion_end_time: null,
    transfusion_start_time: START,
    volume_ml: 350,
    ...overrides,
  };
}

function obs(phase: string, reaction = false): TransfusionObservation {
  return {
    adverse_signs: reaction,
    diastolic_bp: 80,
    id: `o-${phase}`,
    notes: null,
    observed_at: START,
    phase,
    pulse: 80,
    reaction_suspected: reaction,
    respiratory_rate: 16,
    systolic_bp: 120,
    temperature_c: 37,
    transfusion_id: "t1",
  };
}

describe("whether the unit is still running", () => {
  it("stays running until an end time is recorded", () => {
    expect(isRunning(unit())).toBe(true);
  });

  it("is not running once it has ended, even with observations outstanding", () => {
    expect(isRunning(unit({ transfusion_end_time: START }))).toBe(false);
  });
});

describe("the observation schedule", () => {
  it("marks the fifteen-minute check overdue once the time has passed", () => {
    // The check that catches an acute haemolytic reaction. If this stops
    // flagging, the screen looks calm through the exact window it exists for.
    const states = phaseStates(unit(), [obs("baseline")], startMs + 20 * 60_000);
    const fifteen = states.find((state) => state.phase === "fifteen_min");
    expect(fifteen).toEqual({ overdue: true, phase: "fifteen_min", recorded: false });
  });

  it("does not flag it before its time", () => {
    const states = phaseStates(unit(), [obs("baseline")], startMs + 5 * 60_000);
    expect(states.find((state) => state.phase === "fifteen_min")?.overdue).toBe(false);
  });

  it("never marks completion overdue on a running unit", () => {
    // Otherwise every transfusion in progress carries a red mark for the
    // crime of not having finished.
    const states = phaseStates(unit(), [], startMs + 5 * 60 * 60_000);
    expect(states.find((state) => state.phase === "completion")?.overdue).toBe(false);
  });

  it("stops flagging a phase once it has been charted", () => {
    const states = phaseStates(
      unit(),
      [obs("baseline"), obs("fifteen_min")],
      startMs + 60_000 * 90,
    );
    expect(states.find((state) => state.phase === "fifteen_min")).toEqual({
      overdue: false,
      phase: "fifteen_min",
      recorded: true,
    });
  });

  it("flags nothing on a unit that has ended", () => {
    const ended = unit({ transfusion_end_time: START });
    const states = phaseStates(ended, [], startMs + 60 * 60_000);
    expect(states.every((state) => !state.overdue)).toBe(true);
  });
});

describe("reaction flagging", () => {
  it("reads the server's flag rather than re-deciding it", () => {
    expect(hasSuspectedReaction([obs("baseline"), obs("fifteen_min", true)])).toBe(true);
    expect(hasSuspectedReaction([obs("baseline")])).toBe(false);
  });
});

describe("what has to be true before a unit is hung", () => {
  const ready = {
    bagNumber: "BAG-1",
    bloodGroup: "O",
    consentOnFile: true,
    crossmatchCompatible: true,
    expiryDate: "2026-09-01",
    productType: "PRBC",
    secondNurseId: "n2",
  };

  it("allows a complete, consented, compatible, double-checked unit", () => {
    expect(canStartTransfusion(ready)).toBe(true);
  });

  it("refuses without consent, without compatibility, or without a second nurse", () => {
    // The server refuses each of these too. The client copy exists so the
    // nurse is stopped before the tap, never instead of the server.
    expect(canStartTransfusion({ ...ready, consentOnFile: false })).toBe(false);
    expect(canStartTransfusion({ ...ready, crossmatchCompatible: false })).toBe(false);
    expect(canStartTransfusion({ ...ready, secondNurseId: null })).toBe(false);
  });

  it("refuses a bag with no number", () => {
    expect(canStartTransfusion({ ...ready, bagNumber: "   " })).toBe(false);
  });
});
