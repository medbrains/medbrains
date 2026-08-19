// TV-Displays QueueTokensTab — split from tv-displays.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Card, Group, Select, SimpleGrid, Stack, Text, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { QueueTokenFormInput } from "@medbrains/schemas";
import { queueTokenFormSchema } from "@medbrains/schemas";
import { useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import type {
  CreateQueueTokenRequest,
  DepartmentRow,
  QueueToken,
  QueueTokenStatus,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconCheck,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconTicket,
  IconUserOff,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, IconButton, toast } from "@/components/ui";
import { defaultQueueTokenFormValues, queueTokenFormToRequest } from "@/forms/tv-displays.form";
import { DEPARTMENT_LIST_CODES } from "@/lib/api-permission-sets";
import { tvDisplaysService } from "@/services/tvDisplays.service";
import styles from "../tv-displays.module.scss";
import { DISPLAY_LIST_REFRESH_MS, QUEUE_REFRESH_MS, todayIsoDate } from "./shared";

const TOKEN_STATUSES = [
  { value: "waiting", label: "Waiting" },
  { value: "called", label: "Called" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No Show" },
  { value: "cancelled", label: "Cancelled" },
];

const statusColors: Record<string, BadgeTone> = {
  waiting: "neutral",
  called: "primary",
  in_progress: "success",
  completed: "success",
  no_show: "danger",
  cancelled: "neutral",
};

interface DepartmentQueueLane {
  departmentId: string;
  departmentName: string;
  currentTokens: QueueToken[];
  displayCount: number;
  nextToken: QueueToken | null;
  nextTokens: QueueToken[];
  waitingCount: number;
}

function toQueueTokenStatus(value: string | null): QueueTokenStatus | null {
  if (
    value === "waiting" ||
    value === "called" ||
    value === "in_progress" ||
    value === "completed" ||
    value === "no_show" ||
    value === "cancelled"
  ) {
    return value;
  }
  return null;
}

function tokenStatusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function departmentName(departments: DepartmentRow[], departmentId: string) {
  return departments.find((department) => department.id === departmentId)?.name ?? departmentId;
}

export function QueueTokensTab({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<QueueTokenStatus | null>(null);
  const [generateOpened, { open: openGenerate, close: closeGenerate }] = useDisclosure(false);
  const tokenForm = useForm<QueueTokenFormInput>({
    resolver: zodResolver(queueTokenFormSchema),
    defaultValues: defaultQueueTokenFormValues,
  });
  const today = todayIsoDate();

  // The department picker is the shared setup endpoint, which takes
  // require_any_permission over nineteen codes. Mirror the handler rather than
  // guess one member — gating on one would hide the picker from people the
  // server would allow.
  const canListDepartments = useHasAnyPermission(DEPARTMENT_LIST_CODES);
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => tvDisplaysService.listDepartments(),
    enabled: canListDepartments,
  });

  const { data: displays = [] } = useQuery({
    queryKey: ["tv-displays"],
    queryFn: () => tvDisplaysService.listTvDisplays(),
    refetchInterval: DISPLAY_LIST_REFRESH_MS,
  });

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ["queue-tokens", today, selectedDepartment, selectedStatus],
    queryFn: () =>
      tvDisplaysService.listQueueTokens({
        department_id: selectedDepartment || undefined,
        status: selectedStatus || undefined,
        date: today,
      }),
    refetchInterval: QUEUE_REFRESH_MS,
  });

  // The board's contents are served under admin.tv_displays.board, which is a
  // different code from the one that opens this settings tab.
  const canReadBoard = useHasPermission(P.ADMIN.TV_DISPLAYS_BOARD);
  const { data: queueState } = useQuery({
    queryKey: ["queue-state", selectedDepartment],
    queryFn: () =>
      selectedDepartment ? tvDisplaysService.getQueueState(selectedDepartment) : null,
    enabled: !!selectedDepartment && canReadBoard,
    refetchInterval: QUEUE_REFRESH_MS,
  });

  const opdDisplays = useMemo(
    () => displays.filter((display) => display.display_type === "opd_queue"),
    [displays],
  );
  const queueSummary = useMemo(() => {
    const currentTokens = tokens.filter(
      (token) => token.status === "called" || token.status === "in_progress",
    );
    const waitingTokens = tokens.filter((token) => token.status === "waiting");
    const completedTokens = tokens.filter((token) => token.status === "completed");
    const noShowTokens = tokens.filter((token) => token.status === "no_show");
    const scopedDisplays = selectedDepartment
      ? opdDisplays.filter(
          (display) => !display.department_id || display.department_id === selectedDepartment,
        )
      : opdDisplays;
    return {
      completedTokens,
      currentTokens,
      noShowTokens,
      scopedDisplays,
      waitingTokens,
    };
  }, [opdDisplays, selectedDepartment, tokens]);
  const departmentLanes = useMemo<DepartmentQueueLane[]>(() => {
    const lanes = new Map<string, DepartmentQueueLane>();

    function laneFor(departmentId: string) {
      const existing = lanes.get(departmentId);
      if (existing) return existing;
      const lane: DepartmentQueueLane = {
        currentTokens: [],
        departmentId,
        departmentName: departmentName(departments, departmentId),
        displayCount: opdDisplays.filter(
          (display) => !display.department_id || display.department_id === departmentId,
        ).length,
        nextToken: null,
        nextTokens: [],
        waitingCount: 0,
      };
      lanes.set(departmentId, lane);
      return lane;
    }

    for (const token of tokens) {
      const lane = laneFor(token.department_id);
      if (token.status === "waiting") {
        lane.waitingCount += 1;
        lane.nextTokens.push(token);
        lane.nextToken ??= token;
      }
      if (token.status === "called" || token.status === "in_progress") {
        lane.currentTokens.push(token);
      }
    }

    return [...lanes.values()].sort((left, right) =>
      left.departmentName.localeCompare(right.departmentName),
    );
  }, [departments, opdDisplays, tokens]);

  const generateMutation = useMutation({
    mutationFn: (data: CreateQueueTokenRequest) => tvDisplaysService.createQueueToken(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["queue-tokens"] });
      toast.success(`Token ${result.token_number} created successfully`, {
        title: "Token Generated",
      });
      closeGenerate();
    },
    onError: () => {
      toast.error("Failed to generate token", { title: "Error" });
    },
  });

  const callMutation = useMutation({
    mutationFn: (id: string) => tvDisplaysService.callQueueToken(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["queue-tokens"] });
      void queryClient.invalidateQueries({ queryKey: ["queue-state"] });
      toast.success("Token called", { title: "Success" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => tvDisplaysService.completeQueueToken(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["queue-tokens"] });
      void queryClient.invalidateQueries({ queryKey: ["queue-state"] });
      toast.success("Token completed", { title: "Success" });
    },
  });

  const noShowMutation = useMutation({
    mutationFn: (id: string) => tvDisplaysService.noShowQueueToken(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["queue-tokens"] });
      void queryClient.invalidateQueries({ queryKey: ["queue-state"] });
      toast.warning("Token marked as no-show", { title: "Success" });
    },
  });

  const columns: Column<QueueToken>[] = [
    {
      key: "token_number",
      label: "Token",
      render: (row) => (
        <Badge tone="neutral" size="lg" variant="filled">
          {row.token_number}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <Badge tone={statusColors[row.status] || "neutral"}>{tokenStatusLabel(row.status)}</Badge>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      render: (row) => (
        <Badge tone="neutral" variant="outline">
          {row.priority}
        </Badge>
      ),
    },
    {
      key: "department_id",
      label: "Department",
      render: (row) => departmentName(departments, row.department_id),
    },
    {
      key: "called_at",
      label: "Called At",
      render: (row) => (row.called_at ? new Date(row.called_at).toLocaleTimeString() : "-"),
    },
    {
      key: "created_at",
      label: "Created",
      render: (row) => new Date(row.created_at).toLocaleTimeString(),
    },
    {
      key: "id",
      label: "Actions",
      render: (row) => {
        if (!canManage) return null;
        return (
          <Group gap="xs">
            {row.status === "waiting" && (
              <Tooltip label="Call">
                <IconButton
                  tone="primary"
                  onClick={() => callMutation.mutate(row.id)}
                  loading={callMutation.isPending}
                  aria-label="Call"
                >
                  <IconPlayerPlay size={16} />
                </IconButton>
              </Tooltip>
            )}
            {(row.status === "called" || row.status === "in_progress") && (
              <>
                <Tooltip label="Complete">
                  <IconButton
                    tone="success"
                    onClick={() => completeMutation.mutate(row.id)}
                    loading={completeMutation.isPending}
                    aria-label="Complete"
                  >
                    <IconCheck size={16} />
                  </IconButton>
                </Tooltip>
                <Tooltip label="No Show">
                  <IconButton
                    tone="danger"
                    onClick={() => noShowMutation.mutate(row.id)}
                    loading={noShowMutation.isPending}
                    aria-label="No Show"
                  >
                    <IconUserOff size={16} />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Group>
        );
      },
    },
  ];

  const handleGenerateSubmit = tokenForm.handleSubmit((values) => {
    generateMutation.mutate(queueTokenFormToRequest(values));
  });

  return (
    <>
      <Box className={styles.queueMetricGrid} mb="md">
        <Box className={styles.queueMetric}>
          <Text size="sm" c="dimmed">
            Now Serving
          </Text>
          <Text size="xl" fw={700}>
            {queueSummary.currentTokens.map((token) => token.token_number).join(", ") || "-"}
          </Text>
        </Box>
        <Box className={styles.queueMetric}>
          <Text size="sm" c="dimmed">
            Waiting
          </Text>
          <Text size="xl" fw={700} c="primary">
            {queueSummary.waitingTokens.length}
          </Text>
        </Box>
        <Box className={styles.queueMetric}>
          <Text size="sm" c="dimmed">
            Completed Today
          </Text>
          <Text size="xl" fw={700} c="success">
            {queueSummary.completedTokens.length}
          </Text>
        </Box>
        <Box className={styles.queueMetric}>
          <Text size="sm" c="dimmed">
            No Shows
          </Text>
          <Text size="xl" fw={700} c="danger">
            {queueSummary.noShowTokens.length}
          </Text>
        </Box>
        <Box className={styles.queueMetric}>
          <Text size="sm" c="dimmed">
            Linked Displays
          </Text>
          <Text size="xl" fw={700}>
            {queueSummary.scopedDisplays.length}
          </Text>
        </Box>
      </Box>

      {departmentLanes.length > 0 && (
        <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} mb="md" spacing="sm">
          {departmentLanes.map((lane) => {
            const activeToken = lane.currentTokens[0] ?? null;
            const nextToken = lane.nextToken;
            return (
              <Box key={lane.departmentId} className={styles.queueLane}>
                <Group justify="space-between" align="flex-start">
                  <Stack gap={2}>
                    <Text fw={700}>{lane.departmentName}</Text>
                    <Text size="xs" c="dimmed">
                      medbrains://tv/queue?department={lane.departmentId}
                    </Text>
                  </Stack>
                  <Badge tone={lane.displayCount > 0 ? "primary" : "warning"}>
                    {lane.displayCount} displays
                  </Badge>
                </Group>
                <Group mt="sm" justify="space-between" align="flex-end" gap="sm">
                  <Group gap="xs">
                    <Badge tone={lane.currentTokens.length > 0 ? "success" : "neutral"}>
                      Now {lane.currentTokens.map((token) => token.token_number).join(", ") || "-"}
                    </Badge>
                    <Badge tone="primary">Waiting {lane.waitingCount}</Badge>
                    <Badge tone="neutral">
                      Next{" "}
                      {lane.nextTokens
                        .slice(0, 3)
                        .map((token) => token.token_number)
                        .join(", ") || "-"}
                    </Badge>
                  </Group>
                  {canManage && (
                    <Group gap={4}>
                      {nextToken && (
                        <Tooltip label={`Call ${nextToken.token_number}`}>
                          <IconButton
                            tone="primary"
                            aria-label={`Call token ${nextToken.token_number}`}
                            onClick={() => callMutation.mutate(nextToken.id)}
                            loading={callMutation.isPending}
                          >
                            <IconPlayerPlay size={16} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {activeToken && (
                        <>
                          <Tooltip label={`Complete ${activeToken.token_number}`}>
                            <IconButton
                              tone="success"
                              aria-label={`Complete token ${activeToken.token_number}`}
                              onClick={() => completeMutation.mutate(activeToken.id)}
                              loading={completeMutation.isPending}
                            >
                              <IconCheck size={16} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip label={`No-show ${activeToken.token_number}`}>
                            <IconButton
                              tone="danger"
                              aria-label={`Mark token ${activeToken.token_number} no-show`}
                              onClick={() => noShowMutation.mutate(activeToken.id)}
                              loading={noShowMutation.isPending}
                            >
                              <IconUserOff size={16} />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Group>
                  )}
                </Group>
              </Box>
            );
          })}
        </SimpleGrid>
      )}

      {queueState && (
        <SimpleGrid cols={4} mb="md">
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Current Token
            </Text>
            <Text size="xl" fw={700}>
              {queueState.current_token?.token_number || "-"}
            </Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Waiting
            </Text>
            <Text size="xl" fw={700} c="primary">
              {queueState.waiting_count}
            </Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Completed Today
            </Text>
            <Text size="xl" fw={700} c="success">
              {queueState.completed_count}
            </Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Next Up
            </Text>
            <Text size="lg">
              {queueState.next_tokens
                .slice(0, 3)
                .map((t) => t.token_number)
                .join(", ") || "-"}
            </Text>
          </Card>
        </SimpleGrid>
      )}

      {/* Filters */}
      {generateOpened && (
        <Box className={styles.generatePanel} mb="md">
          <form onSubmit={handleGenerateSubmit}>
            <Stack gap="md">
              <Group justify="space-between" align="flex-start">
                <Stack gap={2}>
                  <Text fw={700}>Generate queue token</Text>
                  <Text size="xs" c="dimmed">
                    {selectedDepartment
                      ? departmentName(departments, selectedDepartment)
                      : "Select a department before issuing a token"}
                  </Text>
                </Stack>
                <Button tone="ghost" type="button" size="xs" onClick={closeGenerate}>
                  Close
                </Button>
              </Group>
              <Group align="flex-start">
                <Controller
                  control={tokenForm.control}
                  name="department_id"
                  render={({ field, fieldState }) => (
                    <Select
                      label="Department"
                      data={departments.map((d: DepartmentRow) => ({ value: d.id, label: d.name }))}
                      value={field.value || null}
                      onChange={(value) => field.onChange(value ?? "")}
                      error={fieldState.error?.message}
                      required
                      className={styles.tokenFormField}
                    />
                  )}
                />
                <Controller
                  control={tokenForm.control}
                  name="patient_id"
                  render={({ field }) => (
                    <Box className={styles.tokenFormField}>
                      <PatientSearchSelect
                        label="Patient (optional)"
                        value={field.value}
                        onChange={field.onChange}
                        error={tokenForm.formState.errors.patient_id?.message}
                      />
                    </Box>
                  )}
                />
                <Controller
                  control={tokenForm.control}
                  name="doctor_id"
                  render={({ field }) => (
                    <Box className={styles.tokenFormField}>
                      <DoctorSearchSelect
                        label="Doctor (optional)"
                        value={field.value}
                        onChange={field.onChange}
                        error={tokenForm.formState.errors.doctor_id?.message}
                      />
                    </Box>
                  )}
                />
                <Controller
                  control={tokenForm.control}
                  name="priority"
                  render={({ field, fieldState }) => (
                    <Select
                      label="Priority"
                      data={[
                        { value: "normal", label: "Normal" },
                        { value: "elderly", label: "Elderly" },
                        { value: "disabled", label: "Disabled" },
                        { value: "pregnant", label: "Pregnant" },
                        { value: "emergency_referral", label: "Emergency Referral" },
                        { value: "vip", label: "VIP" },
                      ]}
                      value={field.value}
                      onChange={(value) => field.onChange(value ?? "normal")}
                      error={fieldState.error?.message}
                      className={styles.tokenPriorityField}
                    />
                  )}
                />
                <Button
                  tone="primary"
                  type="submit"
                  loading={generateMutation.isPending}
                  leftSection={<IconTicket size={16} />}
                  className={styles.tokenSubmitButton}
                >
                  Generate
                </Button>
              </Group>
            </Stack>
          </form>
        </Box>
      )}

      <Group mb="md" className={styles.queueToolbar}>
        <Select
          placeholder="Filter by department"
          data={departments.map((d: DepartmentRow) => ({ value: d.id, label: d.name }))}
          value={selectedDepartment}
          onChange={setSelectedDepartment}
          clearable
          style={{ width: 200 }}
        />
        <Select
          placeholder="Filter by status"
          data={TOKEN_STATUSES}
          value={selectedStatus}
          onChange={(value) => setSelectedStatus(toQueueTokenStatus(value))}
          clearable
          style={{ width: 150 }}
        />
        <Button
          tone="ghost"
          leftSection={<IconRefresh size={16} />}
          onClick={() => {
            void queryClient.invalidateQueries({ queryKey: ["queue-tokens"] });
            void queryClient.invalidateQueries({ queryKey: ["queue-state"] });
          }}
        >
          Refresh
        </Button>
        <div style={{ flex: 1 }} />
        {canManage && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              tokenForm.reset({
                ...defaultQueueTokenFormValues,
                department_id: selectedDepartment ?? "",
              });
              generateOpened ? closeGenerate() : openGenerate();
            }}
          >
            {generateOpened ? "Hide Generator" : "Generate Token"}
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={tokens}
        loading={isLoading}
        rowKey={(row) => row.id}
        virtualized="auto"
        virtualizeAt={40}
        virtualRowHeight={58}
        tableMaxHeight="calc(100vh - 500px)"
      />
    </>
  );
}
