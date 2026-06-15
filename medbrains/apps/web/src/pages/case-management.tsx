import { zodResolver } from "@hookform/resolvers/zod";
import {
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
  Textarea,
  TextInput,
  Timeline,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  CaseAssignmentFormInput,
  CaseAssignmentUpdateFormInput,
  CaseAutoAssignFormInput,
  CaseReferralFormInput,
  CaseReferralUpdateFormInput,
  DischargeBarrierFormInput,
} from "@medbrains/schemas";
import {
  caseAssignmentFormSchema,
  caseAssignmentUpdateFormSchema,
  caseAutoAssignFormSchema,
  caseReferralFormSchema,
  caseReferralUpdateFormSchema,
  dischargeBarrierFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AutoAssignRequest,
  BarrierAnalyticsRow,
  CaseAssignment,
  CaseReferral,
  CreateCaseAssignmentRequest,
  CreateCaseReferralRequest,
  CreateDischargeBarrierRequest,
  DischargeBarrier,
  DispositionRow,
  UpdateCaseAssignmentRequest,
  UpdateCaseReferralRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertCircle,
  IconArrowRight,
  IconBarrierBlock,
  IconChartBar,
  IconCheck,
  IconCircleDot,
  IconClipboardList,
  IconPencil,
  IconPlus,
  IconRobot,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import {
  caseOptionalText,
  casePriorityOptions,
  caseReferralStatusOptions,
  caseReferralTypeOptions,
  caseStatusOptions,
  dischargeBarrierTypeOptions,
  toCasePriorityFormValue,
  toCaseReferralStatusFormValue,
  toCaseStatusFormValue,
} from "@/forms/case-management.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { caseManagementService } from "@/services/case-management.service";

const STATUS_COLORS: Record<string, BadgeTone> = {
  assigned: "primary",
  active: "success",
  pending_discharge: "warning",
  discharged: "success",
  closed: "neutral",
};

const PRIORITY_COLORS: Record<string, BadgeTone> = {
  routine: "neutral",
  urgent: "danger",
  complex: "warning",
};

const BARRIER_TYPE_COLORS: Record<string, BadgeTone> = {
  insurance_auth: "danger",
  placement: "warning",
  equipment: "info",
  family: "warning",
  transport: "primary",
  financial: "danger",
  clinical: "accent",
  documentation: "neutral",
  other: "neutral",
};

const REFERRAL_STATUS_COLORS: Record<string, BadgeTone> = {
  pending: "warning",
  accepted: "success",
  declined: "danger",
  completed: "success",
  cancelled: "neutral",
};

const TONE_BY_COLOR: Record<string, BadgeTone> = {
  success: "success",
  danger: "danger",
  warning: "warning",
  slate: "neutral",
  orange: "warning",
  teal: "success",
  primary: "primary",
};

// ── Helpers ────────────────────────────────────────────

function truncate(val: string | undefined | null, len: number): string {
  if (!val) return "\u2014";
  return val.length > len ? `${val.slice(0, len)}...` : val;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card withBorder p="sm">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="lg" fw={700}>
        {value}
      </Text>
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
    queryFn: () => caseManagementService.listCaseAssignments(),
  });

  const { data: caseload = [] } = useQuery({
    queryKey: ["case-caseload"],
    queryFn: () => caseManagementService.caseloadSummary(),
  });

  const createForm = useForm<CaseAssignmentFormInput>({
    resolver: zodResolver(caseAssignmentFormSchema),
    defaultValues: {
      admission_id: "",
      patient_id: "",
      case_manager_id: "",
      priority: "routine",
      target_discharge_date: "",
      notes: "",
    },
  });
  const {
    control: createControl,
    handleSubmit: handleCreateSubmit,
    reset: resetCreate,
    formState: { errors: createErrors },
  } = createForm;
  const editForm = useForm<CaseAssignmentUpdateFormInput>({
    resolver: zodResolver(caseAssignmentUpdateFormSchema),
    defaultValues: {
      status: "",
      priority: "",
      target_discharge_date: "",
      actual_discharge_date: "",
      discharge_disposition: "",
      notes: "",
    },
  });
  const {
    control: editControl,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    formState: { errors: editErrors },
  } = editForm;
  const autoForm = useForm<CaseAutoAssignFormInput>({
    resolver: zodResolver(caseAutoAssignFormSchema),
    defaultValues: {
      admission_id: "",
      patient_id: "",
      priority: "",
    },
  });
  const {
    control: autoControl,
    handleSubmit: handleAutoSubmit,
    reset: resetAuto,
    formState: { errors: autoErrors },
  } = autoForm;

  const createMut = useMutation({
    mutationFn: (data: CreateCaseAssignmentRequest) =>
      caseManagementService.createCaseAssignment(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["case-assignments"] });
      void qc.invalidateQueries({ queryKey: ["case-caseload"] });
      createHandlers.close();
      resetCreate();
      notifications.show({
        title: "Case Assigned",
        message: "Case assignment created",
        color: "success",
      });
    },
  });

  const updateMut = useMutation({
    mutationFn: (data: UpdateCaseAssignmentRequest) => {
      if (!editing) return Promise.reject(new Error("No case selected"));
      return caseManagementService.updateCaseAssignment(editing.id, data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["case-assignments"] });
      void qc.invalidateQueries({ queryKey: ["case-caseload"] });
      editHandlers.close();
      setEditing(null);
      resetEdit();
      notifications.show({
        title: "Updated",
        message: "Case assignment updated",
        color: "success",
      });
    },
  });

  const autoMut = useMutation({
    mutationFn: (data: AutoAssignRequest) => caseManagementService.autoAssignCase(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["case-assignments"] });
      void qc.invalidateQueries({ queryKey: ["case-caseload"] });
      autoHandlers.close();
      resetAuto();
      notifications.show({
        title: "Auto-Assigned",
        message: "Case automatically assigned to a case manager",
        color: "teal",
        icon: <IconRobot size={16} />,
      });
    },
  });

  const submitCreateCase = (values: CaseAssignmentFormInput) => {
    createMut.mutate({
      admission_id: values.admission_id.trim(),
      patient_id: values.patient_id.trim(),
      case_manager_id: values.case_manager_id.trim(),
      priority: values.priority,
      target_discharge_date: caseOptionalText(values.target_discharge_date),
      notes: caseOptionalText(values.notes),
    });
  };

  const submitUpdateCase = (values: CaseAssignmentUpdateFormInput) => {
    updateMut.mutate({
      status: values.status || undefined,
      priority: values.priority || undefined,
      target_discharge_date: caseOptionalText(values.target_discharge_date),
      actual_discharge_date: caseOptionalText(values.actual_discharge_date),
      discharge_disposition: caseOptionalText(values.discharge_disposition),
      notes: caseOptionalText(values.notes),
    });
  };

  const submitAutoAssign = (values: CaseAutoAssignFormInput) => {
    autoMut.mutate({
      admission_id: values.admission_id.trim(),
      patient_id: values.patient_id.trim(),
      priority: values.priority || undefined,
    });
  };

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
        if (match?.[1]) riskScore = parseInt(match[1], 10);
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

  const columns: Column<(typeof enhancedAssignments)[0]>[] = [
    {
      key: "admission_id",
      label: "Admission",
      render: (r) => <Text size="sm">{truncate(r.admission_id, 8)}</Text>,
    },
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => (
        <Group gap="xs">
          <Text size="sm">{truncate(r.patient_id, 8)}</Text>
          {r.riskScore > 0 && (
            <Badge
              tone={TONE_BY_COLOR[r.riskColor] ?? "neutral"}
              size="xs"
              variant="dot"
              title="Readmission Risk"
            >
              {r.riskLabel}
            </Badge>
          )}
        </Group>
      ),
    },
    {
      key: "case_manager_id",
      label: "Case Manager",
      render: (r) => <Text size="sm">{truncate(r.case_manager_id, 8)}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge tone={STATUS_COLORS[r.status] ?? "neutral"} variant="filled" size="sm">
          {r.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      render: (r) => (
        <Badge tone={PRIORITY_COLORS[r.priority] ?? "neutral"} variant="light" size="sm">
          {r.priority}
        </Badge>
      ),
    },
    {
      key: "los",
      label: "LOS",
      render: (r) =>
        r.losDays > 0 ? (
          <Badge tone={TONE_BY_COLOR[r.losColor] ?? "neutral"} size="sm" variant="light">
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
          <IconButton
            tone="default"
            size="sm"
            onClick={() => {
              setEditing(r);
              detailHandlers.open();
            }}
            title="View Details"
            aria-label="Circle Dot"
          >
            <IconCircleDot size={14} />
          </IconButton>
          {canUpdate && (
            <IconButton
              tone="default"
              size="sm"
              onClick={() => {
                setEditing(r);
                resetEdit({
                  status: toCaseStatusFormValue(r.status),
                  priority: toCasePriorityFormValue(r.priority),
                  target_discharge_date: r.target_discharge_date ?? "",
                  actual_discharge_date: r.actual_discharge_date ?? "",
                  discharge_disposition: r.discharge_disposition ?? "",
                  notes: r.notes ?? "",
                });
                editHandlers.open();
              }}
              aria-label="Edit"
            >
              <IconPencil size={14} />
            </IconButton>
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
              <Text size="xs" c="dimmed">
                CM: {truncate(c.case_manager_id, 8)}
              </Text>
              <Group gap="xs" mt={4}>
                <Badge tone="success" variant="light" size="xs">
                  Active: {c.active_cases}
                </Badge>
                <Badge tone="warning" variant="light" size="xs">
                  Pending: {c.pending_discharge}
                </Badge>
                <Badge tone="primary" variant="light" size="xs">
                  Total: {c.total_cases}
                </Badge>
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
                tone="secondary"
                leftSection={<IconRobot size={16} />}
                onClick={autoHandlers.open}
              >
                Auto-Assign
              </Button>
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                onClick={createHandlers.open}
              >
                Assign Case
              </Button>
            </>
          )}
        </Group>
      </Group>

      <DataTable
        columns={columns}
        data={filteredAssignments}
        loading={isLoading}
        rowKey={(r) => r.id}
      />

      {/* Create Drawer */}
      <Drawer
        opened={createOpen}
        onClose={createHandlers.close}
        title="Assign Case"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleCreateSubmit(submitCreateCase)}>
          <Controller
            name="admission_id"
            control={createControl}
            render={({ field }) => (
              <TextInput
                label="Admission ID"
                required
                {...field}
                error={createErrors.admission_id?.message}
              />
            )}
          />
          <Controller
            name="patient_id"
            control={createControl}
            render={({ field }) => (
              <PatientSearchSelect value={field.value} onChange={field.onChange} required />
            )}
          />
          {createErrors.patient_id?.message && (
            <Text size="xs" c="danger">
              {createErrors.patient_id.message}
            </Text>
          )}
          <Controller
            name="case_manager_id"
            control={createControl}
            render={({ field }) => (
              <TextInput
                label="Case Manager ID"
                required
                {...field}
                error={createErrors.case_manager_id?.message}
              />
            )}
          />
          <Controller
            name="priority"
            control={createControl}
            render={({ field }) => (
              <Select
                label="Priority"
                data={casePriorityOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "routine")}
                error={createErrors.priority?.message}
              />
            )}
          />
          <Controller
            name="target_discharge_date"
            control={createControl}
            render={({ field }) => (
              <DateInput
                label="Target Discharge Date"
                value={field.value ? new Date(field.value) : null}
                onChange={(date) =>
                  field.onChange(date ? new Date(date).toISOString().slice(0, 10) : "")
                }
                error={createErrors.target_discharge_date?.message}
              />
            )}
          />
          <Controller
            name="notes"
            control={createControl}
            render={({ field }) => (
              <Textarea label="Notes" {...field} error={createErrors.notes?.message} />
            )}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Create Assignment
          </Button>
        </Stack>
      </Drawer>

      {/* Auto-Assign Drawer */}
      <Drawer
        opened={autoOpen}
        onClose={autoHandlers.close}
        title="Auto-Assign Case"
        position="right"
        size="sm"
      >
        <Stack component="form" onSubmit={handleAutoSubmit(submitAutoAssign)}>
          <Controller
            name="admission_id"
            control={autoControl}
            render={({ field }) => (
              <TextInput
                label="Admission ID"
                required
                {...field}
                error={autoErrors.admission_id?.message}
              />
            )}
          />
          <Controller
            name="patient_id"
            control={autoControl}
            render={({ field }) => (
              <PatientSearchSelect value={field.value} onChange={field.onChange} required />
            )}
          />
          {autoErrors.patient_id?.message && (
            <Text size="xs" c="danger">
              {autoErrors.patient_id.message}
            </Text>
          )}
          <Controller
            name="priority"
            control={autoControl}
            render={({ field }) => (
              <Select
                label="Priority"
                data={casePriorityOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={autoErrors.priority?.message}
              />
            )}
          />
          <Button
            tone="primary"
            type="submit"
            loading={autoMut.isPending}
            leftSection={<IconRobot size={16} />}
          >
            Auto-Assign
          </Button>
        </Stack>
      </Drawer>

      {/* Edit Drawer */}
      <Drawer
        opened={editOpen}
        onClose={editHandlers.close}
        title="Edit Case Assignment"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleEditSubmit(submitUpdateCase)}>
          <Controller
            name="status"
            control={editControl}
            render={({ field }) => (
              <Select
                label="Status"
                data={caseStatusOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={editErrors.status?.message}
              />
            )}
          />
          <Controller
            name="priority"
            control={editControl}
            render={({ field }) => (
              <Select
                label="Priority"
                data={casePriorityOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={editErrors.priority?.message}
              />
            )}
          />
          <Controller
            name="target_discharge_date"
            control={editControl}
            render={({ field }) => (
              <DateInput
                label="Target Discharge Date"
                value={field.value ? new Date(field.value) : null}
                onChange={(date) =>
                  field.onChange(date ? new Date(date).toISOString().slice(0, 10) : "")
                }
                error={editErrors.target_discharge_date?.message}
              />
            )}
          />
          <Controller
            name="actual_discharge_date"
            control={editControl}
            render={({ field }) => (
              <DateInput
                label="Actual Discharge Date"
                value={field.value ? new Date(field.value) : null}
                onChange={(date) =>
                  field.onChange(date ? new Date(date).toISOString().slice(0, 10) : "")
                }
                error={editErrors.actual_discharge_date?.message}
              />
            )}
          />
          <Controller
            name="discharge_disposition"
            control={editControl}
            render={({ field }) => (
              <TextInput
                label="Discharge Disposition"
                {...field}
                error={editErrors.discharge_disposition?.message}
              />
            )}
          />
          <Controller
            name="notes"
            control={editControl}
            render={({ field }) => (
              <Textarea label="Notes" {...field} error={editErrors.notes?.message} />
            )}
          />
          <Button tone="primary" type="submit" loading={updateMut.isPending}>
            Update Assignment
          </Button>
        </Stack>
      </Drawer>

      {/* Case Detail Modal with Progress Tracking */}
      <Modal
        opened={detailOpen}
        onClose={detailHandlers.close}
        title="Case Details & Progress"
        size="lg"
      >
        {editing && (
          <Stack gap="md">
            <SimpleGrid cols={2}>
              <div>
                <Text size="xs" c="dimmed">
                  Patient ID
                </Text>
                <Text fw={600}>{editing.patient_id}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Admission ID
                </Text>
                <Text fw={600}>{editing.admission_id}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Case Manager
                </Text>
                <Text fw={600}>{editing.case_manager_id}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Priority
                </Text>
                <Badge tone={PRIORITY_COLORS[editing.priority] ?? "neutral"}>
                  {editing.priority}
                </Badge>
              </div>
            </SimpleGrid>

            {/* Care Plan Progress */}
            <Card withBorder p="md">
              <Text fw={600} mb="sm">
                Care Plan Progress
              </Text>
              {(() => {
                // Parse milestones from notes or create dummy data
                const createdDate = editing.created_at ?? new Date().toISOString();
                const targetDate = editing.target_discharge_date ?? new Date().toISOString();
                const actualDate = editing.actual_discharge_date ?? "";

                const milestones = [
                  {
                    title: "Initial Assessment",
                    target: createdDate,
                    completed: createdDate,
                    status: "completed",
                  },
                  {
                    title: "Care Plan Development",
                    target: targetDate,
                    completed:
                      editing.status === "active" ? new Date().toISOString().slice(0, 10) : "",
                    status: editing.status === "active" ? "completed" : "pending",
                  },
                  {
                    title: "Discharge Planning",
                    target: targetDate,
                    completed:
                      editing.status === "pending_discharge"
                        ? new Date().toISOString().slice(0, 10)
                        : "",
                    status:
                      editing.status === "pending_discharge" || editing.status === "discharged"
                        ? "completed"
                        : "pending",
                  },
                  {
                    title: "Discharge Execution",
                    target: targetDate,
                    completed: actualDate,
                    status: editing.status === "discharged" ? "completed" : "pending",
                  },
                ];

                const completedCount = milestones.filter((m) => m.status === "completed").length;
                const progressPct = (completedCount / milestones.length) * 100;

                return (
                  <>
                    <Progress value={progressPct} color="primary" size="lg" mb="md" />
                    <Text size="sm" c="dimmed" mb="md">
                      {completedCount} of {milestones.length} milestones completed (
                      {progressPct.toFixed(0)}%)
                    </Text>
                    <Timeline active={completedCount - 1} bulletSize={24} lineWidth={2}>
                      {milestones.map((m) => (
                        <Timeline.Item
                          key={m.title}
                          bullet={
                            m.status === "completed" ? (
                              <IconCheck size={12} />
                            ) : (
                              <IconAlertCircle size={12} />
                            )
                          }
                          title={m.title}
                        >
                          <Text size="xs" c="dimmed">
                            Target: {m.target}
                          </Text>
                          {m.completed && (
                            <Text size="xs" c="teal">
                              Completed: {m.completed}
                            </Text>
                          )}
                          <Badge
                            tone={m.status === "completed" ? "success" : "neutral"}
                            size="xs"
                            mt={4}
                          >
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
                <Text size="xs" fw={600} c="dimmed">
                  Notes
                </Text>
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
      caseManagementService.listDischargeBarriers({
        case_assignment_id: filterAssignmentId || undefined,
        barrier_type: filterType ?? undefined,
        is_resolved: filterResolved === "all" ? undefined : (filterResolved ?? undefined),
      }),
  });

  const barrierForm = useForm<DischargeBarrierFormInput>({
    resolver: zodResolver(dischargeBarrierFormSchema),
    defaultValues: {
      case_assignment_id: "",
      barrier_type: "insurance_auth",
      description: "",
    },
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = barrierForm;

  const createMut = useMutation({
    mutationFn: (data: CreateDischargeBarrierRequest) =>
      caseManagementService.createDischargeBarrier(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["case-barriers"] });
      createHandlers.close();
      reset();
      notifications.show({
        title: "Barrier Added",
        message: "Discharge barrier recorded",
        color: "success",
      });
    },
  });

  const resolveMut = useMutation({
    mutationFn: (id: string) =>
      caseManagementService.updateDischargeBarrier(id, { is_resolved: true }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["case-barriers"] });
      notifications.show({
        title: "Resolved",
        message: "Barrier marked as resolved",
        color: "teal",
      });
    },
  });

  const submitBarrier = (values: DischargeBarrierFormInput) => {
    createMut.mutate({
      case_assignment_id: values.case_assignment_id.trim(),
      barrier_type: values.barrier_type,
      description: values.description.trim(),
    });
  };

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
        <Badge tone={BARRIER_TYPE_COLORS[r.barrier_type] ?? "neutral"} variant="filled" size="sm">
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
          <Badge tone="success" variant="filled" size="sm">
            Resolved
          </Badge>
        ) : (
          <Badge tone="danger" variant="filled" size="sm">
            Unresolved
          </Badge>
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
          <IconButton
            tone="success"
            size="sm"
            onClick={() => resolveMut.mutate(r.id)}
            aria-label="Confirm"
          >
            <IconCheck size={14} />
          </IconButton>
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
          data={dischargeBarrierTypeOptions}
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
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={createHandlers.open}
            ml="auto"
          >
            Add Barrier
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={barriers} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer
        opened={createOpen}
        onClose={createHandlers.close}
        title="Add Discharge Barrier"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmit(submitBarrier)}>
          <Controller
            name="case_assignment_id"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Case Assignment ID"
                required
                {...field}
                error={errors.case_assignment_id?.message}
              />
            )}
          />
          <Controller
            name="barrier_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Barrier Type"
                required
                data={dischargeBarrierTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "insurance_auth")}
                error={errors.barrier_type?.message}
              />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <Textarea
                label="Description"
                required
                {...field}
                error={errors.description?.message}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
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
    queryFn: () => caseManagementService.listCaseReferrals(),
  });

  const referralForm = useForm<CaseReferralFormInput>({
    resolver: zodResolver(caseReferralFormSchema),
    defaultValues: {
      case_assignment_id: "",
      referral_type: "post_acute",
      referred_to: "",
      facility_name: "",
    },
  });
  const {
    control: referralControl,
    handleSubmit: handleReferralSubmit,
    reset: resetReferral,
    formState: { errors: referralErrors },
  } = referralForm;
  const referralUpdateForm = useForm<CaseReferralUpdateFormInput>({
    resolver: zodResolver(caseReferralUpdateFormSchema),
    defaultValues: {
      status: "",
      outcome: "",
    },
  });
  const {
    control: referralUpdateControl,
    handleSubmit: handleReferralUpdateSubmit,
    reset: resetReferralUpdate,
    formState: { errors: referralUpdateErrors },
  } = referralUpdateForm;

  const createMut = useMutation({
    mutationFn: (data: CreateCaseReferralRequest) => caseManagementService.createCaseReferral(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["case-referrals"] });
      createHandlers.close();
      resetReferral();
      notifications.show({
        title: "Referral Created",
        message: "Referral recorded",
        color: "success",
      });
    },
  });

  const updateMut = useMutation({
    mutationFn: (data: UpdateCaseReferralRequest) => {
      if (!editing) return Promise.reject(new Error("No referral selected"));
      return caseManagementService.updateCaseReferral(editing.id, data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["case-referrals"] });
      editHandlers.close();
      setEditing(null);
      resetReferralUpdate();
      notifications.show({ title: "Updated", message: "Referral updated", color: "success" });
    },
  });

  const submitReferral = (values: CaseReferralFormInput) => {
    const facilityName = caseOptionalText(values.facility_name);
    createMut.mutate({
      case_assignment_id: values.case_assignment_id.trim(),
      referral_type: values.referral_type,
      referred_to: values.referred_to.trim(),
      facility_details: facilityName ? { name: facilityName } : undefined,
    });
  };

  const submitReferralUpdate = (values: CaseReferralUpdateFormInput) => {
    updateMut.mutate({
      status: values.status || undefined,
      outcome: caseOptionalText(values.outcome),
    });
  };

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
        <Badge tone="neutral" variant="light" size="sm">
          {caseReferralTypeOptions.find((t) => t.value === r.referral_type)?.label ??
            r.referral_type}
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
        <Badge tone={REFERRAL_STATUS_COLORS[r.status] ?? "neutral"} variant="filled" size="sm">
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
          <IconButton
            tone="default"
            size="sm"
            onClick={() => {
              setEditing(r);
              resetReferralUpdate({
                status: toCaseReferralStatusFormValue(r.status),
                outcome: r.outcome ?? "",
              });
              editHandlers.open();
            }}
            aria-label="Edit"
          >
            <IconPencil size={14} />
          </IconButton>
        ) : null,
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            Create Referral
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={referrals} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create Drawer */}
      <Drawer
        opened={createOpen}
        onClose={createHandlers.close}
        title="Create Referral"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleReferralSubmit(submitReferral)}>
          <Controller
            name="case_assignment_id"
            control={referralControl}
            render={({ field }) => (
              <TextInput
                label="Case Assignment ID"
                required
                {...field}
                error={referralErrors.case_assignment_id?.message}
              />
            )}
          />
          <Controller
            name="referral_type"
            control={referralControl}
            render={({ field }) => (
              <Select
                label="Referral Type"
                required
                data={caseReferralTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "post_acute")}
                error={referralErrors.referral_type?.message}
              />
            )}
          />
          <Controller
            name="referred_to"
            control={referralControl}
            render={({ field }) => (
              <TextInput
                label="Referred To"
                required
                {...field}
                error={referralErrors.referred_to?.message}
              />
            )}
          />
          <Controller
            name="facility_name"
            control={referralControl}
            render={({ field }) => (
              <TextInput
                label="Facility Name"
                {...field}
                error={referralErrors.facility_name?.message}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Create Referral
          </Button>
        </Stack>
      </Drawer>

      {/* Edit Drawer */}
      <Drawer
        opened={editOpen}
        onClose={editHandlers.close}
        title="Edit Referral"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleReferralUpdateSubmit(submitReferralUpdate)}>
          <Controller
            name="status"
            control={referralUpdateControl}
            render={({ field }) => (
              <Select
                label="Status"
                data={caseReferralStatusOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={referralUpdateErrors.status?.message}
              />
            )}
          />
          <Controller
            name="outcome"
            control={referralUpdateControl}
            render={({ field }) => (
              <Textarea label="Outcome" {...field} error={referralUpdateErrors.outcome?.message} />
            )}
          />
          <Button tone="primary" type="submit" loading={updateMut.isPending}>
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
    queryFn: () => caseManagementService.dispositionAnalytics(),
  });

  const { data: barrierData = [], isLoading: barrierLoading } = useQuery({
    queryKey: ["case-analytics-barriers"],
    queryFn: () => caseManagementService.barrierAnalytics(),
  });

  const { data: outcomes } = useQuery({
    queryKey: ["case-analytics-outcomes"],
    queryFn: () => caseManagementService.outcomeAnalytics(),
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
      render: (r) => (
        <Text size="sm" fw={600}>
          {r.count}
        </Text>
      ),
    },
  ];

  const barrierCols: Column<BarrierAnalyticsRow>[] = [
    {
      key: "barrier_type",
      label: "Barrier Type",
      render: (r) => (
        <Badge tone={BARRIER_TYPE_COLORS[r.barrier_type] ?? "neutral"} variant="light" size="sm">
          {r.barrier_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "count",
      label: "Count",
      render: (r) => (
        <Text size="sm" fw={600}>
          {r.count}
        </Text>
      ),
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
              outcomes.avg_days_to_discharge !== undefined &&
              outcomes.avg_days_to_discharge !== null
                ? outcomes.avg_days_to_discharge.toFixed(1)
                : "\u2014"
            }
          />
          <StatCard label="Total Discharged" value={outcomes.total_discharged} />
          <StatCard label="Total with Barriers" value={outcomes.total_with_barriers} />
        </SimpleGrid>
      )}

      {/* Disposition Table */}
      <Text fw={600} size="lg">
        Disposition Breakdown
      </Text>
      <DataTable
        columns={dispositionCols}
        data={dispositions}
        loading={dispLoading}
        rowKey={(r) => r.disposition ?? "none"}
      />

      {/* Barrier Breakdown Table */}
      <Text fw={600} size="lg">
        Barrier Breakdown
      </Text>
      <DataTable
        columns={barrierCols}
        data={barrierData}
        loading={barrierLoading}
        rowKey={(r) => r.barrier_type}
      />
    </Stack>
  );
}
