import { useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Modal,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Timeline,
} from "@mantine/core";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconPencil,
  IconClipboardList,
  IconBarrierBlock,
  IconArrowRight,
  IconChartBar,
  IconCheck,
  IconRobot,
  IconAlertCircle,
  IconCircleDot,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  CaseAssignment,
  DischargeBarrier,
  CaseReferral,
  DispositionRow,
  BarrierAnalyticsRow,
  CreateCaseAssignmentRequest,
  UpdateCaseAssignmentRequest,
  AutoAssignRequest,
  CreateDischargeBarrierRequest,
  CreateCaseReferralRequest,
  UpdateCaseReferralRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";
import type { Column } from "../components/DataTable";

// ── Constants ──────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  assigned: "primary",
  active: "success",
  pending_discharge: "orange",
  discharged: "teal",
  closed: "slate",
};

const PRIORITY_COLORS: Record<string, string> = {
  routine: "slate",
  urgent: "danger",
  complex: "warning",
};

const BARRIER_TYPE_COLORS: Record<string, string> = {
  insurance_auth: "danger",
  placement: "orange",
  equipment: "info",
  family: "warning",
  transport: "primary",
  financial: "danger",
  clinical: "violet",
  documentation: "slate",
  other: "dark",
};

const BARRIER_TYPES = [
  { value: "insurance_auth", label: "Insurance Auth" },
  { value: "placement", label: "Placement" },
  { value: "equipment", label: "Equipment" },
  { value: "family", label: "Family" },
  { value: "transport", label: "Transport" },
  { value: "financial", label: "Financial" },
  { value: "clinical", label: "Clinical" },
  { value: "documentation", label: "Documentation" },
  { value: "other", label: "Other" },
];

const REFERRAL_TYPES = [
  { value: "post_acute", label: "Post Acute" },
  { value: "rehab", label: "Rehab" },
  { value: "home_health", label: "Home Health" },
  { value: "social_work", label: "Social Work" },
  { value: "hospice", label: "Hospice" },
  { value: "snf", label: "SNF" },
  { value: "other", label: "Other" },
];

const REFERRAL_STATUS_COLORS: Record<string, string> = {
  pending: "warning",
  accepted: "success",
  declined: "danger",
  completed: "teal",
  cancelled: "slate",
};

const PRIORITIES = [
  { value: "routine", label: "Routine" },
  { value: "urgent", label: "Urgent" },
  { value: "complex", label: "Complex" },
];

// ── Helpers ────────────────────────────────────────────

