import { Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconCalendar,
  IconClock,
  IconHeartbeat,
  IconIdBadge2,
  IconSchool,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react";
import { useState } from "react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { AttendanceTab } from "./hr/attendance-tab";
import { ComplianceTab } from "./hr/compliance-tab";
import { DutyHoursTab } from "./hr/duty-hours-tab";
import { EmployeesTab } from "./hr/employees-tab";
import { LeaveTab } from "./hr/leave-tab";
import { RosterTab } from "./hr/roster-tab";
import { TrainingTab } from "./hr/training-tab";

export function HrPage() {
  useRequirePermission(P.HR.EMPLOYEES_LIST);

  const canCreateEmployee = useHasPermission(P.HR.EMPLOYEES_CREATE);
  const canManageCredentials = useHasPermission(P.HR.CREDENTIALS_MANAGE);
  const canManageAttendance = useHasPermission(P.HR.ATTENDANCE_MANAGE);
  const canCreateLeave = useHasPermission(P.HR.LEAVE_CREATE);
  const canApproveLeave = useHasPermission(P.HR.LEAVE_APPROVE);
  const canManageRoster = useHasPermission(P.HR.ROSTER_MANAGE);
  const canManageOnCall = useHasPermission(P.HR.ON_CALL_MANAGE);
  const canManageTraining = useHasPermission(P.HR.TRAINING_MANAGE);
  const canManageAppraisal = useHasPermission(P.HR.APPRAISAL_MANAGE);

  const [activeTab, setActiveTab] = useState<string | null>("employees");

  return (
    <div>
      <PageHeader
        title="HR & Staff Management"
        subtitle="Employee directory, attendance, leave, roster, training, and compliance"
        icon={<IconIdBadge2 size={20} stroke={1.5} />}
        color="violet"
      />

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="employees" leftSection={<IconUsers size={16} />}>
            Employees
          </Tabs.Tab>
          <Tabs.Tab value="attendance" leftSection={<IconClock size={16} />}>
            Attendance
          </Tabs.Tab>
          <Tabs.Tab value="duty-hours" leftSection={<IconHeartbeat size={16} />}>
            Duty Hours
          </Tabs.Tab>
          <Tabs.Tab value="leave" leftSection={<IconCalendar size={16} />}>
            Leave
          </Tabs.Tab>
          <Tabs.Tab value="roster" leftSection={<IconCalendar size={16} />}>
            Duty Roster
          </Tabs.Tab>
          <Tabs.Tab value="training" leftSection={<IconSchool size={16} />}>
            Training
          </Tabs.Tab>
          <Tabs.Tab value="compliance" leftSection={<IconShieldCheck size={16} />}>
            Compliance
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="employees">
          <EmployeesTab canCreate={canCreateEmployee} canManageCredentials={canManageCredentials} />
        </Tabs.Panel>
        <Tabs.Panel value="attendance">
          <AttendanceTab canManage={canManageAttendance} />
        </Tabs.Panel>
        <Tabs.Panel value="duty-hours">
          <DutyHoursTab />
        </Tabs.Panel>
        <Tabs.Panel value="leave">
          <LeaveTab canCreate={canCreateLeave} canApprove={canApproveLeave} />
        </Tabs.Panel>
        <Tabs.Panel value="roster">
          <RosterTab canManage={canManageRoster} canManageOnCall={canManageOnCall} />
        </Tabs.Panel>
        <Tabs.Panel value="training">
          <TrainingTab canManage={canManageTraining} />
        </Tabs.Panel>
        <Tabs.Panel value="compliance">
          <ComplianceTab
            canManageCredentials={canManageCredentials}
            canManageAppraisal={canManageAppraisal}
          />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
