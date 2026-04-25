import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBed,
  IconCheck,
  IconClipboardList,
  IconHeartbeat,
  IconLogout,
  IconPrinter,
  IconTemperature,
  IconUserHeart,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  DischargeReadinessRow,
  MedAdminItem,
  NurseTaskItem,
  PatientCardRow,
  VitalsChecklistRow,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";
import type { Column } from "../components/DataTable";

// ── Helpers ─────────────────────────────────────────────

function urgencyColor(overdue: number, pending: number): string {
  if (overdue > 0) return "danger";
  if (pending > 0) return "warning";
  return "success";
}

function news2Color(score: number | null): string {
  if (score === null) return "gray";
  if (score >= 7) return "danger";
  if (score >= 5) return "warning";
  return "success";
}

function fallRiskColor(level: string | null): string {
  if (!level) return "gray";
  const l = level.toLowerCase();
  if (l.includes("high")) return "danger";
  if (l.includes("medium") || l.includes("moderate")) return "warning";
  return "success";
}

function readinessColor(pct: number): string {
  if (pct >= 80) return "success";
  if (pct >= 50) return "warning";
  return "danger";
}

const SHIFTS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "night", label: "Night" },
];

// ══════════════════════════════════════════════════════════
//  Care View Page
// ══════════════════════════════════════════════════════════

