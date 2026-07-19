import {
  Drawer,
  Group,
  NumberInput,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  AttendanceRecord,
  Designation,
  DutyHoursRow,
  Employee,
  EmployeeCredential,
  LeaveBalance,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconCalendar,
  IconClock,
  IconHeartbeat,
  IconIdBadge2,
  IconPencil,
  IconPlus,
  IconSchool,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, Button, IconButton, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { hrService } from "@/services/hr.service";
import { ComplianceTab } from "./hr/compliance-tab";
import { LeaveTab } from "./hr/leave-tab";
import { RosterTab } from "./hr/roster-tab";
import { statusBadgeTone } from "./hr/shared";
import { TrainingTab } from "./hr/training-tab";

// ── Status colors ────────────────────────────────────────────

// Local map: shared `statusColor` returns Mantine color names; convert to BadgeTone at Badge call sites.
// Roles an HR admin may provision via the employee form (admin roles excluded on purpose).
const PROVISION_ROLE_OPTIONS = [
  "doctor",
  "nurse",
  "receptionist",
  "lab_technician",
  "pharmacist",
  "billing_clerk",
  "housekeeping_staff",
  "facilities_manager",
  "audit_officer",
].map((r) => ({ value: r, label: r.replace(/_/g, " ") }));

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

// ══════════════════════════════════════════════════════════
//  Employees Tab
// ══════════════════════════════════════════════════════════

function EmployeesTab({
  canCreate,
  canManageCredentials,
}: {
  canCreate: boolean;
  canManageCredentials: boolean;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  // ── Designations ──
  const { data: designations = [] } = useQuery({
    queryKey: ["hr-designations"],
    queryFn: hrService.listDesignations,
  });
  const [desigOpen, { open: openDesig, close: closeDesig }] = useDisclosure(false);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["hr-employees", search, statusFilter],
    queryFn: () =>
      hrService.listEmployees({ search: search || undefined, status: statusFilter || undefined }),
  });

  // ── Create employee form state ──
  const [form, setForm] = useState({
    employee_code: "",
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    employment_type: "permanent",
    department_id: "",
    designation_id: "",
    date_of_joining: "",
    provision_login: false,
    login_username: "",
    login_password: "",
    login_role: "",
  });

  const createMut = useMutation({
    mutationFn: () =>
      hrService.createEmployee({
        employee_code: form.employee_code,
        first_name: form.first_name,
        last_name: form.last_name || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        employment_type: form.employment_type || undefined,
        department_id: form.department_id || undefined,
        designation_id: form.designation_id || undefined,
        date_of_joining: form.date_of_joining || undefined,
        provision_login: form.provision_login || undefined,
        login_username: form.provision_login ? form.login_username : undefined,
        login_password: form.provision_login ? form.login_password : undefined,
        login_role: form.provision_login ? form.login_role : undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-employees"] });
      closeCreate();
      setForm({
        employee_code: "",
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        employment_type: "permanent",
        department_id: "",
        designation_id: "",
        date_of_joining: "",
        provision_login: false,
        login_username: "",
        login_password: "",
        login_role: "",
      });
      toast.success("Employee record added", { title: "Employee Created" });
    },
    onError: () => toast.error("Failed to create employee", { title: "Error" }),
  });

  // ── Designation form ──
  const [desigForm, setDesigForm] = useState({
    code: "",
    name: "",
    level: 1,
    category: "clinical",
  });
  const desigMut = useMutation({
    mutationFn: () =>
      hrService.createDesignation({
        code: desigForm.code,
        name: desigForm.name,
        level: desigForm.level,
        category: desigForm.category,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-designations"] });
      closeDesig();
      setDesigForm({ code: "", name: "", level: 1, category: "clinical" });
      toast.success("Designation added", { title: "Designation Created" });
    },
  });

  return (
    <>
      <Group justify="space-between" mb="md">
        <Group>
          <TextInput
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ width: 260 }}
          />
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            data={[
              { value: "active", label: "Active" },
              { value: "on_leave", label: "On Leave" },
              { value: "suspended", label: "Suspended" },
              { value: "resigned", label: "Resigned" },
              { value: "terminated", label: "Terminated" },
              { value: "retired", label: "Retired" },
            ]}
          />
        </Group>
        <Group>
          {canCreate && (
            <Button tone="secondary" leftSection={<IconPlus size={16} />} onClick={openDesig}>
              Add Designation
            </Button>
          )}
          {canCreate && (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
              Add Employee
            </Button>
          )}
        </Group>
      </Group>

      <DataTable
        data={employees}
        loading={isLoading}
        rowKey={(r: Employee) => r.id}
        columns={[
          {
            key: "employee_code",
            label: "Code",
            render: (r: Employee) => (
              <Text size="sm" fw={500}>
                {r.employee_code}
              </Text>
            ),
          },
          {
            key: "name",
            label: "Name",
            render: (r: Employee) => (
              <Text size="sm">
                {r.first_name} {r.last_name || ""}
              </Text>
            ),
          },
          {
            key: "employment_type",
            label: "Type",
            render: (r: Employee) => (
              <Badge size="sm">{r.employment_type.replace(/_/g, " ")}</Badge>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r: Employee) => (
              <Badge tone={statusBadgeTone(r.status)} size="sm">
                {r.status.replace(/_/g, " ")}
              </Badge>
            ),
          },
          {
            key: "phone",
            label: "Phone",
            render: (r: Employee) => <Text size="sm">{r.phone || "—"}</Text>,
          },
          {
            key: "email",
            label: "Email",
            render: (r: Employee) => <Text size="sm">{r.email || "—"}</Text>,
          },
          {
            key: "actions",
            label: "",
            render: (r: Employee) => (
              <Tooltip label="View Details">
                <IconButton
                  onClick={() => {
                    setDetailId(r.id);
                    openDetail();
                  }}
                  aria-label="Edit"
                >
                  <IconPencil size={16} />
                </IconButton>
              </Tooltip>
            ),
          },
        ]}
      />

      {/* Create Employee Drawer */}
      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="Add Employee"
        position="right"
        size="xl"
      >
        <Stack gap="sm">
          <TextInput
            label="Employee Code"
            required
            value={form.employee_code}
            onChange={(e) => setForm({ ...form, employee_code: e.currentTarget.value })}
          />
          <TextInput
            label="First Name"
            required
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.currentTarget.value })}
          />
          <TextInput
            label="Last Name"
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.currentTarget.value })}
          />
          <TextInput
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.currentTarget.value })}
          />
          <TextInput
            label="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.currentTarget.value })}
          />
          <Select
            label="Employment Type"
            value={form.employment_type}
            onChange={(v) => setForm({ ...form, employment_type: v || "permanent" })}
            data={[
              { value: "permanent", label: "Permanent" },
              { value: "contract", label: "Contract" },
              { value: "visiting", label: "Visiting" },
              { value: "intern", label: "Intern" },
              { value: "resident", label: "Resident" },
              { value: "fellow", label: "Fellow" },
              { value: "volunteer", label: "Volunteer" },
              { value: "outsourced", label: "Outsourced" },
            ]}
          />
          <Select
            label="Designation"
            value={form.designation_id}
            onChange={(v) => setForm({ ...form, designation_id: v || "" })}
            clearable
            data={designations.map((d: Designation) => ({ value: d.id, label: d.name }))}
          />
          <TextInput
            label="Date of Joining"
            placeholder="YYYY-MM-DD"
            value={form.date_of_joining}
            onChange={(e) => setForm({ ...form, date_of_joining: e.currentTarget.value })}
          />
          <Switch
            label="Create a login for this employee"
            checked={form.provision_login}
            onChange={(e) => setForm({ ...form, provision_login: e.currentTarget.checked })}
          />
          {form.provision_login && (
            <>
              <TextInput
                label="Login username"
                value={form.login_username}
                onChange={(e) => setForm({ ...form, login_username: e.currentTarget.value })}
              />
              <PasswordInput
                label="Temporary password"
                description="They'll be asked to change it on first sign-in"
                value={form.login_password}
                onChange={(e) => setForm({ ...form, login_password: e.currentTarget.value })}
              />
              <Select
                label="Role"
                data={PROVISION_ROLE_OPTIONS}
                value={form.login_role || null}
                onChange={(v) => setForm({ ...form, login_role: v ?? "" })}
              />
            </>
          )}
          <Button
            tone="primary"
            onClick={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={
              !form.employee_code ||
              !form.first_name ||
              (form.provision_login &&
                (!form.login_username || !form.login_password || !form.login_role))
            }
          >
            Create Employee
          </Button>
        </Stack>
      </Drawer>

      {/* Designation Drawer */}
      <Drawer
        opened={desigOpen}
        onClose={closeDesig}
        title="Add Designation"
        position="right"
        size="sm"
      >
        <Stack gap="sm">
          <TextInput
            label="Code"
            required
            value={desigForm.code}
            onChange={(e) => setDesigForm({ ...desigForm, code: e.currentTarget.value })}
          />
          <TextInput
            label="Name"
            required
            value={desigForm.name}
            onChange={(e) => setDesigForm({ ...desigForm, name: e.currentTarget.value })}
          />
          <NumberInput
            label="Level"
            value={desigForm.level}
            onChange={(v) => setDesigForm({ ...desigForm, level: typeof v === "number" ? v : 1 })}
          />
          <Select
            label="Category"
            value={desigForm.category}
            onChange={(v) => setDesigForm({ ...desigForm, category: v || "clinical" })}
            data={[
              { value: "clinical", label: "Clinical" },
              { value: "administrative", label: "Administrative" },
              { value: "support", label: "Support" },
            ]}
          />
          <Button
            tone="primary"
            onClick={() => desigMut.mutate()}
            loading={desigMut.isPending}
            disabled={!desigForm.code || !desigForm.name}
          >
            Create Designation
          </Button>
        </Stack>
      </Drawer>

      {/* Employee Detail Drawer */}
      {detailId && (
        <EmployeeDetailDrawer
          employeeId={detailId}
          opened={detailOpen}
          onClose={() => {
            closeDetail();
            setDetailId(null);
          }}
          canManageCredentials={canManageCredentials}
        />
      )}
    </>
  );
}