function truncate(val: string | undefined | null, len: number): string {
  if (!val) return "\u2014";
  return val.length > len ? `${val.slice(0, len)}...` : val;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card withBorder p="sm">
      <Text size="xs" c="dimmed">{label}</Text>
      <Text size="lg" fw={700}>{value}</Text>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────

export function CaseManagementPage() {
  useRequirePermission(P.CASE_MGMT.ASSIGNMENTS_LIST);
  const [activeTab, setActiveTab] = useState<string | null>("board");

  return (
    <div>
      <PageHeader
        title="Case Management"
        subtitle="Case assignments, discharge barriers, referrals, and analytics"
      />
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="board" leftSection={<IconClipboardList size={16} />}>
            Case Board
          </Tabs.Tab>
          <Tabs.Tab value="barriers" leftSection={<IconBarrierBlock size={16} />}>
            Discharge Barriers
          </Tabs.Tab>
          <Tabs.Tab value="referrals" leftSection={<IconArrowRight size={16} />}>
            Referrals
          </Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
            Analytics
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="board" pt="md">
          <CaseBoardTab />
        </Tabs.Panel>
        <Tabs.Panel value="barriers" pt="md">
          <DischargeBarriersTab />
        </Tabs.Panel>
        <Tabs.Panel value="referrals" pt="md">
          <ReferralsTab />
        </Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md">
          <AnalyticsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Case Board Tab
// ══════════════════════════════════════════════════════════

function CaseBoardTab() {
  const canCreate = useHasPermission(P.CASE_MGMT.ASSIGNMENTS_CREATE);
  const canUpdate = useHasPermission(P.CASE_MGMT.ASSIGNMENTS_UPDATE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [autoOpen, autoHandlers] = useDisclosure(false);
  const [editOpen, editHandlers] = useDisclosure(false);
  const [detailOpen, detailHandlers] = useDisclosure(false);
  const [editing, setEditing] = useState<CaseAssignment | null>(null);
  const [losFilter, setLosFilter] = useState<string | null>(null);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["case-assignments"],
    queryFn: () => api.listCaseAssignments(),
  });

  const { data: caseload = [] } = useQuery({
    queryKey: ["case-caseload"],
    queryFn: () => api.caseloadSummary(),
  });

  // Create form
  const [form, setForm] = useState<CreateCaseAssignmentRequest>({
    admission_id: "",
    patient_id: "",
    case_manager_id: "",
  });

  // Edit form
  const [editForm, setEditForm] = useState<UpdateCaseAssignmentRequest>({});

  // Auto-assign form
  const [autoForm, setAutoForm] = useState<AutoAssignRequest>({
    admission_id: "",
    patient_id: "",
  });

  const createMut = useMutation({
    mutationFn: () => api.createCaseAssignment(form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["case-assignments"] });
      void qc.invalidateQueries({ queryKey: ["case-caseload"] });
      createHandlers.close();
      setForm({ admission_id: "", patient_id: "", case_manager_id: "" });
      notifications.show({ title: "Case Assigned", message: "Case assignment created", color: "success" });
    },
  });

  const updateMut = useMutation({
    mutationFn: () => {
      if (!editing) return Promise.reject(new Error("No case selected"));
      return api.updateCaseAssignment(editing.id, editForm);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["case-assignments"] });
      void qc.invalidateQueries({ queryKey: ["case-caseload"] });
      editHandlers.close();
      setEditing(null);
      setEditForm({});
      notifications.show({ title: "Updated", message: "Case assignment updated", color: "success" });
    },
  });

  const autoMut = useMutation({
    mutationFn: () => api.autoAssignCase(autoForm),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["case-assignments"] });
      void qc.invalidateQueries({ queryKey: ["case-caseload"] });
      autoHandlers.close();
      setAutoForm({ admission_id: "", patient_id: "" });
      notifications.show({
        title: "Auto-Assigned",
        message: "Case automatically assigned to a case manager",
        color: "teal",
        icon: <IconRobot size={16} />,
      });
    },
  });

  // Calculate LOS and risk badges
  const enhancedAssignments = useMemo(() => {
    return assignments.map((a) => {
      let losDays = 0;
      let losColor = "success";
      let losStatus = "Within";

      if (a.status === "active" || a.status === "pending_discharge") {
        const admitDate = new Date(a.created_at ?? "");
        const now = new Date();
        losDays = Math.floor((now.getTime() - admitDate.getTime()) / (1000 * 60 * 60 * 24));

        if (a.target_discharge_date) {
          const targetDate = new Date(a.target_discharge_date);
          if (now > targetDate) {
            losColor = "danger";
            losStatus = "Over";
          } else if (Math.abs(now.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24) <= 1) {
            losColor = "warning";
            losStatus = "At";
          }
        }
      }

      // Parse risk_score from notes or use dummy calculation
      let riskScore = 0;
      let riskLabel = "Not assessed";
      let riskColor = "slate";

      if (a.notes) {
        const match = a.notes.match(/risk[:\s]+(\d+)/i);
        if (match && match[1]) riskScore = parseInt(match[1], 10);
      }
      if (riskScore > 0) {
        if (riskScore <= 3) {
          riskLabel = "Low";
          riskColor = "success";
        } else if (riskScore <= 6) {
          riskLabel = "Medium";
          riskColor = "warning";
        } else {
          riskLabel = "High";
          riskColor = "danger";
        }
      }

      return { ...a, losDays, losColor, losStatus, riskScore, riskLabel, riskColor };
    });
  }, [assignments]);

  // Filter by LOS status
  const filteredAssignments = useMemo(() => {
    if (!losFilter) return enhancedAssignments;
    return enhancedAssignments.filter((a) => a.losStatus === losFilter);
  }, [enhancedAssignments, losFilter]);

  const columns: Column<typeof enhancedAssignments[0]>[] = [
    { key: "admission_id", label: "Admission", render: (r) => <Text size="sm">{truncate(r.admission_id, 8)}</Text> },
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => (
        <Group gap="xs">
          <Text size="sm">{truncate(r.patient_id, 8)}</Text>
          {r.riskScore > 0 && (
            <Badge color={r.riskColor} size="xs" variant="dot" title="Readmission Risk">
              {r.riskLabel}
            </Badge>
          )}
        </Group>
      ),
    },
    { key: "case_manager_id", label: "Case Manager", render: (r) => <Text size="sm">{truncate(r.case_manager_id, 8)}</Text> },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge color={STATUS_COLORS[r.status] ?? "slate"} variant="filled" size="sm">
          {r.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      render: (r) => (
        <Badge color={PRIORITY_COLORS[r.priority] ?? "slate"} variant="light" size="sm">
          {r.priority}
        </Badge>
      ),
    },
    {
      key: "los",
      label: "LOS",
      render: (r) =>
        r.losDays > 0 ? (
          <Badge color={r.losColor} size="sm" variant="light">
            {r.losDays}d ({r.losStatus})
          </Badge>
        ) : (
          <Text size="sm">\u2014</Text>
        ),
    },
    {
      key: "target_discharge_date",
      label: "Target Discharge",
      render: (r) => <Text size="sm">{r.target_discharge_date ?? "\u2014"}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap={4}>
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={() => {
              setEditing(r);
              detailHandlers.open();
            }}
            title="View Details"
            aria-label="Circle Dot"
          >
            <IconCircleDot size={14} />
          </ActionIcon>
          {canUpdate && (
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => {
                setEditing(r);
                setEditForm({
                  status: r.status,
                  priority: r.priority,
                  target_discharge_date: r.target_discharge_date,
                  notes: r.notes,
                });
                editHandlers.open();
              }}
              aria-label="Edit"
            >
              <IconPencil size={14} />
            </ActionIcon>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      {/* Caseload Summary */}
      {caseload.length > 0 && (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} mb="md">
          {caseload.map((c) => (
            <Card withBorder p="sm" key={c.case_manager_id}>
              <Text size="xs" c="dimmed">CM: {truncate(c.case_manager_id, 8)}</Text>
              <Group gap="xs" mt={4}>
                <Badge color="success" variant="light" size="xs">Active: {c.active_cases}</Badge>
                <Badge color="orange" variant="light" size="xs">Pending: {c.pending_discharge}</Badge>
                <Badge color="primary" variant="light" size="xs">Total: {c.total_cases}</Badge>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Group justify="space-between" mb="md">
        <Select
          placeholder="Filter by LOS status"
          data={[
            { value: "Over", label: "Over Expected LOS" },
            { value: "At", label: "At Expected LOS" },
            { value: "Within", label: "Within Expected LOS" },
          ]}
          value={losFilter}
          onChange={setLosFilter}
          clearable
          w={220}
        />
        <Group gap="xs">
          {canCreate && (
            <>
              <Button
                variant="light"
                leftSection={<IconRobot size={16} />}
                onClick={autoHandlers.open}
              >
                Auto-Assign
              </Button>
              <Button leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
                Assign Case
              </Button>
            </>
          )}
        </Group>
      </Group>

      <DataTable columns={columns} data={filteredAssignments} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create Drawer */}
      <Drawer opened={createOpen} onClose={createHandlers.close} title="Assign Case" position="right" size="xl">
        <Stack>
          <TextInput
            label="Admission ID"
            required
            value={form.admission_id}
            onChange={(e) => setForm({ ...form, admission_id: e.currentTarget.value })}
          />
          <PatientSearchSelect value={form.patient_id} onChange={(v) => setForm({ ...form, patient_id: v })} required />
          <TextInput
            label="Case Manager ID"
            required
            value={form.case_manager_id}
            onChange={(e) => setForm({ ...form, case_manager_id: e.currentTarget.value })}
          />
          <Select
            label="Priority"
            data={PRIORITIES}
            value={form.priority ?? "routine"}
            onChange={(v) => setForm({ ...form, priority: v ?? undefined })}
          />
          <DateInput
            label="Target Discharge Date"
            value={form.target_discharge_date ? new Date(form.target_discharge_date) : null}
            onChange={(d) =>
              setForm({
                ...form,
                target_discharge_date: d ? new Date(d).toISOString().slice(0, 10) : undefined,
              })
            }
          />
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })}
          />
          <Button
            onClick={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={!form.admission_id || !form.patient_id || !form.case_manager_id}
          >
            Create Assignment
          </Button>
        </Stack>
      </Drawer>

      {/* Auto-Assign Drawer */}
      <Drawer opened={autoOpen} onClose={autoHandlers.close} title="Auto-Assign Case" position="right" size="sm">
        <Stack>
          <TextInput
            label="Admission ID"
            required
            value={autoForm.admission_id}
            onChange={(e) => setAutoForm({ ...autoForm, admission_id: e.currentTarget.value })}
          />
          <PatientSearchSelect value={autoForm.patient_id} onChange={(v) => setAutoForm({ ...autoForm, patient_id: v })} required />
          <Select
            label="Priority"
            data={PRIORITIES}
            value={autoForm.priority ?? null}
            onChange={(v) => setAutoForm({ ...autoForm, priority: v ?? undefined })}
            clearable
          />
          <Button
            onClick={() => autoMut.mutate()}
            loading={autoMut.isPending}
            disabled={!autoForm.admission_id || !autoForm.patient_id}
            leftSection={<IconRobot size={16} />}
          >
            Auto-Assign
          </Button>
        </Stack>
      </Drawer>

      {/* Edit Drawer */}
      <Drawer opened={editOpen} onClose={editHandlers.close} title="Edit Case Assignment" position="right" size="xl">
        <Stack>
          <Select
            label="Status"
            data={[
              { value: "assigned", label: "Assigned" },
              { value: "active", label: "Active" },
              { value: "pending_discharge", label: "Pending Discharge" },
              { value: "discharged", label: "Discharged" },
              { value: "closed", label: "Closed" },
            ]}
            value={editForm.status ?? null}
            onChange={(v) =>
              setEditForm({ ...editForm, status: (v as UpdateCaseAssignmentRequest["status"]) ?? undefined })
            }
          />
          <Select
            label="Priority"
            data={PRIORITIES}
            value={editForm.priority ?? null}
            onChange={(v) => setEditForm({ ...editForm, priority: v ?? undefined })}
          />
          <DateInput
            label="Target Discharge Date"
            value={editForm.target_discharge_date ? new Date(editForm.target_discharge_date) : null}
            onChange={(d) =>
              setEditForm({
                ...editForm,
                target_discharge_date: d ? new Date(d).toISOString().slice(0, 10) : undefined,
              })
            }
          />
          <DateInput
            label="Actual Discharge Date"
            value={editForm.actual_discharge_date ? new Date(editForm.actual_discharge_date) : null}
            onChange={(d) =>
              setEditForm({
                ...editForm,
                actual_discharge_date: d ? new Date(d).toISOString().slice(0, 10) : undefined,
              })
            }
          />
          <TextInput
            label="Discharge Disposition"
            value={editForm.discharge_disposition ?? ""}
            onChange={(e) =>
              setEditForm({ ...editForm, discharge_disposition: e.currentTarget.value || undefined })
            }
          />
          <Textarea
            label="Notes"
            value={editForm.notes ?? ""}
            onChange={(e) => setEditForm({ ...editForm, notes: e.currentTarget.value || undefined })}
          />
          <Button onClick={() => updateMut.mutate()} loading={updateMut.isPending}>
            Update Assignment
          </Button>
        </Stack>
      </Drawer>

      {/* Case Detail Modal with Progress Tracking */}
      <Modal opened={detailOpen} onClose={detailHandlers.close} title="Case Details & Progress" size="lg">
        {editing && (
          <Stack gap="md">
            <SimpleGrid cols={2}>
              <div>
                <Text size="xs" c="dimmed">Patient ID</Text>
                <Text fw={600}>{editing.patient_id}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Admission ID</Text>
                <Text fw={600}>{editing.admission_id}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Case Manager</Text>
                <Text fw={600}>{editing.case_manager_id}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Priority</Text>
                <Badge color={PRIORITY_COLORS[editing.priority] ?? "slate"}>{editing.priority}</Badge>
              </div>
            </SimpleGrid>

            {/* Care Plan Progress */}
            <Card withBorder p="md">
              <Text fw={600} mb="sm">Care Plan Progress</Text>
              {(() => {
                // Parse milestones from notes or create dummy data
                const createdDate = editing.created_at ?? new Date().toISOString();
                const targetDate = editing.target_discharge_date ?? new Date().toISOString();
                const actualDate = editing.actual_discharge_date ?? "";

                const milestones = [
                  { title: "Initial Assessment", target: createdDate, completed: createdDate, status: "completed" },
                  { title: "Care Plan Development", target: targetDate, completed: editing.status === "active" ? new Date().toISOString().slice(0, 10) : "", status: editing.status === "active" ? "completed" : "pending" },
                  { title: "Discharge Planning", target: targetDate, completed: editing.status === "pending_discharge" ? new Date().toISOString().slice(0, 10) : "", status: editing.status === "pending_discharge" || editing.status === "discharged" ? "completed" : "pending" },
                  { title: "Discharge Execution", target: targetDate, completed: actualDate, status: editing.status === "discharged" ? "completed" : "pending" },
                ];

                const completedCount = milestones.filter((m) => m.status === "completed").length;
                const progressPct = (completedCount / milestones.length) * 100;

                return (
                  <>
                    <Progress value={progressPct} color="primary" size="lg" mb="md" />
                    <Text size="sm" c="dimmed" mb="md">
                      {completedCount} of {milestones.length} milestones completed ({progressPct.toFixed(0)}%)
                    </Text>
                    <Timeline active={completedCount - 1} bulletSize={24} lineWidth={2}>
                      {milestones.map((m, idx) => (
                        <Timeline.Item
                          key={idx}
                          bullet={m.status === "completed" ? <IconCheck size={12} /> : <IconAlertCircle size={12} />}
                          title={m.title}
                        >
                          <Text size="xs" c="dimmed">Target: {m.target}</Text>
                          {m.completed && <Text size="xs" c="teal">Completed: {m.completed}</Text>}
                          <Badge color={m.status === "completed" ? "success" : "slate"} size="xs" mt={4}>
                            {m.status}
                          </Badge>
                        </Timeline.Item>
                      ))}
                    </Timeline>
                  </>
                );
              })()}
            </Card>

            {editing.notes && (
              <Card withBorder p="sm">
                <Text size="xs" fw={600} c="dimmed">Notes</Text>
                <Text size="sm">{editing.notes}</Text>
              </Card>
            )}
          </Stack>
        )}
      </Modal>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Discharge Barriers Tab
// ══════════════════════════════════════════════════════════

function DischargeBarriersTab() {
  const canManage = useHasPermission(P.CASE_MGMT.BARRIERS_MANAGE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);

  const [filterAssignmentId, setFilterAssignmentId] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterResolved, setFilterResolved] = useState<string | null>("false");

  const { data: barriers = [], isLoading } = useQuery({
    queryKey: ["case-barriers", filterAssignmentId, filterType, filterResolved],
    queryFn: () =>
      api.listDischargeBarriers({
        case_assignment_id: filterAssignmentId || undefined,
        barrier_type: filterType ?? undefined,
        is_resolved: filterResolved === "all" ? undefined : filterResolved ?? undefined,
      }),
  });

  const [form, setForm] = useState<CreateDischargeBarrierRequest>({
    case_assignment_id: "",
    barrier_type: "insurance_auth",
    description: "",
  });

  const createMut = useMutation({
    mutationFn: () => api.createDischargeBarrier(form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["case-barriers"] });
      createHandlers.close();
      setForm({ case_assignment_id: "", barrier_type: "insurance_auth", description: "" });
      notifications.show({ title: "Barrier Added", message: "Discharge barrier recorded", color: "success" });
    },
  });

  const resolveMut = useMutation({
    mutationFn: (id: string) => api.updateDischargeBarrier(id, { is_resolved: true }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["case-barriers"] });
      notifications.show({ title: "Resolved", message: "Barrier marked as resolved", color: "teal" });
    },
  });

  const columns: Column<DischargeBarrier>[] = [
    {
      key: "case_assignment_id",
      label: "Assignment",
      render: (r) => <Text size="sm">{truncate(r.case_assignment_id, 8)}</Text>,
    },
    {
      key: "barrier_type",
      label: "Barrier Type",
      render: (r) => (
        <Badge color={BARRIER_TYPE_COLORS[r.barrier_type] ?? "slate"} variant="filled" size="sm">
          {r.barrier_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (r) => <Text size="sm">{truncate(r.description, 50)}</Text>,
    },
    {
      key: "identified_date",
      label: "Identified",
      render: (r) => <Text size="sm">{r.identified_date}</Text>,
    },
    {
      key: "is_resolved",
      label: "Resolved",
      render: (r) =>
        r.is_resolved ? (
          <Badge color="success" variant="filled" size="sm">Resolved</Badge>
        ) : (
          <Badge color="danger" variant="filled" size="sm">Unresolved</Badge>
        ),
    },
    {
      key: "escalated_to",
      label: "Escalated To",
      render: (r) => <Text size="sm">{r.escalated_to ?? "\u2014"}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canManage && !r.is_resolved ? (
          <ActionIcon
            variant="subtle"
            color="success"
            size="sm"
            onClick={() => resolveMut.mutate(r.id)}
            aria-label="Confirm"
          >
            <IconCheck size={14} />
          </ActionIcon>
        ) : null,
    },
  ];

  return (
    <>
      <Group mb="md" gap="sm">
        <TextInput
          placeholder="Filter by Assignment ID"
          value={filterAssignmentId}
          onChange={(e) => setFilterAssignmentId(e.currentTarget.value)}
          w={220}
        />
        <Select
          placeholder="Barrier Type"
          data={BARRIER_TYPES}
          value={filterType}
          onChange={setFilterType}
          clearable
          w={180}
        />
        <Select
          placeholder="Resolved"
          data={[
            { value: "all", label: "All" },
            { value: "true", label: "Resolved" },
            { value: "false", label: "Unresolved" },
          ]}
          value={filterResolved}
          onChange={setFilterResolved}
          w={150}
        />
        {canManage && (
          <Button leftSection={<IconPlus size={16} />} onClick={createHandlers.open} ml="auto">
            Add Barrier
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={barriers} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer opened={createOpen} onClose={createHandlers.close} title="Add Discharge Barrier" position="right" size="xl">
        <Stack>
          <TextInput
            label="Case Assignment ID"
            required
            value={form.case_assignment_id}
            onChange={(e) => setForm({ ...form, case_assignment_id: e.currentTarget.value })}
          />
          <Select
            label="Barrier Type"
            required
            data={BARRIER_TYPES}
            value={form.barrier_type}
            onChange={(v) =>
              setForm({
                ...form,
                barrier_type: (v as CreateDischargeBarrierRequest["barrier_type"]) ?? "insurance_auth",
              })
            }
          />
          <Textarea
            label="Description"
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
          />
          <Button
            onClick={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={!form.case_assignment_id || !form.description}
          >
            Add Barrier
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Referrals Tab
// ══════════════════════════════════════════════════════════

function ReferralsTab() {
  const canManage = useHasPermission(P.CASE_MGMT.REFERRALS_MANAGE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [editOpen, editHandlers] = useDisclosure(false);
  const [editing, setEditing] = useState<CaseReferral | null>(null);

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ["case-referrals"],
    queryFn: () => api.listCaseReferrals(),
  });

  const [form, setForm] = useState<CreateCaseReferralRequest>({
    case_assignment_id: "",
    referral_type: "post_acute",
    referred_to: "",
  });

  const [editForm, setEditForm] = useState<UpdateCaseReferralRequest>({});

  const createMut = useMutation({
    mutationFn: () => api.createCaseReferral(form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["case-referrals"] });
      createHandlers.close();
      setForm({ case_assignment_id: "", referral_type: "post_acute", referred_to: "" });
      notifications.show({ title: "Referral Created", message: "Referral recorded", color: "success" });
    },
  });

  const updateMut = useMutation({
    mutationFn: () => {
      if (!editing) return Promise.reject(new Error("No referral selected"));
      return api.updateCaseReferral(editing.id, editForm);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["case-referrals"] });
      editHandlers.close();
      setEditing(null);
      setEditForm({});
      notifications.show({ title: "Updated", message: "Referral updated", color: "success" });
    },
  });

  const columns: Column<CaseReferral>[] = [
    {
      key: "case_assignment_id",
      label: "Assignment",
      render: (r) => <Text size="sm">{truncate(r.case_assignment_id, 8)}</Text>,
    },
    {
      key: "referral_type",
      label: "Type",
      render: (r) => (
        <Badge variant="light" size="sm">
          {REFERRAL_TYPES.find((t) => t.value === r.referral_type)?.label ?? r.referral_type}
        </Badge>
      ),
    },
    {
      key: "referred_to",
      label: "Referred To",
      render: (r) => <Text size="sm">{r.referred_to}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge color={REFERRAL_STATUS_COLORS[r.status] ?? "slate"} variant="filled" size="sm">
          {r.status}
        </Badge>
      ),
    },
    {
      key: "outcome",
      label: "Outcome",
      render: (r) => <Text size="sm">{r.outcome ?? "\u2014"}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canManage ? (
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={() => {
              setEditing(r);
              setEditForm({ status: r.status, outcome: r.outcome });
              editHandlers.open();
            }}
            aria-label="Edit"
          >
            <IconPencil size={14} />
          </ActionIcon>
        ) : null,
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canManage && (
          <Button leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            Create Referral
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={referrals} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create Drawer */}
      <Drawer opened={createOpen} onClose={createHandlers.close} title="Create Referral" position="right" size="xl">
        <Stack>
          <TextInput
            label="Case Assignment ID"
            required
            value={form.case_assignment_id}
            onChange={(e) => setForm({ ...form, case_assignment_id: e.currentTarget.value })}
          />
          <Select
            label="Referral Type"
            required
            data={REFERRAL_TYPES}
            value={form.referral_type}
            onChange={(v) => setForm({ ...form, referral_type: v ?? "post_acute" })}
          />
          <TextInput
            label="Referred To"
            required
            value={form.referred_to}
            onChange={(e) => setForm({ ...form, referred_to: e.currentTarget.value })}
          />
          <TextInput
            label="Facility Name"
            value={
              form.facility_details && typeof form.facility_details === "object"
                ? ((form.facility_details as Record<string, string>).name ?? "")
                : ""
            }
            onChange={(e) =>
              setForm({
                ...form,
                facility_details: { ...((form.facility_details as Record<string, unknown>) ?? {}), name: e.currentTarget.value || undefined },
              })
            }
          />
          <Button
            onClick={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={!form.case_assignment_id || !form.referred_to}
          >
            Create Referral
          </Button>
        </Stack>
      </Drawer>

      {/* Edit Drawer */}
      <Drawer opened={editOpen} onClose={editHandlers.close} title="Edit Referral" position="right" size="xl">
        <Stack>
          <Select
            label="Status"
            data={[
              { value: "pending", label: "Pending" },
              { value: "accepted", label: "Accepted" },
              { value: "declined", label: "Declined" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
            ]}
            value={editForm.status ?? null}
            onChange={(v) => setEditForm({ ...editForm, status: v ?? undefined })}
          />
          <Textarea
            label="Outcome"
            value={editForm.outcome ?? ""}
            onChange={(e) => setEditForm({ ...editForm, outcome: e.currentTarget.value || undefined })}
          />
          <Button onClick={() => updateMut.mutate()} loading={updateMut.isPending}>
            Update Referral
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Analytics Tab
// ══════════════════════════════════════════════════════════

function AnalyticsTab() {
  const { data: dispositions = [], isLoading: dispLoading } = useQuery({
    queryKey: ["case-analytics-dispositions"],
    queryFn: () => api.dispositionAnalytics(),
  });

  const { data: barrierData = [], isLoading: barrierLoading } = useQuery({
    queryKey: ["case-analytics-barriers"],
    queryFn: () => api.barrierAnalytics(),
  });

  const { data: outcomes } = useQuery({
    queryKey: ["case-analytics-outcomes"],
    queryFn: () => api.outcomeAnalytics(),
  });

  const dispositionCols: Column<DispositionRow>[] = [
    {
      key: "disposition",
      label: "Disposition",
      render: (r) => <Text size="sm">{r.disposition ?? "Not set"}</Text>,
    },
    {
      key: "count",
      label: "Count",
      render: (r) => <Text size="sm" fw={600}>{r.count}</Text>,
    },
  ];

  const barrierCols: Column<BarrierAnalyticsRow>[] = [
    {
      key: "barrier_type",
      label: "Barrier Type",
      render: (r) => (
        <Badge color={BARRIER_TYPE_COLORS[r.barrier_type] ?? "slate"} variant="light" size="sm">
          {r.barrier_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "count",
      label: "Count",
      render: (r) => <Text size="sm" fw={600}>{r.count}</Text>,
    },
    {
      key: "avg_days_open",
      label: "Avg Days Open",
      render: (r) => (
        <Text size="sm">
          {r.avg_days_open !== undefined && r.avg_days_open !== null
            ? r.avg_days_open.toFixed(1)
            : "\u2014"}
        </Text>
      ),
    },
  ];

  return (
    <Stack gap="md">
      {/* Outcome Summary Cards */}
      {outcomes && (
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <StatCard
            label="Avg Days to Discharge"
            value={
              outcomes.avg_days_to_discharge !== undefined && outcomes.avg_days_to_discharge !== null
                ? outcomes.avg_days_to_discharge.toFixed(1)
                : "\u2014"
            }
          />
          <StatCard label="Total Discharged" value={outcomes.total_discharged} />
          <StatCard label="Total with Barriers" value={outcomes.total_with_barriers} />
        </SimpleGrid>
      )}

      {/* Disposition Table */}
      <Text fw={600} size="lg">Disposition Breakdown</Text>
      <DataTable
        columns={dispositionCols}
        data={dispositions}
        loading={dispLoading}
        rowKey={(r) => r.disposition ?? "none"}
      />

      {/* Barrier Breakdown Table */}
      <Text fw={600} size="lg">Barrier Breakdown</Text>
      <DataTable
        columns={barrierCols}
        data={barrierData}
        loading={barrierLoading}
        rowKey={(r) => r.barrier_type}
      />
    </Stack>
  );
}
