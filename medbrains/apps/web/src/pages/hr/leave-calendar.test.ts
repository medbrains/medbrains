import type { Holiday, LeaveRequest } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  approvalAction,
  countOnLeave,
  holidayLabel,
  stepDate,
  toHolidayEvents,
  toLeaveEvents,
  upcomingApproved,
  visibleRange,
} from "./leave-calendar";

function leave(over: Partial<LeaveRequest>): LeaveRequest {
  return {
    id: "l1",
    tenant_id: "t",
    employee_id: "e1",
    leave_type: "casual",
    start_date: "2026-11-02",
    end_date: "2026-11-02",
    days: 1,
    is_half_day: false,
    status: "approved",
    created_at: "",
    updated_at: "",
    ...over,
  };
}

describe("visibleRange", () => {
  it("starts a week on Monday, even from a Sunday", () => {
    // 2026-11-08 is a Sunday: its week is Mon 2 – Sun 8.
    expect(visibleRange("week", "2026-11-08")).toEqual({ from: "2026-11-02", to: "2026-11-08" });
  });

  it("covers the six-week month grid, outside days included", () => {
    // November 2026 starts on a Sunday, so the grid opens on Mon 26 Oct.
    expect(visibleRange("month", "2026-11-15")).toEqual({ from: "2026-10-26", to: "2026-12-06" });
  });

  it("is one day in the day view", () => {
    expect(visibleRange("day", "2026-11-04")).toEqual({ from: "2026-11-04", to: "2026-11-04" });
  });
});

describe("stepDate", () => {
  it("moves by the view's unit", () => {
    expect(stepDate("week", "2026-11-04", 1)).toBe("2026-11-11");
    expect(stepDate("month", "2026-01-31", 1)).toBe("2026-02-28");
    expect(stepDate("day", "2026-11-01", -1)).toBe("2026-10-31");
  });
});

describe("toLeaveEvents", () => {
  it("spans every day of the leave as one all-day block", () => {
    const [e] = toLeaveEvents([leave({ start_date: "2026-11-02", end_date: "2026-11-04" })]);
    expect(e?.start).toBe("2026-11-02 00:00:00");
    expect(e?.end).toBe("2026-11-05 00:00:00");
  });

  it("names status, type and person, so colour is never the only signal", () => {
    const [a, p] = toLeaveEvents([
      { ...leave({ leave_type: "loss_of_pay" }), employee_name: "Asha" },
      { ...leave({ id: "p", status: "pending_hod" }), employee_name: "Ravi" },
    ]);
    expect(a?.title).toBe("Loss of Pay · Asha");
    expect(p?.title).toBe("Pending · Casual · Ravi");
  });

  it("keeps pending and approved apart and leaves rejected and cancelled off", () => {
    const events = toLeaveEvents([
      leave({ id: "a", status: "approved" }),
      leave({ id: "p", status: "pending_admin" }),
      leave({ id: "r", status: "rejected" }),
      leave({ id: "c", status: "cancelled" }),
    ]);
    expect(events.map((e) => [e.id, e.color])).toEqual([
      ["a", "success"],
      ["p", "primary"],
    ]);
  });
});

describe("countOnLeave", () => {
  it("counts people, not leaves, and only approved leave covering the day", () => {
    const rows = [
      leave({ id: "1", employee_id: "e1", start_date: "2026-11-01", end_date: "2026-11-03" }),
      leave({ id: "2", employee_id: "e1", start_date: "2026-11-02", end_date: "2026-11-02" }),
      leave({ id: "3", employee_id: "e2", status: "pending_hod" }),
      leave({ id: "4", employee_id: "e3", start_date: "2026-11-03", end_date: "2026-11-05" }),
    ];
    expect(countOnLeave(rows, "2026-11-02")).toBe(1);
    expect(countOnLeave(rows, "2026-11-03")).toBe(2);
  });
});

describe("upcomingApproved", () => {
  it("lists approved leave not yet over, soonest first, capped", () => {
    const rows = [
      leave({ id: "late", start_date: "2026-12-01", end_date: "2026-12-02" }),
      leave({ id: "now", start_date: "2026-10-30", end_date: "2026-11-02" }),
      leave({ id: "past", start_date: "2026-10-01", end_date: "2026-10-02" }),
      leave({
        id: "pend",
        status: "pending_hod",
        start_date: "2026-11-10",
        end_date: "2026-11-10",
      }),
      leave({ id: "next", start_date: "2026-11-05", end_date: "2026-11-05" }),
    ];
    expect(upcomingApproved(rows, "2026-11-01", 2).map((r) => r.id)).toEqual(["now", "next"]);
  });
});

describe("approvalAction", () => {
  const hr = { canApprove: true, canManage: true, myEmployeeId: "me" };
  const head = { canApprove: true, canManage: false, myEmployeeId: "me" };

  it("lets HR give final approval at either pending stage", () => {
    expect(approvalAction(leave({ status: "pending_hod" }), hr)).toBe("approve");
    expect(approvalAction(leave({ status: "pending_admin" }), hr)).toBe("approve");
  });

  it("lets a department head only forward to HR", () => {
    expect(approvalAction(leave({ status: "pending_hod" }), head)).toBe("approve_hod");
    expect(approvalAction(leave({ status: "pending_admin" }), head)).toBeNull();
  });

  it("never offers approval of your own leave or of decided leave", () => {
    expect(approvalAction(leave({ status: "pending_hod", employee_id: "me" }), hr)).toBeNull();
    expect(approvalAction(leave({ status: "approved" }), hr)).toBeNull();
    expect(
      approvalAction(leave({ status: "pending_hod" }), { ...hr, canApprove: false }),
    ).toBeNull();
  });
});

describe("toHolidayEvents", () => {
  const diwali: Holiday = {
    id: "h1",
    holiday_date: "2026-11-08",
    name: "Diwali",
    kind: "national",
  };

  it("draws one all-day strip on the holiday's date", () => {
    const [e] = toHolidayEvents([diwali]);
    expect(e?.start).toBe("2026-11-08 00:00:00");
    expect(e?.end).toBe("2026-11-09 00:00:00");
    expect(e?.payload).toEqual({ holiday: diwali });
  });

  it("names the holiday in words, and says when it is only optional", () => {
    expect(holidayLabel(diwali)).toBe("Holiday · Diwali");
    expect(holidayLabel({ ...diwali, kind: "restricted" })).toBe("Restricted holiday · Diwali");
  });

  it("keeps holiday ids apart from leave ids", () => {
    expect(toHolidayEvents([diwali])[0]?.id).toBe("holiday-h1");
  });
});
