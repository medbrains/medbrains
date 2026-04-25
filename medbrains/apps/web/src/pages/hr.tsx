import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  NumberInput,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCalendar,
  IconCertificate,
  IconCheck,
  IconClock,
  IconIdBadge2,
  IconPencil,
  IconPlus,
  IconSchool,
  IconShieldCheck,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  AttendanceRecord,
  Designation,
  DutyRoster,
  Employee,
  EmployeeCredential,
  LeaveBalance,
  LeaveRequest,
  OnCallSchedule,
  ShiftDefinition,
  TrainingComplianceRow,
  TrainingProgram,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { EmployeeSearchSelect } from "../components/EmployeeSearchSelect";
import { useRequirePermission } from "../hooks/useRequirePermission";

// ── Status colors ────────────────────────────────────────────

const employeeStatusColors: Record<string, string> = {
  active: "success",
  on_leave: "warning",
  suspended: "orange",
  resigned: "slate",
  terminated: "danger",
  retired: "dark",
  absconding: "danger",
};

const leaveStatusColors: Record<string, string> = {
  draft: "slate",
  pending_hod: "primary",
  pending_admin: "primary",
  approved: "success",
  rejected: "danger",
  cancelled: "dark",
};

const credentialStatusColors: Record<string, string> = {
  active: "success",
  expired: "danger",
  suspended: "orange",
  revoked: "danger",
  pending_renewal: "warning",
};

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

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
          <Tabs.Tab value="employees" leftSection={<IconUsers size={16} />}>Employees</Tabs.Tab>
          <Tabs.Tab value="attendance" leftSection={<IconClock size={16} />}>Attendance</Tabs.Tab>
          <Tabs.Tab value="leave" leftSection={<IconCalendar size={16} />}>Leave</Tabs.Tab>
          <Tabs.Tab value="roster" leftSection={<IconCalendar size={16} />}>Duty Roster</Tabs.Tab>
          <Tabs.Tab value="training" leftSection={<IconSchool size={16} />}>Training</Tabs.Tab>
          <Tabs.Tab value="compliance" leftSection={<IconShieldCheck size={16} />}>Compliance</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="employees"><EmployeesTab canCreate={canCreateEmployee} canManageCredentials={canManageCredentials} /></Tabs.Panel>
        <Tabs.Panel value="attendance"><AttendanceTab canManage={canManageAttendance} /></Tabs.Panel>
        <Tabs.Panel value="leave"><LeaveTab canCreate={canCreateLeave} canApprove={canApproveLeave} /></Tabs.Panel>
        <Tabs.Panel value="roster"><RosterTab canManage={canManageRoster} canManageOnCall={canManageOnCall} /></Tabs.Panel>
        <Tabs.Panel value="training"><TrainingTab canManage={canManageTraining} /></Tabs.Panel>
        <Tabs.Panel value="compliance"><ComplianceTab canManageCredentials={canManageCredentials} canManageAppraisal={canManageAppraisal} /></Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Employees Tab
// ══════════════════════════════════════════════════════════

function EmployeesTab({ canCreate, canManageCredentials }: { canCreate: boolean; canManageCredentials: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  // ── Designations ──
  const { data: designations = [] } = useQuery({ queryKey: ["hr-designations"], queryFn: api.listDesignations });
  const [desigOpen, { open: openDesig, close: closeDesig }] = useDisclosure(false);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["hr-employees", search, statusFilter],
    queryFn: () => api.listEmployees({ search: search || undefined, status: statusFilter || undefined }),
  });

  // ── Create employee form state ──
  const [form, setForm] = useState({ employee_code: "", first_name: "", last_name: "", phone: "", email: "", employment_type: "permanent", department_id: "", designation_id: "", date_of_joining: "" });

  const createMut = useMutation({
    mutationFn: () => api.createEmployee({
      employee_code: form.employee_code,
      first_name: form.first_name,
      last_name: form.last_name || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      employment_type: form.employment_type || undefined,
      department_id: form.department_id || undefined,
      designation_id: form.designation_id || undefined,
      date_of_joining: form.date_of_joining || undefined,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-employees"] });
      closeCreate();
      setForm({ employee_code: "", first_name: "", last_name: "", phone: "", email: "", employment_type: "permanent", department_id: "", designation_id: "", date_of_joining: "" });
      notifications.show({ title: "Employee Created", message: "Employee record added", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to create employee", color: "danger" }),
  });

  // ── Designation form ──
  const [desigForm, setDesigForm] = useState({ code: "", name: "", level: 1, category: "clinical" });
  const desigMut = useMutation({
    mutationFn: () => api.createDesignation({ code: desigForm.code, name: desigForm.name, level: desigForm.level, category: desigForm.category }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-designations"] });
      closeDesig();
      setDesigForm({ code: "", name: "", level: 1, category: "clinical" });
      notifications.show({ title: "Designation Created", message: "Designation added", color: "success" });
    },
  });

  return (
    <>
      <Group justify="space-between" mb="md">
        <Group>
          <TextInput placeholder="Search employees..." value={search} onChange={(e) => setSearch(e.currentTarget.value)} style={{ width: 260 }} />
          <Select placeholder="Status" value={statusFilter} onChange={setStatusFilter} clearable data={[
            { value: "active", label: "Active" }, { value: "on_leave", label: "On Leave" },
            { value: "suspended", label: "Suspended" }, { value: "resigned", label: "Resigned" },
            { value: "terminated", label: "Terminated" }, { value: "retired", label: "Retired" },
          ]} />
        </Group>
        <Group>
          {canCreate && <Button leftSection={<IconPlus size={16} />} variant="light" onClick={openDesig}>Add Designation</Button>}
          {canCreate && <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Add Employee</Button>}
        </Group>
      </Group>

      <DataTable
        data={employees}
        loading={isLoading}
        rowKey={(r: Employee) => r.id}
        columns={[
          { key: "employee_code", label: "Code", render: (r: Employee) => <Text size="sm" fw={500}>{r.employee_code}</Text> },
          { key: "name", label: "Name", render: (r: Employee) => <Text size="sm">{r.first_name} {r.last_name || ""}</Text> },
          { key: "employment_type", label: "Type", render: (r: Employee) => <Badge variant="light" size="sm">{r.employment_type.replace(/_/g, " ")}</Badge> },
          { key: "status", label: "Status", render: (r: Employee) => <Badge color={employeeStatusColors[r.status] || "slate"} size="sm">{r.status.replace(/_/g, " ")}</Badge> },
          { key: "phone", label: "Phone", render: (r: Employee) => <Text size="sm">{r.phone || "—"}</Text> },
          { key: "email", label: "Email", render: (r: Employee) => <Text size="sm">{r.email || "—"}</Text> },
          { key: "actions", label: "", render: (r: Employee) => (
            <Tooltip label="View Details">
              <ActionIcon variant="subtle" onClick={() => { setDetailId(r.id); openDetail(); }} aria-label="Edit">
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>
          )},
        ]}
      />

      {/* Create Employee Drawer */}
      <Drawer opened={createOpen} onClose={closeCreate} title="Add Employee" position="right" size="xl">
        <Stack gap="sm">
          <TextInput label="Employee Code" required value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.currentTarget.value })} />
          <TextInput label="First Name" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.currentTarget.value })} />
          <TextInput label="Last Name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.currentTarget.value })} />
          <TextInput label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.currentTarget.value })} />
          <TextInput label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.currentTarget.value })} />
          <Select label="Employment Type" value={form.employment_type} onChange={(v) => setForm({ ...form, employment_type: v || "permanent" })} data={[
            { value: "permanent", label: "Permanent" }, { value: "contract", label: "Contract" },
            { value: "visiting", label: "Visiting" }, { value: "intern", label: "Intern" },
            { value: "resident", label: "Resident" }, { value: "fellow", label: "Fellow" },
            { value: "volunteer", label: "Volunteer" }, { value: "outsourced", label: "Outsourced" },
          ]} />
          <Select label="Designation" value={form.designation_id} onChange={(v) => setForm({ ...form, designation_id: v || "" })} clearable data={designations.map((d: Designation) => ({ value: d.id, label: d.name }))} />
          <TextInput label="Date of Joining" placeholder="YYYY-MM-DD" value={form.date_of_joining} onChange={(e) => setForm({ ...form, date_of_joining: e.currentTarget.value })} />
          <Button onClick={() => createMut.mutate()} loading={createMut.isPending} disabled={!form.employee_code || !form.first_name}>Create Employee</Button>
        </Stack>
      </Drawer>

      {/* Designation Drawer */}
      <Drawer opened={desigOpen} onClose={closeDesig} title="Add Designation" position="right" size="sm">
        <Stack gap="sm">
          <TextInput label="Code" required value={desigForm.code} onChange={(e) => setDesigForm({ ...desigForm, code: e.currentTarget.value })} />
          <TextInput label="Name" required value={desigForm.name} onChange={(e) => setDesigForm({ ...desigForm, name: e.currentTarget.value })} />
          <NumberInput label="Level" value={desigForm.level} onChange={(v) => setDesigForm({ ...desigForm, level: typeof v === "number" ? v : 1 })} />
          <Select label="Category" value={desigForm.category} onChange={(v) => setDesigForm({ ...desigForm, category: v || "clinical" })} data={[
            { value: "clinical", label: "Clinical" }, { value: "administrative", label: "Administrative" }, { value: "support", label: "Support" },
          ]} />
          <Button onClick={() => desigMut.mutate()} loading={desigMut.isPending} disabled={!desigForm.code || !desigForm.name}>Create Designation</Button>
        </Stack>
      </Drawer>

      {/* Employee Detail Drawer */}
      {detailId && <EmployeeDetailDrawer employeeId={detailId} opened={detailOpen} onClose={() => { closeDetail(); setDetailId(null); }} canManageCredentials={canManageCredentials} />}
    </>
  );
}

