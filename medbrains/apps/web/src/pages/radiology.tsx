import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Drawer,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCalendar,
  IconChartBar,
  IconEye,
  IconPlus,
  IconRadar,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateRadiologyAppointmentRequest,
  CreateRadiologyOrderRequest,
  RadiologyModality,
  RadiologyOrder,
  RadiologyTatRow,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { ClinicalEventProvider, useClinicalEmit, DataTable, PageHeader, StatusDot } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";

const statusColors: Record<string, string> = {
  ordered: "primary",
  scheduled: "info",
  in_progress: "warning",
  completed: "orange",
  reported: "teal",
  verified: "success",
  cancelled: "danger",
};

const priorityColors: Record<string, string> = {
  routine: "slate",
  urgent: "orange",
  stat: "danger",
};

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function RadiologyPage() {
  useRequirePermission(P.RADIOLOGY.ORDERS_LIST);

  return (
    <ClinicalEventProvider moduleCode="radiology" contextCode="radiology-orders">
      <Tabs defaultValue="orders">
        <Tabs.List>
          <Tabs.Tab value="orders" leftSection={<IconRadar size={16} />}>Orders</Tabs.Tab>
          <Tabs.Tab value="modalities">Modalities</Tabs.Tab>
          <Tabs.Tab value="appointments" leftSection={<IconCalendar size={16} />}>Appointments</Tabs.Tab>
          <Tabs.Tab value="tat" leftSection={<IconChartBar size={16} />}>TAT Analytics</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="orders" pt="md">
          <RadiologyOrdersTab />
        </Tabs.Panel>
        <Tabs.Panel value="modalities" pt="md">
          <ModalitiesTab />
        </Tabs.Panel>
        <Tabs.Panel value="appointments" pt="md">
          <AppointmentsTab />
        </Tabs.Panel>
        <Tabs.Panel value="tat" pt="md">
          <TatAnalyticsTab />
        </Tabs.Panel>
      </Tabs>
    </ClinicalEventProvider>
  );
}

// ══════════════════════════════════════════════════════════
//  Orders Tab
// ══════════════════════════════════════════════════════════

