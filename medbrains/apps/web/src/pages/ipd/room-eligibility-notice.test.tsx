import type { RoomCheck } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { RoomEligibilityNotice } from "./room-eligibility-notice";

const service = vi.hoisted(() => ({ checkRoomEligibility: vi.fn(), setRoomRentLimit: vi.fn() }));
vi.mock("@/services/ipd.service", () => ({ ipdService: service }));

const billing = vi.hoisted(() => ({ listRoomConsentWitnesses: vi.fn() }));
vi.mock("@/services/billing.service", () => ({ billingService: billing }));

const held = vi.hoisted(() => new Set<string>());
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.has(code),
}));

/** An ₹8,000 room under a ₹5,000 Star Health limit, ₹40,000 linked so far. */
function above(overrides: Partial<RoomCheck> = {}): RoomCheck {
  return {
    status: "above",
    patient_insurance_id: "pol-1",
    insurance_provider: "Star Health",
    room_rate: "8000.00",
    eligible_rate: "5000.00",
    payable_ratio: "0.6250",
    associated_so_far: "40000.00",
    ...overrides,
  };
}

beforeEach(() => {
  held.clear();
  service.checkRoomEligibility.mockReset();
  service.setRoomRentLimit.mockReset();
  billing.listRoomConsentWitnesses.mockReset();
  billing.listRoomConsentWitnesses.mockResolvedValue([
    { id: "u-2", full_name: "Ward Sister", role: "nurse" },
  ]);
});