// ── Employee Detail Drawer ───────────────────────────────────

function EmployeeDetailDrawer({ employeeId, opened, onClose, canManageCredentials }: { employeeId: string; opened: boolean; onClose: () => void; canManageCredentials: boolean }) {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<string | null>("info");

  const { data: employee } = useQuery({ queryKey: ["hr-employee", employeeId], queryFn: () => api.getEmployee(employeeId), enabled: opened });
  const { data: credentials = [] } = useQuery({ queryKey: ["hr-credentials", employeeId], queryFn: () => api.listCredentials(employeeId), enabled: opened });
  const { data: leaveBalances = [] } = useQuery({ queryKey: ["hr-leave-balances", employeeId], queryFn: () => api.listLeaveBalances(employeeId), enabled: opened });

  // ── Add credential ──
  const [credOpen, { open: openCred, close: closeCred }] = useDisclosure(false);
  const [credForm, setCredForm] = useState({ credential_type: "medical_council", issuing_body: "", registration_no: "", state_code: "", expiry_date: "" });
  const credMut = useMutation({
    mutationFn: () => api.createCredential(employeeId, {
      credential_type: credForm.credential_type,
      issuing_body: credForm.issuing_body,
      registration_no: credForm.registration_no,
      state_code: credForm.state_code || undefined,
      expiry_date: credForm.expiry_date || undefined,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-credentials", employeeId] });
      closeCred();
      setCredForm({ credential_type: "medical_council", issuing_body: "", registration_no: "", state_code: "", expiry_date: "" });
      notifications.show({ title: "Credential Added", message: "Credential recorded", color: "success" });
    },
  });

  return (
    <Drawer opened={opened} onClose={onClose} title={employee ? `${employee.first_name} ${employee.last_name || ""}` : "Employee"} position="right" size="lg">
      <Tabs value={subTab} onChange={setSubTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="info">Info</Tabs.Tab>
          <Tabs.Tab value="credentials">Credentials</Tabs.Tab>
          <Tabs.Tab value="leave-balances">Leave Balances</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="info">
          {employee && (
            <Stack gap="xs">
              <Group><Text fw={500} size="sm" w={140}>Code:</Text><Text size="sm">{employee.employee_code}</Text></Group>
              <Group><Text fw={500} size="sm" w={140}>Status:</Text><Badge color={employeeStatusColors[employee.status] || "slate"} size="sm">{employee.status.replace(/_/g, " ")}</Badge></Group>
              <Group><Text fw={500} size="sm" w={140}>Type:</Text><Text size="sm">{employee.employment_type.replace(/_/g, " ")}</Text></Group>
              <Group><Text fw={500} size="sm" w={140}>Phone:</Text><Text size="sm">{employee.phone || "—"}</Text></Group>
              <Group><Text fw={500} size="sm" w={140}>Email:</Text><Text size="sm">{employee.email || "—"}</Text></Group>
              <Group><Text fw={500} size="sm" w={140}>Date of Joining:</Text><Text size="sm">{employee.date_of_joining}</Text></Group>
              <Group><Text fw={500} size="sm" w={140}>Blood Group:</Text><Text size="sm">{employee.blood_group || "—"}</Text></Group>
              <Group><Text fw={500} size="sm" w={140}>PAN:</Text><Text size="sm">{employee.pan_number || "—"}</Text></Group>
              <Group><Text fw={500} size="sm" w={140}>PF Number:</Text><Text size="sm">{employee.pf_number || "—"}</Text></Group>
              <Group><Text fw={500} size="sm" w={140}>ESI Number:</Text><Text size="sm">{employee.esi_number || "—"}</Text></Group>
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="credentials">
          {canManageCredentials && (
            <Button leftSection={<IconPlus size={16} />} mb="md" size="sm" onClick={openCred}>Add Credential</Button>
          )}
          <DataTable
            data={credentials}
            rowKey={(r: EmployeeCredential) => r.id}
            columns={[
              { key: "type", label: "Type", render: (r: EmployeeCredential) => <Text size="sm">{r.credential_type.replace(/_/g, " ")}</Text> },
              { key: "reg", label: "Reg No", render: (r: EmployeeCredential) => <Text size="sm">{r.registration_no}</Text> },
              { key: "body", label: "Issuing Body", render: (r: EmployeeCredential) => <Text size="sm">{r.issuing_body}</Text> },
              { key: "expiry", label: "Expiry", render: (r: EmployeeCredential) => r.expiry_date ? <Text size="sm">{r.expiry_date}</Text> : <Text size="sm" c="dimmed">—</Text> },
              { key: "status", label: "Status", render: (r: EmployeeCredential) => <Badge color={credentialStatusColors[r.status] || "slate"} size="sm">{r.status.replace(/_/g, " ")}</Badge> },
            ]}
          />
          {/* Add Credential sub-drawer */}
          <Drawer opened={credOpen} onClose={closeCred} title="Add Credential" position="right" size="sm">
            <Stack gap="sm">
              <Select label="Credential Type" value={credForm.credential_type} onChange={(v) => setCredForm({ ...credForm, credential_type: v || "medical_council" })} data={[
                { value: "medical_council", label: "Medical Council" }, { value: "nursing_council", label: "Nursing Council" },
                { value: "pharmacy_council", label: "Pharmacy Council" }, { value: "dental_council", label: "Dental Council" },
                { value: "bls", label: "BLS" }, { value: "acls", label: "ACLS" }, { value: "pals", label: "PALS" },
                { value: "fire_safety", label: "Fire Safety" }, { value: "radiation_safety", label: "Radiation Safety" },
                { value: "nabh_orientation", label: "NABH Orientation" },
              ]} />
              <TextInput label="Issuing Body" required value={credForm.issuing_body} onChange={(e) => setCredForm({ ...credForm, issuing_body: e.currentTarget.value })} />
              <TextInput label="Registration No" required value={credForm.registration_no} onChange={(e) => setCredForm({ ...credForm, registration_no: e.currentTarget.value })} />
              <TextInput label="State Code" value={credForm.state_code} onChange={(e) => setCredForm({ ...credForm, state_code: e.currentTarget.value })} />
              <TextInput label="Expiry Date" placeholder="YYYY-MM-DD" value={credForm.expiry_date} onChange={(e) => setCredForm({ ...credForm, expiry_date: e.currentTarget.value })} />
              <Button onClick={() => credMut.mutate()} loading={credMut.isPending} disabled={!credForm.issuing_body || !credForm.registration_no}>Add Credential</Button>
            </Stack>
          </Drawer>
        </Tabs.Panel>

        <Tabs.Panel value="leave-balances">
          <DataTable
            data={leaveBalances}
            rowKey={(r: LeaveBalance) => r.id}
            columns={[
              { key: "type", label: "Leave Type", render: (r: LeaveBalance) => <Badge variant="light" size="sm">{r.leave_type.replace(/_/g, " ")}</Badge> },
              { key: "year", label: "Year", render: (r: LeaveBalance) => <Text size="sm">{r.year}</Text> },
              { key: "opening", label: "Opening", render: (r: LeaveBalance) => <Text size="sm">{r.opening}</Text> },
              { key: "earned", label: "Earned", render: (r: LeaveBalance) => <Text size="sm">{r.earned}</Text> },
              { key: "used", label: "Used", render: (r: LeaveBalance) => <Text size="sm">{r.used}</Text> },
              { key: "balance", label: "Balance", render: (r: LeaveBalance) => <Text size="sm" fw={600} c={Number(r.balance) <= 0 ? "danger" : undefined}>{r.balance}</Text> },
            ]}
          />
        </Tabs.Panel>
      </Tabs>
    </Drawer>
  );
}

// ══════════════════════════════════════════════════════════
//  Attendance Tab
// ══════════════════════════════════════════════════════════

function AttendanceTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["hr-attendance", dateFrom, dateTo],
    queryFn: () => api.listAttendance({ date_from: dateFrom || undefined, date_to: dateTo || undefined }),
  });

  const [form, setForm] = useState({ employee_id: "", attendance_date: "", check_in: "", check_out: "", status: "present", source: "manual" });
  const createMut = useMutation({
    mutationFn: () => api.createAttendance({
      employee_id: form.employee_id,
      attendance_date: form.attendance_date,
      check_in: form.check_in || undefined,
      check_out: form.check_out || undefined,
      status: form.status || undefined,
      source: form.source || undefined,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-attendance"] });
      closeCreate();
      setForm({ employee_id: "", attendance_date: "", check_in: "", check_out: "", status: "present", source: "manual" });
      notifications.show({ title: "Attendance Recorded", message: "Attendance marked", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to record attendance", color: "danger" }),
  });

  return (
    <>
      <Group justify="space-between" mb="md">
        <Group>
          <TextInput placeholder="From (YYYY-MM-DD)" value={dateFrom} onChange={(e) => setDateFrom(e.currentTarget.value)} style={{ width: 160 }} />
          <TextInput placeholder="To (YYYY-MM-DD)" value={dateTo} onChange={(e) => setDateTo(e.currentTarget.value)} style={{ width: 160 }} />
        </Group>
        {canManage && <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Mark Attendance</Button>}
      </Group>

      <DataTable
        data={records}
        loading={isLoading}
        rowKey={(r: AttendanceRecord) => r.id}
        columns={[
          { key: "date", label: "Date", render: (r: AttendanceRecord) => <Text size="sm">{r.attendance_date}</Text> },
          { key: "employee", label: "Employee ID", render: (r: AttendanceRecord) => <Text size="sm" ff="monospace">{r.employee_id.slice(0, 8)}</Text> },
          { key: "check_in", label: "Check In", render: (r: AttendanceRecord) => <Text size="sm">{r.check_in ? new Date(r.check_in).toLocaleTimeString() : "—"}</Text> },
          { key: "check_out", label: "Check Out", render: (r: AttendanceRecord) => <Text size="sm">{r.check_out ? new Date(r.check_out).toLocaleTimeString() : "—"}</Text> },
          { key: "status", label: "Status", render: (r: AttendanceRecord) => <Badge variant="light" size="sm">{r.status}</Badge> },
          { key: "late", label: "Late", render: (r: AttendanceRecord) => r.is_late ? <Badge color="orange" size="sm">{r.late_minutes}m</Badge> : <Text size="sm" c="dimmed">—</Text> },
          { key: "overtime", label: "OT", render: (r: AttendanceRecord) => r.overtime_minutes > 0 ? <Badge color="primary" size="sm">{r.overtime_minutes}m</Badge> : <Text size="sm" c="dimmed">—</Text> },
          { key: "source", label: "Source", render: (r: AttendanceRecord) => <Badge variant="outline" size="sm">{r.source}</Badge> },
        ]}
      />

      <Drawer opened={createOpen} onClose={closeCreate} title="Mark Attendance" position="right" size="xl">
        <Stack gap="sm">
          <EmployeeSearchSelect value={form.employee_id} onChange={(id) => setForm({ ...form, employee_id: id })} required />
          <TextInput label="Date" required placeholder="YYYY-MM-DD" value={form.attendance_date} onChange={(e) => setForm({ ...form, attendance_date: e.currentTarget.value })} />
          <TextInput label="Check In" placeholder="HH:MM (ISO timestamp)" value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.currentTarget.value })} />
          <TextInput label="Check Out" placeholder="HH:MM (ISO timestamp)" value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.currentTarget.value })} />
          <Select label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v || "present" })} data={[
            { value: "present", label: "Present" }, { value: "absent", label: "Absent" },
            { value: "half_day", label: "Half Day" }, { value: "holiday", label: "Holiday" },
            { value: "week_off", label: "Week Off" },
          ]} />
          <Select label="Source" value={form.source} onChange={(v) => setForm({ ...form, source: v || "manual" })} data={[
            { value: "manual", label: "Manual" }, { value: "biometric", label: "Biometric" },
          ]} />
          <Button onClick={() => createMut.mutate()} loading={createMut.isPending} disabled={!form.employee_id || !form.attendance_date}>Record Attendance</Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Leave Tab
