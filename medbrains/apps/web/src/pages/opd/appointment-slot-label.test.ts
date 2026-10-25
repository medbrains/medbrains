import { describe, expect, it } from "vitest";
import { appointmentSlotLabel } from "./shared";

describe("appointmentSlotLabel", () => {
  it("prints the slot the way the desk reads it, without seconds", () => {
    expect(appointmentSlotLabel({ slot_start: "11:30:00", slot_end: "11:45:00" })).toBe(
      "11:30 AM - 11:45 AM",
    );
    expect(
      appointmentSlotLabel({
        appointment_slot_start: "12:15:00",
        appointment_slot_end: "12:30:00",
      }),
    ).toBe("12:15 PM - 12:30 PM");
  });

  it("falls back to the date, then to the no-slot label", () => {
    expect(appointmentSlotLabel({ appointment_date: "2026-10-25" })).toBe("2026-10-25");
    expect(appointmentSlotLabel({}, "No slot")).toBe("No slot");
  });
});
