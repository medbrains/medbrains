/**
 * The rules behind public appointment booking, kept out of the page.
 *
 * A stranger with no login is filling this in, so the decisions here are about
 * what to refuse and how to say why — which is exactly the part worth testing.
 */

import type { PublicAvailableSlot, PublicBookableDoctor } from "@medbrains/types";

/** How far ahead the public may book. */
export const BOOKING_HORIZON_DAYS = 60;

export interface DepartmentGroup {
  departmentId: string;
  departmentName: string;
  doctors: PublicBookableDoctor[];
}

/**
 * Group the flat directory by department.
 *
 * A patient thinks "I need Orthopaedics", not "I need Dr Rao". One pass with a
 * map rather than a filter per department — the directory is small today and
 * a scan per department is the kind of thing that quietly stops being small.
 */
export function groupByDepartment(doctors: ReadonlyArray<PublicBookableDoctor>): DepartmentGroup[] {
  const groups = new Map<string, DepartmentGroup>();
  for (const doctor of doctors) {
    const existing = groups.get(doctor.department_id);
    if (existing) {
      existing.doctors.push(doctor);
      continue;
    }
    groups.set(doctor.department_id, {
      departmentId: doctor.department_id,
      departmentName: doctor.department_name,
      doctors: [doctor],
    });
  }
  return [...groups.values()];
}

/** `HH:MM:SS` or `HH:MM` as something a person reads. */
export function slotLabel(startTime: string): string {
  const [hourRaw, minute] = startTime.split(":");
  const hour = Number(hourRaw);
  if (!Number.isFinite(hour) || minute === undefined) {
    return startTime;
  }
  const suffix = hour < 12 ? "am" : "pm";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${minute} ${suffix}`;
}

/** Only slots the server marked bookable and that are not already full. */
export function bookableSlots(slots: ReadonlyArray<PublicAvailableSlot>): PublicAvailableSlot[] {
  return slots.filter((slot) => slot.is_available && slot.booked_count < slot.max_patients);
}

export interface BookingDetails {
  patientName: string;
  patientPhone: string;
}

/**
 * Why this booking cannot be submitted yet, or `null`.
 *
 * Phone is checked for digit count rather than a format pattern: patients type
 * spaces, dashes and a country code, and rejecting those teaches them nothing.
 * The hospital rings this number to confirm, so a wrong one is a missed
 * appointment rather than a validation nicety.
 */
export function bookingProblem(details: BookingDetails): string | null {
  if (details.patientName.trim().length < 2) {
    return "Please enter the patient's full name.";
  }
  const digits = details.patientPhone.replace(/\D/g, "");
  if (digits.length < 10) {
    return "Please enter a mobile number the hospital can reach you on.";
  }
  if (digits.length > 15) {
    return "That number is longer than any phone number.";
  }
  return null;
}

/**
 * The last date the public may book.
 *
 * Bounded because a date field with no ceiling invites somebody to book next
 * year against a schedule nobody has planned.
 */
export function lastBookableDate(today: Date): string {
  const last = new Date(today);
  last.setDate(last.getDate() + BOOKING_HORIZON_DAYS);
  return isoDate(last);
}

export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