// ══════════════════════════════════════════════════════════

function LeaveTab({ canCreate, canApprove }: { canCreate: boolean; canApprove: boolean }) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["hr-leaves", statusFilter],
    queryFn: () => api.listLeaveRequests({ status: statusFilter || undefined }),
  });

  const [form, setForm] = useState({ employee_id: "", leave_type: "casual", start_date: "", end_date: "", days: 1, is_half_day: false, reason: "" });
  const createMut = useMutation({
    mutationFn: () => api.createLeaveRequest({
      employee_id: form.employee_id,
      leave_type: form.leave_type,
      start_date: form.start_date,
      end_date: form.end_date,
      days: form.days,
      is_half_day: form.is_half_day,
      reason: form.reason || undefined,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-leaves"] });
      closeCreate();
      setForm({ employee_id: "", leave_type: "casual", start_date: "", end_date: "", days: 1, is_half_day: false, reason: "" });
      notifications.show({ title: "Leave Applied", message: "Leave request submitted", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to submit leave", color: "danger" }),
  });

  const actionMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.leaveAction(id, { action }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-leaves"] });
      notifications.show({ title: "Leave Updated", message: "Leave status updated", color: "success" });
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => api.cancelLeave(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-leaves"] });
      notifications.show({ title: "Leave Cancelled", message: "Leave request cancelled", color: "orange" });
    },
  });

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select placeholder="Filter by status" value={statusFilter} onChange={setStatusFilter} clearable data={[
          { value: "draft", label: "Draft" }, { value: "pending_hod", label: "Pending HOD" },
          { value: "pending_admin", label: "Pending Admin" }, { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" }, { value: "cancelled", label: "Cancelled" },
        ]} />
        {canCreate && <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Apply Leave</Button>}
      </Group>

      <DataTable
        data={requests}
        loading={isLoading}
        rowKey={(r: LeaveRequest) => r.id}
        columns={[
          { key: "employee", label: "Employee", render: (r: LeaveRequest) => <Text size="sm" ff="monospace">{r.employee_id.slice(0, 8)}</Text> },
          { key: "type", label: "Type", render: (r: LeaveRequest) => <Badge variant="light" size="sm">{r.leave_type.replace(/_/g, " ")}</Badge> },
          { key: "dates", label: "Period", render: (r: LeaveRequest) => <Text size="sm">{r.start_date} → {r.end_date}</Text> },
          { key: "days", label: "Days", render: (r: LeaveRequest) => <Text size="sm">{r.days}{r.is_half_day ? " (½)" : ""}</Text> },
          { key: "status", label: "Status", render: (r: LeaveRequest) => <Badge color={leaveStatusColors[r.status] || "slate"} size="sm">{r.status.replace(/_/g, " ")}</Badge> },
          { key: "reason", label: "Reason", render: (r: LeaveRequest) => <Text size="sm" lineClamp={1}>{r.reason || "—"}</Text> },
          { key: "actions", label: "", render: (r: LeaveRequest) => (
            <Group gap={4}>
              {canApprove && r.status === "pending_hod" && (
                <>
                  <Tooltip label="Approve"><ActionIcon color="success" variant="subtle" onClick={() => actionMut.mutate({ id: r.id, action: "approve" })} aria-label="Confirm"><IconCheck size={16} /></ActionIcon></Tooltip>
                  <Tooltip label="Reject"><ActionIcon color="danger" variant="subtle" onClick={() => actionMut.mutate({ id: r.id, action: "reject" })} aria-label="Close"><IconX size={16} /></ActionIcon></Tooltip>
                </>
              )}
              {(r.status === "draft" || r.status === "pending_hod") && (
                <Tooltip label="Cancel"><ActionIcon color="slate" variant="subtle" onClick={() => cancelMut.mutate(r.id)} aria-label="Close"><IconX size={16} /></ActionIcon></Tooltip>
              )}
            </Group>
          )},
        ]}
      />

      <Drawer opened={createOpen} onClose={closeCreate} title="Apply Leave" position="right" size="xl">
        <Stack gap="sm">
          <EmployeeSearchSelect value={form.employee_id} onChange={(id) => setForm({ ...form, employee_id: id })} required />
          <Select label="Leave Type" value={form.leave_type} onChange={(v) => setForm({ ...form, leave_type: v || "casual" })} data={[
            { value: "casual", label: "Casual" }, { value: "earned", label: "Earned" },
            { value: "medical", label: "Medical" }, { value: "maternity", label: "Maternity" },
            { value: "paternity", label: "Paternity" }, { value: "compensatory", label: "Compensatory" },
            { value: "study", label: "Study" }, { value: "special", label: "Special" },
            { value: "loss_of_pay", label: "Loss of Pay" },
          ]} />
          <TextInput label="Start Date" required placeholder="YYYY-MM-DD" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.currentTarget.value })} />
          <TextInput label="End Date" required placeholder="YYYY-MM-DD" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.currentTarget.value })} />
          <NumberInput label="Days" value={form.days} onChange={(v) => setForm({ ...form, days: typeof v === "number" ? v : 1 })} min={0.5} step={0.5} />
          <Switch label="Half Day" checked={form.is_half_day} onChange={(e) => setForm({ ...form, is_half_day: e.currentTarget.checked })} />
          <Textarea label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.currentTarget.value })} />
          <Button onClick={() => createMut.mutate()} loading={createMut.isPending} disabled={!form.employee_id || !form.start_date || !form.end_date}>Submit Leave</Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Duty Roster Tab