function RadiologyOrdersTab() {
  const canCreate = useHasPermission(P.RADIOLOGY.ORDERS_CREATE);
  const canReport = useHasPermission(P.RADIOLOGY.REPORTS_CREATE);
  const canVerify = useHasPermission(P.RADIOLOGY.REPORTS_VERIFY);
  const canCancel = useHasPermission(P.RADIOLOGY.ORDERS_CANCEL);
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [createOpen, createHandlers] = useDisclosure(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["radiology-orders", params],
    queryFn: () => api.listRadiologyOrders(params),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      api.cancelRadiologyOrder(id, { cancellation_reason: "Cancelled by user" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-orders"] });
      notifications.show({ title: "Order cancelled", message: "", color: "danger" });
    },
  });

  const statusTransitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateRadiologyOrderStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-orders"] });
    },
  });

  const orders = data?.orders ?? [];
  const totalPages = data ? Math.ceil(data.total / data.per_page) : 1;

  const columns = [
    { key: "patient_id" as const, label: "Patient", render: (o: RadiologyOrder) => o.patient_id.slice(0, 8) },
    {
      key: "priority" as const,
      label: "Priority",
      render: (o: RadiologyOrder) => (
        <Badge size="xs" color={priorityColors[o.priority] ?? "slate"}>{o.priority}</Badge>
      ),
    },
    {
      key: "status" as const,
      label: "Status",
      render: (o: RadiologyOrder) => <StatusDot label={o.status} color={statusColors[o.status] ?? "slate"} />,
    },
    { key: "body_part" as const, label: "Body Part", render: (o: RadiologyOrder) => o.body_part ?? "—" },
    {
      key: "flags" as const,
      label: "Flags",
      render: (o: RadiologyOrder) => (
        <Group gap={4}>
          {o.contrast_required && <Badge size="xs" color="warning">Contrast</Badge>}
          {o.allergy_flagged && <Badge size="xs" color="danger">Allergy</Badge>}
          {o.pregnancy_checked && <Badge size="xs" color="danger">Preg-Chk</Badge>}
        </Group>
      ),
    },
    {
      key: "created_at" as const,
      label: "Date",
      render: (o: RadiologyOrder) => new Date(o.created_at).toLocaleDateString(),
    },
    {
      key: "actions" as const,
      label: "",
      render: (o: RadiologyOrder) => (
        <Group gap={4}>
          <Tooltip label="View">
            <ActionIcon variant="subtle" onClick={() => setDetailId(o.id)} aria-label="View details">
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          {o.status === "ordered" && canCancel && (
            <Tooltip label="Cancel">
              <ActionIcon variant="subtle" color="danger" onClick={() => cancelMutation.mutate(o.id)} aria-label="Close">
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {o.status === "ordered" && (
            <Button size="xs" variant="light" onClick={() => statusTransitionMutation.mutate({ id: o.id, status: "in_progress" })}>
              Start
            </Button>
          )}
          {o.status === "in_progress" && (
            <Button size="xs" variant="light" color="orange" onClick={() => statusTransitionMutation.mutate({ id: o.id, status: "completed" })}>
              Complete
            </Button>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Radiology Orders"
        subtitle="Imaging order management"
        actions={
          <Group>
            <Select
              placeholder="Filter by status"
              clearable
              size="xs"
              w={160}
              data={["ordered", "scheduled", "in_progress", "completed", "reported", "verified", "cancelled"]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            {canCreate && (
              <Button leftSection={<IconPlus size={16} />} size="xs" onClick={createHandlers.open}>
                New Order
              </Button>
            )}
          </Group>
        }
      />

      <DataTable
        columns={columns}
        data={orders}
        rowKey={(o) => o.id}
        loading={isLoading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <CreateOrderDrawer opened={createOpen} onClose={createHandlers.close} />

      {detailId && (
        <OrderDetailDrawer
          id={detailId}
          onClose={() => setDetailId(null)}
          canReport={canReport}
          canVerify={canVerify}
        />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Create Order Drawer
// ══════════════════════════════════════════════════════════

function CreateOrderDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const emit = useClinicalEmit();

  const { data: modalities } = useQuery({
    queryKey: ["radiology-modalities"],
    queryFn: () => api.listRadiologyModalities(),
  });

  const [form, setForm] = useState<Partial<CreateRadiologyOrderRequest>>({});
  const [contrast, setContrast] = useState(false);
  const [pregnancyChecked, setPregnancyChecked] = useState(false);
  const [allergyFlagged, setAllergyFlagged] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: CreateRadiologyOrderRequest) => api.createRadiologyOrder(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-orders"] });
      notifications.show({ title: "Order created", message: "", color: "success" });
      emit("radiology.order.created", {});
      setForm({});
      setContrast(false);
      setPregnancyChecked(false);
      setAllergyFlagged(false);
      onClose();
    },
  });

  const modalityOptions = (modalities ?? [])
    .filter((m: RadiologyModality) => m.is_active)
    .map((m: RadiologyModality) => ({ value: m.id, label: `${m.code} — ${m.name}` }));

  return (
    <Drawer opened={opened} onClose={onClose} title="New Radiology Order" position="right" size="xl">
      <Stack>
        <PatientSearchSelect value={form.patient_id ?? ""} onChange={(v) => setForm({ ...form, patient_id: v })} required />
        <Select
          label="Modality"
          required
          data={modalityOptions}
          value={form.modality_id ?? null}
          onChange={(v) => setForm({ ...form, modality_id: v ?? undefined })}
          searchable
        />
        <TextInput
          label="Body Part"
          value={form.body_part ?? ""}
          onChange={(e) => setForm({ ...form, body_part: e.currentTarget.value })}
        />
        <Textarea
          label="Clinical Indication"
          value={form.clinical_indication ?? ""}
          onChange={(e) => setForm({ ...form, clinical_indication: e.currentTarget.value })}
        />
        <Select
          label="Priority"
          data={[
            { value: "routine", label: "Routine" },
            { value: "urgent", label: "Urgent" },
            { value: "stat", label: "STAT" },
          ]}
          value={form.priority ?? "routine"}
          onChange={(v) => setForm({ ...form, priority: v ?? "routine" })}
        />
        <Switch label="Contrast Required" checked={contrast} onChange={(e) => setContrast(e.currentTarget.checked)} />
        <Checkbox label="Pregnancy Verified" checked={pregnancyChecked} onChange={(e) => setPregnancyChecked(e.currentTarget.checked)} />
        <Checkbox label="Allergy Flagged" checked={allergyFlagged} onChange={(e) => setAllergyFlagged(e.currentTarget.checked)} />
        <Textarea
          label="Notes"
          value={form.notes ?? ""}
          onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })}
        />
        <Button
          onClick={() => {
            if (!form.patient_id || !form.modality_id) return;
            createMutation.mutate({
              patient_id: form.patient_id,
              modality_id: form.modality_id,
              body_part: form.body_part,
              clinical_indication: form.clinical_indication,
              priority: form.priority,
              notes: form.notes,
              contrast_required: contrast,
              pregnancy_checked: pregnancyChecked,
              allergy_flagged: allergyFlagged,
            });
          }}
          loading={createMutation.isPending}
        >
          Create Order
        </Button>
      </Stack>
    </Drawer>
  );
}

// ══════════════════════════════════════════════════════════
//  Order Detail Drawer
// ══════════════════════════════════════════════════════════

function OrderDetailDrawer({
  id,
  onClose,
  canReport,
  canVerify,
}: {
  id: string;
  onClose: () => void;
  canReport: boolean;
  canVerify: boolean;
}) {
  const qc = useQueryClient();
  const emit = useClinicalEmit();

  const { data } = useQuery({
    queryKey: ["radiology-order", id],
    queryFn: () => api.getRadiologyOrder(id),
  });

  const [reportTab, setReportTab] = useState<string | null>("details");
  const [findings, setFindings] = useState("");
  const [impression, setImpression] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [isCritical, setIsCritical] = useState(false);

  const reportMutation = useMutation({
    mutationFn: () =>
      api.createRadiologyReport(id, {
        findings,
        impression: impression || undefined,
        recommendations: recommendations || undefined,
        is_critical: isCritical,
        status: "preliminary",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-order", id] });
      void qc.invalidateQueries({ queryKey: ["radiology-orders"] });
      notifications.show({ title: "Report created", message: "", color: "success" });
      emit("radiology.report.created", { orderId: id });
      setFindings("");
      setImpression("");
      setRecommendations("");
      setIsCritical(false);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (reportId: string) => api.verifyRadiologyReport(reportId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-order", id] });
      void qc.invalidateQueries({ queryKey: ["radiology-orders"] });
      notifications.show({ title: "Report verified", message: "", color: "success" });
    },
  });

  const order = data?.order;
  const report = data?.report;
  const doseRecords = data?.dose_records ?? [];

  return (
    <Drawer opened onClose={onClose} title="Order Detail" position="right" size="lg">
      {order && (
        <Stack>
          <Group>
            <Text fw={600}>Status:</Text>
            <Badge color={statusColors[order.status] ?? "slate"}>{order.status}</Badge>
            <Text fw={600}>Priority:</Text>
            <Badge color={priorityColors[order.priority] ?? "slate"}>{order.priority}</Badge>
          </Group>
          {order.body_part && <Text size="sm">Body Part: {order.body_part}</Text>}
          {order.clinical_indication && <Text size="sm">Indication: {order.clinical_indication}</Text>}
          {order.cancellation_reason && (
            <Badge color="danger" variant="light">Cancelled: {order.cancellation_reason}</Badge>
          )}

          <Tabs value={reportTab} onChange={setReportTab}>
            <Tabs.List>
              <Tabs.Tab value="details">Details</Tabs.Tab>
              <Tabs.Tab value="report">Report</Tabs.Tab>
              <Tabs.Tab value="dose">Dose Tracking</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="details" pt="sm">
              <Stack gap="xs">
                <Group gap={8}>
                  {order.contrast_required && <Badge size="sm" color="warning">Contrast Required</Badge>}
                  {order.pregnancy_checked && <Badge size="sm" color="danger">Pregnancy Verified</Badge>}
                  {order.allergy_flagged && <Badge size="sm" color="danger">Allergy Flagged</Badge>}
                </Group>
                {order.notes && <Text size="sm">Notes: {order.notes}</Text>}
                {order.scheduled_at && (
                  <Text size="sm">Scheduled: {new Date(order.scheduled_at).toLocaleString()}</Text>
                )}
                {order.completed_at && (
                  <Text size="sm">Completed: {new Date(order.completed_at).toLocaleString()}</Text>
                )}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="report" pt="sm">
              {report ? (
                <Stack>
                  <Group>
                    <Badge color={report.status === "final" ? "success" : "warning"}>{report.status}</Badge>
                    {report.is_critical && <Badge color="danger">CRITICAL</Badge>}
                  </Group>
                  <Text fw={600}>Findings:</Text>
                  <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{report.findings}</Text>
                  {report.impression && (
                    <>
                      <Text fw={600}>Impression:</Text>
                      <Text size="sm">{report.impression}</Text>
                    </>
                  )}
                  {report.recommendations && (
                    <>
                      <Text fw={600}>Recommendations:</Text>
                      <Text size="sm">{report.recommendations}</Text>
                    </>
                  )}
                  {canVerify && report.status !== "final" && (
                    <Button
                      color="success"
                      onClick={() => verifyMutation.mutate(report.id)}
                      loading={verifyMutation.isPending}
                    >
                      Verify & Finalize Report
                    </Button>
                  )}
                </Stack>
              ) : canReport && ["completed", "in_progress"].includes(order.status) ? (
                <Stack>
                  <Textarea label="Findings" required value={findings} onChange={(e) => setFindings(e.currentTarget.value)} minRows={4} />
                  <Textarea label="Impression" value={impression} onChange={(e) => setImpression(e.currentTarget.value)} />
                  <Textarea label="Recommendations" value={recommendations} onChange={(e) => setRecommendations(e.currentTarget.value)} />
                  <Switch label="Critical Finding" checked={isCritical} onChange={(e) => setIsCritical(e.currentTarget.checked)} />
                  <Button onClick={() => reportMutation.mutate()} loading={reportMutation.isPending} disabled={!findings}>
                    Submit Report
                  </Button>
                </Stack>
              ) : (
                <Text c="dimmed" size="sm">No report available yet.</Text>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="dose" pt="sm">
              {doseRecords.length > 0 ? (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Modality</Table.Th>
                      <Table.Th>Body Part</Table.Th>
                      <Table.Th>Dose</Table.Th>
                      <Table.Th>DLP</Table.Th>
                      <Table.Th>CTDIvol</Table.Th>
                      <Table.Th>Recorded</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {doseRecords.map((d) => (
                      <Table.Tr key={d.id}>
                        <Table.Td>{d.modality_code}</Table.Td>
                        <Table.Td>{d.body_part ?? "—"}</Table.Td>
                        <Table.Td>{d.dose_value ? `${d.dose_value} ${d.dose_unit}` : "—"}</Table.Td>
                        <Table.Td>{d.dlp ?? "—"}</Table.Td>
                        <Table.Td>{d.ctdi_vol ?? "—"}</Table.Td>
                        <Table.Td>{new Date(d.recorded_at).toLocaleString()}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <Text c="dimmed" size="sm">No dose records.</Text>
              )}
            </Tabs.Panel>
          </Tabs>
        </Stack>
      )}
    </Drawer>
  );
}

// ══════════════════════════════════════════════════════════
//  Modalities Tab
// ══════════════════════════════════════════════════════════

function ModalitiesTab() {
  const canManage = useHasPermission(P.RADIOLOGY.MODALITIES_MANAGE);
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: modalities, isLoading } = useQuery({
    queryKey: ["radiology-modalities"],
    queryFn: () => api.listRadiologyModalities(),
  });

  const createMutation = useMutation({
    mutationFn: () => api.createRadiologyModality({ code, name, description: description || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-modalities"] });
      notifications.show({ title: "Modality created", message: "", color: "success" });
      setCode("");
      setName("");
      setDescription("");
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteRadiologyModality(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-modalities"] });
      notifications.show({ title: "Modality deleted", message: "", color: "danger" });
    },
  });

  return (
    <>
      <PageHeader
        title="Imaging Modalities"
        subtitle="Master list of imaging types"
        actions={
          canManage ? (
            <Button leftSection={<IconPlus size={16} />} size="xs" onClick={() => setShowForm(true)}>
              Add Modality
            </Button>
          ) : undefined
        }
      />

      {showForm && (
        <Stack mb="md" p="md" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}>
          <Group grow>
            <TextInput label="Code" required value={code} onChange={(e) => setCode(e.currentTarget.value)} placeholder="XRAY" />
            <TextInput label="Name" required value={name} onChange={(e) => setName(e.currentTarget.value)} placeholder="X-Ray" />
          </Group>
          <TextInput label="Description" value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
          <Group>
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending} disabled={!code || !name}>
              Save
            </Button>
            <Button variant="subtle" onClick={() => setShowForm(false)}>Cancel</Button>
          </Group>
        </Stack>
      )}

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Code</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Description</Table.Th>
            <Table.Th>Active</Table.Th>
            {canManage && <Table.Th />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading ? (
            <Table.Tr>
              <Table.Td colSpan={5}><Text c="dimmed">Loading...</Text></Table.Td>
            </Table.Tr>
          ) : (modalities ?? []).map((m: RadiologyModality) => (
            <Table.Tr key={m.id}>
              <Table.Td fw={600}>{m.code}</Table.Td>
              <Table.Td>{m.name}</Table.Td>
              <Table.Td>{m.description ?? "—"}</Table.Td>
              <Table.Td>{m.is_active ? <Badge color="success" size="xs">Active</Badge> : <Badge color="slate" size="xs">Inactive</Badge>}</Table.Td>
              {canManage && (
                <Table.Td>
                  <ActionIcon variant="subtle" color="danger" onClick={() => deleteMutation.mutate(m.id)} aria-label="Close">
                    <IconX size={16} />
                  </ActionIcon>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Appointments Tab
// ══════════════════════════════════════════════════════════

function AppointmentsTab() {
  const canCreate = useHasPermission(P.RADIOLOGY.ORDERS_CREATE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["radiology-appointments"],
    queryFn: () => api.listRadiologyAppointments(),
  });

  const { data: modalities } = useQuery({
    queryKey: ["radiology-modalities"],
    queryFn: () => api.listRadiologyModalities(),
  });

  const [form, setForm] = useState<Partial<CreateRadiologyAppointmentRequest>>({});

  const createMutation = useMutation({
    mutationFn: (data: CreateRadiologyAppointmentRequest) => api.createRadiologyAppointment(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-appointments"] });
      notifications.show({ title: "Appointment created", message: "", color: "success" });
      setForm({});
      createHandlers.close();
    },
  });

  const modalityOptions = (modalities ?? [])
    .filter((m: RadiologyModality) => m.is_active)
    .map((m: RadiologyModality) => ({ value: m.id, label: `${m.code} — ${m.name}` }));

  const columns = [
    {
      key: "patient_id" as const,
      label: "Patient",
      render: (r: Record<string, unknown>) => String(r.patient_id ?? "").slice(0, 8),
    },
    {
      key: "modality_id" as const,
      label: "Modality",
      render: (r: Record<string, unknown>) => {
        const mod = (modalities ?? []).find((m: RadiologyModality) => m.id === r.modality_id);
        return mod ? `${mod.code} — ${mod.name}` : String(r.modality_id ?? "---");
      },
    },
    {
      key: "encounter_id" as const,
      label: "Encounter",
      render: (r: Record<string, unknown>) => String(r.encounter_id ?? "---").slice(0, 8),
    },
    {
      key: "priority" as const,
      label: "Priority",
      render: (r: Record<string, unknown>) => {
        const p = String(r.priority ?? "routine");
        return <Badge size="xs" color={priorityColors[p] ?? "slate"}>{p}</Badge>;
      },
    },
    {
      key: "notes" as const,
      label: "Notes",
      render: (r: Record<string, unknown>) => String(r.notes ?? "---"),
    },
    {
      key: "created_at" as const,
      label: "Created",
      render: (r: Record<string, unknown>) =>
        r.created_at ? new Date(String(r.created_at)).toLocaleDateString() : "---",
    },
  ];

  return (
    <>
      <PageHeader
        title="Radiology Appointments"
        subtitle="Scheduled imaging appointments"
        actions={
          canCreate ? (
            <Button leftSection={<IconPlus size={16} />} size="xs" onClick={createHandlers.open}>
              Create Appointment
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={appointments}
        rowKey={(r) => String(r.id ?? Math.random())}
        loading={isLoading}
      />

      <Modal opened={createOpen} onClose={createHandlers.close} title="Create Radiology Appointment" size="md">
        <Stack>
          <PatientSearchSelect value={form.patient_id ?? ""} onChange={(v) => setForm({ ...form, patient_id: v })} required />
          <Select
            label="Modality"
            required
            data={modalityOptions}
            value={form.modality_id ?? null}
            onChange={(v) => setForm({ ...form, modality_id: v ?? undefined })}
            searchable
          />
          <TextInput
            label="Encounter ID"
            required
            value={form.encounter_id ?? ""}
            onChange={(e) => setForm({ ...form, encounter_id: e.currentTarget.value })}
          />
          <Select
            label="Priority"
            data={[
              { value: "routine", label: "Routine" },
              { value: "urgent", label: "Urgent" },
              { value: "stat", label: "STAT" },
            ]}
            value={form.priority ?? "routine"}
            onChange={(v) => setForm({ ...form, priority: v ?? "routine" })}
          />
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })}
          />
          <Button
            onClick={() => {
              if (!form.patient_id || !form.modality_id || !form.encounter_id) return;
              createMutation.mutate({
                patient_id: form.patient_id,
                modality_id: form.modality_id,
                encounter_id: form.encounter_id,
                priority: form.priority,
                notes: form.notes,
              });
            }}
            loading={createMutation.isPending}
          >
            Create Appointment
          </Button>
        </Stack>
      </Modal>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  TAT Analytics Tab
// ══════════════════════════════════════════════════════════

function TatAnalyticsTab() {
  const { data: tatData = [], isLoading } = useQuery({
    queryKey: ["radiology-tat"],
    queryFn: () => api.getRadiologyTat(),
  });

  const columns = [
    {
      key: "modality_name" as const,
      label: "Modality",
      render: (r: RadiologyTatRow) => <Text fw={600}>{r.modality_name}</Text>,
    },
    {
      key: "total_orders" as const,
      label: "Total Orders",
      render: (r: RadiologyTatRow) => String(r.total_orders),
    },
    {
      key: "completed_count" as const,
      label: "Total Completed",
      render: (r: RadiologyTatRow) => String(r.completed_count),
    },
    {
      key: "avg_tat_hours" as const,
      label: "Avg TAT (hours)",
      render: (r: RadiologyTatRow) =>
        r.avg_tat_hours !== null ? (
          <Badge
            color={r.avg_tat_hours <= 24 ? "success" : r.avg_tat_hours <= 48 ? "warning" : "danger"}
            variant="light"
          >
            {r.avg_tat_hours.toFixed(1)}h
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">N/A</Text>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Turnaround Time Analytics"
        subtitle="Average turnaround times by modality"
      />
      <DataTable
        columns={columns}
        data={tatData}
        rowKey={(r) => r.modality_name}
        loading={isLoading}
      />
    </>
  );
}
