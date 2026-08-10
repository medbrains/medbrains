// Case-management CaseBoardTab — split from case-management.tsx (pure move).

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
} from "@medbrains/schemas";
import {
  caseAssignmentFormSchema,
  caseAssignmentUpdateFormSchema,
  caseAutoAssignFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AutoAssignRequest,
  CaseAssignment,
  CreateCaseAssignmentRequest,
  UpdateCaseAssignmentRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertCircle,
  IconCheck,
  IconCircleDot,
  IconPencil,
  IconPlus,
  IconRobot,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import {
  caseOptionalText,
  casePriorityOptions,
  caseStatusOptions,
  toCasePriorityFormValue,
  toCaseStatusFormValue,
} from "@/forms/case-management.form";
import { caseManagementService } from "@/services/case-management.service";
import { truncate } from "./shared";

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

const TONE_BY_COLOR: Record<string, BadgeTone> = {
  success: "success",
  danger: "danger",
  warning: "warning",
  slate: "neutral",
  orange: "warning",
  teal: "success",
  primary: "primary",
};

export function CaseBoardTab() {
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
              <EmployeeSearchSelect
                label="Case manager"
                required
                value={field.value}
                onChange={field.onChange}
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

            {/* Case stage — the status machine, not a care plan */}
            <Card withBorder p="md">
              <Text fw={600} mb="sm">
                Case stage
              </Text>
              {(() => {
                /*
                 * These are the case's own status stages, not a care plan.
                 *
                 * They used to be titled "Care Plan Progress" with milestone
                 * names — "Initial Assessment", "Care Plan Development" — that
                 * no assessment or plan record backs. Worse, a stage reached at
                 * any point in the past was stamped "Completed: <today>", so a
                 * case that moved to discharge planning three weeks ago read as
                 * having done it this morning.
                 *
                 * There is no milestone model to read, so nothing is invented:
                 * the stages are the status machine, and a date is shown only
                 * where a real one exists.
                 */
                const createdDate = editing.created_at ?? null;
                const targetDate = editing.target_discharge_date ?? null;
                const actualDate = editing.actual_discharge_date ?? null;

                const reached = (...statuses: string[]) => statuses.includes(editing.status);

                const milestones = [
                  {
                    title: "Case opened",
                    target: createdDate,
                    // The only stage with a date the record actually holds.
                    completed: createdDate,
                    status: "completed",
                  },
                  {
                    title: "Active management",
                    target: null,
                    completed: null,
                    status: reached("active", "pending_discharge", "discharged")
                      ? "completed"
                      : "pending",
                  },
                  {
                    title: "Discharge planning",
                    target: targetDate,
                    completed: null,
                    status: reached("pending_discharge", "discharged") ? "completed" : "pending",
                  },
                  {
                    title: "Discharged",
                    target: targetDate,
                    completed: actualDate,
                    status: reached("discharged") ? "completed" : "pending",
                  },
                ];

                const completedCount = milestones.filter((m) => m.status === "completed").length;
                const progressPct = (completedCount / milestones.length) * 100;

                return (
                  <>
                    <Progress value={progressPct} color="primary" size="lg" mb="md" />
                    <Text size="sm" c="dimmed" mb="md">
                      Stage {completedCount} of {milestones.length}
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
                          {m.target && (
                            <Text size="xs" c="dimmed">
                              Target: {m.target}
                            </Text>
                          )}
                          {m.completed && (
                            <Text size="xs" c="teal">
                              {m.completed}
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
