import type { UhiRequest } from "@medbrains/types";
import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { UhiPinCheck } from "./uhi-pin-check";
import { UhiVisitNotes } from "./uhi-visit-notes";

const service = vi.hoisted(() => ({ checkPin: vi.fn() }));
vi.mock("@/services/uhi.service", () => ({ uhiService: service }));

const visit: UhiRequest = {
  id: "r1",
  service: "physical_consultation",
  state: "confirmed",
  customer_name: "Kiran Das",
  customer_phone: "9876500055",
  customer_abha: null,
  summary: "Dr A at 2026-11-20 09:00:00",
  appointment_id: "a1",
  ambulance_trip_id: null,
  decline_reason: null,
  confirmed_at: "2026-11-15T10:00:00Z",
  responded_at: null,
  updated_at: "2026-11-15T10:00:00Z",
  payment_type: "ON-FULFILLMENT",
  payment_status: "NOT-PAID",
  amount: null,
  hold_expires_at: null,
  lab_order_ids: [],
  home_collection: false,
  slot_held_until: null,
  doctor_no_show_at: null,
  has_pin: true,
  pin_verified_at: null,
  pin_failed_attempts: 0,
};

async function typePin(pin: string) {
  // The PIN boxes are masked (password inputs), so they have no textbox role.
  await screen.findAllByLabelText("PIN from the patient's app");
  const boxes = document.body.querySelectorAll<HTMLInputElement>('input[type="password"]');
  for (const [i, digit] of [...pin].entries()) {
    fireEvent.change(boxes[i] as HTMLInputElement, { target: { value: digit } });
  }
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
}

beforeEach(() => vi.clearAllMocks());

describe("UhiPinCheck", () => {
  it("sends the typed PIN for this booking and says when it matches", async () => {
    service.checkPin.mockResolvedValue({ matched: true, tries_left: 5 });
    render(<UhiPinCheck request={visit} onClose={() => {}} />);
    await typePin("0420");
    expect(service.checkPin).toHaveBeenCalledWith("r1", "0420");
    expect(await screen.findByText("The PIN matches")).toBeInTheDocument();
  });

  it("says a wrong PIN does not match and how many tries are left", async () => {
    service.checkPin.mockResolvedValue({ matched: false, tries_left: 3 });
    render(<UhiPinCheck request={visit} onClose={() => {}} />);
    await typePin("1111");
    expect(await screen.findByText("That PIN does not match")).toBeInTheDocument();
    expect(screen.getByText(/3 tries left/)).toBeInTheDocument();
  });
});

describe("UhiVisitNotes", () => {
  it("shows a doctor no-show the patient's app reported", () => {
    render(<UhiVisitNotes request={{ ...visit, doctor_no_show_at: "2026-11-20T05:00:00Z" }} />);
    expect(screen.getByText(/Patient reports doctor no-show/)).toBeInTheDocument();
  });

  it("says a lapsed hold has freed the slot", () => {
    const lapsed = { ...visit, state: "initialised" as const, has_pin: false };
    render(<UhiVisitNotes request={{ ...lapsed, slot_held_until: "2020-01-01T00:00:00Z" }} />);
    expect(screen.getByText("Hold lapsed — the slot is free again")).toBeInTheDocument();
  });

  it("tells the desk to check by hand after too many wrong PINs", () => {
    render(<UhiVisitNotes request={{ ...visit, pin_failed_attempts: 5 }} />);
    expect(screen.getByText(/check the booking by hand/)).toBeInTheDocument();
  });
});
