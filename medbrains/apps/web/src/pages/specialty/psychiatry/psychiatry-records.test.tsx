import { usePermissionStore } from "@medbrains/stores";
import type { PsychEctRegister, PsychSeclusionRestraint } from "@medbrains/types";
import { P } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { EctTab } from "./EctTab";
import { RestraintTab } from "./RestraintTab";

const service = vi.hoisted(() => ({
  listRestraints: vi.fn(),
  createRestraint: vi.fn(),
  releaseRestraint: vi.fn(),
  listEct: vi.fn(),
  createEct: vi.fn(),
}));
vi.mock("@/services/psychiatry.service", () => ({ psychiatryService: service }));

const PSYCH_ID = "11111111-1111-4111-8111-111111111111";
const HOUR = 3_600_000;

function restraint(over: Partial<PsychSeclusionRestraint>): PsychSeclusionRestraint {
  return {
    id: "r1",
    tenant_id: "t",
    psych_patient_id: PSYCH_ID,
    restraint_type: "physical",
    reason: "Assaulting staff",
    start_time: new Date(Date.now() - 2 * HOUR).toISOString(),
    review_due_at: new Date(Date.now() + 2 * HOUR).toISOString(),
    reviewed_at: null,
    end_time: null,
    ordered_by: "u",
    released_by: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  };
}

describe("Restraint register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePermissionStore
      .getState()
      .setPermissions("doctor", [
        P.SPECIALTY.PSYCHIATRY.RESTRAINT_LIST,
        P.SPECIALTY.PSYCHIATRY.RESTRAINT_MANAGE,
      ]);
  });

  // The page read `released_at`, a field the server never sends, so every
  // episode — including ones long ended — showed as in force.
  it("reads the end from end_time: an ended episode is not shown as in force", async () => {
    service.listRestraints.mockResolvedValue([
      restraint({ id: "ended", end_time: new Date(Date.now() - HOUR).toISOString() }),
    ]);
    render(<RestraintTab psychPatientId={PSYCH_ID} />);
    expect(await screen.findByText(/^Ended/)).toBeInTheDocument();
    expect(screen.queryByText("In force")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "End restraint" })).not.toBeInTheDocument();
  });

  it("an episode still in force can be ended, and the release sends a body", async () => {
    service.listRestraints.mockResolvedValue([restraint({})]);
    service.releaseRestraint.mockResolvedValue(restraint({ end_time: new Date().toISOString() }));
    render(<RestraintTab psychPatientId={PSYCH_ID} />);
    expect(await screen.findByText("In force")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "End restraint" }));
    await userEvent.type(await screen.findByLabelText("Notes at release"), "Calm, eating");
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "End restraint" }));
    await waitFor(() =>
      expect(service.releaseRestraint).toHaveBeenCalledWith("r1", { notes: "Calm, eating" }),
    );
  });

  it("an overdue review says so in words, not colour alone", async () => {
    service.listRestraints.mockResolvedValue([
      restraint({ review_due_at: new Date(Date.now() - HOUR).toISOString() }),
    ]);
    render(<RestraintTab psychPatientId={PSYCH_ID} />);
    expect(await screen.findByText(/overdue/)).toBeInTheDocument();
  });

  it("does not fetch the register without the list permission", () => {
    usePermissionStore.getState().setPermissions("nurse", []);
    render(<RestraintTab psychPatientId={PSYCH_ID} />);
    expect(service.listRestraints).not.toHaveBeenCalled();
  });

  it("an outage reads as an error, not as an empty register", async () => {
    service.listRestraints.mockRejectedValue(new Error("Service unavailable"));
    render(<RestraintTab psychPatientId={PSYCH_ID} />);
    expect(await screen.findByText(/Service unavailable|could not|try again/i)).toBeInTheDocument();
    expect(screen.queryByText("No restraint episodes")).not.toBeInTheDocument();
  });
});

describe("ECT register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePermissionStore.getState().setPermissions("doctor", [P.SPECIALTY.PSYCHIATRY.ECT_LIST]);
  });

  // The page read `seizure_duration`; the server sends `seizure_duration_sec`.
  it("shows the seizure duration the server sends", async () => {
    const row: PsychEctRegister = {
      id: "e1",
      tenant_id: "t",
      psych_patient_id: PSYCH_ID,
      session_number: 3,
      consent_obtained: true,
      laterality: "right_unilateral",
      stimulus_dose: "35.50",
      seizure_duration_sec: 42,
      anesthetic: "Propofol",
      muscle_relaxant: "Succinylcholine",
      performed_by: "u",
      anesthetist_id: null,
      session_date: new Date().toISOString(),
      complications: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    service.listEct.mockResolvedValue([row]);
    render(<EctTab psychPatientId={PSYCH_ID} />);
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.getByText("35.50")).toBeInTheDocument();
    expect(screen.getByText("Consent on file")).toBeInTheDocument();
    expect(screen.getByText("Right unilateral")).toBeInTheDocument();
  });
});
