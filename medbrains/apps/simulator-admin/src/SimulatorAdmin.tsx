/**
 * Admin → Simulator control plane.
 *
 * Surfaces the Day-1 backend (POST /api/admin/simulator/*) — schedules
 * carry a JSON profile + cron, run-now spawns a detached engine task.
 * Built for super_admin / hospital_admin; permission check uses
 * P.ADMIN.SYSTEM (both bypass roles see it). Cron scheduler itself is
 * Day-2; today only the cron expression is captured for future use.
 */
import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  JsonInput,
  Modal,
  NumberInput,
  Select,
  Slider,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import type {
  SimulatorProfile,
  SimulatorRun,
  SimulatorRunDetail,
  SimulatorSchedule,
} from "@medbrains/types";
import {
  IconBolt,
  IconHistory,
  IconNews,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { holidayLookup, seasonFor } from "./calendar";

const DEFAULT_PROFILE: SimulatorProfile = {
  patients: 10,
  opd_pct: 0.9,
  er_pct: 0.1,
  branches: {
    lab_pct: 0.25,
    rad_pct: 0.15,
    ipd_escalation_pct: 0.1,
    rx_pct: 0.7,
    dispense_pct: 0.8,
  },
  er: {
    mlc_pct: 0.15,
    admit_pct: 0.3,
    triage_mix: { red: 0.1, yellow: 0.35, green: 0.55 },
  },
};

const STATUS_COLOR: Record<SimulatorRun["status"], string> = {
  running: "blue",
  succeeded: "green",
  failed: "red",
  cancelled: "gray",
};

interface ScheduleFormState {
  name: string;
  description: string;
  cron_expr: string;
  enabled: boolean;
  profileText: string;
}

function profileToText(p: SimulatorProfile): string {
  return JSON.stringify(p, null, 2);
}

function emptyForm(): ScheduleFormState {
  return {
    name: "",
    description: "",
    cron_expr: "",
    enabled: true,
    profileText: profileToText(DEFAULT_PROFILE),
  };
}

type ParsedProfileText = { ok: true; profile: SimulatorProfile } | { ok: false; error: string };

function parseProfileText(text: string): ParsedProfileText {
  try {
    return { ok: true, profile: JSON.parse(text) as SimulatorProfile };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function SimulatorAdmin() {
  // Auth gate is handled by App.tsx; backend enforces bypass-role check.
  const qc = useQueryClient();

  const schedulesQuery = useQuery({
    queryKey: ["simulator-schedules"],
    queryFn: () => api.listSimulatorSchedules(),
  });
  const runsQuery = useQuery({
    queryKey: ["simulator-runs"],
    queryFn: () => api.listSimulatorRuns({ limit: 50 }),
  });

  const [formOpen, formHandlers] = useDisclosure(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleFormState>(emptyForm());
  const [runDetail, setRunDetail] = useState<SimulatorRunDetail | null>(null);
  const [runDetailOpen, runDetailHandlers] = useDisclosure(false);
  const [pendingOnly, setPendingOnly] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (state: ScheduleFormState) => {
      const profile = JSON.parse(state.profileText) as SimulatorProfile;
      return api.createSimulatorSchedule({
        name: state.name,
        description: state.description || undefined,
        cron_expr: state.cron_expr || undefined,
        profile,
        enabled: state.enabled,
      });
    },
    onSuccess: () => {
      notifications.show({ title: "Schedule created", message: "", color: "green" });
      void qc.invalidateQueries({ queryKey: ["simulator-schedules"] });
      formHandlers.close();
    },
    onError: (err: Error) =>
      notifications.show({ title: "Create failed", message: err.message, color: "red" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, state }: { id: string; state: ScheduleFormState }) => {
      const profile = JSON.parse(state.profileText) as SimulatorProfile;
      return api.updateSimulatorSchedule(id, {
        name: state.name,
        description: state.description || undefined,
        cron_expr: state.cron_expr || null,
        profile,
        enabled: state.enabled,
      });
    },
    onSuccess: () => {
      notifications.show({ title: "Schedule updated", message: "", color: "green" });
      void qc.invalidateQueries({ queryKey: ["simulator-schedules"] });
      formHandlers.close();
      setEditingId(null);
    },
    onError: (err: Error) =>
      notifications.show({ title: "Update failed", message: err.message, color: "red" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteSimulatorSchedule(id),
    onSuccess: () => {
      notifications.show({ title: "Schedule deleted", message: "", color: "green" });
      void qc.invalidateQueries({ queryKey: ["simulator-schedules"] });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Delete failed", message: err.message, color: "red" }),
  });

  const runNowMutation = useMutation({
    mutationFn: (id: string) => api.runSimulatorNow(id),
    onSuccess: (res) => {
      notifications.show({
        title: "Simulator started",
        message: `Run ${res.run_id.slice(0, 8)}… queued; refresh runs in a few seconds`,
        color: "teal",
      });
      void qc.invalidateQueries({ queryKey: ["simulator-runs"] });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Run failed", message: err.message, color: "red" }),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    formHandlers.open();
  };

  const openEdit = (s: SimulatorSchedule) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      description: s.description ?? "",
      cron_expr: s.cron_expr ?? "",
      enabled: s.enabled,
      profileText: profileToText(s.profile),
    });
    formHandlers.open();
  };

  const submitForm = () => {
    if (!form.name.trim()) {
      notifications.show({ title: "Name required", message: "", color: "red" });
      return;
    }
    try {
      JSON.parse(form.profileText);
    } catch (err) {
      notifications.show({
        title: "Profile JSON invalid",
        message: (err as Error).message,
        color: "red",
      });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, state: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const schedules = schedulesQuery.data ?? [];
  const runs = runsQuery.data ?? [];
  const scheduleNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of schedules) m[s.id] = s.name;
    return m;
  }, [schedules]);

  const openRunDetail = async (runId: string) => {
    try {
      const detail = await api.getSimulatorRun(runId);
      setRunDetail(detail);
      runDetailHandlers.open();
    } catch (err) {
      notifications.show({
        title: "Could not load run",
        message: (err as Error).message,
        color: "red",
      });
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <Stack gap={2}>
          <Title order={2}>Data simulator</Title>
          <Text size="xs" c="dimmed">
            Internal training records (is_dummy = true). Never visible to regulators.
          </Text>
        </Stack>
        <Group gap="xs">
          <Button
            variant="default"
            leftSection={<IconRefresh size={14} />}
            onClick={() => {
              void schedulesQuery.refetch();
              void runsQuery.refetch();
            }}
          >
            Refresh
          </Button>
          <Button leftSection={<IconPlus size={14} />} onClick={openCreate}>
            New schedule
          </Button>
        </Group>
      </Group>

      <Alert color="yellow" variant="light">
        Every row this simulator writes carries <strong>is_dummy = true</strong>. Make sure
        regulator-facing exports filter that out before running this in any environment a regulator
        can see.
      </Alert>

      <ActiveAlertsBanner />

      <Tabs defaultValue="schedules">
        <Tabs.List>
          <Tabs.Tab value="schedules" leftSection={<IconBolt size={14} />}>
            Schedules
          </Tabs.Tab>
          <Tabs.Tab value="runs" leftSection={<IconHistory size={14} />}>
            Run history
          </Tabs.Tab>
          <Tabs.Tab value="news" leftSection={<IconNews size={14} />}>
            News & alerts
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="schedules" pt="md">
          <Card withBorder padding={0}>
            <Table striped="even" withColumnBorders={false} verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Cron</Table.Th>
                  <Table.Th>Patients / run</Table.Th>
                  <Table.Th>Last run</Table.Th>
                  <Table.Th>Enabled</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {schedules.map((s) => (
                  <Table.Tr key={s.id}>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text size="sm" fw={600}>
                          {s.name}
                        </Text>
                        {s.description && (
                          <Text size="xs" c="dimmed">
                            {s.description}
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" ff="monospace">
                        {s.cron_expr ?? "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{s.profile?.patients ?? "—"}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {s.last_run_at ? new Date(s.last_run_at).toLocaleString() : "never"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={s.enabled ? "green" : "gray"} variant="light">
                        {s.enabled ? "on" : "off"}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Tooltip label="Run now">
                          <ActionIcon
                            variant="subtle"
                            color="teal"
                            loading={runNowMutation.isPending}
                            onClick={() => runNowMutation.mutate(s.id)}
                          >
                            <IconPlayerPlay size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Edit">
                          <ActionIcon variant="subtle" onClick={() => openEdit(s)}>
                            <IconPencil size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => {
                              if (window.confirm(`Delete schedule "${s.name}"?`)) {
                                deleteMutation.mutate(s.id);
                              }
                            }}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {schedules.length === 0 && !schedulesQuery.isLoading && (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text c="dimmed" ta="center" py="lg">
                        No schedules yet. Create one to drive the simulator.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="runs" pt="md">
          <Group justify="space-between" mb="xs">
            <Switch
              label="Pending approval only"
              checked={pendingOnly}
              onChange={(e) => setPendingOnly(e.currentTarget.checked)}
            />
            <Badge color="orange" variant="light">
              {runs.filter((r) => r.approval_status === "pending_approval").length} pending
            </Badge>
          </Group>
          <Card withBorder padding={0}>
            <Table striped="even" verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Schedule</Table.Th>
                  <Table.Th>Trigger</Table.Th>
                  <Table.Th>Started</Table.Th>
                  <Table.Th>Finished</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Approval</Table.Th>
                  <Table.Th>Summary</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(pendingOnly
                  ? runs.filter((r) => r.approval_status === "pending_approval")
                  : runs
                ).map((r) => (
                  <Table.Tr
                    key={r.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => openRunDetail(r.id)}
                  >
                    <Table.Td>
                      <Text size="sm">
                        {r.schedule_id ? (scheduleNameById[r.schedule_id] ?? "—") : "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="light">
                        {r.trigger_kind}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {new Date(r.started_at).toLocaleString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {r.finished_at ? new Date(r.finished_at).toLocaleString() : "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={STATUS_COLOR[r.status]} variant="filled" size="xs">
                        {r.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {r.approval_status === "pending_approval" && (
                        <Badge color="orange" variant="filled" size="xs">
                          pending
                        </Badge>
                      )}
                      {r.approval_status === "approved" && (
                        <Badge color="green" variant="light" size="xs">
                          approved
                        </Badge>
                      )}
                      {r.approval_status === "rejected" && (
                        <Badge color="red" variant="light" size="xs">
                          rejected
                        </Badge>
                      )}
                      {r.approval_status === "auto_committed" && (
                        <Badge color="gray" variant="light" size="xs">
                          auto
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        opd {r.summary?.opd_count ?? 0} · er {r.summary?.er_count ?? 0}
                        {" · "}lab {r.summary?.lab_count ?? 0} · rad{" "}
                        {r.summary?.radiology_count ?? 0}
                        {" · "}ipd {r.summary?.ipd_admission_count ?? 0}
                        {r.summary?.errors ? ` · err ${r.summary.errors}` : ""}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {runs.length === 0 && !runsQuery.isLoading && (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <Text c="dimmed" ta="center" py="lg">
                        No runs yet. Use "Run now" on a schedule to fire one.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="news" pt="md">
          <NewsAdmin />
        </Tabs.Panel>
      </Tabs>

      {/* Create / edit modal */}
      <Modal
        opened={formOpen}
        onClose={() => {
          formHandlers.close();
          setEditingId(null);
        }}
        title={editingId ? "Edit schedule" : "New schedule"}
        size="lg"
        centered
      >
        <Stack gap="sm">
          <TextInput
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.currentTarget.value }))}
            required
          />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.currentTarget.value }))}
            autosize
            minRows={2}
          />
          <TextInput
            label="Cron expression"
            placeholder="0 9 * * * (Day-2 scheduler — captured but not yet fired)"
            value={form.cron_expr}
            onChange={(e) => setForm((f) => ({ ...f, cron_expr: e.currentTarget.value }))}
          />
          <Switch
            label="Enabled"
            checked={form.enabled}
            onChange={(e) => setForm((f) => ({ ...f, enabled: e.currentTarget.checked }))}
          />
          <JsonInput
            label="Profile JSON"
            description="Patients, OPD/ER share, branch probabilities, ER triage mix"
            value={form.profileText}
            onChange={(v) => setForm((f) => ({ ...f, profileText: v }))}
            formatOnBlur
            autosize
            minRows={14}
            validationError="Profile is not valid JSON"
          />
          <ProfileQuickPresets
            value={form.profileText}
            onChange={(text) => setForm((f) => ({ ...f, profileText: text }))}
          />
          <PreviewPanel
            profileText={form.profileText}
            onApplyVolumes={(opd, er) => {
              try {
                const obj = JSON.parse(form.profileText) as Record<string, unknown>;
                const vols = (obj.volumes as Record<string, unknown>) ?? {};
                vols.opd_count = opd;
                vols.er_count = er;
                obj.volumes = vols;
                setForm((f) => ({
                  ...f,
                  profileText: JSON.stringify(obj, null, 2),
                }));
                notifications.show({
                  title: "Applied",
                  message: `volumes.opd_count=${opd}, volumes.er_count=${er}`,
                  color: "teal",
                });
              } catch (err) {
                notifications.show({
                  title: "Apply failed",
                  message: (err as Error).message,
                  color: "red",
                });
              }
            }}
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                formHandlers.close();
                setEditingId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={submitForm}
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? "Save" : "Create"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Run detail drawer */}
      <Drawer
        opened={runDetailOpen}
        onClose={runDetailHandlers.close}
        title={runDetail ? `Run ${runDetail.run.id.slice(0, 8)}…` : "Run"}
        position="right"
        size="md"
      >
        {runDetail && (
          <Stack gap="md">
            <Card withBorder padding="sm">
              <Group justify="space-between">
                <Group gap="xs">
                  <Badge color={STATUS_COLOR[runDetail.run.status]} variant="filled">
                    {runDetail.run.status}
                  </Badge>
                  {runDetail.run.approval_status === "pending_approval" && (
                    <Badge color="orange" variant="filled">
                      pending approval
                    </Badge>
                  )}
                  {runDetail.run.approval_status === "approved" && (
                    <Badge color="green" variant="light">
                      approved
                    </Badge>
                  )}
                  {runDetail.run.approval_status === "rejected" && (
                    <Badge color="red" variant="light">
                      rejected
                    </Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  {runDetail.run.trigger_kind}
                </Text>
              </Group>
              {runDetail.run.approval_status === "pending_approval" && (
                <Group gap="xs" mt="xs">
                  <Button
                    size="xs"
                    color="green"
                    onClick={async () => {
                      try {
                        await api.approveSimulatorRun(runDetail.run.id);
                        notifications.show({
                          title: "Approved",
                          message: "Run committed",
                          color: "green",
                        });
                        const fresh = await api.getSimulatorRun(runDetail.run.id);
                        setRunDetail(fresh);
                        void qc.invalidateQueries({ queryKey: ["simulator-runs"] });
                      } catch (err) {
                        notifications.show({
                          title: "Approve failed",
                          message: (err as Error).message,
                          color: "red",
                        });
                      }
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    variant="light"
                    onClick={async () => {
                      if (!window.confirm("Reject this run? Generated rows will be deleted.")) {
                        return;
                      }
                      try {
                        const res = await api.rejectSimulatorRun(runDetail.run.id);
                        notifications.show({
                          title: "Rejected",
                          message: `Deleted ${res.deleted_rows} rows`,
                          color: "orange",
                        });
                        const fresh = await api.getSimulatorRun(runDetail.run.id);
                        setRunDetail(fresh);
                        void qc.invalidateQueries({ queryKey: ["simulator-runs"] });
                      } catch (err) {
                        notifications.show({
                          title: "Reject failed",
                          message: (err as Error).message,
                          color: "red",
                        });
                      }
                    }}
                  >
                    Reject
                  </Button>
                </Group>
              )}
              <Text size="xs" c="dimmed" mt={4}>
                started {new Date(runDetail.run.started_at).toLocaleString()}
              </Text>
              {runDetail.run.finished_at && (
                <Text size="xs" c="dimmed">
                  finished {new Date(runDetail.run.finished_at).toLocaleString()}
                </Text>
              )}
              {runDetail.run.error && (
                <Alert color="red" variant="light" mt="xs">
                  {runDetail.run.error}
                </Alert>
              )}
              <Text size="xs" mt="xs">
                opd {runDetail.run.summary?.opd_count ?? 0} · er{" "}
                {runDetail.run.summary?.er_count ?? 0} · vitals{" "}
                {runDetail.run.summary?.vitals_count ?? 0} · dx{" "}
                {runDetail.run.summary?.diagnoses_count ?? 0} · rx{" "}
                {runDetail.run.summary?.prescription_count ?? 0} · lab{" "}
                {runDetail.run.summary?.lab_count ?? 0} · rad{" "}
                {runDetail.run.summary?.radiology_count ?? 0} · ipd{" "}
                {runDetail.run.summary?.ipd_admission_count ?? 0} · triage{" "}
                {runDetail.run.summary?.triage_count ?? 0} · er-admit{" "}
                {runDetail.run.summary?.er_admit_count ?? 0}
                {runDetail.run.summary?.errors ? ` · errors ${runDetail.run.summary.errors}` : ""}
              </Text>
            </Card>
            <Stack gap={4}>
              <Text fw={600} size="sm">
                Steps
              </Text>
              {runDetail.steps.length === 0 && (
                <Text size="xs" c="dimmed">
                  No steps recorded.
                </Text>
              )}
              {runDetail.steps.map((step) => (
                <Group key={step.id} gap="xs" wrap="nowrap" align="flex-start">
                  <Badge color={step.success ? "green" : "red"} variant="filled" size="xs">
                    {step.step_type}
                  </Badge>
                  <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
                    <Text size="xs" ff="monospace" truncate>
                      {step.target_id ?? "—"}
                    </Text>
                    {step.error && (
                      <Text size="xs" c="red">
                        {step.error}
                      </Text>
                    )}
                  </Stack>
                </Group>
              ))}
            </Stack>
          </Stack>
        )}
      </Drawer>
    </Stack>
  );
}

function ProfileQuickPresets({
  value,
  onChange,
}: {
  value: string;
  onChange: (text: string) => void;
}) {
  const writeAt = (path: string[], setter: (cur: Record<string, unknown>, key: string) => void) => {
    if (path.length === 0) return;
    try {
      const obj = JSON.parse(value) as Record<string, unknown>;
      let cur: Record<string, unknown> = obj;
      for (let i = 0; i < path.length - 1; i += 1) {
        const key = path[i] ?? "";
        if (typeof cur[key] !== "object" || cur[key] === null) {
          cur[key] = {};
        }
        cur = cur[key] as Record<string, unknown>;
      }
      setter(cur, path[path.length - 1] ?? "");
      onChange(JSON.stringify(obj, null, 2));
    } catch {
      // ignore — user is mid-edit
    }
  };
  const updateNumber = (path: string[], n: number) => {
    writeAt(path, (cur, key) => {
      cur[key] = n;
    });
  };
  const updateBool = (path: string[], v: boolean) => {
    writeAt(path, (cur, key) => {
      cur[key] = v;
    });
  };
  const clearKey = (path: string[]) => {
    writeAt(path, (cur, key) => {
      delete cur[key];
    });
  };
  const parsed = (() => {
    try {
      return JSON.parse(value) as SimulatorProfile;
    } catch {
      return null;
    }
  })();
  if (!parsed) return null;
  const previewDate = parsed.date ? new Date(parsed.date) : new Date();
  const season = seasonFor(previewDate);
  const holiday = holidayLookup(previewDate);
  const holidayLabel = holiday
    ? ` · ${holiday.kind === "PublicHoliday" ? "Public holiday" : "Festival"}: ${holiday.name}${
        holiday.icd_boost.length > 0 ? ` (ICD boost ${holiday.icd_boost.join(", ")})` : ""
      }`
    : "";
  return (
    <Card withBorder padding="sm">
      <Text size="xs" fw={600} mb={6}>
        Quick edit
      </Text>
      <Text size="xs" c="dimmed" mb="sm">
        Preview · {previewDate.toLocaleDateString()} · season {season}
        {holidayLabel}
      </Text>
      <Group gap="sm" wrap="wrap">
        <NumberInput
          label="Patients / run"
          value={parsed.patients}
          onChange={(v) => updateNumber(["patients"], typeof v === "number" ? v : 1)}
          min={1}
          max={200}
          size="xs"
          w={140}
        />
        <NumberInput
          label="OPD %"
          value={parsed.opd_pct}
          onChange={(v) => updateNumber(["opd_pct"], typeof v === "number" ? v : 0)}
          min={0}
          max={1}
          step={0.05}
          decimalScale={2}
          size="xs"
          w={110}
        />
        <NumberInput
          label="ER %"
          value={parsed.er_pct}
          onChange={(v) => updateNumber(["er_pct"], typeof v === "number" ? v : 0)}
          min={0}
          max={1}
          step={0.05}
          decimalScale={2}
          size="xs"
          w={110}
        />
        <NumberInput
          label="Lab branch"
          value={parsed.branches.lab_pct}
          onChange={(v) => updateNumber(["branches", "lab_pct"], typeof v === "number" ? v : 0)}
          min={0}
          max={1}
          step={0.05}
          decimalScale={2}
          size="xs"
          w={120}
        />
        <NumberInput
          label="Rad branch"
          value={parsed.branches.rad_pct}
          onChange={(v) => updateNumber(["branches", "rad_pct"], typeof v === "number" ? v : 0)}
          min={0}
          max={1}
          step={0.05}
          decimalScale={2}
          size="xs"
          w={120}
        />
        <NumberInput
          label="IPD escalation"
          value={parsed.branches.ipd_escalation_pct}
          onChange={(v) =>
            updateNumber(["branches", "ipd_escalation_pct"], typeof v === "number" ? v : 0)
          }
          min={0}
          max={1}
          step={0.05}
          decimalScale={2}
          size="xs"
          w={130}
        />
      </Group>

      <Accordion variant="separated" mt="md" multiple>
        <Accordion.Item value="volumes">
          <Accordion.Control>
            Volume overrides
            <Text size="xs" c="dimmed">
              Explicit per-module counts. Empty = derive from patients × percentages.
            </Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Group gap="sm" wrap="wrap">
              {(
                [
                  ["opd_count", "OPD encounters"],
                  ["er_count", "ER visits"],
                  ["ipd_count", "IPD admissions"],
                  ["lab_count", "Lab orders"],
                  ["radiology_count", "Imaging"],
                  ["pharmacy_count", "Pharmacy"],
                ] as const
              ).map(([key, label]) => {
                const current = parsed.volumes?.[key] ?? null;
                return (
                  <NumberInput
                    key={key}
                    label={label}
                    placeholder="auto"
                    value={current ?? ""}
                    onChange={(v) => {
                      if (typeof v === "number") {
                        updateNumber(["volumes", key], v);
                      } else {
                        clearKey(["volumes", key]);
                      }
                    }}
                    min={0}
                    max={1000}
                    size="xs"
                    w={140}
                  />
                );
              })}
            </Group>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="hours">
          <Accordion.Control>
            Hours
            <Text size="xs" c="dimmed">
              When OPD timestamps land. ER stays 24h.
            </Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Group gap="sm" wrap="wrap">
              <NumberInput
                label="OPD open"
                value={parsed.hours?.opd_open_hour ?? 8}
                onChange={(v) =>
                  updateNumber(["hours", "opd_open_hour"], typeof v === "number" ? v : 8)
                }
                min={0}
                max={23}
                size="xs"
                w={110}
              />
              <NumberInput
                label="OPD close"
                value={parsed.hours?.opd_close_hour ?? 20}
                onChange={(v) =>
                  updateNumber(["hours", "opd_close_hour"], typeof v === "number" ? v : 20)
                }
                min={1}
                max={24}
                size="xs"
                w={110}
              />
              <NumberInput
                label="IPD admission start"
                value={parsed.hours?.ipd_admission_start_hour ?? 10}
                onChange={(v) =>
                  updateNumber(
                    ["hours", "ipd_admission_start_hour"],
                    typeof v === "number" ? v : 10,
                  )
                }
                min={0}
                max={23}
                size="xs"
                w={150}
              />
              <Switch
                label="ER 24h"
                checked={parsed.hours?.er_24h ?? true}
                onChange={(e) => updateBool(["hours", "er_24h"], e.currentTarget.checked)}
              />
            </Group>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="natural-flow">
          <Accordion.Control>
            Natural-flow adaptation
            <Text size="xs" c="dimmed">
              Blend the tenant's real (non-dummy) case mix into the synthetic load.
            </Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <Switch
                label="Enabled"
                checked={parsed.natural_flow?.enabled ?? true}
                onChange={(e) => updateBool(["natural_flow", "enabled"], e.currentTarget.checked)}
              />
              <Group gap="sm" wrap="wrap" align="flex-end">
                <NumberInput
                  label="Lookback days"
                  value={parsed.natural_flow?.lookback_days ?? 30}
                  onChange={(v) =>
                    updateNumber(["natural_flow", "lookback_days"], typeof v === "number" ? v : 30)
                  }
                  min={1}
                  max={365}
                  size="xs"
                  w={140}
                />
                <Stack gap={4} style={{ flex: 1, minWidth: 220 }}>
                  <Text size="xs" fw={500}>
                    Blend weight ({(parsed.natural_flow?.blend ?? 0.6).toFixed(2)})
                  </Text>
                  <Slider
                    value={parsed.natural_flow?.blend ?? 0.6}
                    onChange={(v) => updateNumber(["natural_flow", "blend"], v)}
                    min={0}
                    max={1}
                    step={0.05}
                    label={(v) => v.toFixed(2)}
                  />
                </Stack>
              </Group>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="holidays">
          <Accordion.Control>
            Holidays & festivals
            <Text size="xs" c="dimmed">
              Scale OPD / ER counts and bias ICDs on holiday dates.
            </Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <Switch
                label="Respect holidays"
                checked={parsed.holidays?.respect_holidays ?? true}
                onChange={(e) =>
                  updateBool(["holidays", "respect_holidays"], e.currentTarget.checked)
                }
              />
              <Group gap="sm" wrap="wrap">
                <NumberInput
                  label="OPD scale on holiday"
                  value={parsed.holidays?.opd_scale_on_holiday ?? 0.2}
                  onChange={(v) =>
                    updateNumber(
                      ["holidays", "opd_scale_on_holiday"],
                      typeof v === "number" ? v : 0.2,
                    )
                  }
                  min={0}
                  max={2}
                  step={0.1}
                  decimalScale={2}
                  size="xs"
                  w={170}
                />
                <NumberInput
                  label="ER scale on holiday"
                  value={parsed.holidays?.er_scale_on_holiday ?? 1.2}
                  onChange={(v) =>
                    updateNumber(
                      ["holidays", "er_scale_on_holiday"],
                      typeof v === "number" ? v : 1.2,
                    )
                  }
                  min={0}
                  max={3}
                  step={0.1}
                  decimalScale={2}
                  size="xs"
                  w={170}
                />
                <NumberInput
                  label="Festival ICD weight boost"
                  value={parsed.holidays?.festival_weight_boost ?? 1.3}
                  onChange={(v) =>
                    updateNumber(
                      ["holidays", "festival_weight_boost"],
                      typeof v === "number" ? v : 1.3,
                    )
                  }
                  min={0}
                  max={5}
                  step={0.1}
                  decimalScale={2}
                  size="xs"
                  w={200}
                />
              </Group>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="approval">
          <Accordion.Control>
            Approval gate
            <Text size="xs" c="dimmed">
              Manual mode parks each run as pending until a super-admin approves or rejects.
            </Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Group gap="sm" wrap="wrap" align="center">
              <Switch
                label="Manual approval required"
                checked={(parsed.approval_mode ?? "auto") === "manual"}
                onChange={(e) =>
                  writeAt(["approval_mode"], (cur, key) => {
                    cur[key] = e.currentTarget.checked ? "manual" : "auto";
                  })
                }
              />
              <Text size="xs" c="dimmed">
                Currently:{" "}
                <strong>{(parsed.approval_mode ?? "auto") === "manual" ? "manual" : "auto"}</strong>
              </Text>
            </Group>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Card>
  );
}

// ── News & alerts admin ──────────────────────────────────────────────

const NEWS_CATEGORIES: { value: import("@medbrains/types").NewsCategory; label: string }[] = [
  { value: "outbreak_alert", label: "Outbreak alert (feeds simulator)" },
  { value: "weather_advisory", label: "Weather advisory (feeds simulator)" },
  { value: "festival_advisory", label: "Festival advisory" },
  { value: "internal_notice", label: "Internal notice" },
];

const NEWS_SEVERITIES: {
  value: import("@medbrains/types").NewsSeverity;
  label: string;
  color: string;
}[] = [
  { value: "info", label: "Info", color: "blue" },
  { value: "warning", label: "Warning", color: "yellow" },
  { value: "critical", label: "Critical", color: "red" },
];

const DEFAULT_NEWS_DRAFT = {
  category: "outbreak_alert" as import("@medbrains/types").NewsCategory,
  title: "",
  body: "",
  severity: "info" as import("@medbrains/types").NewsSeverity,
  source: "",
  icd_boost: [] as string[],
  expires_at: "",
  is_active: true,
};

function NewsAdmin() {
  const qc = useQueryClient();
  const newsQuery = useQuery({
    queryKey: ["news-admin-list"],
    queryFn: () => api.listAllNews(),
  });
  const [formOpen, formHandlers] = useDisclosure(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ ...DEFAULT_NEWS_DRAFT });
  const [icdInput, setIcdInput] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.createNewsArticle({
        category: draft.category,
        title: draft.title,
        body: draft.body || undefined,
        severity: draft.severity,
        source: draft.source || undefined,
        icd_boost: draft.icd_boost,
        expires_at: draft.expires_at || undefined,
        is_active: draft.is_active,
      }),
    onSuccess: () => {
      notifications.show({ title: "News published", message: "", color: "green" });
      void qc.invalidateQueries({ queryKey: ["news-admin-list"] });
      formHandlers.close();
    },
    onError: (err: Error) =>
      notifications.show({ title: "Create failed", message: err.message, color: "red" }),
  });

  const update = useMutation({
    mutationFn: (id: string) =>
      api.updateNewsArticle(id, {
        category: draft.category,
        title: draft.title,
        body: draft.body,
        severity: draft.severity,
        source: draft.source || undefined,
        icd_boost: draft.icd_boost,
        expires_at: draft.expires_at || undefined,
        is_active: draft.is_active,
      }),
    onSuccess: () => {
      notifications.show({ title: "News updated", message: "", color: "green" });
      void qc.invalidateQueries({ queryKey: ["news-admin-list"] });
      formHandlers.close();
      setEditingId(null);
    },
    onError: (err: Error) =>
      notifications.show({ title: "Update failed", message: err.message, color: "red" }),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteNewsArticle(id),
    onSuccess: () => {
      notifications.show({ title: "Deleted", message: "", color: "green" });
      void qc.invalidateQueries({ queryKey: ["news-admin-list"] });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Delete failed", message: err.message, color: "red" }),
  });

  function openCreate() {
    setEditingId(null);
    setDraft({ ...DEFAULT_NEWS_DRAFT });
    setIcdInput("");
    formHandlers.open();
  }

  function openEdit(article: import("@medbrains/types").NewsArticle) {
    setEditingId(article.id);
    setDraft({
      category: article.category,
      title: article.title,
      body: article.body,
      severity: article.severity,
      source: article.source ?? "",
      icd_boost: article.icd_boost,
      expires_at: article.expires_at?.slice(0, 16) ?? "",
      is_active: article.is_active,
    });
    setIcdInput("");
    formHandlers.open();
  }

  function submit() {
    if (!draft.title.trim()) {
      notifications.show({ title: "Title required", message: "", color: "red" });
      return;
    }
    if (editingId) {
      update.mutate(editingId);
    } else {
      create.mutate();
    }
  }

  function addIcd() {
    const v = icdInput.trim().toUpperCase();
    if (!v) return;
    if (!draft.icd_boost.includes(v)) {
      setDraft((d) => ({ ...d, icd_boost: [...d.icd_boost, v] }));
    }
    setIcdInput("");
  }

  const articles = newsQuery.data ?? [];

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Outbreak alerts and weather advisories with an ICD-boost list feed the simulator's
          diagnosis weighting. Festival / internal categories are informational.
        </Text>
        <Button leftSection={<IconPlus size={14} />} onClick={openCreate}>
          New advisory
        </Button>
      </Group>

      <Card withBorder padding={0}>
        <Table striped="even" verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Title</Table.Th>
              <Table.Th>Category</Table.Th>
              <Table.Th>Severity</Table.Th>
              <Table.Th>ICD boost</Table.Th>
              <Table.Th>Expires</Table.Th>
              <Table.Th>Active</Table.Th>
              <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {articles.map((a) => {
              const sev = NEWS_SEVERITIES.find((s) => s.value === a.severity);
              const cat = NEWS_CATEGORIES.find((c) => c.value === a.category);
              return (
                <Table.Tr key={a.id}>
                  <Table.Td>
                    <Stack gap={0}>
                      <Text size="sm" fw={600}>
                        {a.title}
                      </Text>
                      {a.body && (
                        <Text size="xs" c="dimmed" lineClamp={2}>
                          {a.body}
                        </Text>
                      )}
                      {a.source && (
                        <Text size="xs" c="dimmed">
                          source: {a.source}
                        </Text>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light">{cat?.label ?? a.category}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={sev?.color ?? "gray"} variant="filled" size="xs">
                      {sev?.label ?? a.severity}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={2}>
                      {a.icd_boost.map((c) => (
                        <Badge key={c} size="xs" variant="outline">
                          {c}
                        </Badge>
                      ))}
                      {a.icd_boost.length === 0 && (
                        <Text size="xs" c="dimmed">
                          —
                        </Text>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {a.expires_at ? new Date(a.expires_at).toLocaleString() : "no expiry"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={a.is_active ? "green" : "gray"} variant="light">
                      {a.is_active ? "on" : "off"}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ textAlign: "right" }}>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      <Tooltip label="Edit">
                        <ActionIcon variant="subtle" onClick={() => openEdit(a)}>
                          <IconPencil size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => {
                            if (window.confirm(`Delete "${a.title}"?`)) {
                              del.mutate(a.id);
                            }
                          }}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
            {articles.length === 0 && !newsQuery.isLoading && (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text c="dimmed" ta="center" py="lg">
                    No advisories yet. Click "New advisory" to publish one.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal
        opened={formOpen}
        onClose={() => {
          formHandlers.close();
          setEditingId(null);
        }}
        title={editingId ? "Edit advisory" : "New advisory"}
        size="lg"
        centered
      >
        <Stack gap="sm">
          <TextInput
            label="Title"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.currentTarget.value }))}
            required
          />
          <Textarea
            label="Body"
            value={draft.body}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.currentTarget.value }))}
            autosize
            minRows={3}
          />
          <Group grow>
            <Select
              label="Category"
              data={NEWS_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
              value={draft.category}
              onChange={(v) =>
                v &&
                setDraft((d) => ({
                  ...d,
                  category: v as import("@medbrains/types").NewsCategory,
                }))
              }
            />
            <Select
              label="Severity"
              data={NEWS_SEVERITIES.map((s) => ({ value: s.value, label: s.label }))}
              value={draft.severity}
              onChange={(v) =>
                v &&
                setDraft((d) => ({
                  ...d,
                  severity: v as import("@medbrains/types").NewsSeverity,
                }))
              }
            />
          </Group>
          <TextInput
            label="Source"
            placeholder="e.g. MoHFW bulletin · IMD · IDSP"
            value={draft.source}
            onChange={(e) => setDraft((d) => ({ ...d, source: e.currentTarget.value }))}
          />
          <Group align="flex-end" gap="xs">
            <TextInput
              label="ICD boost"
              description="Codes the simulator will over-represent while this advisory is active"
              placeholder="e.g. A90"
              value={icdInput}
              onChange={(e) => setIcdInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addIcd();
                }
              }}
              style={{ flex: 1 }}
            />
            <Button variant="default" onClick={addIcd}>
              Add
            </Button>
          </Group>
          {draft.icd_boost.length > 0 && (
            <Group gap="xs">
              {draft.icd_boost.map((c) => (
                <Badge
                  key={c}
                  variant="outline"
                  rightSection={
                    <ActionIcon
                      size="xs"
                      variant="transparent"
                      color="red"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          icd_boost: d.icd_boost.filter((x) => x !== c),
                        }))
                      }
                    >
                      ×
                    </ActionIcon>
                  }
                >
                  {c}
                </Badge>
              ))}
            </Group>
          )}
          <TextInput
            label="Expires at"
            type="datetime-local"
            value={draft.expires_at}
            onChange={(e) => setDraft((d) => ({ ...d, expires_at: e.currentTarget.value }))}
          />
          <Switch
            label="Active"
            checked={draft.is_active}
            onChange={(e) => setDraft((d) => ({ ...d, is_active: e.currentTarget.checked }))}
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                formHandlers.close();
                setEditingId(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={submit} loading={create.isPending || update.isPending}>
              {editingId ? "Save" : "Publish"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Active alerts banner ─────────────────────────────────────────────
// Shows currently-active outbreak alerts + critical-severity advisories
// at the top of the page so users see what's biasing the next simulator
// run. Polls every 60s.

function ActiveAlertsBanner() {
  const { data: active = [] } = useQuery({
    queryKey: ["news-active-banner"],
    queryFn: () => api.listActiveNews({ limit: 20 }),
    refetchInterval: 60_000,
  });
  // Outbreak + weather advisories both bias the simulator's ICD pool.
  const biasing = active.filter(
    (a) => a.category === "outbreak_alert" || a.category === "weather_advisory",
  );
  const criticals = active.filter(
    (a) =>
      a.severity === "critical" &&
      a.category !== "outbreak_alert" &&
      a.category !== "weather_advisory",
  );
  if (biasing.length === 0 && criticals.length === 0) return null;
  return (
    <Stack gap="xs">
      {biasing.length > 0 && (
        <Alert
          color="red"
          variant="light"
          title="Active health & weather alerts (biasing simulator)"
        >
          <Stack gap={4}>
            {biasing.map((a) => (
              <Text key={a.id} size="sm">
                <Badge size="xs" variant="filled" mr={6}>
                  {a.category === "outbreak_alert" ? "outbreak" : "weather"}
                </Badge>
                <strong>{a.title}</strong>
                {a.icd_boost.length > 0 ? ` · ICD ${a.icd_boost.join(", ")}` : ""}
                {a.expires_at ? ` · until ${new Date(a.expires_at).toLocaleString()}` : ""}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}
      {criticals.length > 0 && (
        <Alert color="orange" variant="light" title="Critical advisories">
          <Stack gap={4}>
            {criticals.map((a) => (
              <Text key={a.id} size="sm">
                <strong>{a.title}</strong>
                {a.body ? ` — ${a.body.slice(0, 140)}` : ""}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}
    </Stack>
  );
}

// ── Preview panel (next-run resolved context) ────────────────────────

function PreviewPanel({
  profileText,
  onApplyVolumes,
}: {
  profileText: string;
  onApplyVolumes: (opd: number, er: number) => void;
}) {
  const [debouncedProfileText] = useDebouncedValue(profileText, { wait: 600 });
  const parsedProfile = useMemo(
    () => parseProfileText(debouncedProfileText),
    [debouncedProfileText],
  );
  const profileForPreview = parsedProfile.ok ? parsedProfile.profile : null;
  const previewQuery = useQuery({
    queryKey: ["simulator-preview", debouncedProfileText],
    queryFn: () => {
      if (!profileForPreview) {
        throw new Error("Profile JSON invalid");
      }
      return api.previewSimulator(profileForPreview);
    },
    enabled: profileForPreview !== null,
    retry: false,
    staleTime: 30_000,
  });
  const preview = previewQuery.data ?? null;
  const jsonError = parsedProfile.ok ? null : parsedProfile.error;

  const onPreview = () => {
    if (!profileForPreview) {
      notifications.show({
        title: "Profile JSON invalid",
        message: jsonError ?? "Fix the JSON before previewing.",
        color: "red",
      });
      return;
    }
    void previewQuery.refetch();
  };

  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" mb={preview ? "xs" : 0}>
        <Group gap={6}>
          <Text size="xs" fw={600}>
            Next-run preview
          </Text>
          <Badge size="xs" color={jsonError ? "red" : "teal"} variant="light">
            {jsonError ? "JSON invalid" : "auto"}
          </Badge>
        </Group>
        <Button
          size="compact-xs"
          variant="light"
          onClick={onPreview}
          loading={previewQuery.isFetching}
        >
          Refresh
        </Button>
      </Group>
      {jsonError && (
        <Alert color="red" variant="light" mt="xs">
          {jsonError}
        </Alert>
      )}
      {!jsonError && previewQuery.isError && (
        <Alert color="red" variant="light" mt="xs">
          {previewQuery.error.message}
        </Alert>
      )}
      {preview && (
        <Stack gap={6}>
          <Text size="xs">
            <strong>Date:</strong> {preview.date} · <strong>Season:</strong> {preview.season_label}
            {preview.holiday_name
              ? ` · ${preview.holiday_kind ?? "holiday"}: ${preview.holiday_name}`
              : ""}
          </Text>
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Text size="xs">
              <strong>Effective counts:</strong> OPD {preview.effective_opd_count} · ER{" "}
              {preview.effective_er_count}
            </Text>
            <Button
              size="compact-xs"
              variant="subtle"
              onClick={() =>
                onApplyVolumes(preview.effective_opd_count, preview.effective_er_count)
              }
            >
              Apply to volumes
            </Button>
          </Group>
          {preview.season_icds.length > 0 && (
            <Group gap={4} wrap="wrap">
              <Text size="xs" c="dimmed">
                Season ICDs:
              </Text>
              {preview.season_icds.map((c) => (
                <Badge key={`s-${c}`} size="xs" variant="light">
                  {c}
                </Badge>
              ))}
            </Group>
          )}
          {preview.holiday_icds.length > 0 && (
            <Group gap={4} wrap="wrap">
              <Text size="xs" c="dimmed">
                Holiday boost:
              </Text>
              {preview.holiday_icds.map((c) => (
                <Badge key={`h-${c}`} size="xs" color="orange" variant="light">
                  {c}
                </Badge>
              ))}
            </Group>
          )}
          {preview.news_icds.length > 0 && (
            <Group gap={4} wrap="wrap">
              <Text size="xs" c="dimmed">
                News ICDs (outbreak + weather):
              </Text>
              {Array.from(new Set(preview.news_icds)).map((c) => (
                <Badge key={`n-${c}`} size="xs" color="red" variant="light">
                  {c}
                </Badge>
              ))}
            </Group>
          )}
          {preview.natural_top_icds.length > 0 && (
            <Group gap={4} wrap="wrap">
              <Text size="xs" c="dimmed">
                Natural top (last N days):
              </Text>
              {preview.natural_top_icds.map(([c, n]) => (
                <Badge key={`nat-${c}`} size="xs" color="teal" variant="light">
                  {c} ({n})
                </Badge>
              ))}
            </Group>
          )}
        </Stack>
      )}
    </Card>
  );
}