// ══════════════════════════════════════════════════════════

function RosterTab({ canManage, canManageOnCall }: { canManage: boolean; canManageOnCall: boolean }) {
  const qc = useQueryClient();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rosterOpen, { open: openRoster, close: closeRoster }] = useDisclosure(false);
  const [onCallOpen, { open: openOnCall, close: closeOnCall }] = useDisclosure(false);
  const [subTab, setSubTab] = useState<string | null>("roster");

  const { data: shifts = [] } = useQuery({ queryKey: ["hr-shifts"], queryFn: api.listShifts });
  const { data: rosters = [], isLoading: rostersLoading } = useQuery({
    queryKey: ["hr-rosters", dateFrom, dateTo],
    queryFn: () => api.listRosters({ date_from: dateFrom || undefined, date_to: dateTo || undefined }),
  });
  const { data: onCallList = [], isLoading: onCallLoading } = useQuery({
    queryKey: ["hr-on-call"],
    queryFn: () => api.listOnCall({}),
  });

  // ── Shift management ──
  const [shiftOpen, { open: openShift, close: closeShift }] = useDisclosure(false);
  const [shiftForm, setShiftForm] = useState({ code: "", name: "", shift_type: "general", start_time: "09:00", end_time: "17:00", break_minutes: 30, is_night: false });
  const shiftMut = useMutation({
    mutationFn: () => api.createShift({ code: shiftForm.code, name: shiftForm.name, shift_type: shiftForm.shift_type, start_time: shiftForm.start_time, end_time: shiftForm.end_time, break_minutes: shiftForm.break_minutes, is_night: shiftForm.is_night }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["hr-shifts"] }); closeShift(); notifications.show({ title: "Shift Created", message: "Shift definition added", color: "success" }); },
  });

  // ── Create roster entry ──
  const [rosterForm, setRosterForm] = useState({ employee_id: "", shift_id: "", roster_date: "", is_on_call: false });
  const rosterMut = useMutation({
    mutationFn: () => api.createRoster({ employee_id: rosterForm.employee_id, shift_id: rosterForm.shift_id, roster_date: rosterForm.roster_date, is_on_call: rosterForm.is_on_call }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-rosters"] });
      closeRoster();
      setRosterForm({ employee_id: "", shift_id: "", roster_date: "", is_on_call: false });
      notifications.show({ title: "Roster Entry Added", message: "Duty roster updated", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to create roster entry", color: "danger" }),
  });

  // ── Create on-call ──
  const [onCallForm, setOnCallForm] = useState({ employee_id: "", schedule_date: "", start_time: "18:00", end_time: "06:00", is_primary: true, contact_number: "" });
  const onCallMut = useMutation({
    mutationFn: () => api.createOnCall({ employee_id: onCallForm.employee_id, schedule_date: onCallForm.schedule_date, start_time: onCallForm.start_time, end_time: onCallForm.end_time, is_primary: onCallForm.is_primary, contact_number: onCallForm.contact_number || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-on-call"] });
      closeOnCall();
      setOnCallForm({ employee_id: "", schedule_date: "", start_time: "18:00", end_time: "06:00", is_primary: true, contact_number: "" });
      notifications.show({ title: "On-Call Scheduled", message: "On-call schedule added", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to create on-call entry", color: "danger" }),
  });

  const swapMut = useMutation({
    mutationFn: (id: string) => api.approveSwap(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-rosters"] });
      notifications.show({ title: "Swap Approved", message: "Shift swap approved", color: "success" });
    },
  });

  return (
    <>
      <Tabs value={subTab} onChange={setSubTab} variant="outline">
        <Tabs.List mb="md">
          <Tabs.Tab value="roster">Duty Roster</Tabs.Tab>
          <Tabs.Tab value="shifts">Shift Definitions</Tabs.Tab>
          <Tabs.Tab value="on-call">On-Call Schedules</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="roster">
          <Group justify="space-between" mb="md">
            <Group>
              <TextInput placeholder="From (YYYY-MM-DD)" value={dateFrom} onChange={(e) => setDateFrom(e.currentTarget.value)} style={{ width: 160 }} />
              <TextInput placeholder="To (YYYY-MM-DD)" value={dateTo} onChange={(e) => setDateTo(e.currentTarget.value)} style={{ width: 160 }} />
            </Group>
            {canManage && <Button leftSection={<IconPlus size={16} />} onClick={openRoster}>Add Roster Entry</Button>}
          </Group>
          <DataTable
            data={rosters}
            loading={rostersLoading}
            rowKey={(r: DutyRoster) => r.id}
            columns={[
              { key: "date", label: "Date", render: (r: DutyRoster) => <Text size="sm">{r.roster_date}</Text> },
              { key: "employee", label: "Employee", render: (r: DutyRoster) => <Text size="sm" ff="monospace">{r.employee_id.slice(0, 8)}</Text> },
              { key: "shift", label: "Shift", render: (r: DutyRoster) => <Text size="sm" ff="monospace">{r.shift_id.slice(0, 8)}</Text> },
              { key: "on_call", label: "On-Call", render: (r: DutyRoster) => r.is_on_call ? <Badge color="orange" size="sm">Yes</Badge> : <Text size="sm" c="dimmed">No</Text> },
              { key: "swap", label: "Swap", render: (r: DutyRoster) => r.swap_with ? (r.swap_approved ? <Badge color="success" size="sm">Approved</Badge> : <Badge color="warning" size="sm">Pending</Badge>) : <Text size="sm" c="dimmed">—</Text> },
              { key: "actions", label: "", render: (r: DutyRoster) => (
                canManage && r.swap_with && !r.swap_approved ? (
                  <Tooltip label="Approve Swap"><ActionIcon color="success" variant="subtle" onClick={() => swapMut.mutate(r.id)} aria-label="Confirm"><IconCheck size={16} /></ActionIcon></Tooltip>
                ) : null
              )},
            ]}
          />
        </Tabs.Panel>

        <Tabs.Panel value="shifts">
          <Group justify="flex-end" mb="md">
            {canManage && <Button leftSection={<IconPlus size={16} />} onClick={openShift}>Add Shift</Button>}
          </Group>
          <DataTable
            data={shifts}
            rowKey={(r: ShiftDefinition) => r.id}
            columns={[
              { key: "code", label: "Code", render: (r: ShiftDefinition) => <Text size="sm" fw={500}>{r.code}</Text> },
              { key: "name", label: "Name", render: (r: ShiftDefinition) => <Text size="sm">{r.name}</Text> },
              { key: "type", label: "Type", render: (r: ShiftDefinition) => <Badge variant="light" size="sm">{r.shift_type.replace(/_/g, " ")}</Badge> },
              { key: "time", label: "Time", render: (r: ShiftDefinition) => <Text size="sm">{r.start_time} - {r.end_time}</Text> },
              { key: "break", label: "Break", render: (r: ShiftDefinition) => <Text size="sm">{r.break_minutes}m</Text> },
              { key: "night", label: "Night", render: (r: ShiftDefinition) => r.is_night ? <Badge color="primary" size="sm">Night</Badge> : <Text size="sm" c="dimmed">Day</Text> },
              { key: "active", label: "Active", render: (r: ShiftDefinition) => r.is_active ? <Badge color="success" size="sm">Yes</Badge> : <Badge color="slate" size="sm">No</Badge> },
            ]}
          />
        </Tabs.Panel>

        <Tabs.Panel value="on-call">
          <Group justify="flex-end" mb="md">
            {canManageOnCall && <Button leftSection={<IconPlus size={16} />} onClick={openOnCall}>Add On-Call</Button>}
          </Group>
          <DataTable
            data={onCallList}
            loading={onCallLoading}
            rowKey={(r: OnCallSchedule) => r.id}
            columns={[
              { key: "date", label: "Date", render: (r: OnCallSchedule) => <Text size="sm">{r.schedule_date}</Text> },
              { key: "employee", label: "Employee", render: (r: OnCallSchedule) => <Text size="sm" ff="monospace">{r.employee_id.slice(0, 8)}</Text> },
              { key: "time", label: "Time", render: (r: OnCallSchedule) => <Text size="sm">{r.start_time} - {r.end_time}</Text> },
              { key: "primary", label: "Primary", render: (r: OnCallSchedule) => r.is_primary ? <Badge color="success" size="sm">Primary</Badge> : <Badge variant="light" size="sm">Backup</Badge> },
              { key: "contact", label: "Contact", render: (r: OnCallSchedule) => <Text size="sm">{r.contact_number || "—"}</Text> },
            ]}
          />
        </Tabs.Panel>
      </Tabs>

      {/* Create Roster Drawer */}
      <Drawer opened={rosterOpen} onClose={closeRoster} title="Add Roster Entry" position="right" size="xl">
        <Stack gap="sm">
          <EmployeeSearchSelect value={rosterForm.employee_id} onChange={(id) => setRosterForm({ ...rosterForm, employee_id: id })} required />
          <Select label="Shift" required value={rosterForm.shift_id} onChange={(v) => setRosterForm({ ...rosterForm, shift_id: v || "" })} data={shifts.map((s: ShiftDefinition) => ({ value: s.id, label: `${s.name} (${s.start_time}-${s.end_time})` }))} />
          <TextInput label="Date" required placeholder="YYYY-MM-DD" value={rosterForm.roster_date} onChange={(e) => setRosterForm({ ...rosterForm, roster_date: e.currentTarget.value })} />
          <Switch label="On-Call" checked={rosterForm.is_on_call} onChange={(e) => setRosterForm({ ...rosterForm, is_on_call: e.currentTarget.checked })} />
          <Button onClick={() => rosterMut.mutate()} loading={rosterMut.isPending} disabled={!rosterForm.employee_id || !rosterForm.shift_id || !rosterForm.roster_date}>Add to Roster</Button>
        </Stack>
      </Drawer>

      {/* Create Shift Drawer */}
      <Drawer opened={shiftOpen} onClose={closeShift} title="Add Shift Definition" position="right" size="sm">
        <Stack gap="sm">
          <TextInput label="Code" required value={shiftForm.code} onChange={(e) => setShiftForm({ ...shiftForm, code: e.currentTarget.value })} />
          <TextInput label="Name" required value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.currentTarget.value })} />
          <Select label="Type" value={shiftForm.shift_type} onChange={(v) => setShiftForm({ ...shiftForm, shift_type: v || "general" })} data={[
            { value: "morning", label: "Morning" }, { value: "afternoon", label: "Afternoon" },
            { value: "evening", label: "Evening" }, { value: "night", label: "Night" },
            { value: "general", label: "General" }, { value: "split", label: "Split" },
            { value: "on_call", label: "On Call" }, { value: "custom", label: "Custom" },
          ]} />
          <TextInput label="Start Time" required placeholder="HH:MM" value={shiftForm.start_time} onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.currentTarget.value })} />
          <TextInput label="End Time" required placeholder="HH:MM" value={shiftForm.end_time} onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.currentTarget.value })} />
          <NumberInput label="Break (minutes)" value={shiftForm.break_minutes} onChange={(v) => setShiftForm({ ...shiftForm, break_minutes: typeof v === "number" ? v : 30 })} />
          <Switch label="Night Shift" checked={shiftForm.is_night} onChange={(e) => setShiftForm({ ...shiftForm, is_night: e.currentTarget.checked })} />
          <Button onClick={() => shiftMut.mutate()} loading={shiftMut.isPending} disabled={!shiftForm.code || !shiftForm.name}>Create Shift</Button>
        </Stack>
      </Drawer>

      {/* Create On-Call Drawer */}
      <Drawer opened={onCallOpen} onClose={closeOnCall} title="Add On-Call Schedule" position="right" size="xl">
        <Stack gap="sm">
          <EmployeeSearchSelect value={onCallForm.employee_id} onChange={(id) => setOnCallForm({ ...onCallForm, employee_id: id })} required />
          <TextInput label="Date" required placeholder="YYYY-MM-DD" value={onCallForm.schedule_date} onChange={(e) => setOnCallForm({ ...onCallForm, schedule_date: e.currentTarget.value })} />
          <TextInput label="Start Time" required placeholder="HH:MM" value={onCallForm.start_time} onChange={(e) => setOnCallForm({ ...onCallForm, start_time: e.currentTarget.value })} />
          <TextInput label="End Time" required placeholder="HH:MM" value={onCallForm.end_time} onChange={(e) => setOnCallForm({ ...onCallForm, end_time: e.currentTarget.value })} />
          <Switch label="Primary On-Call" checked={onCallForm.is_primary} onChange={(e) => setOnCallForm({ ...onCallForm, is_primary: e.currentTarget.checked })} />
          <TextInput label="Contact Number" value={onCallForm.contact_number} onChange={(e) => setOnCallForm({ ...onCallForm, contact_number: e.currentTarget.value })} />
          <Button onClick={() => onCallMut.mutate()} loading={onCallMut.isPending} disabled={!onCallForm.employee_id || !onCallForm.schedule_date}>Schedule On-Call</Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Training Tab