// ── Employee Detail Drawer ───────────────────────────────────

function EmployeeDetailDrawer({
  employeeId,
  opened,
  onClose,
  canManageCredentials,
}: {
  employeeId: string;
  opened: boolean;
  onClose: () => void;
  canManageCredentials: boolean;
}) {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<string | null>("info");

  const { data: employee } = useQuery({
    queryKey: ["hr-employee", employeeId],
    queryFn: () => hrService.getEmployee(employeeId),
    enabled: opened,
  });
  const { data: credentials = [] } = useQuery({
    queryKey: ["hr-credentials", employeeId],
    queryFn: () => hrService.listCredentials(employeeId),
    enabled: opened,
  });
  const { data: leaveBalances = [] } = useQuery({
    queryKey: ["hr-leave-balances", employeeId],
    queryFn: () => hrService.listLeaveBalances(employeeId),
    enabled: opened,
  });

  // ── Add credential ──
  const [credOpen, { open: openCred, close: closeCred }] = useDisclosure(false);
  const [credForm, setCredForm] = useState({
    credential_type: "medical_council",
    issuing_body: "",
    registration_no: "",
    state_code: "",
    expiry_date: "",
  });
  const credMut = useMutation({
    mutationFn: () =>
      hrService.createCredential(employeeId, {
        credential_type: credForm.credential_type,
        issuing_body: credForm.issuing_body,
        registration_no: credForm.registration_no,
        state_code: credForm.state_code || undefined,
        expiry_date: credForm.expiry_date || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-credentials", employeeId] });
      closeCred();
      setCredForm({
        credential_type: "medical_council",
        issuing_body: "",
        registration_no: "",
        state_code: "",
        expiry_date: "",
      });
      toast.success("Credential recorded", { title: "Credential Added" });
    },
  });

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={employee ? `${employee.first_name} ${employee.last_name || ""}` : "Employee"}
      position="right"
      size="lg"
    >
      <Tabs value={subTab} onChange={setSubTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="info">Info</Tabs.Tab>
          <Tabs.Tab value="credentials">Credentials</Tabs.Tab>
          <Tabs.Tab value="leave-balances">Leave Balances</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="info">
          {employee && (
            <Stack gap="xs">
              <Group>
                <Text fw={500} size="sm" w={140}>
                  Code:
                </Text>
                <Text size="sm">{employee.employee_code}</Text>
              </Group>
              <Group>
                <Text fw={500} size="sm" w={140}>
                  Status:
                </Text>
                <Badge tone={statusBadgeTone(employee.status)} size="sm">
                  {employee.status.replace(/_/g, " ")}
                </Badge>
              </Group>
              <Group>
                <Text fw={500} size="sm" w={140}>
                  Type:
                </Text>
                <Text size="sm">{employee.employment_type.replace(/_/g, " ")}</Text>
              </Group>
              <Group>
                <Text fw={500} size="sm" w={140}>
                  Phone:
                </Text>
                <Text size="sm">{employee.phone || "—"}</Text>
              </Group>
              <Group>
                <Text fw={500} size="sm" w={140}>
                  Email:
                </Text>
                <Text size="sm">{employee.email || "—"}</Text>
              </Group>
              <Group>
                <Text fw={500} size="sm" w={140}>
                  Date of Joining:
                </Text>
                <Text size="sm">{employee.date_of_joining}</Text>
              </Group>
              <Group>
                <Text fw={500} size="sm" w={140}>
                  Blood Group:
                </Text>
                <Text size="sm">{employee.blood_group || "—"}</Text>
              </Group>
              <Group>
                <Text fw={500} size="sm" w={140}>
                  PAN:
                </Text>
                <Text size="sm">{employee.pan_number || "—"}</Text>
              </Group>
              <Group>
                <Text fw={500} size="sm" w={140}>
                  PF Number:
                </Text>
                <Text size="sm">{employee.pf_number || "—"}</Text>
              </Group>
              <Group>
                <Text fw={500} size="sm" w={140}>
                  ESI Number:
                </Text>
                <Text size="sm">{employee.esi_number || "—"}</Text>
              </Group>
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="credentials">
          {canManageCredentials && (
            <Button
              tone="primary"
              leftSection={<IconPlus size={16} />}
              mb="md"
              size="sm"
              onClick={openCred}
            >
              Add Credential
            </Button>
          )}
          <DataTable
            data={credentials}
            rowKey={(r: EmployeeCredential) => r.id}
            columns={[
              {
                key: "type",
                label: "Type",
                render: (r: EmployeeCredential) => (
                  <Text size="sm">{r.credential_type.replace(/_/g, " ")}</Text>
                ),
              },
              {
                key: "reg",
                label: "Reg No",
                render: (r: EmployeeCredential) => <Text size="sm">{r.registration_no}</Text>,
              },
              {
                key: "body",
                label: "Issuing Body",
                render: (r: EmployeeCredential) => <Text size="sm">{r.issuing_body}</Text>,
              },
              {
                key: "expiry",
                label: "Expiry",
                render: (r: EmployeeCredential) =>
                  r.expiry_date ? (
                    <Text size="sm">{r.expiry_date}</Text>
                  ) : (
                    <Text size="sm" c="dimmed">
                      —
                    </Text>
                  ),
              },
              {
                key: "status",
                label: "Status",
                render: (r: EmployeeCredential) => (
                  <Badge tone={statusBadgeTone(r.status)} size="sm">
                    {r.status.replace(/_/g, " ")}
                  </Badge>
                ),
              },
            ]}
          />
          {/* Add Credential sub-drawer */}
          <Drawer
            opened={credOpen}
            onClose={closeCred}
            title="Add Credential"
            position="right"
            size="sm"
          >
            <Stack gap="sm">
              <Select
                label="Credential Type"
                value={credForm.credential_type}
                onChange={(v) =>
                  setCredForm({ ...credForm, credential_type: v || "medical_council" })
                }
                data={[
                  { value: "medical_council", label: "Medical Council" },
                  { value: "nursing_council", label: "Nursing Council" },
                  { value: "pharmacy_council", label: "Pharmacy Council" },
                  { value: "dental_council", label: "Dental Council" },
                  { value: "bls", label: "BLS" },
                  { value: "acls", label: "ACLS" },
                  { value: "pals", label: "PALS" },
                  { value: "fire_safety", label: "Fire Safety" },
                  { value: "radiation_safety", label: "Radiation Safety" },
                  { value: "nabh_orientation", label: "NABH Orientation" },
                ]}
              />
              <TextInput
                label="Issuing Body"
                required
                value={credForm.issuing_body}
                onChange={(e) => setCredForm({ ...credForm, issuing_body: e.currentTarget.value })}
              />
              <TextInput
                label="Registration No"
                required
                value={credForm.registration_no}
                onChange={(e) =>
                  setCredForm({ ...credForm, registration_no: e.currentTarget.value })
                }
              />
              <TextInput
                label="State Code"
                value={credForm.state_code}
                onChange={(e) => setCredForm({ ...credForm, state_code: e.currentTarget.value })}
              />
              <TextInput
                label="Expiry Date"
                placeholder="YYYY-MM-DD"
                value={credForm.expiry_date}
                onChange={(e) => setCredForm({ ...credForm, expiry_date: e.currentTarget.value })}
              />
              <Button
                tone="primary"
                onClick={() => credMut.mutate()}
                loading={credMut.isPending}
                disabled={!credForm.issuing_body || !credForm.registration_no}
              >
                Add Credential
              </Button>
            </Stack>
          </Drawer>
        </Tabs.Panel>

        <Tabs.Panel value="leave-balances">
          <DataTable
            data={leaveBalances}
            rowKey={(r: LeaveBalance) => r.id}
            columns={[
              {
                key: "type",
                label: "Leave Type",
                render: (r: LeaveBalance) => (
                  <Badge size="sm">{r.leave_type.replace(/_/g, " ")}</Badge>
                ),
              },
              {
                key: "year",
                label: "Year",
                render: (r: LeaveBalance) => <Text size="sm">{r.year}</Text>,
              },
              {
                key: "opening",
                label: "Opening",
                render: (r: LeaveBalance) => <Text size="sm">{r.opening}</Text>,
              },
              {
                key: "earned",
                label: "Earned",
                render: (r: LeaveBalance) => <Text size="sm">{r.earned}</Text>,
              },
              {
                key: "used",
                label: "Used",
                render: (r: LeaveBalance) => <Text size="sm">{r.used}</Text>,
              },
              {
                key: "balance",
                label: "Balance",
                render: (r: LeaveBalance) => (
                  <Text size="sm" fw={600} c={Number(r.balance) <= 0 ? "danger" : undefined}>
                    {r.balance}
                  </Text>
                ),
              },
            ]}
          />
        </Tabs.Panel>
      </Tabs>
    </Drawer>
  );
}

// ══════════════════════════════════════════════════════════
//  Duty Hours / WLB Tab
// ══════════════════════════════════════════════════════════

const FATIGUE_FLAG_LABEL: Record<string, string> = {
  long_continuous: "12h+ continuous",
  short_rest: "<8h rest",
  heavy_week: "60h+ this week",
};

function DutyHoursTab() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["hr-duty-hours"],
    queryFn: () => hrService.listDutyHours(),
  });

  const columns = [
    {
      key: "employee_name",
      label: "Staff",
      render: (r: DutyHoursRow) => <Text fw={500}>{r.employee_name}</Text>,
    },
    {
      key: "session_status",
      label: "On shift",
      render: (r: DutyHoursRow) =>
        r.session_status ? (
          <Badge tone={r.session_status === "paused" ? "warning" : "success"} size="sm">
            {r.session_status === "paused" ? "Paused" : "On duty"}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ),
    },
    {
      key: "shift_end",
      label: "Ends",
      render: (r: DutyHoursRow) => (
        <Text size="sm">
          {r.shift_end
            ? new Date(r.shift_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "—"}
        </Text>
      ),
    },
    {
      key: "continuous_h",
      label: "Continuous",
      render: (r: DutyHoursRow) => <Text size="sm">{r.continuous_h.toFixed(1)}h</Text>,
    },
    {
      key: "week_h",
      label: "7-day",
      render: (r: DutyHoursRow) => <Text size="sm">{r.week_h.toFixed(1)}h</Text>,
    },
    {
      key: "overtime_h",
      label: "Overtime",
      render: (r: DutyHoursRow) => <Text size="sm">{r.overtime_h.toFixed(1)}h</Text>,
    },
    {
      key: "flags",
      label: "Fatigue",
      render: (r: DutyHoursRow) =>
        r.flags.length > 0 ? (
          <Group gap={4}>
            {r.flags.map((f) => (
              <Badge key={f} tone="danger" size="sm">
                {FATIGUE_FLAG_LABEL[f] ?? f}
              </Badge>
            ))}
          </Group>
        ) : (
          <Badge tone="success" size="sm">
            OK
          </Badge>
        ),
    },
  ];

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Worked hours over the last 7 days, sorted by load. Fatigue flags are advisory — follow up
        with flagged staff and arrange relief where you can.
      </Text>
      <DataTable
        columns={columns}
        data={data}
        loading={isLoading}
        rowKey={(r: DutyHoursRow) => r.employee_id}
      />
    </Stack>
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
    queryFn: () =>
      hrService.listAttendance({ date_from: dateFrom || undefined, date_to: dateTo || undefined }),
  });

  const [form, setForm] = useState({
    employee_id: "",
    attendance_date: "",
    check_in: "",
    check_out: "",
    status: "present",
    source: "manual",
  });
  const createMut = useMutation({
    mutationFn: () =>
      hrService.createAttendance({
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
      setForm({
        employee_id: "",
        attendance_date: "",
        check_in: "",
        check_out: "",
        status: "present",
        source: "manual",
      });
      toast.success("Attendance marked", { title: "Attendance Recorded" });
    },
    onError: () => toast.error("Failed to record attendance", { title: "Error" }),
  });

  return (
    <>
      <Group justify="space-between" mb="md">
        <Group>
          <TextInput
            placeholder="From (YYYY-MM-DD)"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.currentTarget.value)}
            style={{ width: 160 }}
          />
          <TextInput
            placeholder="To (YYYY-MM-DD)"
            value={dateTo}
            onChange={(e) => setDateTo(e.currentTarget.value)}
            style={{ width: 160 }}
          />
        </Group>
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Mark Attendance
          </Button>
        )}
      </Group>

      <DataTable
        data={records}
        loading={isLoading}
        rowKey={(r: AttendanceRecord) => r.id}
        columns={[
          {
            key: "date",
            label: "Date",
            render: (r: AttendanceRecord) => <Text size="sm">{r.attendance_date}</Text>,
          },
          {
            key: "employee",
            label: "Employee ID",
            render: (r: AttendanceRecord) => (
              <Text size="sm" ff="monospace">
                {r.employee_id.slice(0, 8)}
              </Text>
            ),
          },
          {
            key: "check_in",
            label: "Check In",
            render: (r: AttendanceRecord) => (
              <Text size="sm">{r.check_in ? new Date(r.check_in).toLocaleTimeString() : "—"}</Text>
            ),
          },
          {
            key: "check_out",
            label: "Check Out",
            render: (r: AttendanceRecord) => (
              <Text size="sm">
                {r.check_out ? new Date(r.check_out).toLocaleTimeString() : "—"}
              </Text>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r: AttendanceRecord) => <Badge size="sm">{r.status}</Badge>,
          },
          {
            key: "late",
            label: "Late",
            render: (r: AttendanceRecord) =>
              r.is_late ? (
                <Badge tone="warning" size="sm">
                  {r.late_minutes}m
                </Badge>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              ),
          },
          {
            key: "overtime",
            label: "OT",
            render: (r: AttendanceRecord) =>
              r.overtime_minutes > 0 ? (
                <Badge tone="primary" size="sm">
                  {r.overtime_minutes}m
                </Badge>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              ),
          },
          {
            key: "source",
            label: "Source",
            render: (r: AttendanceRecord) => <Badge size="sm">{r.source}</Badge>,
          },
        ]}
      />

      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="Mark Attendance"
        position="right"
        size="xl"
      >
        <Stack gap="sm">
          <EmployeeSearchSelect
            value={form.employee_id}
            onChange={(id) => setForm({ ...form, employee_id: id })}
            required
          />
          <TextInput
            label="Date"
            required
            placeholder="YYYY-MM-DD"
            value={form.attendance_date}
            onChange={(e) => setForm({ ...form, attendance_date: e.currentTarget.value })}
          />
          <TextInput
            label="Check In"
            placeholder="HH:MM (ISO timestamp)"
            value={form.check_in}
            onChange={(e) => setForm({ ...form, check_in: e.currentTarget.value })}
          />
          <TextInput
            label="Check Out"
            placeholder="HH:MM (ISO timestamp)"
            value={form.check_out}
            onChange={(e) => setForm({ ...form, check_out: e.currentTarget.value })}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(v) => setForm({ ...form, status: v || "present" })}
            data={[
              { value: "present", label: "Present" },
              { value: "absent", label: "Absent" },
              { value: "half_day", label: "Half Day" },
              { value: "holiday", label: "Holiday" },
              { value: "week_off", label: "Week Off" },
            ]}
          />
          <Select
            label="Source"
            value={form.source}
            onChange={(v) => setForm({ ...form, source: v || "manual" })}
            data={[
              { value: "manual", label: "Manual" },
              { value: "biometric", label: "Biometric" },
            ]}
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={!form.employee_id || !form.attendance_date}
          >
            Record Attendance
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Leave Tab
// ══════════════════════════════════════════════════════════
