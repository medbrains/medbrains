// HR EmployeesTab — split from hr.tsx (pure move).

import {
  Drawer,
  Group,
  NumberInput,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { Designation, Employee } from "@medbrains/types";
import { IconPencil, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, Button, IconButton, toast } from "@/components/ui";
import { hrService } from "@/services/hr.service";
import { EmployeeDetailDrawer } from "./employee-detail-drawer";
import { statusBadgeTone } from "./shared";

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

export function EmployeesTab({
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
