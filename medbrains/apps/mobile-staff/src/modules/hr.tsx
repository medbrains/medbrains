/**
 * HR module — employees, attendance, leave, roster, on-call,
 * training, appraisals. Mobile target is shift-start punch + leave
 * request from anywhere.
 */

import type { ReactNode } from "react";
import { P } from "@medbrains/types";
import type { Module } from "@medbrains/mobile-shell";
import type { IntentTone } from "@medbrains/ui-mobile";
import { ModuleHome } from "../components/module-home.js";
import { ModuleRouter, useModuleRouter } from "../components/module-router.js";
import { EntityListScreen } from "../components/entity-list.js";
import { EntityRow } from "../components/entity-row.js";
import { listAttendance } from "../api/hr.js";

const STATUS_TONE: Record<string, IntentTone> = {
  present: "success",
  absent: "alert",
  late: "warn",
  on_leave: "info",
  weekly_off: "neutral",
};

function HrHome(): ReactNode {
  const router = useModuleRouter();
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="HR"
      description="Attendance, leave, roster, training."
      summaries={[
        { eyebrow: "TODAY", count: "—", title: "Punched-in staff" },
        { eyebrow: "LEAVE", count: "—", title: "Pending approvals" },
      ]}
      actions={[
        {
          id: "attendance",
          label: "Attendance",
          description: "Today's punch register.",
          permission: P.HR.ATTENDANCE_LIST,
          onPress: () => router.push("attendance"),
        },
        {
          id: "punch",
          label: "Punch in / out",
          description: "Shift attendance with location stamp.",
          permission: P.HR.ATTENDANCE_MANAGE,
        },
        {
          id: "leave",
          label: "Apply / approve leave",
          description: "Casual, sick, earned, comp-off.",
          permission: P.HR.LEAVE_LIST,
        },
        {
          id: "roster",
          label: "Duty roster",
          description: "Shift swap + on-call schedule.",
          permission: P.HR.ROSTER_LIST,
        },
        {
          id: "training",
          label: "Training",
          description: "Mandatory cert tracking.",
          permission: P.HR.TRAINING_LIST,
        },
        {
          id: "credentials",
          label: "Credentials",
          description: "Licences expiring soon.",
          permission: P.HR.CREDENTIALS_LIST,
        },
      ]}
    />
  );
}

function AttendanceScreen(): ReactNode {
  return (
    <EntityListScreen
      eyebrow="HR"
      title="Attendance"
      fetcher={() => listAttendance()}
      rowKey={(a) => a.id}
      renderRow={(a) => (
        <EntityRow
          title={a.employee_name}
          subtitle={`${a.shift_date} · in ${a.punch_in_at ?? "—"} · out ${a.punch_out_at ?? "—"}`}
          badge={{ label: a.status, tone: STATUS_TONE[a.status] ?? "neutral" }}
        />
      )}
      emptyTitle="No attendance records"
    />
  );
}

function HrScreen(): ReactNode {
  return (
    <ModuleRouter
      initial="home"
      screens={{ home: <HrHome />, attendance: <AttendanceScreen /> }}
    />
  );
}

export const hrModule: Module = {
  id: "hr",
  displayName: "HR",
  icon: () => null,
  requiredPermissions: [P.HR.ATTENDANCE_LIST],
  navigator: HrScreen,
  offlineDocTypes: ["attendance_punch", "leave_request"],
};
