// HR EmployeeDetailDrawer — split from hr.tsx (pure move).

import { Drawer, Group, Select, Stack, Tabs, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { EmployeeCredential, LeaveBalance } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, Button, toast } from "@/components/ui";
import { hrService } from "@/services/hr.service";
import { statusBadgeTone } from "./shared";

export function EmployeeDetailDrawer({
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

  // Credentials and leave balances each have their own code — an employee's
  // licence and registration history is not the same read as their leave.
  const canListCredentials = useHasPermission(P.HR.CREDENTIALS_LIST);
  const canListLeave = useHasPermission(P.HR.LEAVE_LIST);
  const { data: employee } = useQuery({
    queryKey: ["hr-employee", employeeId],
    queryFn: () => hrService.getEmployee(employeeId),
    enabled: opened,
  });
  const { data: credentials = [] } = useQuery({
    queryKey: ["hr-credentials", employeeId],
    queryFn: () => hrService.listCredentials(employeeId),
    enabled: opened && canListCredentials,
  });
  const { data: leaveBalances = [] } = useQuery({
    queryKey: ["hr-leave-balances", employeeId],
    queryFn: () => hrService.listLeaveBalances(employeeId),
    enabled: opened && canListLeave,
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
