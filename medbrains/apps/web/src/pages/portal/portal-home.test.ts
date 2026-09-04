import { describe, expect, it } from "vitest";
import { portalWaiting } from "./portal-home";

/**
 * What the portal tells a frightened person first.
 *
 * The failure that matters is claiming nothing is waiting when something is —
 * a patient who reads "nothing needs you today" stops looking.
 */
const NOW = new Date("2026-09-10T12:00:00Z").getTime();
const day = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

const report = (reported_at: string) =>
  ({
    order_id: "o",
    test_name: "FBC",
    parameter_name: "Hb",
    value: "9",
    unit: "g/dL",
    normal_range: "12-15",
    flag: "low",
    reported_at,
  }) as never;
const appt = (appointment_date: string, status = "scheduled") =>
  ({ id: appointment_date, appointment_date, status, department_name: "Medicine" }) as never;
const bill = (balance_due: string) =>
  ({
    id: balance_due,
    invoice_number: "INV",
    status: "unpaid",
    total_amount: "100",
    paid_amount: "0",
    balance_due,
    created_at: day(-1),
  }) as never;

describe("what is waiting for the patient", () => {
  const none = { reports: [], appointments: [], bills: [] };

  it("says nothing is waiting only when nothing is", () => {
    expect(portalWaiting(none, NOW).nothingWaiting).toBe(true);
  });

  it("counts a result released this week as waiting", () => {
    const w = portalWaiting({ ...none, reports: [report(day(-2))] }, NOW);
    expect(w.newResults).toHaveLength(1);
    expect(w.nothingWaiting).toBe(false);
  });

  it("does not present a result from last month as new", () => {
    expect(portalWaiting({ ...none, reports: [report(day(-30))] }, NOW).newResults).toHaveLength(0);
  });

  it("never treats a future-dated result as released", () => {
    // A clock skew must not announce a result the lab has not reported.
    expect(portalWaiting({ ...none, reports: [report(day(2))] }, NOW).newResults).toHaveLength(0);
  });

  it("picks the soonest appointment still to come, not the earliest on record", () => {
    const w = portalWaiting(
      { ...none, appointments: [appt(day(-5)), appt(day(9)), appt(day(3))] },
      NOW,
    );
    expect(w.nextAppointment?.appointment_date).toBe(day(3));
  });

  it("does not offer a cancelled appointment as the next one", () => {
    const w = portalWaiting(
      { ...none, appointments: [appt(day(2), "cancelled"), appt(day(6))] },
      NOW,
    );
    expect(w.nextAppointment?.appointment_date).toBe(day(6));
  });

  it("adds up what is owed and ignores credits", () => {
    const w = portalWaiting({ ...none, bills: [bill("250.50"), bill("0"), bill("-40")] }, NOW);
    expect(w.amountOwed).toBeCloseTo(250.5);
    expect(w.nothingWaiting).toBe(false);
  });
});