// ══════════════════════════════════════════════════════════

function TrainingTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [programOpen, { open: openProgram, close: closeProgram }] = useDisclosure(false);
  const [recordOpen, { open: openRecord, close: closeRecord }] = useDisclosure(false);
  const [subView, setSubView] = useState<string>("programs");

  const { data: programs = [], isLoading } = useQuery({ queryKey: ["hr-training-programs"], queryFn: api.listTrainingPrograms });

  const { data: complianceRows = [], isLoading: complianceLoading } = useQuery({
    queryKey: ["hr-training-compliance"],
    queryFn: () => api.trainingCompliance(),
    enabled: subView === "compliance",
  });

  // ── Create program ──
  const [progForm, setProgForm] = useState({ code: "", name: "", description: "", is_mandatory: false, frequency_months: 12, duration_hours: 2 });
  const progMut = useMutation({
    mutationFn: () => api.createTrainingProgram({
      code: progForm.code, name: progForm.name, description: progForm.description || undefined,
      is_mandatory: progForm.is_mandatory, frequency_months: progForm.frequency_months, duration_hours: progForm.duration_hours,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-training-programs"] });
      closeProgram();
      setProgForm({ code: "", name: "", description: "", is_mandatory: false, frequency_months: 12, duration_hours: 2 });
      notifications.show({ title: "Program Created", message: "Training program added", color: "success" });
    },
  });

  // ── Record training ──
  const [recForm, setRecForm] = useState({ employee_id: "", program_id: "", training_date: "", status: "completed", score: 0, certificate_no: "", trainer_name: "" });
  const recMut = useMutation({
    mutationFn: () => api.createTrainingRecord({
      employee_id: recForm.employee_id, program_id: recForm.program_id, training_date: recForm.training_date,
      status: recForm.status || undefined, score: recForm.score || undefined, certificate_no: recForm.certificate_no || undefined,
      trainer_name: recForm.trainer_name || undefined,
    }),
    onSuccess: () => {
      closeRecord();
      setRecForm({ employee_id: "", program_id: "", training_date: "", status: "completed", score: 0, certificate_no: "", trainer_name: "" });
      notifications.show({ title: "Training Recorded", message: "Training record added", color: "success" });
    },
  });

  // ── Compliance stats ──
  const mandatoryRows = complianceRows.filter((r) => r.is_mandatory);
  const mandatoryPct = mandatoryRows.length > 0
    ? mandatoryRows.reduce((sum, r) => sum + r.compliance_pct, 0) / mandatoryRows.length
    : 0;
  const overallPct = complianceRows.length > 0
    ? complianceRows.reduce((sum, r) => sum + r.compliance_pct, 0) / complianceRows.length
    : 0;
  const totalStaff = complianceRows.length > 0 ? (complianceRows[0]?.total_staff ?? 0) : 0;

  return (
    <>
      <Group justify="space-between" mb="md">
        <SegmentedControl
          value={subView}
          onChange={setSubView}
          data={[
            { value: "programs", label: "Programs" },
            { value: "compliance", label: "Training Compliance" },
          ]}
        />
        {canManage && subView === "programs" && (
          <Group gap="xs">
            <Button leftSection={<IconPlus size={16} />} variant="light" onClick={openRecord}>Record Training</Button>
            <Button leftSection={<IconPlus size={16} />} onClick={openProgram}>Add Program</Button>
          </Group>
        )}
      </Group>

      {subView === "programs" && (
        <DataTable
          data={programs}
          loading={isLoading}
          rowKey={(r: TrainingProgram) => r.id}
          columns={[
            { key: "code", label: "Code", render: (r: TrainingProgram) => <Text size="sm" fw={500}>{r.code}</Text> },
            { key: "name", label: "Name", render: (r: TrainingProgram) => <Text size="sm">{r.name}</Text> },
            { key: "mandatory", label: "Mandatory", render: (r: TrainingProgram) => r.is_mandatory ? <Badge color="danger" size="sm">Mandatory</Badge> : <Badge color="slate" variant="light" size="sm">Optional</Badge> },
            { key: "frequency", label: "Frequency", render: (r: TrainingProgram) => <Text size="sm">{r.frequency_months ? `${r.frequency_months}mo` : "—"}</Text> },
            { key: "duration", label: "Duration", render: (r: TrainingProgram) => <Text size="sm">{r.duration_hours ? `${r.duration_hours}h` : "—"}</Text> },
            { key: "active", label: "Active", render: (r: TrainingProgram) => r.is_active ? <Badge color="success" size="sm">Yes</Badge> : <Badge color="slate" size="sm">No</Badge> },
          ]}
        />
      )}

      {subView === "compliance" && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Card withBorder p="md">
              <Text size="xs" c="dimmed">Total Employees</Text>
              <Text fw={700} size="xl">{totalStaff}</Text>
            </Card>
            <Card withBorder p="md">
              <Text size="xs" c="dimmed">Mandatory Compliance</Text>
              <Text fw={700} size="xl" c={mandatoryPct >= 90 ? "success" : mandatoryPct >= 70 ? "warning" : "danger"}>
                {mandatoryPct.toFixed(1)}%
              </Text>
              <Progress value={mandatoryPct} color={mandatoryPct >= 90 ? "success" : mandatoryPct >= 70 ? "warning" : "danger"} size="sm" mt={4} />
            </Card>
            <Card withBorder p="md">
              <Text size="xs" c="dimmed">Overall Compliance</Text>
              <Text fw={700} size="xl" c={overallPct >= 90 ? "success" : overallPct >= 70 ? "warning" : "danger"}>
                {overallPct.toFixed(1)}%
              </Text>
              <Progress value={overallPct} color={overallPct >= 90 ? "success" : overallPct >= 70 ? "warning" : "danger"} size="sm" mt={4} />
            </Card>
          </SimpleGrid>
          <DataTable
            data={complianceRows}
            loading={complianceLoading}
            rowKey={(r: TrainingComplianceRow) => r.program_id}
            columns={[
              { key: "program_name", label: "Program", render: (r: TrainingComplianceRow) => <Text size="sm" fw={500}>{r.program_name}</Text> },
              { key: "mandatory", label: "Type", render: (r: TrainingComplianceRow) => r.is_mandatory ? <Badge color="danger" size="sm">Mandatory</Badge> : <Badge color="slate" variant="light" size="sm">Optional</Badge> },
              { key: "total", label: "Total Staff", render: (r: TrainingComplianceRow) => <Text size="sm">{r.total_staff}</Text> },
              { key: "completed", label: "Completed", render: (r: TrainingComplianceRow) => <Text size="sm">{r.completed}</Text> },
              { key: "pct", label: "Compliance %", render: (r: TrainingComplianceRow) => (
                <Group gap="xs">
                  <Progress value={r.compliance_pct} color={r.compliance_pct >= 90 ? "success" : r.compliance_pct >= 70 ? "warning" : "danger"} size="sm" style={{ width: 80 }} />
                  <Text size="sm" fw={500}>{r.compliance_pct.toFixed(1)}%</Text>
                </Group>
              )},
            ]}
          />
        </Stack>
      )}

      {/* Create Program Drawer */}
      <Drawer opened={programOpen} onClose={closeProgram} title="Add Training Program" position="right" size="xl">
        <Stack gap="sm">
          <TextInput label="Code" required value={progForm.code} onChange={(e) => setProgForm({ ...progForm, code: e.currentTarget.value })} />
          <TextInput label="Name" required value={progForm.name} onChange={(e) => setProgForm({ ...progForm, name: e.currentTarget.value })} />
          <Textarea label="Description" value={progForm.description} onChange={(e) => setProgForm({ ...progForm, description: e.currentTarget.value })} />
          <Switch label="Mandatory" checked={progForm.is_mandatory} onChange={(e) => setProgForm({ ...progForm, is_mandatory: e.currentTarget.checked })} />
          <NumberInput label="Frequency (months)" value={progForm.frequency_months} onChange={(v) => setProgForm({ ...progForm, frequency_months: typeof v === "number" ? v : 12 })} />
          <NumberInput label="Duration (hours)" value={progForm.duration_hours} onChange={(v) => setProgForm({ ...progForm, duration_hours: typeof v === "number" ? v : 2 })} />
          <Button onClick={() => progMut.mutate()} loading={progMut.isPending} disabled={!progForm.code || !progForm.name}>Create Program</Button>
        </Stack>
      </Drawer>

      {/* Record Training Drawer */}
      <Drawer opened={recordOpen} onClose={closeRecord} title="Record Training" position="right" size="xl">
        <Stack gap="sm">
          <EmployeeSearchSelect value={recForm.employee_id} onChange={(id) => setRecForm({ ...recForm, employee_id: id })} required />
          <Select label="Program" required value={recForm.program_id} onChange={(v) => setRecForm({ ...recForm, program_id: v || "" })} data={programs.map((p: TrainingProgram) => ({ value: p.id, label: p.name }))} />
          <TextInput label="Training Date" required placeholder="YYYY-MM-DD" value={recForm.training_date} onChange={(e) => setRecForm({ ...recForm, training_date: e.currentTarget.value })} />
          <Select label="Status" value={recForm.status} onChange={(v) => setRecForm({ ...recForm, status: v || "completed" })} data={[
            { value: "scheduled", label: "Scheduled" }, { value: "in_progress", label: "In Progress" },
            { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" },
            { value: "failed", label: "Failed" },
          ]} />
          <NumberInput label="Score" value={recForm.score} onChange={(v) => setRecForm({ ...recForm, score: typeof v === "number" ? v : 0 })} />
          <TextInput label="Certificate No" value={recForm.certificate_no} onChange={(e) => setRecForm({ ...recForm, certificate_no: e.currentTarget.value })} />
          <TextInput label="Trainer Name" value={recForm.trainer_name} onChange={(e) => setRecForm({ ...recForm, trainer_name: e.currentTarget.value })} />
          <Button onClick={() => recMut.mutate()} loading={recMut.isPending} disabled={!recForm.employee_id || !recForm.program_id || !recForm.training_date}>Record Training</Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Compliance Tab
// ══════════════════════════════════════════════════════════

function ComplianceTab({ canManageCredentials, canManageAppraisal }: { canManageCredentials: boolean; canManageAppraisal: boolean }) {
  const [subTab, setSubTab] = useState<string | null>("credentials");
  const [appraisalOpen, { open: openAppraisal, close: closeAppraisal }] = useDisclosure(false);
  const [statOpen, { open: openStat, close: closeStat }] = useDisclosure(false);

  // For credentials we reuse the employees query and show a summary view
  const { data: employees = [] } = useQuery({
    queryKey: ["hr-employees"],
    queryFn: () => api.listEmployees({}),
  });

  // ── Appraisal form ──
  const [apprForm, setApprForm] = useState({ employee_id: "", appraisal_year: new Date().getFullYear(), rating: 3.0, strengths: "", improvements: "" });
  const apprMut = useMutation({
    mutationFn: () => api.createAppraisal({
      employee_id: apprForm.employee_id, appraisal_year: apprForm.appraisal_year,
      rating: apprForm.rating, strengths: apprForm.strengths || undefined, improvements: apprForm.improvements || undefined,
    }),
    onSuccess: () => {
      closeAppraisal();
      setApprForm({ employee_id: "", appraisal_year: new Date().getFullYear(), rating: 3.0, strengths: "", improvements: "" });
      notifications.show({ title: "Appraisal Created", message: "Appraisal record added", color: "success" });
    },
  });

  // ── Statutory record form ──
  const [statForm, setStatForm] = useState({ employee_id: "", record_type: "posh", title: "", compliance_date: "", expiry_date: "" });
  const statMut = useMutation({
    mutationFn: () => api.createStatutoryRecord({
      employee_id: statForm.employee_id, record_type: statForm.record_type, title: statForm.title,
      compliance_date: statForm.compliance_date || undefined, expiry_date: statForm.expiry_date || undefined,
    }),
    onSuccess: () => {
      closeStat();
      setStatForm({ employee_id: "", record_type: "posh", title: "", compliance_date: "", expiry_date: "" });
      notifications.show({ title: "Record Added", message: "Statutory record created", color: "success" });
    },
  });

  return (
    <Tabs value={subTab} onChange={setSubTab} variant="outline">
      <Tabs.List mb="md">
        <Tabs.Tab value="credentials" leftSection={<IconCertificate size={16} />}>Credential Expiry</Tabs.Tab>
        <Tabs.Tab value="appraisals">Appraisals</Tabs.Tab>
        <Tabs.Tab value="statutory">Statutory Records</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="credentials">
        <Text size="sm" c="dimmed" mb="md">
          View credential expiry status by clicking on individual employees in the Employees tab.
          Employees with expiring credentials will be highlighted below.
        </Text>
        <DataTable
          data={employees}
          rowKey={(r: Employee) => r.id}
          columns={[
            { key: "code", label: "Code", render: (r: Employee) => <Text size="sm" fw={500}>{r.employee_code}</Text> },
            { key: "name", label: "Name", render: (r: Employee) => <Text size="sm">{r.first_name} {r.last_name || ""}</Text> },
            { key: "type", label: "Type", render: (r: Employee) => <Badge variant="light" size="sm">{r.employment_type.replace(/_/g, " ")}</Badge> },
            { key: "status", label: "Status", render: (r: Employee) => <Badge color={employeeStatusColors[r.status] || "slate"} size="sm">{r.status.replace(/_/g, " ")}</Badge> },
          ]}
        />
      </Tabs.Panel>

      <Tabs.Panel value="appraisals">
        <Group justify="flex-end" mb="md">
          {canManageAppraisal && <Button leftSection={<IconPlus size={16} />} onClick={openAppraisal}>Create Appraisal</Button>}
        </Group>
        <Text size="sm" c="dimmed">
          Select an employee in the Employees tab to view their appraisal history.
        </Text>

        <Drawer opened={appraisalOpen} onClose={closeAppraisal} title="Create Appraisal" position="right" size="xl">
          <Stack gap="sm">
            <EmployeeSearchSelect value={apprForm.employee_id} onChange={(id) => setApprForm({ ...apprForm, employee_id: id })} required />
            <NumberInput label="Year" required value={apprForm.appraisal_year} onChange={(v) => setApprForm({ ...apprForm, appraisal_year: typeof v === "number" ? v : new Date().getFullYear() })} />
            <NumberInput label="Rating" value={apprForm.rating} onChange={(v) => setApprForm({ ...apprForm, rating: typeof v === "number" ? v : 3.0 })} min={0} max={5} step={0.5} decimalScale={1} />
            <Textarea label="Strengths" value={apprForm.strengths} onChange={(e) => setApprForm({ ...apprForm, strengths: e.currentTarget.value })} />
            <Textarea label="Areas for Improvement" value={apprForm.improvements} onChange={(e) => setApprForm({ ...apprForm, improvements: e.currentTarget.value })} />
            <Button onClick={() => apprMut.mutate()} loading={apprMut.isPending} disabled={!apprForm.employee_id}>Create Appraisal</Button>
          </Stack>
        </Drawer>
      </Tabs.Panel>

      <Tabs.Panel value="statutory">
        <Group justify="flex-end" mb="md">
          {canManageCredentials && <Button leftSection={<IconPlus size={16} />} onClick={openStat}>Add Statutory Record</Button>}
        </Group>
        <Text size="sm" c="dimmed">
          Track POSH training, fire safety certifications, and other statutory compliance records.
        </Text>

        <Drawer opened={statOpen} onClose={closeStat} title="Add Statutory Record" position="right" size="xl">
          <Stack gap="sm">
            <EmployeeSearchSelect value={statForm.employee_id} onChange={(id) => setStatForm({ ...statForm, employee_id: id })} required />
            <Select label="Record Type" value={statForm.record_type} onChange={(v) => setStatForm({ ...statForm, record_type: v || "posh" })} data={[
              { value: "posh", label: "POSH Training" }, { value: "fire_safety", label: "Fire Safety" },
              { value: "bls_certification", label: "BLS Certification" }, { value: "infection_control", label: "Infection Control" },
              { value: "radiation_safety", label: "Radiation Safety" }, { value: "nrc_verification", label: "NRC Verification" },
              { value: "police_verification", label: "Police Verification" }, { value: "other", label: "Other" },
            ]} />
            <TextInput label="Title" required value={statForm.title} onChange={(e) => setStatForm({ ...statForm, title: e.currentTarget.value })} />
            <TextInput label="Compliance Date" placeholder="YYYY-MM-DD" value={statForm.compliance_date} onChange={(e) => setStatForm({ ...statForm, compliance_date: e.currentTarget.value })} />
            <TextInput label="Expiry Date" placeholder="YYYY-MM-DD" value={statForm.expiry_date} onChange={(e) => setStatForm({ ...statForm, expiry_date: e.currentTarget.value })} />
            <Button onClick={() => statMut.mutate()} loading={statMut.isPending} disabled={!statForm.employee_id || !statForm.title}>Add Record</Button>
          </Stack>
        </Drawer>
      </Tabs.Panel>
    </Tabs>
  );
}
