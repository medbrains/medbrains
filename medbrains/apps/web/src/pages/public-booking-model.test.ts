import type { PublicAvailableSlot, PublicBookableDoctor } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  bookableSlots,
  bookingProblem,
  groupByDepartment,
  lastBookableDate,
  slotLabel,
} from "./public-booking-model";

function doctor(name: string, deptId: string, deptName: string): PublicBookableDoctor {
  return {
    doctor_id: `${name}-id`,
    doctor_name: name,
    department_id: deptId,
    department_name: deptName,
  };
}

function slot(overrides: Partial<PublicAvailableSlot> = {}): PublicAvailableSlot {
  return {
    start_time: "09:00:00",
    end_time: "09:15:00",
    booked_count: 0,
    max_patients: 4,
    is_available: true,
    ...overrides,
  };
}

describe("groupByDepartment", () => {
  it("collects doctors under one entry per department", () => {
    const groups = groupByDepartment([
      doctor("Rao", "d1", "Orthopaedics"),
      doctor("Iyer", "d2", "Cardiology"),
      doctor("Khan", "d1", "Orthopaedics"),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.departmentName).toBe("Orthopaedics");
    expect(groups[0]?.doctors.map((d) => d.doctor_name)).toEqual(["Rao", "Khan"]);
    expect(groups[1]?.doctors).toHaveLength(1);
  });

  it("handles an empty directory", () => {
    expect(groupByDepartment([])).toEqual([]);
  });
});

describe("bookableSlots", () => {
  /**
   * A full slot still comes back from the server with its counts. Offering it
   * would let a patient pick a time and be refused on submit, after they had
   * entered their details.
   */
  it("drops slots that are full or marked unavailable", () => {
    const slots = [
      slot({ start_time: "09:00:00" }),
      slot({ start_time: "09:15:00", booked_count: 4, max_patients: 4 }),
      slot({ start_time: "09:30:00", is_available: false }),
      slot({ start_time: "09:45:00", booked_count: 3, max_patients: 4 }),
    ];
    expect(bookableSlots(slots).map((s) => s.start_time)).toEqual(["09:00:00", "09:45:00"]);
  });
});

describe("slotLabel", () => {
  it("reads as a clock time", () => {
    expect(slotLabel("09:00:00")).toBe("9:00 am");
    expect(slotLabel("13:30:00")).toBe("1:30 pm");
  });

  /** Midnight and noon are where a naive modulo prints "0:00". */
  it("gets the twelves right", () => {
    expect(slotLabel("00:15:00")).toBe("12:15 am");
    expect(slotLabel("12:05:00")).toBe("12:05 pm");
  });

  it("returns anything unparseable unchanged rather than inventing a time", () => {
    expect(slotLabel("not-a-time")).toBe("not-a-time");
    expect(slotLabel("")).toBe("");
  });
});

describe("bookingProblem", () => {
  it("accepts a plausible name and number", () => {
    expect(bookingProblem({ patientName: "Asha Menon", patientPhone: "9876543210" })).toBeNull();
  });

  /**
   * Patients type spaces, dashes and a country code. Rejecting those teaches
   * them nothing and loses the booking.
   */
  it("accepts numbers as people actually type them", () => {
    expect(bookingProblem({ patientName: "Asha", patientPhone: "+91 98765-43210" })).toBeNull();
  });

  it("asks for a name", () => {
    expect(bookingProblem({ patientName: " ", patientPhone: "9876543210" })).toMatch(/full name/i);
    expect(bookingProblem({ patientName: "A", patientPhone: "9876543210" })).toMatch(/full name/i);
  });

  it("asks for a reachable number", () => {
    expect(bookingProblem({ patientName: "Asha", patientPhone: "12345" })).toMatch(/mobile/i);
    expect(bookingProblem({ patientName: "Asha", patientPhone: "1".repeat(16) })).toMatch(
      /longer/i,
    );
  });
});

describe("lastBookableDate", () => {
  it("is bounded, so nobody books against a schedule that does not exist yet", () => {
    expect(lastBookableDate(new Date("2026-01-01T00:00:00Z"))).toBe("2026-03-02");
  });
});
