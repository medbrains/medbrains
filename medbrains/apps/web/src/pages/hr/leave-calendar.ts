// Pure date and layout logic for the leave calendar — no React, so it is tested alone.

import type { ScheduleEventData } from "@mantine/schedule";
import type { Holiday, LeaveRequest } from "@medbrains/types";
import dayjs, { type Dayjs } from "dayjs";
import { LEAVE_TYPE_OPTIONS } from "./leave-options";

export type CalendarView = "day" | "week" | "month";

/** Leave the calendar draws; rejected and cancelled leave live only in the table. */
const PENDING = new Set(["draft", "pending_hod", "pending_admin"]);
const ON_CALENDAR = new Set([...PENDING, "approved"]);
/** MonthView renders six full weeks (consistentWeeks), Monday first. */
const MONTH_GRID_DAYS = 42;
const DATE = "YYYY-MM-DD";

export function isPendingLeave(status: string): boolean {
  return PENDING.has(status);
}

export function leaveTypeLabel(type: string): string {
  return LEAVE_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type.replace(/_/g, " ");
}

function startOfIsoWeek(d: Dayjs): Dayjs {
  return d.subtract((d.day() + 6) % 7, "day").startOf("day");
}

/** The inclusive date window a view shows — what the calendar asks the server for. */
export function visibleRange(view: CalendarView, date: string): { from: string; to: string } {
  const d = dayjs(date);
  if (view === "day") return { from: d.format(DATE), to: d.format(DATE) };
  if (view === "week") {
    const from = startOfIsoWeek(d);
    return { from: from.format(DATE), to: from.add(6, "day").format(DATE) };
  }
  const from = startOfIsoWeek(d.startOf("month"));
  return { from: from.format(DATE), to: from.add(MONTH_GRID_DAYS - 1, "day").format(DATE) };
}

/** The date one step back (-1) or forward (+1) in the current view. */
export function stepDate(view: CalendarView, date: string, dir: 1 | -1): string {
  return dayjs(date).add(dir, view).format(DATE);
}

export type LeaveRow = LeaveRequest & { employee_name?: string };

/**
 * One all-day block per leave: start at the first day's midnight, end at the
 * midnight after the last day, so multi-day leave spans its days. Status
 * picks the theme colour; the block also says it in text and border style.
 */
export function toLeaveEvents<T extends LeaveRow>(rows: T[]): ScheduleEventData<{ leave: T }>[] {
  return rows
    .filter((r) => ON_CALENDAR.has(r.status))
    .map((r) => ({
      id: r.id,
      // The week/day all-day row draws the title alone, so status lives in it too.
      title: [
        isPendingLeave(r.status) ? "Pending" : null,
        leaveTypeLabel(r.leave_type),
        r.employee_name,
      ]
        .filter(Boolean)
        .join(" · "),
      start: `${r.start_date} 00:00:00`,
      end: `${dayjs(r.end_date).add(1, "day").format(DATE)} 00:00:00`,
      color: isPendingLeave(r.status) ? "primary" : "success",
      variant: "light",
      payload: { leave: r },
    }));
}

/** What a calendar block carries: a leave, or a holiday drawn as a strip. */
export type CalendarPayload<T extends LeaveRow> = { leave: T } | { holiday: Holiday };

/** The label a holiday strip reads — words, so the strip never relies on colour. */
export function holidayLabel(h: Holiday): string {
  return h.kind === "restricted" ? `Restricted holiday · ${h.name}` : `Holiday · ${h.name}`;
}

/** One all-day strip per holiday, on its date. */
export function toHolidayEvents(holidays: Holiday[]): ScheduleEventData<{ holiday: Holiday }>[] {
  return holidays.map((h) => ({
    id: `holiday-${h.id}`,
    title: holidayLabel(h),
    start: `${h.holiday_date} 00:00:00`,
    end: `${dayjs(h.holiday_date).add(1, "day").format(DATE)} 00:00:00`,
    color: "warning",
    variant: "light",
    payload: { holiday: h },
  }));
}

/** Whether a leave covers the given day. */
export function coversDay(r: LeaveRequest, day: string): boolean {
  return r.start_date <= day && r.end_date >= day;
}

/** Distinct people on approved leave on `day`. */
export function countOnLeave(rows: LeaveRequest[], day: string): number {
  return new Set(
    rows.filter((r) => r.status === "approved" && coversDay(r, day)).map((r) => r.employee_id),
  ).size;
}

/** Approved leave that has not ended yet, soonest first. */
export function upcomingApproved<T extends LeaveRequest>(
  rows: T[],
  today: string,
  max: number,
): T[] {
  return rows
    .filter((r) => r.status === "approved" && r.end_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, max);
}

export interface ApprovalRights {
  canApprove: boolean;
  /** `hr.leave.manage` — gives the final approval. */
  canManage: boolean;
  myEmployeeId: string | undefined;
}

/**
 * The approve action this viewer may take on a leave, or null. Mirrors the
 * server (which refuses anything else): never your own leave; a department
 * head forwards `pending_hod` to HR; HR approves either pending stage.
 */
export function approvalAction(
  r: LeaveRequest,
  rights: ApprovalRights,
): "approve" | "approve_hod" | null {
  if (!rights.canApprove || r.employee_id === rights.myEmployeeId) return null;
  if (r.status === "pending_hod") return rights.canManage ? "approve" : "approve_hod";
  if (r.status === "pending_admin" && rights.canManage) return "approve";
  return null;
}
