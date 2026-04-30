/**
 * HR module — employees, attendance, leave, roster, on-call,
 * training, appraisals. Mobile target is shift-start punch + leave
 * request from anywhere.
 */

import { P } from "@medbrains/types";
import type { Module } from "@medbrains/mobile-shell";
import { ModuleHome } from "../components/module-home.js";

function HrScreen() {
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

export const hrModule: Module = {
  id: "hr",
  displayName: "HR",
  icon: () => null,
  requiredPermissions: [P.HR.ATTENDANCE_LIST],
  navigator: HrScreen,
  offlineDocTypes: ["attendance_punch", "leave_request"],
};