export function CareViewPage() {
  useRequirePermission(P.CARE_VIEW.VIEW);

  const canMyTasks = useHasPermission(P.CARE_VIEW.MY_TASKS);
  const canHandover = useHasPermission(P.CARE_VIEW.HANDOVER);
  const canDischarge = useHasPermission(P.CARE_VIEW.DISCHARGE_TRACKER);
  const canManage = useHasPermission(P.CARE_VIEW.MANAGE_TASKS);

  const [selectedWard, setSelectedWard] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>("grid");

  // Ward selector
  const { data: wards } = useQuery({
    queryKey: ["wards"],
    queryFn: () => api.listWards(),
  });

  const wardOptions = [
    { value: "", label: "All Wards" },
    ...(wards?.map((w) => ({ value: w.id, label: w.name })) ?? []),
  ];

  return (
    <div>
      <PageHeader
        title="Care View"
        subtitle="Ward dashboard for nursing care"
        actions={
          <Select
            placeholder="Filter by ward"
            data={wardOptions}
            value={selectedWard ?? ""}
            onChange={(v) => setSelectedWard(v || null)}
            clearable
            w={250}
          />
        }
      />

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="grid" leftSection={<IconBed size={16} />}>
            Patient Grid
          </Tabs.Tab>
          {canMyTasks && (
            <Tabs.Tab value="tasks" leftSection={<IconClipboardList size={16} />}>
              My Tasks
            </Tabs.Tab>
          )}
          {canHandover && (
            <Tabs.Tab value="handover" leftSection={<IconUserHeart size={16} />}>
              Handover
            </Tabs.Tab>
          )}
          {canDischarge && (
            <Tabs.Tab value="discharge" leftSection={<IconLogout size={16} />}>
              Discharge Tracker
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="grid" pt="md">
          <PatientGridTab wardId={selectedWard} />
        </Tabs.Panel>

        {canMyTasks && (
          <Tabs.Panel value="tasks" pt="md">
            <MyTasksTab wardId={selectedWard} canManage={canManage} />
          </Tabs.Panel>
        )}

        {canHandover && (
          <Tabs.Panel value="handover" pt="md">
            <HandoverTab wardId={selectedWard} />
          </Tabs.Panel>
        )}

        {canDischarge && (
          <Tabs.Panel value="discharge" pt="md">
            <DischargeTrackerTab wardId={selectedWard} />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}

// ── Tab 1: Patient Grid ─────────────────────────────────

function PatientGridTab({ wardId }: { wardId: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ["care-view", "ward-grid", wardId],
    queryFn: () => api.wardPatientGrid(wardId ?? undefined),
    refetchInterval: 30_000,
  });

  const summary = data?.summary;

  return (
    <Stack gap="md">
      {/* Summary banner */}
      {summary && (
        <Group gap="xl">
          <Badge size="lg" variant="light" color="primary">
            Occupied: {summary.occupied} / {summary.total_beds}
          </Badge>
          <Badge size="lg" variant="light" color="danger">
            Critical: {summary.critical_count}
          </Badge>
          <Badge size="lg" variant="light" color="orange">
            Isolation: {summary.isolation_count}
          </Badge>
          <Badge size="lg" variant="light" color="warning">
            Overdue Tasks: {summary.overdue_tasks_total}
          </Badge>
          <Badge size="lg" variant="light" color="violet">
            Pending Discharges: {summary.pending_discharges}
          </Badge>
        </Group>
      )}

      {/* Vitals Checklist link */}
      <VitalsChecklistSection wardId={wardId} />

      {/* Patient cards */}
      {isLoading && <Text c="dimmed">Loading patient grid...</Text>}

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
        {data?.patients.map((p) => (
          <PatientCard key={p.admission_id} patient={p} />
        ))}
      </SimpleGrid>

      {data?.patients.length === 0 && !isLoading && (
        <Text c="dimmed" ta="center" py="xl">
          No admitted patients in the selected ward.
        </Text>
      )}
    </Stack>
  );
}

function PatientCard({ patient: p }: { patient: PatientCardRow }) {
  const urgency = urgencyColor(
    p.overdue_tasks + p.overdue_meds,
    p.pending_tasks + p.pending_meds,
  );

  return (
    <Card shadow="xs" padding="sm" radius="sm" withBorder>
      <Group justify="space-between" mb={4}>
        <div>
          <Text fw={600} size="sm" lineClamp={1}>
            {p.patient_name}
          </Text>
          <Text size="xs" c="dimmed">
            {p.uhid} &middot; {p.bed_name ?? "No bed"}
          </Text>
        </div>
        <ThemeIcon size="sm" radius="xl" color={urgency} variant="filled">
          <IconHeartbeat size={12} />
        </ThemeIcon>
      </Group>

      <Group gap={4} mb={6}>
        {p.is_critical && (
          <Badge size="xs" color="danger" variant="filled">
            Critical
          </Badge>
        )}
        {p.isolation_required && (
          <Badge size="xs" color="orange" variant="filled">
            Isolation
          </Badge>
        )}
        {p.ip_type && (
          <Badge size="xs" color="primary" variant="light">
            {p.ip_type}
          </Badge>
        )}
      </Group>

      <Stack gap={2}>
        {/* Acuity — NEWS2 */}
        <Group gap={4}>
          <Text size="xs" c="dimmed" w={80}>
            NEWS2:
          </Text>
          <Badge size="xs" color={news2Color(p.latest_news2_score)} variant="light">
            {p.latest_news2_score !== null ? p.latest_news2_score : "N/A"}
          </Badge>
        </Group>

        {/* Fall Risk */}
        <Group gap={4}>
          <Text size="xs" c="dimmed" w={80}>
            Fall Risk:
          </Text>
          <Badge size="xs" color={fallRiskColor(p.fall_risk_level)} variant="light">
            {p.fall_risk_level ?? "N/A"}
          </Badge>
        </Group>

        {/* Tasks */}
        <Group gap={4}>
          <Text size="xs" c="dimmed" w={80}>
            Tasks:
          </Text>
          <Text size="xs">
            {p.pending_tasks} pending
            {p.overdue_tasks > 0 && (
              <Text span c="danger" fw={600}>
                {" "}
                ({p.overdue_tasks} overdue)
              </Text>
            )}
          </Text>
        </Group>

        {/* Meds */}
        <Group gap={4}>
          <Text size="xs" c="dimmed" w={80}>
            Meds:
          </Text>
          <Text size="xs">
            {p.pending_meds} pending
            {p.overdue_meds > 0 && (
              <Text span c="danger" fw={600}>
                {" "}
                ({p.overdue_meds} overdue)
              </Text>
            )}
          </Text>
        </Group>

        {/* Vitals due */}
        {p.vitals_due && (
          <Group gap={4}>
            <IconTemperature size={14} color="var(--mantine-color-orange-6)" />
            <Text size="xs" c="orange" fw={600}>
              Vitals due
            </Text>
          </Group>
        )}

        {/* Clinical docs */}
        {p.active_clinical_docs > 0 && (
          <Text size="xs" c="dimmed">
            {p.active_clinical_docs} active clinical doc(s)
          </Text>
        )}
      </Stack>

      <Group gap={4} mt={6}>
        {p.admitting_doctor_name && (
          <Text size="xs" c="dimmed">
            Dr. {p.admitting_doctor_name}
          </Text>
        )}
        {p.primary_nurse_name && (
          <Text size="xs" c="dimmed">
            &middot; RN {p.primary_nurse_name}
          </Text>
        )}
      </Group>
    </Card>
  );
}

function VitalsChecklistSection({ wardId }: { wardId: string | null }) {
  const [show, setShow] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["care-view", "vitals-checklist", wardId],
    queryFn: () => api.vitalsChecklist(wardId ?? undefined),
    enabled: show,
    refetchInterval: 60_000,
  });

  const dueCount = data?.filter((r) => r.vitals_due).length ?? 0;

  const columns: Column<VitalsChecklistRow>[] = [
    { key: "patient_name", label: "Patient", render: (r) => <Text size="sm">{r.patient_name}</Text> },
    { key: "bed_name", label: "Bed", render: (r) => <Text size="sm">{r.bed_name ?? "—"}</Text> },
    {
      key: "hours_since_last",
      label: "Hours Since Last",
      render: (r) => (
        <Text size="sm" c={r.vitals_due ? "danger" : undefined}>
          {r.hours_since_last !== null ? `${r.hours_since_last.toFixed(1)}h` : "Never"}
        </Text>
      ),
    },
    {
      key: "vitals_due",
      label: "Status",
      render: (r) => (
        <Badge size="sm" color={r.vitals_due ? "danger" : "success"}>
          {r.vitals_due ? "Due" : "OK"}
        </Badge>
      ),
    },
  ];

  return (
    <Stack gap="xs">
      <Button
        variant="subtle"
        size="compact-sm"
        leftSection={<IconTemperature size={16} />}
        onClick={() => setShow((s) => !s)}
      >
        Vitals Checklist {dueCount > 0 && `(${dueCount} due)`}
      </Button>
      {show && (
        <DataTable
          columns={columns}
          data={data ?? []}
          loading={isLoading}
          rowKey={(r) => r.admission_id}
        />
      )}
    </Stack>
  );
}

// ── Tab 2: My Tasks ─────────────────────────────────────

function MyTasksTab({ wardId, canManage }: { wardId: string | null; canManage: boolean }) {
  const [segment, setSegment] = useState("medications");

  const { data, isLoading } = useQuery({
    queryKey: ["care-view", "my-tasks", wardId],
    queryFn: () => api.careViewMyTasks({ ward_id: wardId ?? undefined }),
    refetchInterval: 30_000,
  });

  return (
    <Stack gap="md">
      <SegmentedControl
        value={segment}
        onChange={setSegment}
        data={[
          { value: "medications", label: `Medications (${data?.medication_tasks.length ?? 0})` },
          { value: "nursing", label: `Nursing Tasks (${data?.nursing_tasks.length ?? 0})` },
        ]}
      />

      {segment === "medications" ? (
        <MedicationsTable items={data?.medication_tasks ?? []} loading={isLoading} />
      ) : (
        <NursingTasksTable items={data?.nursing_tasks ?? []} loading={isLoading} canManage={canManage} />
      )}
    </Stack>
  );
}

function MedicationsTable({ items, loading }: { items: MedAdminItem[]; loading: boolean }) {
  const columns: Column<MedAdminItem>[] = [
    { key: "patient_name", label: "Patient", render: (r) => <Text size="sm">{r.patient_name}</Text> },
    { key: "bed_name", label: "Bed", render: (r) => <Text size="sm">{r.bed_name ?? "—"}</Text> },
    {
      key: "drug_name",
      label: "Drug",
      render: (r) => (
        <Group gap={4}>
          <Text size="sm">{r.drug_name}</Text>
          {r.is_high_alert && (
            <Badge size="xs" color="danger" variant="filled">
              HIGH ALERT
            </Badge>
          )}
        </Group>
      ),
    },
    { key: "dose", label: "Dose", render: (r) => <Text size="sm">{r.dose}</Text> },
    { key: "route", label: "Route", render: (r) => <Text size="sm">{r.route}</Text> },
    {
      key: "scheduled_at",
      label: "Scheduled",
      render: (r) => (
        <Text size="sm" c={r.is_overdue ? "danger" : undefined}>
          {new Date(r.scheduled_at).toLocaleTimeString()}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge size="sm" color={r.is_overdue ? "danger" : "warning"}>
          {r.is_overdue ? "Overdue" : "Pending"}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={items}
      loading={loading}
      rowKey={(r) => r.mar_id}
    />
  );
}

function NursingTasksTable({
  items,
  loading,
  canManage,
}: {
  items: NurseTaskItem[];
  loading: boolean;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const completeMut = useMutation({
    mutationFn: (taskId: string) => api.completeCareViewTask(taskId),
    onSuccess: () => {
      notifications.show({ title: "Task completed", message: "", color: "success" });
      void qc.invalidateQueries({ queryKey: ["care-view", "my-tasks"] });
      void qc.invalidateQueries({ queryKey: ["care-view", "ward-grid"] });
    },
  });

  const columns: Column<NurseTaskItem>[] = [
    { key: "patient_name", label: "Patient", render: (r) => <Text size="sm">{r.patient_name}</Text> },
    { key: "bed_name", label: "Bed", render: (r) => <Text size="sm">{r.bed_name ?? "—"}</Text> },
    { key: "description", label: "Task", render: (r) => <Text size="sm" lineClamp={2}>{r.description}</Text> },
    {
      key: "category",
      label: "Category",
      render: (r) => (
        <Badge size="xs" variant="light" color="primary">
          {r.category ?? "—"}
        </Badge>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      render: (r) => (
        <Badge
          size="xs"
          color={r.priority === "stat" ? "danger" : r.priority === "urgent" ? "orange" : "slate"}
        >
          {r.priority}
        </Badge>
      ),
    },
    {
      key: "due_at",
      label: "Due",
      render: (r) => (
        <Text size="sm" c={r.is_overdue ? "danger" : undefined}>
          {r.due_at ? new Date(r.due_at).toLocaleTimeString() : "—"}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge size="sm" color={r.is_overdue ? "danger" : "warning"}>
          {r.is_overdue ? "Overdue" : "Pending"}
        </Badge>
      ),
    },
  ];

  if (canManage) {
    columns.push({
      key: "actions",
      label: "",
      render: (r) => (
        <Tooltip label="Complete task">
          <ActionIcon
            size="sm"
            color="success"
            variant="light"
            loading={completeMut.isPending}
            onClick={() => completeMut.mutate(r.task_id)}
            aria-label="Confirm"
          >
            <IconCheck size={14} />
          </ActionIcon>
        </Tooltip>
      ),
    });
  }

  return (
    <DataTable
      columns={columns}
      data={items}
      loading={loading}
      rowKey={(r) => r.task_id}
    />
  );
}

// ── Tab 3: Handover ─────────────────────────────────────

function HandoverTab({ wardId }: { wardId: string | null }) {
  const [shift, setShift] = useState<string | null>(null);
  const [triggered, setTriggered] = useState(false);

  const effectiveWard = wardId ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["care-view", "handover", effectiveWard, shift],
    queryFn: () => api.handoverSummary(effectiveWard, shift ?? "morning"),
    enabled: triggered && !!effectiveWard && !!shift,
  });

  return (
    <Stack gap="md">
      <Group>
        <Select
          placeholder="Select shift"
          data={SHIFTS}
          value={shift}
          onChange={setShift}
          w={200}
        />
        <Button
          leftSection={<IconClipboardList size={16} />}
          disabled={!effectiveWard || !shift}
          loading={isLoading}
          onClick={() => setTriggered(true)}
        >
          Generate Summary
        </Button>
        {data && (
          <Button
            variant="light"
            leftSection={<IconPrinter size={16} />}
            onClick={() => window.print()}
          >
            Print
          </Button>
        )}
      </Group>

      {!effectiveWard && (
        <Text c="dimmed">Please select a ward to generate handover summary.</Text>
      )}

      {data && (
        <Stack gap="md">
          <Group gap="xl">
            <Text fw={600}>
              {data.ward_name} — {data.shift} shift
            </Text>
            <Badge color="primary" size="lg">
              {data.total_patients} patients
            </Badge>
            <Badge color="danger" size="lg">
              {data.critical_count} critical
            </Badge>
          </Group>

          {data.patients.map((p) => (
            <Card key={p.admission_id} shadow="xs" padding="sm" withBorder>
              <Group justify="space-between" mb={4}>
                <Group gap={8}>
                  <Text fw={600} size="sm">
                    {p.patient_name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {p.bed_name}
                  </Text>
                </Group>
                <Group gap={4}>
                  {p.is_critical && (
                    <Badge size="xs" color="danger">
                      Critical
                    </Badge>
                  )}
                  {p.isolation_required && (
                    <Badge size="xs" color="orange">
                      Isolation
                    </Badge>
                  )}
                </Group>
              </Group>

              {p.provisional_diagnosis && (
                <Text size="xs" c="dimmed" mb={4}>
                  Dx: {p.provisional_diagnosis}
                </Text>
              )}

              {p.pending_tasks.length > 0 && (
                <div>
                  <Text size="xs" fw={600}>
                    Pending Tasks:
                  </Text>
                  {p.pending_tasks.map((t, i) => (
                    <Text key={i} size="xs" c="dimmed" pl="sm">
                      &bull; {t}
                    </Text>
                  ))}
                </div>
              )}

              {p.pending_meds.length > 0 && (
                <div>
                  <Text size="xs" fw={600}>
                    Pending Meds:
                  </Text>
                  {p.pending_meds.map((m, i) => (
                    <Text key={i} size="xs" c="dimmed" pl="sm">
                      &bull; {m}
                    </Text>
                  ))}
                </div>
              )}

              {p.active_clinical_docs.length > 0 && (
                <div>
                  <Text size="xs" fw={600}>
                    Active Clinical Docs:
                  </Text>
                  {p.active_clinical_docs.map((d, i) => (
                    <Text key={i} size="xs" c="dimmed" pl="sm">
                      &bull; {d}
                    </Text>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

// ── Tab 4: Discharge Tracker ────────────────────────────

function DischargeTrackerTab({ wardId }: { wardId: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ["care-view", "discharge-tracker", wardId],
    queryFn: () => api.dischargeReadiness(wardId ?? undefined),
    refetchInterval: 60_000,
  });

  const columns: Column<DischargeReadinessRow>[] = [
    { key: "patient_name", label: "Patient", render: (r) => <Text size="sm">{r.patient_name}</Text> },
    { key: "uhid", label: "UHID", render: (r) => <Text size="sm">{r.uhid}</Text> },
    { key: "bed_name", label: "Bed", render: (r) => <Text size="sm">{r.bed_name ?? "—"}</Text> },
    { key: "ward_name", label: "Ward", render: (r) => <Text size="sm">{r.ward_name ?? "—"}</Text> },
    {
      key: "expected_discharge_date",
      label: "Expected Discharge",
      render: (r) => (
        <Text size="sm">
          {r.expected_discharge_date
            ? new Date(r.expected_discharge_date).toLocaleDateString()
            : "—"}
        </Text>
      ),
    },
    {
      key: "readiness_pct",
      label: "Readiness",
      render: (r) => (
        <Stack gap={2}>
          <Progress
            value={r.readiness_pct}
            color={readinessColor(r.readiness_pct)}
            size="sm"
          />
          <Text size="xs" ta="center">
            {r.readiness_pct}%
          </Text>
        </Stack>
      ),
    },
    {
      key: "billing_cleared",
      label: "Billing",
      render: (r) => (
        <Badge size="xs" color={r.billing_cleared ? "success" : "slate"}>
          {r.billing_cleared ? "Cleared" : "Pending"}
        </Badge>
      ),
    },
    {
      key: "pharmacy_cleared",
      label: "Pharmacy",
      render: (r) => (
        <Badge size="xs" color={r.pharmacy_cleared ? "success" : "slate"}>
          {r.pharmacy_cleared ? "Cleared" : "Pending"}
        </Badge>
      ),
    },
    {
      key: "nursing_cleared",
      label: "Nursing",
      render: (r) => (
        <Badge size="xs" color={r.nursing_cleared ? "success" : "slate"}>
          {r.nursing_cleared ? "Cleared" : "Pending"}
        </Badge>
      ),
    },
    {
      key: "doctor_cleared",
      label: "Doctor",
      render: (r) => (
        <Badge size="xs" color={r.doctor_cleared ? "success" : "slate"}>
          {r.doctor_cleared ? "Cleared" : "Pending"}
        </Badge>
      ),
    },
    {
      key: "pending_lab_count",
      label: "Pending Labs",
      render: (r) => (
        <Text size="sm" c={r.pending_lab_count > 0 ? "danger" : undefined}>
          {r.pending_lab_count}
        </Text>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data ?? []}
      loading={isLoading}
      rowKey={(r) => r.admission_id}
    />
  );
}