describe("the room check before a bed is allocated", () => {
  it("warns above the limit with the proportionate cut and records witnessed consent", async () => {
    held.add("insurance.room_eligibility.resolve");
    service.checkRoomEligibility.mockResolvedValue(above());
    const onConsent = vi.fn();
    render(<RoomEligibilityNotice patientId="p-1" bedId="b-1" onConsentChange={onConsent} />);
    expect(await screen.findByText("Room above the policy's room rent limit")).toBeInTheDocument();
    expect(screen.getByText(/pay only 62.5% of every room-linked charge/)).toBeInTheDocument();
    expect(
      screen.getByText("Estimated deduction the family would pay: ₹15,000"),
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox"));
    expect(onConsent).toHaveBeenLastCalledWith(undefined);
    await user.type(screen.getByLabelText(/Agreed by/), "Meena Rao");
    await user.type(screen.getByLabelText(/Relation to patient/), "Wife");
    expect(onConsent).toHaveBeenLastCalledWith(undefined);
    await user.click(screen.getByPlaceholderText("Search staff by name"));
    await user.click(
      await screen.findByRole("option", { name: "Ward Sister (nurse)", hidden: true }),
    );
    expect(onConsent).toHaveBeenLastCalledWith({
      consented_by_name: "Meena Rao",
      consenter_relation: "Wife",
      witness_user_id: "u-2",
      disclosure_version: "room-cut-2026-11-v1",
      estimated_bill: 40000,
    });
  });

  it("leaves consent to the insurance desk for a clerk who may not record it", async () => {
    service.checkRoomEligibility.mockResolvedValue(above());
    render(<RoomEligibilityNotice patientId="p-1" bedId="b-1" onConsentChange={vi.fn()} />);
    expect(
      await screen.findByText(/the insurance desk records the family's consent/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("says plainly when the hospital has no room-category pricing or the limit is unknown", async () => {
    service.checkRoomEligibility.mockResolvedValueOnce(
      above({ status: "no_differential_billing" }),
    );
    const { unmount } = render(
      <RoomEligibilityNotice patientId="p-1" bedId="b-1" onConsentChange={vi.fn()} />,
    );
    expect(await screen.findByText(/no deduction here/)).toBeInTheDocument();
    unmount();
    service.checkRoomEligibility.mockResolvedValueOnce(above({ status: "limit_unknown" }));
    render(<RoomEligibilityNotice patientId="p-1" bedId="b-2" onConsentChange={vi.fn()} />);
    expect(
      await screen.findByText("Could not work out the policy's room limit"),
    ).toBeInTheDocument();
  });

  it("says nothing alarming for a room within the limit", async () => {
    service.checkRoomEligibility.mockResolvedValue(
      above({ status: "within", room_rate: "4000.00", payable_ratio: null }),
    );
    render(<RoomEligibilityNotice patientId="p-1" bedId="b-1" onConsentChange={vi.fn()} />);
    expect(
      await screen.findByText("Within the policy's room limit of ₹5,000 a day."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows nothing for a cash patient", async () => {
    service.checkRoomEligibility.mockResolvedValue(above({ status: "not_insured" }));
    render(<RoomEligibilityNotice patientId="p-1" bedId="b-1" onConsentChange={vi.fn()} />);
    await waitFor(() => expect(screen.queryByText(/Checking the room/)).not.toBeInTheDocument());
    expect(screen.queryByText(/policy/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows a failed check as a fault, never as within the limit", async () => {
    service.checkRoomEligibility.mockImplementation(async () => {
      throw new Error("Service unavailable");
    });
    render(<RoomEligibilityNotice patientId="p-1" bedId="b-1" onConsentChange={vi.fn()} />);
    expect(
      await screen.findByText("Could not check this room against the policy"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Within the policy/)).not.toBeInTheDocument();
  });

  it("does not check before a patient and a bed are chosen", () => {
    render(<RoomEligibilityNotice patientId="p-1" bedId="" onConsentChange={vi.fn()} />);
    expect(service.checkRoomEligibility).not.toHaveBeenCalled();
  });

  it("lets the insurance desk record a missing policy limit", async () => {
    held.add("insurance.room_eligibility.configure");
    service.checkRoomEligibility.mockResolvedValue(
      above({ status: "no_limit", eligible_rate: null }),
    );
    service.setRoomRentLimit.mockResolvedValue({ id: "pol-1" });
    const user = userEvent.setup();
    render(<RoomEligibilityNotice patientId="p-1" bedId="b-1" onConsentChange={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Record the limit" }));
    await user.type(screen.getByLabelText(/Eligible room rent a day/), "5000");
    await user.click(screen.getByRole("button", { name: "Save limit" }));
    await waitFor(() =>
      expect(service.setRoomRentLimit).toHaveBeenCalledWith("pol-1", {
        room_rent_limit_per_day: 5000,
        room_rent_limit_percent: null,
      }),
    );
  });

  it("says no limit is recorded, with no control, to a desk that may not set it", async () => {
    service.checkRoomEligibility.mockResolvedValue(
      above({ status: "no_limit", eligible_rate: null }),
    );
    render(<RoomEligibilityNotice patientId="p-1" bedId="b-1" onConsentChange={vi.fn()} />);
    expect(await screen.findByText(/No room rent limit is recorded/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record the limit" })).not.toBeInTheDocument();
  });
});

describe("correcting a room limit already recorded", () => {
  it.each([
    ["within", above({ status: "within", payable_ratio: null })],
    ["above", above()],
    ["limit_unknown", above({ status: "limit_unknown", eligible_rate: null })],
  ])("offers 'Edit the limit' on a %s check to the insurance desk", async (_, check) => {
    held.add("insurance.room_eligibility.configure");
    service.checkRoomEligibility.mockResolvedValue(check);
    render(<RoomEligibilityNotice patientId="p-1" bedId="b-1" onConsentChange={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Edit the limit" }));
    expect(await screen.findByText("Policy room rent limit")).toBeInTheDocument();
  });

  it("offers no edit to someone who may not configure the limit", async () => {
    service.checkRoomEligibility.mockResolvedValue(
      above({ status: "within", payable_ratio: null }),
    );
    render(<RoomEligibilityNotice patientId="p-1" bedId="b-1" onConsentChange={vi.fn()} />);
    await screen.findByText(/Within the policy's room limit/);
    expect(screen.queryByRole("button", { name: "Edit the limit" })).not.toBeInTheDocument();
  });
});
