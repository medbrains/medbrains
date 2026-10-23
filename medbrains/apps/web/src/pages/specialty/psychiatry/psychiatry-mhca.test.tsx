import { usePermissionStore } from "@medbrains/stores";
import type { PsychAdvanceDirective, PsychScreening } from "@medbrains/types";
import { P } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, within } from "@/test/test-utils";
import { DirectiveSection } from "./DirectiveSection";
import { RestraintTab } from "./RestraintTab";
import { ScreeningsTab } from "./ScreeningsTab";

const service = vi.hoisted(() => ({
  listScreenings: vi.fn(),
  createScreening: vi.fn(),
  completeSafetyReview: vi.fn(),
  listRestraints: vi.fn(),
  listDirectives: vi.fn(),
  listChallenges: vi.fn(),
}));
vi.mock("@/services/psychiatry.service", () => ({ psychiatryService: service }));
vi.mock("@/services/lookups.service", () => ({
  lookupsService: { listDoctors: vi.fn().mockResolvedValue([]) },
}));

const ID = "33333333-3333-4333-8333-333333333333";
const now = new Date().toISOString();

function screening(over: Partial<PsychScreening>): PsychScreening {
  return {
    id: "s1",
    tenant_id: "t",
    psych_patient_id: ID,
    instrument: "phq9",
    answers: [1, 1, 1, 1, 1, 1, 1, 0, 1],
    total: 8,
    severity: "mild",
    item9_positive: true,
    administered_by: "u",
    administered_at: now,
    safety_review_status: "pending",
    safety_reviewed_by: null,
    safety_reviewed_at: null,
    safety_review_outcome: null,
    safety_review_note: null,
    notes: null,
    created_at: now,
    updated_at: now,
    ...over,
  };
}

describe("PHQ-9 safety review", () => {
  beforeEach(() => vi.clearAllMocks());

  // A positive item 9 is a safety event, whatever the total.
  it("puts a pending review at the top, with the action for those who may record it", async () => {
    usePermissionStore
      .getState()
      .setPermissions("doctor", [
        P.SPECIALTY.PSYCHIATRY.ASSESSMENTS_LIST,
        P.SPECIALTY.PSYCHIATRY.SAFETY_REVIEW,
      ]);
    service.listScreenings.mockResolvedValue([screening({})]);
    render(<ScreeningsTab psychPatientId={ID} />);
    expect(await screen.findByText("Suicide-risk review needed today")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record the review" })).toBeInTheDocument();
    expect(screen.getByText("Positive")).toBeInTheDocument();
  });

  it("a role without the review permission sees the alert but not the action", async () => {
    usePermissionStore
      .getState()
      .setPermissions("nurse", [P.SPECIALTY.PSYCHIATRY.ASSESSMENTS_LIST]);
    service.listScreenings.mockResolvedValue([screening({})]);
    render(<ScreeningsTab psychPatientId={ID} />);
    expect(await screen.findByText("Suicide-risk review needed today")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record the review" })).not.toBeInTheDocument();
  });
});

describe("Restraint under s.97", () => {
  it("does not offer seclusion", async () => {
    usePermissionStore
      .getState()
      .setPermissions("doctor", [
        P.SPECIALTY.PSYCHIATRY.RESTRAINT_LIST,
        P.SPECIALTY.PSYCHIATRY.RESTRAINT_MANAGE,
      ]);
    service.listRestraints.mockResolvedValue([]);
    render(<RestraintTab psychPatientId={ID} />);
    await userEvent.click(await screen.findByRole("button", { name: "Start restraint" }));
    const dialog = await screen.findByRole("dialog");
    Element.prototype.scrollIntoView = vi.fn();
    await userEvent.click(within(dialog).getByLabelText("Type"));
    expect(
      await screen.findByRole("option", { name: "Chemical restraint", hidden: true }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Seclusion/, hidden: true }),
    ).not.toBeInTheDocument();
  });
});

describe("Advance directive", () => {
  it("an active directive must be followed, and the Board is the only way round it", async () => {
    usePermissionStore
      .getState()
      .setPermissions("doctor", [P.SPECIALTY.PSYCHIATRY.DIRECTIVES_CHALLENGE]);
    const ad: PsychAdvanceDirective = {
      id: "d1",
      tenant_id: "t",
      psych_patient_id: ID,
      made_on: null,
      made_by: "patient",
      treatment_wishes: null,
      treatment_refusals: "No ECT",
      representative_preferences: null,
      document_ref: null,
      status: "active",
      revoked_at: null,
      recorded_by: null,
      created_at: now,
      updated_at: now,
    };
    service.listDirectives.mockResolvedValue([ad]);
    service.listChallenges.mockResolvedValue([]);
    render(<DirectiveSection psychPatientId={ID} />);
    expect(await screen.findByText("This directive must be followed")).toBeInTheDocument();
    expect(screen.getByText("No ECT")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply to the Board" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Patient revoked it" })).not.toBeInTheDocument();
  });
});
