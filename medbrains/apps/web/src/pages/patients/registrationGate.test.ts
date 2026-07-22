import { describe, expect, it } from "vitest";
import { nextCheckState } from "@/lib/advisoryCheck";
import { registrationAction } from "./registrationGate";

const NO_MATCHES: string[] = [];
const MATCHES = ["existing-patient-uhid"];

describe("registrationAction", () => {
  it("asks for confirmation when someone matched", () => {
    const check = nextCheckState({ type: "checked", findings: MATCHES }, NO_MATCHES);
    expect(registrationAction(check)).toBe("confirm");
  });

  it("proceeds when the check ran and nobody matched", () => {
    const check = nextCheckState({ type: "checked", findings: NO_MATCHES }, NO_MATCHES);
    expect(registrationAction(check)).toBe("proceed");
  });

  /**
   * The regression this exists for. A failed check leaves an empty match list,
   * which is indistinguishable from "nobody matched" unless the unavailable
   * flag is honoured — and the two must not lead to the same silent create.
   */
  it("does not treat a failed check as nobody matching", () => {
    const failed = nextCheckState<string[]>({ type: "failed" }, NO_MATCHES);
    const clean = nextCheckState({ type: "checked", findings: NO_MATCHES }, NO_MATCHES);

    expect(failed.findings).toEqual(clean.findings);
    expect(registrationAction(failed)).not.toBe(registrationAction(clean));
    expect(registrationAction(failed)).toBe("proceedUnverified");
  });

  /**
   * Registration still has to happen — a camp intake cannot stop because the
   * MPI service is down. Both failure and success create the patient; only the
   * confirmation step differs.
   */
  it("never blocks registration outright", () => {
    const actions: RegistrationActionList = [
      registrationAction(nextCheckState<string[]>({ type: "failed" }, NO_MATCHES)),
      registrationAction(nextCheckState({ type: "checked", findings: NO_MATCHES }, NO_MATCHES)),
    ];
    expect(actions).not.toContain("confirm");
  });
});

type RegistrationActionList = ReturnType<typeof registrationAction>[];
