import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Stepper,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Timeline,
  Tooltip,
} from "@mantine/core";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconChartBar,
  IconCheck,
  IconClipboardList,
  IconEye,
  IconHeart,
  IconPackage,
  IconPill,
  IconPlus,
  IconSend,
  IconTruckDelivery,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import type {
  AbcAnalysisRow,
  ApproveIndentItemInput,
  ComplianceCheckRow,
  ConsumptionAnalysisRow,
  CreateCondemnationRequest,
  CreateImplantRequest,
  CreateIndentItemInput,
  CreateStoreCatalogRequest,
  DeadStockRow,
  EquipmentCondemnation,
  FsnAnalysisRow,
  ImplantRegistryEntry,
  IndentRequisition,
  IndentRequisitionDetailResponse,
  IndentType,
  InventoryValuationRow,
  IssueToPatientRequest,
  PatientConsumableIssue,
  PurchaseOrder,
  PurchaseConsumptionTrendRow,
  ResolvedSidecar,
  StoreCatalog,
  StoreStockMovement,
  UpdateCondemnationStatusRequest,
  UpdateStoreCatalogRequest,
  VedAnalysisRow,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { ClinicalEventProvider, useClinicalEmit, DataTable, PageHeader, StatusDot } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";

// ── Status colors ─────────────────────────────────────────

const statusColors: Record<string, string> = {
  draft: "slate",
  submitted: "primary",
  approved: "success",
  partially_approved: "teal",
  rejected: "danger",
  issued: "violet",
  partially_issued: "primary",
  closed: "dark",
  cancelled: "danger",
};

const priorityColors: Record<string, string> = {
  normal: "slate",
  urgent: "orange",
  emergency: "danger",
};

const linkedPoStatusColors: Record<string, string> = {
  draft: "slate",
  submitted: "primary",
  approved: "success",
  sent_to_vendor: "teal",
  partially_received: "primary",
  fully_received: "violet",
  closed: "dark",
  cancelled: "danger",
};

const indentTypeLabels: Record<string, string> = {
  general: "General",
  pharmacy: "Pharmacy",
  lab: "Lab",
  surgical: "Surgical",
  housekeeping: "Housekeeping",
  emergency: "Emergency",
};

// ── Status to stepper step mapping ────────────────────────

function statusToStep(status: string): number {
  const map: Record<string, number> = {
    draft: 0,
    submitted: 1,
    approved: 2,
    partially_approved: 2,
    rejected: 2,
    issued: 3,
    partially_issued: 3,
    closed: 4,
    cancelled: 4,
  };
  return map[status] ?? 0;
}

const indentWorkflowEvents = [
  "indent.submitted",
  "indent.approved",
  "indent.issued",
] as const;

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function IndentPage() {
  useRequirePermission(P.INDENT.LIST);

  return (
    <ClinicalEventProvider moduleCode="indent" contextCode="indent-requisitions">
      <IndentPageInner />
    </ClinicalEventProvider>
  );
}

function IndentPageInner() {
  const canCreate = useHasPermission(P.INDENT.CREATE);
  const canApprove = useHasPermission(P.INDENT.APPROVE);
  const canStock = useHasPermission(P.INDENT.STOCK_MANAGE);
  const canAnalytics = useHasPermission(P.INDENT.ANALYTICS_VIEW);
  const canConsumables = useHasPermission(P.INDENT.CONSUMABLES_LIST);
  const canImplants = useHasPermission(P.INDENT.IMPLANTS_LIST);

  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<string | null>("my-indents");

  return (
    <div>
      <PageHeader
        title="Indent & Store"
        subtitle="Requisitions, approvals, and store management"
        icon={<IconClipboardList size={20} stroke={1.5} />}
        color="info"
        actions={
          canCreate ? (
            <Button leftSection={<IconPlus size={16} />} onClick={() => setActiveTab("create")}>
              New Indent
            </Button>
          ) : undefined
        }
      />

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="my-indents" leftSection={<IconClipboardList size={16} />}>My Indents</Tabs.Tab>
          {canApprove && (
            <Tabs.Tab value="pending-approval" leftSection={<IconCheck size={16} />}>Pending Approval</Tabs.Tab>
          )}
          <Tabs.Tab value="all-indents" leftSection={<IconClipboardList size={16} />}>All Indents</Tabs.Tab>
          <Tabs.Tab value="flow-tracker" leftSection={<IconTruckDelivery size={16} />}>Flow Tracker</Tabs.Tab>
          {canStock && (
            <>
              <Tabs.Tab value="catalog" leftSection={<IconPackage size={16} />}>Store Catalog</Tabs.Tab>
              <Tabs.Tab value="stock" leftSection={<IconTruckDelivery size={16} />}>Stock</Tabs.Tab>
            </>
          )}
          {canAnalytics && (
            <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>Analytics</Tabs.Tab>
          )}
          {canConsumables && (
            <Tabs.Tab value="patient-consumables" leftSection={<IconPill size={16} />}>Patient Consumables</Tabs.Tab>
          )}
          {canImplants && (
            <Tabs.Tab value="assets-implants" leftSection={<IconHeart size={16} />}>Assets &amp; Implants</Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="my-indents">
          <IndentListPanel requestedBy={user?.id} />
        </Tabs.Panel>

        {canApprove && (
          <Tabs.Panel value="pending-approval">
            <IndentListPanel status="submitted" />
          </Tabs.Panel>
        )}

        <Tabs.Panel value="all-indents">
          <IndentListPanel />
        </Tabs.Panel>

        <Tabs.Panel value="flow-tracker">
          <FlowTrackerPanel />
        </Tabs.Panel>

        {canStock && (
          <>
            <Tabs.Panel value="catalog">
              <CatalogPanel />
            </Tabs.Panel>
            <Tabs.Panel value="stock">
              <StockPanel />
            </Tabs.Panel>
          </>
        )}

        {canAnalytics && (
          <Tabs.Panel value="analytics">
            <AnalyticsPanel />
          </Tabs.Panel>
        )}
        {canConsumables && (
          <Tabs.Panel value="patient-consumables">
            <PatientConsumablesPanel />
          </Tabs.Panel>
        )}
        {canImplants && (
          <Tabs.Panel value="assets-implants">
            <AssetsImplantsPanel />
          </Tabs.Panel>
        )}

        {activeTab === "create" && canCreate && (
          <CreateIndentPanel onDone={() => setActiveTab("my-indents")} />
        )}
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Indent List Panel
// ══════════════════════════════════════════════════════════

function IndentListPanel({ status, requestedBy }: { status?: string; requestedBy?: string }) {
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (status) params.status = status;
  if (requestedBy) params.requested_by = requestedBy;

  const { data, isLoading } = useQuery({
    queryKey: ["indent-requisitions", params],
    queryFn: () => api.listIndentRequisitions(params),
  });

  const columns = [
    { key: "indent_number", label: "Indent #", render: (row: IndentRequisition) => <Text fw={600}>{row.indent_number}</Text> },
    {
      key: "indent_type",
      label: "Type",
      render: (row: IndentRequisition) => <Badge variant="light">{indentTypeLabels[row.indent_type] ?? row.indent_type}</Badge>,
    },
    {
      key: "priority",
      label: "Priority",
      render: (row: IndentRequisition) => (
        <StatusDot color={priorityColors[row.priority] ?? "slate"} label={row.priority} size="sm" />
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: IndentRequisition) => (
        <StatusDot color={statusColors[row.status] ?? "slate"} label={row.status.replace(/_/g, " ")} size="sm" />
      ),
    },
    { key: "total_amount", label: "Amount", render: (row: IndentRequisition) => `₹${row.total_amount}` },
    { key: "created_at", label: "Created", render: (row: IndentRequisition) => new Date(row.created_at).toLocaleDateString() },
    {
      key: "actions",
      label: "",
      render: (row: IndentRequisition) => (
        <Tooltip label="View details">
          <ActionIcon
            variant="subtle"
            onClick={() => {
              setDetailId(row.id);
              openDetail();
            }}
            aria-label="View details"
          >
            <IconEye size={16} />
          </ActionIcon>
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={data?.requisitions ?? []}
        loading={isLoading}
        page={page}
        totalPages={Math.ceil((data?.total ?? 0) / 20)}
        onPageChange={setPage}
        rowKey={(row) => row.id}
        emptyTitle="No indent requisitions found"
      />

      <Drawer opened={detailOpened} onClose={closeDetail} title="Indent Details" position="right" size="lg">
        {detailId && <IndentDetailView id={detailId} onClose={closeDetail} />}
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Indent Detail View (Drawer)
// ══════════════════════════════════════════════════════════

function IndentDetailView({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const canApprove = useHasPermission(P.INDENT.APPROVE);
  const canStock = useHasPermission(P.INDENT.STOCK_MANAGE);
  const canCreate = useHasPermission(P.INDENT.CREATE);

  const { data, isLoading } = useQuery({
    queryKey: ["indent-requisition", id],
    queryFn: () => api.getIndentRequisition(id),
  });

  const emit = useClinicalEmit();

  const submitMutation = useMutation({
    mutationFn: () => api.submitIndentRequisition(id),
    onSuccess: () => {
      notifications.show({ title: "Submitted", message: "Indent submitted for approval", color: "success" });
      emit("indent.submitted", { requisition_id: id });
      void queryClient.invalidateQueries({ queryKey: ["indent-requisition"] });
      void queryClient.invalidateQueries({ queryKey: ["indent-requisitions"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.rejectIndentRequisition(id),
    onSuccess: () => {
      notifications.show({ title: "Rejected", message: "Indent rejected", color: "danger" });
      void queryClient.invalidateQueries({ queryKey: ["indent-requisition"] });
      void queryClient.invalidateQueries({ queryKey: ["indent-requisitions"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelIndentRequisition(id),
    onSuccess: () => {
      notifications.show({ title: "Cancelled", message: "Indent cancelled", color: "orange" });
      void queryClient.invalidateQueries({ queryKey: ["indent-requisition"] });
      void queryClient.invalidateQueries({ queryKey: ["indent-requisitions"] });
      onClose();
    },
  });

  if (isLoading || !data) return <Text>Loading...</Text>;

  const { requisition, items } = data;
  const step = statusToStep(requisition.status);

  return (
    <Stack>
      <Stepper active={step} size="xs">
        <Stepper.Step label="Draft" />
        <Stepper.Step label="Submitted" />
        <Stepper.Step label="Approved" />
        <Stepper.Step label="Issued" />
        <Stepper.Step label="Closed" />
      </Stepper>

      <Group>
        <Badge color={statusColors[requisition.status] ?? "slate"} variant="filled">
          {requisition.status.replace(/_/g, " ")}
        </Badge>
        <Badge color={priorityColors[requisition.priority] ?? "slate"} variant="outline">
          {requisition.priority}
        </Badge>
        <Badge variant="light">{indentTypeLabels[requisition.indent_type] ?? requisition.indent_type}</Badge>
      </Group>

      <Text size="sm" c="dimmed">Indent #{requisition.indent_number}</Text>
      {requisition.notes && <Text size="sm">{requisition.notes}</Text>}

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item</Table.Th>
            <Table.Th>Requested</Table.Th>
            <Table.Th>Approved</Table.Th>
            <Table.Th>Issued</Table.Th>
            <Table.Th>Price</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td>{item.item_name}</Table.Td>
              <Table.Td>{item.quantity_requested}</Table.Td>
              <Table.Td>{item.quantity_approved}</Table.Td>
              <Table.Td>{item.quantity_issued}</Table.Td>
              <Table.Td>₹{item.total_price}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Text fw={600}>Total: ₹{requisition.total_amount}</Text>

      <Group>
        {requisition.status === "draft" && canCreate && (
          <>
            <Button
              leftSection={<IconSend size={16} />}
              loading={submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              Submit
            </Button>
            <Button
              variant="outline"
              color="danger"
              leftSection={<IconX size={16} />}
              loading={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
            >
              Cancel
            </Button>
          </>
        )}

        {requisition.status === "submitted" && canApprove && (
          <>
            <ApproveButton requisitionId={id} items={items} />
            <Button
              variant="outline"
              color="danger"
              leftSection={<IconX size={16} />}
              loading={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate()}
            >
              Reject
            </Button>
          </>
        )}

        {["approved", "partially_approved", "partially_issued"].includes(requisition.status) && canStock && (
          <IssueButton requisitionId={id} items={items} />
        )}
      </Group>
    </Stack>
  );
}

// ── Approve Button with quantity editing ──────────────────

function ApproveButton({
  requisitionId,
  items,
}: {
  requisitionId: string;
  items: IndentRequisitionDetailResponse["items"];
}) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [approvals, setApprovals] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.quantity_requested])),
  );

  const mutation = useMutation({
    mutationFn: () => {
      const approveItems: ApproveIndentItemInput[] = items.map((i) => ({
        item_id: i.id,
        quantity_approved: approvals[i.id] ?? i.quantity_requested,
      }));
      return api.approveIndentRequisition(requisitionId, { items: approveItems });
    },
    onSuccess: () => {
      notifications.show({ title: "Approved", message: "Indent approved", color: "success" });
      emit("indent.approved", { requisition_id: requisitionId });
      void queryClient.invalidateQueries({ queryKey: ["indent-requisition"] });
      void queryClient.invalidateQueries({ queryKey: ["indent-requisitions"] });
      close();
    },
  });

  return (
    <>
      <Button leftSection={<IconCheck size={16} />} color="success" onClick={open}>
        Approve
      </Button>
      <Drawer opened={opened} onClose={close} title="Approve Indent Items" position="right" size="md">
        <Stack>
          {items.map((item) => (
            <Group key={item.id}>
              <Text size="sm" style={{ flex: 1 }}>{item.item_name}</Text>
              <NumberInput
                size="xs"
                w={80}
                min={0}
                max={item.quantity_requested}
                value={approvals[item.id] ?? item.quantity_requested}
                onChange={(v) => setApprovals((prev) => ({ ...prev, [item.id]: Number(v) }))}
              />
              <Text size="xs" c="dimmed">/ {item.quantity_requested}</Text>
            </Group>
          ))}
          <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Confirm Approval
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Issue Button ──────────────────────────────────────────

function IssueButton({
  requisitionId,
  items,
}: {
  requisitionId: string;
  items: IndentRequisitionDetailResponse["items"];
}) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [issues, setIssues] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.quantity_approved - i.quantity_issued])),
  );

  const mutation = useMutation({
    mutationFn: () => {
      const issueItems = items.map((i) => ({
        item_id: i.id,
        quantity_issued: issues[i.id] ?? 0,
      }));
      return api.issueIndentRequisition(requisitionId, { items: issueItems });
    },
    onSuccess: () => {
      notifications.show({ title: "Issued", message: "Items issued and stock updated", color: "success" });
      emit("indent.issued", { requisition_id: requisitionId });
      void queryClient.invalidateQueries({ queryKey: ["indent-requisition"] });
      void queryClient.invalidateQueries({ queryKey: ["indent-requisitions"] });
      close();
    },
  });

  return (
    <>
      <Button leftSection={<IconTruckDelivery size={16} />} color="violet" onClick={open}>
        Issue Items
      </Button>
      <Drawer opened={opened} onClose={close} title="Issue Indent Items" position="right" size="md">
        <Stack>
          {items.map((item) => {
            const remaining = item.quantity_approved - item.quantity_issued;
            return (
              <Group key={item.id}>
                <Text size="sm" style={{ flex: 1 }}>{item.item_name}</Text>
                <NumberInput
                  size="xs"
                  w={80}
                  min={0}
                  max={remaining}
                  value={issues[item.id] ?? remaining}
                  onChange={(v) => setIssues((prev) => ({ ...prev, [item.id]: Number(v) }))}
                />
                <Text size="xs" c="dimmed">/ {remaining} remaining</Text>
              </Group>
            );
          })}
          <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Confirm Issue
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Flow Tracker Panel
// ══════════════════════════════════════════════════════════

function FlowTrackerPanel() {
  const [indentNumber, setIndentNumber] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["indent-requisition", selectedId],
    queryFn: () => api.getIndentRequisition(selectedId!),
    enabled: !!selectedId,
  });

  return (
    <Stack>
      <Group>
        <TextInput
          placeholder="Search by indent number..."
          value={indentNumber}
          onChange={(e) => setIndentNumber(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
      </Group>

      {/* Recent indents for quick selection */}
      <RecentIndentsList onSelect={setSelectedId} searchTerm={indentNumber} />

      {selectedId && detailQuery.data && (
        <IndentTimeline data={detailQuery.data} />
      )}
    </Stack>
  );
}

function RecentIndentsList({
  onSelect,
  searchTerm,
}: {
  onSelect: (id: string) => void;
  searchTerm: string;
}) {
  const { data } = useQuery({
    queryKey: ["indent-requisitions", { page: "1", per_page: "10" }],
    queryFn: () => api.listIndentRequisitions({ page: "1", per_page: "10" }),
  });

  const filtered = (data?.requisitions ?? []).filter((req) =>
    req.indent_number.toLowerCase().includes(searchTerm.trim().toLowerCase()),
  );

  if (!filtered.length) {
    return searchTerm.trim() ? (
      <Text size="sm" c="dimmed">No indents match that number yet.</Text>
    ) : null;
  }

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Indent #</Table.Th>
          <Table.Th>Type</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Date</Table.Th>
          <Table.Th />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {filtered.map((req) => (
          <Table.Tr key={req.id} style={{ cursor: "pointer" }} onClick={() => onSelect(req.id)}>
            <Table.Td><Text fw={600} size="sm">{req.indent_number}</Text></Table.Td>
            <Table.Td><Badge variant="light" size="sm">{indentTypeLabels[req.indent_type]}</Badge></Table.Td>
            <Table.Td><Badge color={statusColors[req.status]} variant="filled" size="sm">{req.status.replace(/_/g, " ")}</Badge></Table.Td>
            <Table.Td><Text size="sm">{new Date(req.created_at).toLocaleDateString()}</Text></Table.Td>
            <Table.Td>
              <ActionIcon variant="subtle" size="sm" aria-label="View details"><IconEye size={14} /></ActionIcon>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function IndentTimeline({ data }: { data: IndentRequisitionDetailResponse }) {
  const { requisition, items } = data;
  const relatedPurchaseOrdersQuery = useQuery({
    queryKey: ["purchase-orders", "indent-link", requisition.id],
    queryFn: () => api.listPurchaseOrders({ indent_requisition_id: requisition.id, page: "1", per_page: "10" }),
    staleTime: 30_000,
  });
  const sidecarsQuery = useQuery({
    queryKey: ["module-sidecars", "indent", "indent-requisitions", "flow-tracker"],
    queryFn: () => api.listModuleSidecars("indent", "indent-requisitions"),
    staleTime: 5 * 60 * 1000,
  });

  const timelineItems = [
    { title: "Created", description: `Indent ${requisition.indent_number} created`, date: requisition.created_at, active: true },
    ...(requisition.status !== "draft"
      ? [{ title: "Submitted", description: "Submitted for approval", date: requisition.updated_at, active: true }]
      : []),
    ...(requisition.approved_at
      ? [{
          title: requisition.status === "rejected" ? "Rejected" : "Approved",
          description: requisition.status === "rejected" ? "Requisition rejected" : `Approved${requisition.status === "partially_approved" ? " (partial)" : ""}`,
          date: requisition.approved_at,
          active: true,
        }]
      : []),
    ...(["issued", "partially_issued", "closed"].includes(requisition.status)
      ? [{ title: "Issued", description: `Items ${requisition.status === "partially_issued" ? "partially " : ""}issued`, date: requisition.updated_at, active: true }]
      : []),
    ...(requisition.status === "closed"
      ? [{ title: "Closed", description: "Requisition closed", date: requisition.updated_at, active: true }]
      : []),
  ];

  return (
    <Stack>
      <Stepper active={statusToStep(requisition.status)} size="sm">
        <Stepper.Step label="Draft" />
        <Stepper.Step label="Submitted" />
        <Stepper.Step label="Approved" />
        <Stepper.Step label="Issued" />
        <Stepper.Step label="Closed" />
      </Stepper>

      <Timeline active={timelineItems.length - 1} bulletSize={24} lineWidth={2}>
        {timelineItems.map((item, idx) => (
          <Timeline.Item key={idx} title={item.title}>
            <Text c="dimmed" size="sm">{item.description}</Text>
            <Text size="xs" mt={4}>{new Date(item.date).toLocaleString()}</Text>
          </Timeline.Item>
        ))}
      </Timeline>

      <WorkflowSidecarPanel sidecars={sidecarsQuery.data ?? []} />

      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item</Table.Th>
            <Table.Th>Requested</Table.Th>
            <Table.Th>Approved</Table.Th>
            <Table.Th>Issued</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td>{item.item_name}</Table.Td>
              <Table.Td>{item.quantity_requested}</Table.Td>
              <Table.Td>{item.quantity_approved}</Table.Td>
              <Table.Td>{item.quantity_issued}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <LinkedPurchaseOrdersPanel
        requisitionId={requisition.id}
        purchaseOrders={relatedPurchaseOrdersQuery.data?.purchase_orders ?? []}
      />
    </Stack>
  );
}

function WorkflowSidecarPanel({ sidecars }: { sidecars: ResolvedSidecar[] }) {
  const relevantSidecars = sidecars.filter((sidecar) =>
    indentWorkflowEvents.includes(sidecar.trigger_event as (typeof indentWorkflowEvents)[number]),
  );

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text fw={600}>Workflow Sidecar</Text>
        <Badge variant="light" color="violet">
          {relevantSidecars.length} configured
        </Badge>
      </Group>

      {relevantSidecars.length === 0 ? (
        <Text size="sm" c="dimmed">
          No module sidecars are configured for indent events yet. Add a pipeline or inline action from the screen builder to automate this flow.
        </Text>
      ) : (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Event</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Action</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {relevantSidecars.map((sidecar) => (
              <Table.Tr key={sidecar.id}>
                <Table.Td>
                  <Badge variant="light" size="sm">
                    {sidecar.trigger_event}
                  </Badge>
                </Table.Td>
                <Table.Td>{sidecar.name}</Table.Td>
                <Table.Td>
                  {sidecar.pipeline_id ? (
                    <Badge color="violet" variant="outline">Pipeline</Badge>
                  ) : sidecar.inline_action ? (
                    <Badge color="teal" variant="outline">Inline Action</Badge>
                  ) : (
                    <Badge color="slate" variant="outline">Passive</Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

function LinkedPurchaseOrdersPanel({
  requisitionId,
  purchaseOrders,
}: {
  requisitionId: string;
  purchaseOrders: PurchaseOrder[];
}) {
  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text fw={600}>Downstream Procurement</Text>
        <Badge variant="light" color="info">
          {purchaseOrders.length} linked
        </Badge>
      </Group>

      {purchaseOrders.length === 0 ? (
        <Text size="sm" c="dimmed">
          No purchase orders are linked to this indent yet. Create a PO from Procurement and select this indent to continue the chain.
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>PO #</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Amount</Table.Th>
              <Table.Th>Date</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {purchaseOrders.map((po) => (
              <Table.Tr key={`${requisitionId}-${po.id}`}>
                <Table.Td>
                  <Text fw={600} size="sm">{po.po_number}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={linkedPoStatusColors[po.status] ?? "slate"} variant="light" size="sm">
                    {po.status.replace(/_/g, " ")}
                  </Badge>
                </Table.Td>
                <Table.Td>₹{po.total_amount}</Table.Td>
                <Table.Td>{po.order_date}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Create Indent Panel
// ══════════════════════════════════════════════════════════

function CreateIndentPanel({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [indentType, setIndentType] = useState<string>("general");
  const [priority, setPriority] = useState<string>("normal");
  const [departmentId, setDepartmentId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<CreateIndentItemInput[]>([
    { item_name: "", quantity_requested: 1 },
  ]);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.listDepartments(),
  });

  const { data: catalog } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => api.listStoreCatalog({ active_only: "true" }),
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.createIndentRequisition({
        department_id: departmentId,
        indent_type: indentType as IndentType,
        priority: priority as "normal" | "urgent" | "emergency",
        notes: notes || undefined,
        items,
      }),
    onSuccess: () => {
      notifications.show({ title: "Created", message: "Indent requisition created", color: "success" });
      void queryClient.invalidateQueries({ queryKey: ["indent-requisitions"] });
      onDone();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  const addItem = () => setItems([...items, { item_name: "", quantity_requested: 1 }]);

  const removeItem = (idx: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== idx));
    }
  };

  const updateItem = (idx: number, field: keyof CreateIndentItemInput, value: unknown) => {
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const departmentOptions = (departments ?? []).map((d) => ({
    value: d.id,
    label: d.name,
  }));

  return (
    <Stack mt="md">
      <Text fw={600} size="lg">Create New Indent</Text>

      <Group grow>
        <Select
          label="Department"
          placeholder="Select department"
          data={departmentOptions}
          value={departmentId}
          onChange={(v) => setDepartmentId(v ?? "")}
          searchable
          required
        />
        <Select
          label="Indent Type"
          data={Object.entries(indentTypeLabels).map(([value, label]) => ({ value, label }))}
          value={indentType}
          onChange={(v) => setIndentType(v ?? "general")}
        />
        <Select
          label="Priority"
          data={[
            { value: "normal", label: "Normal" },
            { value: "urgent", label: "Urgent" },
            { value: "emergency", label: "Emergency" },
          ]}
          value={priority}
          onChange={(v) => setPriority(v ?? "normal")}
        />
      </Group>

      <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />

      <Text fw={600}>Items</Text>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item Name</Table.Th>
            <Table.Th>Catalog Item</Table.Th>
            <Table.Th>Qty</Table.Th>
            <Table.Th>Unit Price</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item, idx) => (
            <Table.Tr key={idx}>
              <Table.Td>
                <TextInput
                  size="xs"
                  placeholder="Item name"
                  value={item.item_name}
                  onChange={(e) => updateItem(idx, "item_name", e.currentTarget.value)}
                  required
                />
              </Table.Td>
              <Table.Td>
                <Select
                  size="xs"
                  placeholder="From catalog"
                  data={(catalog ?? []).map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
                  value={item.catalog_item_id ?? null}
                  onChange={(v) => {
                    const cat = catalog?.find((c) => c.id === v);
                    if (cat) {
                      updateItem(idx, "catalog_item_id", v);
                      updateItem(idx, "item_name", cat.name);
                      updateItem(idx, "unit_price", Number(cat.base_price));
                    }
                  }}
                  searchable
                  clearable
                />
              </Table.Td>
              <Table.Td>
                <NumberInput
                  size="xs"
                  w={80}
                  min={1}
                  value={item.quantity_requested}
                  onChange={(v) => updateItem(idx, "quantity_requested", Number(v))}
                />
              </Table.Td>
              <Table.Td>
                <NumberInput
                  size="xs"
                  w={100}
                  min={0}
                  decimalScale={2}
                  value={item.unit_price ?? 0}
                  onChange={(v) => updateItem(idx, "unit_price", Number(v))}
                />
              </Table.Td>
              <Table.Td>
                <ActionIcon variant="subtle" color="danger" onClick={() => removeItem(idx)} aria-label="Close">
                  <IconX size={14} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Button variant="outline" size="xs" leftSection={<IconPlus size={14} />} onClick={addItem} w="fit-content">
        Add Item
      </Button>

      <Group>
        <Button
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
          disabled={!departmentId || items.every((i) => !i.item_name)}
        >
          Create Indent
        </Button>
        <Button variant="outline" onClick={onDone}>Cancel</Button>
      </Group>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Store Catalog Panel
// ══════════════════════════════════════════════════════════

function CatalogPanel() {
  const queryClient = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [editItem, setEditItem] = useState<StoreCatalog | null>(null);
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);

  const { data: catalog, isLoading } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => api.listStoreCatalog(),
  });

  const columns = [
    { key: "code", label: "Code", render: (row: StoreCatalog) => <Text fw={600}>{row.code}</Text> },
    { key: "name", label: "Name", render: (row: StoreCatalog) => row.name },
    { key: "category", label: "Category", render: (row: StoreCatalog) => row.category ?? "-" },
    { key: "unit", label: "Unit", render: (row: StoreCatalog) => row.unit },
    { key: "base_price", label: "Price", render: (row: StoreCatalog) => `₹${row.base_price}` },
    {
      key: "current_stock",
      label: "Stock",
      render: (row: StoreCatalog) => (
        <Badge color={row.current_stock <= row.reorder_level ? "danger" : "success"} variant="light">
          {row.current_stock}
        </Badge>
      ),
    },
    { key: "reorder_level", label: "Reorder Level", render: (row: StoreCatalog) => row.reorder_level },
    {
      key: "actions",
      label: "",
      render: (row: StoreCatalog) => (
        <ActionIcon variant="subtle" onClick={() => { setEditItem(row); openEdit(); }} aria-label="View details">
          <IconEye size={16} />
        </ActionIcon>
      ),
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Add Item</Button>
      </Group>

      <DataTable
        columns={columns}
        data={catalog ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyTitle="No catalog items"
      />

      <Drawer opened={createOpened} onClose={closeCreate} title="Add Catalog Item" position="right" size="md">
        <CatalogForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["store-catalog"] });
            closeCreate();
          }}
        />
      </Drawer>

      <Drawer opened={editOpened} onClose={closeEdit} title="Edit Catalog Item" position="right" size="md">
        {editItem && (
          <CatalogForm
            initial={editItem}
            onSuccess={() => {
              void queryClient.invalidateQueries({ queryKey: ["store-catalog"] });
              closeEdit();
            }}
          />
        )}
      </Drawer>
    </>
  );
}

function CatalogForm({ initial, onSuccess }: { initial?: StoreCatalog; onSuccess: () => void }) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "unit");
  const [basePrice, setBasePrice] = useState(Number(initial?.base_price ?? 0));
  const [reorderLevel, setReorderLevel] = useState(initial?.reorder_level ?? 0);

  const createMutation = useMutation({
    mutationFn: () =>
      api.createStoreCatalogItem({
        code,
        name,
        category: category || undefined,
        unit: unit || undefined,
        base_price: basePrice,
        reorder_level: reorderLevel,
      } as CreateStoreCatalogRequest),
    onSuccess: () => {
      notifications.show({ title: "Created", message: "Catalog item created", color: "success" });
      onSuccess();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateStoreCatalogItem(initial!.id, {
        name,
        category: category || undefined,
        unit: unit || undefined,
        base_price: basePrice,
        reorder_level: reorderLevel,
      } as UpdateStoreCatalogRequest),
    onSuccess: () => {
      notifications.show({ title: "Updated", message: "Catalog item updated", color: "success" });
      onSuccess();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  return (
    <Stack>
      <TextInput label="Code" value={code} onChange={(e) => setCode(e.currentTarget.value)} required disabled={!!initial} />
      <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
      <TextInput label="Category" value={category} onChange={(e) => setCategory(e.currentTarget.value)} />
      <TextInput label="Unit" value={unit} onChange={(e) => setUnit(e.currentTarget.value)} />
      <NumberInput label="Base Price" value={basePrice} onChange={(v) => setBasePrice(Number(v))} decimalScale={2} min={0} />
      <NumberInput label="Reorder Level" value={reorderLevel} onChange={(v) => setReorderLevel(Number(v))} min={0} />
      <Button
        loading={initial ? updateMutation.isPending : createMutation.isPending}
        onClick={() => (initial ? updateMutation.mutate() : createMutation.mutate())}
      >
        {initial ? "Update" : "Create"}
      </Button>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Stock Movements Panel
// ══════════════════════════════════════════════════════════

function StockPanel() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data, isLoading } = useQuery({
    queryKey: ["stock-movements", page],
    queryFn: () => api.listStoreStockMovements({ page: String(page), per_page: "50" }),
  });

  const columns = [
    {
      key: "movement_type",
      label: "Type",
      render: (row: StoreStockMovement) => (
        <Badge
          color={row.movement_type === "receipt" || row.movement_type === "return" ? "success" : "danger"}
          variant="light"
          size="sm"
        >
          {row.movement_type}
        </Badge>
      ),
    },
    { key: "quantity", label: "Qty", render: (row: StoreStockMovement) => row.quantity },
    { key: "reference_type", label: "Reference", render: (row: StoreStockMovement) => row.reference_type ?? "-" },
    { key: "notes", label: "Notes", render: (row: StoreStockMovement) => row.notes ?? "-" },
    { key: "created_at", label: "Date", render: (row: StoreStockMovement) => new Date(row.created_at).toLocaleString() },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Record Movement</Button>
      </Group>

      <DataTable
        columns={columns}
        data={data?.movements ?? []}
        loading={isLoading}
        page={page}
        totalPages={Math.ceil((data?.total ?? 0) / 50)}
        onPageChange={setPage}
        rowKey={(row) => row.id}
        emptyTitle="No stock movements"
      />

      <Drawer opened={createOpened} onClose={closeCreate} title="Record Stock Movement" position="right" size="md">
        <StockMovementForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
            void queryClient.invalidateQueries({ queryKey: ["store-catalog"] });
            closeCreate();
          }}
        />
      </Drawer>
    </>
  );
}

function StockMovementForm({ onSuccess }: { onSuccess: () => void }) {
  const [catalogItemId, setCatalogItemId] = useState("");
  const [movementType, setMovementType] = useState("receipt");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const { data: catalog } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => api.listStoreCatalog({ active_only: "true" }),
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.createStoreStockMovement({
        catalog_item_id: catalogItemId,
        movement_type: movementType as "receipt" | "issue" | "return" | "adjustment" | "transfer",
        quantity,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      notifications.show({ title: "Recorded", message: "Stock movement recorded", color: "success" });
      onSuccess();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  return (
    <Stack>
      <Select
        label="Catalog Item"
        placeholder="Select item"
        data={(catalog ?? []).map((c) => ({ value: c.id, label: `${c.code} - ${c.name} (Stock: ${c.current_stock})` }))}
        value={catalogItemId}
        onChange={(v) => setCatalogItemId(v ?? "")}
        searchable
        required
      />
      <Select
        label="Movement Type"
        data={[
          { value: "receipt", label: "Receipt (In)" },
          { value: "issue", label: "Issue (Out)" },
          { value: "return", label: "Return (In)" },
          { value: "adjustment", label: "Adjustment" },
          { value: "transfer", label: "Transfer (Out)" },
        ]}
        value={movementType}
        onChange={(v) => setMovementType(v ?? "receipt")}
      />
      <NumberInput label="Quantity" value={quantity} onChange={(v) => setQuantity(Number(v))} min={1} required />
      <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
      <Button loading={mutation.isPending} onClick={() => mutation.mutate()} disabled={!catalogItemId}>
        Record Movement
      </Button>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Analytics Panel
// ══════════════════════════════════════════════════════════

function AnalyticsPanel() {
  const [view, setView] = useState("consumption");

  return (
    <Stack>
      <SegmentedControl
        value={view}
        onChange={setView}
        data={[
          { label: "Consumption", value: "consumption" },
          { label: "ABC", value: "abc" },
          { label: "VED", value: "ved" },
          { label: "FSN", value: "fsn" },
          { label: "Dead Stock", value: "dead-stock" },
          { label: "Purchase vs Consumption", value: "pvc" },
          { label: "Valuation", value: "valuation" },
          { label: "Compliance", value: "compliance" },
        ]}
      />
      {view === "consumption" && <ConsumptionView />}
      {view === "abc" && <AbcView />}
      {view === "ved" && <VedView />}
      {view === "fsn" && <FsnView />}
      {view === "dead-stock" && <DeadStockView />}
      {view === "pvc" && <PurchaseConsumptionView />}
      {view === "valuation" && <ValuationView />}
      {view === "compliance" && <ComplianceView />}
    </Stack>
  );
}

// ── Consumption Analysis ─────────────────────────────────

function ConsumptionView() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [department, setDepartment] = useState<string | null>(null);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.listDepartments(),
  });

  const params: Record<string, string> = {};
  if (fromDate) params.from = fromDate;
  if (toDate) params.to = toDate;
  if (department) params.department_id = department;

  const { data, isLoading } = useQuery({
    queryKey: ["indent-analytics-consumption", params],
    queryFn: () => api.getConsumptionAnalysis(params),
  });

  const columns = [
    { key: "item_name", label: "Item", render: (row: ConsumptionAnalysisRow) => row.item_name },
    { key: "department_name", label: "Department", render: (row: ConsumptionAnalysisRow) => row.department_name ?? "-" },
    { key: "total_issued", label: "Total Issued", render: (row: ConsumptionAnalysisRow) => row.total_issued },
    { key: "total_value", label: "Total Value", render: (row: ConsumptionAnalysisRow) => `\u20B9${row.total_value}` },
  ];

  const departmentOptions = (departments ?? []).map((d) => ({ value: d.id, label: d.name }));

  return (
    <Stack>
      <Group>
        <TextInput
          label="From Date"
          placeholder="YYYY-MM-DD"
          value={fromDate}
          onChange={(e) => setFromDate(e.currentTarget.value)}
          w={160}
        />
        <TextInput
          label="To Date"
          placeholder="YYYY-MM-DD"
          value={toDate}
          onChange={(e) => setToDate(e.currentTarget.value)}
          w={160}
        />
        <Select
          label="Department"
          placeholder="All departments"
          data={departmentOptions}
          value={department}
          onChange={setDepartment}
          clearable
          searchable
          w={220}
        />
      </Group>
      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        rowKey={(row) => `${row.item_name}-${row.department_name}`}
        emptyTitle="No consumption data"
      />
    </Stack>
  );
}

// ── ABC Analysis ─────────────────────────────────────────

function AbcView() {
  const { data, isLoading } = useQuery({
    queryKey: ["indent-analytics-abc"],
    queryFn: () => api.getAbcAnalysis(),
  });

  const abcColors: Record<string, string> = { A: "danger", B: "orange", C: "success" };

  const columns = [
    { key: "item_name", label: "Item", render: (row: AbcAnalysisRow) => row.item_name },
    { key: "annual_value", label: "Annual Value", render: (row: AbcAnalysisRow) => `\u20B9${row.annual_value}` },
    { key: "cumulative_pct", label: "Cumulative %", render: (row: AbcAnalysisRow) => `${row.cumulative_pct.toFixed(1)}%` },
    {
      key: "abc_class",
      label: "Class",
      render: (row: AbcAnalysisRow) => (
        <Badge color={abcColors[row.abc_class] ?? "slate"} variant="filled" size="sm">
          {row.abc_class}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data ?? []}
      loading={isLoading}
      rowKey={(row) => row.item_name}
      emptyTitle="No ABC analysis data"
    />
  );
}

// ── VED Analysis ─────────────────────────────────────────

function VedView() {
  const { data, isLoading } = useQuery({
    queryKey: ["indent-analytics-ved"],
    queryFn: () => api.getVedAnalysis(),
  });

  const vedColors: Record<string, string> = { vital: "danger", essential: "orange", desirable: "success" };

  const classified = (data ?? []).filter((r) => r.ved_class);
  const unclassified = (data ?? []).filter((r) => !r.ved_class);

  const columns = [
    { key: "item_name", label: "Item", render: (row: VedAnalysisRow) => row.item_name },
    {
      key: "ved_class",
      label: "VED Class",
      render: (row: VedAnalysisRow) =>
        row.ved_class ? (
          <Badge color={vedColors[row.ved_class] ?? "slate"} variant="filled" size="sm">
            {row.ved_class}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">Unclassified</Text>
        ),
    },
    { key: "current_stock", label: "Current Stock", render: (row: VedAnalysisRow) => row.current_stock },
    { key: "reorder_level", label: "Reorder Level", render: (row: VedAnalysisRow) => row.reorder_level },
  ];

  return (
    <Stack>
      <DataTable
        columns={columns}
        data={classified}
        loading={isLoading}
        rowKey={(row) => row.item_name}
        emptyTitle="No classified items"
      />
      {unclassified.length > 0 && (
        <>
          <Text fw={600} mt="md">
            <IconAlertTriangle size={16} style={{ verticalAlign: "middle", marginRight: 4 }} />
            Unclassified Items ({unclassified.length})
          </Text>
          <DataTable
            columns={columns}
            data={unclassified}
            loading={false}
            rowKey={(row) => row.item_name}
            emptyTitle="No unclassified items"
          />
        </>
      )}
    </Stack>
  );
}

// ── FSN Analysis ─────────────────────────────────────────

function FsnView() {
  const [period, setPeriod] = useState("90");

  const params: Record<string, string> = { period_days: period };

  const { data, isLoading } = useQuery({
    queryKey: ["indent-analytics-fsn", params],
    queryFn: () => api.getFsnAnalysis(params),
  });

  const fsnColors: Record<string, string> = { fast: "success", slow: "warning", non_moving: "danger" };

  const columns = [
    { key: "item_name", label: "Item", render: (row: FsnAnalysisRow) => row.item_name },
    {
      key: "last_issue_date",
      label: "Last Issue",
      render: (row: FsnAnalysisRow) => row.last_issue_date ? new Date(row.last_issue_date).toLocaleDateString() : "Never",
    },
    {
      key: "days_since_last_issue",
      label: "Days Idle",
      render: (row: FsnAnalysisRow) => row.days_since_last_issue ?? "-",
    },
    {
      key: "fsn_class",
      label: "Class",
      render: (row: FsnAnalysisRow) => (
        <Badge color={fsnColors[row.fsn_class] ?? "slate"} variant="filled" size="sm">
          {row.fsn_class.replace(/_/g, " ")}
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      <Group>
        <Select
          label="Period (days)"
          data={[
            { value: "30", label: "30 days" },
            { value: "60", label: "60 days" },
            { value: "90", label: "90 days" },
            { value: "180", label: "180 days" },
            { value: "365", label: "365 days" },
          ]}
          value={period}
          onChange={(v) => setPeriod(v ?? "90")}
          w={160}
        />
      </Group>
      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        rowKey={(row) => row.item_name}
        emptyTitle="No FSN analysis data"
      />
    </Stack>
  );
}

// ── Dead Stock Report ────────────────────────────────────

function DeadStockView() {
  const [threshold, setThreshold] = useState("180");

  const params: Record<string, string> = { threshold_days: threshold };

  const { data, isLoading } = useQuery({
    queryKey: ["indent-analytics-dead-stock", params],
    queryFn: () => api.getDeadStockReport(params),
  });

  const columns = [
    { key: "item_name", label: "Item", render: (row: DeadStockRow) => row.item_name },
    { key: "current_stock", label: "Stock", render: (row: DeadStockRow) => row.current_stock },
    { key: "stock_value", label: "Value", render: (row: DeadStockRow) => `\u20B9${row.stock_value}` },
    {
      key: "last_movement_date",
      label: "Last Movement",
      render: (row: DeadStockRow) => row.last_movement_date ? new Date(row.last_movement_date).toLocaleDateString() : "Never",
    },
    { key: "days_idle", label: "Days Idle", render: (row: DeadStockRow) => row.days_idle ?? "-" },
  ];

  return (
    <Stack>
      <Group>
        <Select
          label="Idle threshold (days)"
          data={[
            { value: "90", label: "90 days" },
            { value: "180", label: "180 days" },
            { value: "365", label: "365 days" },
          ]}
          value={threshold}
          onChange={(v) => setThreshold(v ?? "180")}
          w={180}
        />
      </Group>
      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        rowKey={(row) => row.item_name}
        emptyTitle="No dead stock items"
      />
    </Stack>
  );
}

// ── Purchase vs Consumption ──────────────────────────────

function PurchaseConsumptionView() {
  const { data, isLoading } = useQuery({
    queryKey: ["indent-analytics-pvc"],
    queryFn: () => api.getPurchaseConsumptionTrend(),
  });

  const columns = [
    { key: "period", label: "Period", render: (row: PurchaseConsumptionTrendRow) => row.period },
    { key: "total_purchased", label: "Purchased", render: (row: PurchaseConsumptionTrendRow) => row.total_purchased },
    { key: "total_consumed", label: "Consumed", render: (row: PurchaseConsumptionTrendRow) => row.total_consumed },
    {
      key: "net_change",
      label: "Net Change",
      render: (row: PurchaseConsumptionTrendRow) => (
        <Text size="sm" c={row.net_change >= 0 ? "success" : "danger"} fw={600}>
          {row.net_change >= 0 ? "+" : ""}{row.net_change}
        </Text>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data ?? []}
      loading={isLoading}
      rowKey={(row) => row.period}
      emptyTitle="No trend data"
    />
  );
}

// ── Inventory Valuation ──────────────────────────────────

function ValuationView() {
  const { data, isLoading } = useQuery({
    queryKey: ["indent-analytics-valuation"],
    queryFn: () => api.getInventoryValuation(),
  });

  const grandTotal = (data ?? []).reduce((sum, r) => sum + Number(r.total_value), 0);

  const columns = [
    { key: "item_name", label: "Item", render: (row: InventoryValuationRow) => row.item_name },
    { key: "category", label: "Category", render: (row: InventoryValuationRow) => row.category ?? "-" },
    { key: "current_stock", label: "Stock", render: (row: InventoryValuationRow) => row.current_stock },
    { key: "avg_unit_cost", label: "Avg Unit Cost", render: (row: InventoryValuationRow) => `\u20B9${row.avg_unit_cost}` },
    { key: "total_value", label: "Total Value", render: (row: InventoryValuationRow) => `\u20B9${row.total_value}` },
  ];

  return (
    <Stack>
      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        rowKey={(row) => row.item_name}
        emptyTitle="No valuation data"
      />
      {(data ?? []).length > 0 && (
        <Group justify="flex-end">
          <Text fw={700} size="lg">
            Grand Total: {"\u20B9"}{grandTotal.toFixed(2)}
          </Text>
        </Group>
      )}
    </Stack>
  );
}

// ── Compliance Report ────────────────────────────────────

function ComplianceView() {
  const { data, isLoading } = useQuery({
    queryKey: ["indent-analytics-compliance"],
    queryFn: () => api.getComplianceReport(),
  });

  const columns = [
    { key: "check_name", label: "Check", render: (row: ComplianceCheckRow) => row.check_name },
    {
      key: "status",
      label: "Status",
      render: (row: ComplianceCheckRow) => (
        <Badge color={row.status === "pass" ? "success" : "danger"} variant="filled" size="sm">
          {row.status}
        </Badge>
      ),
    },
    { key: "detail", label: "Detail", render: (row: ComplianceCheckRow) => row.detail },
  ];

  return (
    <DataTable
      columns={columns}
      data={data ?? []}
      loading={isLoading}
      rowKey={(row) => row.check_name}
      emptyTitle="No compliance data"
    />
  );
}

// ══════════════════════════════════════════════════════════
//  Patient Consumables Panel
// ══════════════════════════════════════════════════════════

function PatientConsumablesPanel() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(P.INDENT.CONSUMABLES_MANAGE);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data, isLoading } = useQuery({
    queryKey: ["patient-consumables"],
    queryFn: () => api.listPatientConsumables(),
  });

  const columns = [
    { key: "catalog_item_id", label: "Catalog Item", render: (row: PatientConsumableIssue) => <Text size="sm" truncate>{row.catalog_item_id}</Text> },
    { key: "patient_id", label: "Patient", render: (row: PatientConsumableIssue) => <Text size="sm" truncate>{row.patient_id}</Text> },
    { key: "quantity", label: "Qty", render: (row: PatientConsumableIssue) => row.quantity },
    { key: "returned_qty", label: "Returned", render: (row: PatientConsumableIssue) => row.returned_qty },
    { key: "unit_price", label: "Unit Price", render: (row: PatientConsumableIssue) => `\u20B9${row.unit_price}` },
    {
      key: "status",
      label: "Status",
      render: (row: PatientConsumableIssue) => (
        <Badge
          color={row.status === "issued" ? "primary" : row.status === "returned" ? "orange" : "success"}
          variant="light"
          size="sm"
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: "is_chargeable",
      label: "Chargeable",
      render: (row: PatientConsumableIssue) =>
        row.is_chargeable ? (
          <Badge color="violet" size="sm">Yes</Badge>
        ) : (
          <Text size="sm" c="dimmed">No</Text>
        ),
    },
    {
      key: "created_at",
      label: "Date",
      render: (row: PatientConsumableIssue) => new Date(row.created_at).toLocaleDateString(),
    },
  ];

  return (
    <>
      {canManage && (
        <Group justify="flex-end" mb="md">
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Issue to Patient
          </Button>
        </Group>
      )}
      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyTitle="No patient consumable issues"
      />
      <Drawer opened={createOpened} onClose={closeCreate} title="Issue to Patient" position="right" size="md">
        <IssueToPatientForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["patient-consumables"] });
            closeCreate();
          }}
        />
      </Drawer>
    </>
  );
}

function IssueToPatientForm({ onSuccess }: { onSuccess: () => void }) {
  const [patientId, setPatientId] = useState("");
  const [catalogItemId, setCatalogItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isChargeable, setIsChargeable] = useState(true);
  const [notes, setNotes] = useState("");

  const { data: catalog } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => api.listStoreCatalog({ active_only: "true" }),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload: IssueToPatientRequest = {
        patient_id: patientId,
        catalog_item_id: catalogItemId,
        quantity,
        is_chargeable: isChargeable,
        notes: notes || undefined,
      };
      return api.issueToPatient(payload);
    },
    onSuccess: () => {
      notifications.show({ title: "Issued", message: "Consumable issued to patient", color: "success" });
      onSuccess();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  return (
    <Stack>
      <PatientSearchSelect value={patientId} onChange={setPatientId} required />
      <Select
        label="Catalog Item"
        placeholder="Select item"
        data={(catalog ?? []).map((c) => ({ value: c.id, label: `${c.code} - ${c.name} (Stock: ${c.current_stock})` }))}
        value={catalogItemId}
        onChange={(v) => setCatalogItemId(v ?? "")}
        searchable
        required
      />
      <NumberInput
        label="Quantity"
        value={quantity}
        onChange={(v) => setQuantity(Number(v))}
        min={1}
        required
      />
      <Switch
        label="Chargeable to patient"
        checked={isChargeable}
        onChange={(e) => setIsChargeable(e.currentTarget.checked)}
      />
      <Textarea
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
      />
      <Button
        loading={mutation.isPending}
        onClick={() => mutation.mutate()}
        disabled={!patientId || !catalogItemId}
      >
        Issue Consumable
      </Button>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Assets & Implants Panel
// ══════════════════════════════════════════════════════════

function AssetsImplantsPanel() {
  const [subView, setSubView] = useState("implants");

  return (
    <Stack>
      <SegmentedControl
        value={subView}
        onChange={setSubView}
        data={[
          { label: "Implant Registry", value: "implants" },
          { label: "Condemnations", value: "condemnations" },
        ]}
      />
      {subView === "implants" && <ImplantRegistryView />}
      {subView === "condemnations" && <CondemnationsView />}
    </Stack>
  );
}

// ── Implant Registry ─────────────────────────────────────

function ImplantRegistryView() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(P.INDENT.IMPLANTS_MANAGE);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data, isLoading } = useQuery({
    queryKey: ["implant-registry"],
    queryFn: () => api.listImplantRegistry(),
  });

  const columns = [
    { key: "catalog_item_id", label: "Catalog Item", render: (row: ImplantRegistryEntry) => <Text size="sm" truncate>{row.catalog_item_id}</Text> },
    { key: "patient_id", label: "Patient", render: (row: ImplantRegistryEntry) => <Text size="sm" truncate>{row.patient_id}</Text> },
    { key: "serial_number", label: "Serial #", render: (row: ImplantRegistryEntry) => row.serial_number ?? "-" },
    {
      key: "implant_date",
      label: "Implant Date",
      render: (row: ImplantRegistryEntry) => new Date(row.implant_date).toLocaleDateString(),
    },
    { key: "implant_site", label: "Site", render: (row: ImplantRegistryEntry) => row.implant_site ?? "-" },
    { key: "manufacturer", label: "Manufacturer", render: (row: ImplantRegistryEntry) => row.manufacturer ?? "-" },
    { key: "model_number", label: "Model", render: (row: ImplantRegistryEntry) => row.model_number ?? "-" },
    {
      key: "warranty_expiry",
      label: "Warranty Expiry",
      render: (row: ImplantRegistryEntry) => row.warranty_expiry ? new Date(row.warranty_expiry).toLocaleDateString() : "-",
    },
  ];

  return (
    <>
      {canManage && (
        <Group justify="flex-end" mb="md">
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Register Implant
          </Button>
        </Group>
      )}
      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyTitle="No implant registry entries"
      />
      <Drawer opened={createOpened} onClose={closeCreate} title="Register Implant" position="right" size="md">
        <CreateImplantForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["implant-registry"] });
            closeCreate();
          }}
        />
      </Drawer>
    </>
  );
}

function CreateImplantForm({ onSuccess }: { onSuccess: () => void }) {
  const [catalogItemId, setCatalogItemId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [implantDate, setImplantDate] = useState("");
  const [implantSite, setImplantSite] = useState("");
  const [surgeonId, setSurgeonId] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [modelNumber, setModelNumber] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [notes, setNotes] = useState("");

  const { data: catalog } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => api.listStoreCatalog({ active_only: "true" }),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload: CreateImplantRequest = {
        catalog_item_id: catalogItemId,
        patient_id: patientId,
        implant_date: implantDate,
        serial_number: serialNumber || undefined,
        implant_site: implantSite || undefined,
        surgeon_id: surgeonId || undefined,
        manufacturer: manufacturer || undefined,
        model_number: modelNumber || undefined,
        warranty_expiry: warrantyExpiry || undefined,
        notes: notes || undefined,
      };
      return api.createImplantEntry(payload);
    },
    onSuccess: () => {
      notifications.show({ title: "Registered", message: "Implant registered successfully", color: "success" });
      onSuccess();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  return (
    <Stack>
      <Select
        label="Catalog Item"
        placeholder="Select item"
        data={(catalog ?? []).map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
        value={catalogItemId}
        onChange={(v) => setCatalogItemId(v ?? "")}
        searchable
        required
      />
      <PatientSearchSelect value={patientId} onChange={setPatientId} required />
      <TextInput
        label="Serial Number"
        value={serialNumber}
        onChange={(e) => setSerialNumber(e.currentTarget.value)}
      />
      <TextInput
        label="Implant Date"
        placeholder="YYYY-MM-DD"
        value={implantDate}
        onChange={(e) => setImplantDate(e.currentTarget.value)}
        required
      />
      <TextInput
        label="Implant Site"
        value={implantSite}
        onChange={(e) => setImplantSite(e.currentTarget.value)}
      />
      <TextInput
        label="Surgeon ID"
        placeholder="Enter surgeon user ID"
        value={surgeonId}
        onChange={(e) => setSurgeonId(e.currentTarget.value)}
      />
      <TextInput
        label="Manufacturer"
        value={manufacturer}
        onChange={(e) => setManufacturer(e.currentTarget.value)}
      />
      <TextInput
        label="Model Number"
        value={modelNumber}
        onChange={(e) => setModelNumber(e.currentTarget.value)}
      />
      <TextInput
        label="Warranty Expiry"
        placeholder="YYYY-MM-DD"
        value={warrantyExpiry}
        onChange={(e) => setWarrantyExpiry(e.currentTarget.value)}
      />
      <Textarea
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
      />
      <Button
        loading={mutation.isPending}
        onClick={() => mutation.mutate()}
        disabled={!catalogItemId || !patientId || !implantDate}
      >
        Register Implant
      </Button>
    </Stack>
  );
}

// ── Condemnations ────────────────────────────────────────

function CondemnationsView() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(P.INDENT.CONDEMNATION_MANAGE);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [statusItem, setStatusItem] = useState<EquipmentCondemnation | null>(null);
  const [statusOpened, { open: openStatus, close: closeStatus }] = useDisclosure(false);

  const { data, isLoading } = useQuery({
    queryKey: ["condemnations"],
    queryFn: () => api.listCondemnations(),
  });

  const condemnationStatusColors: Record<string, string> = {
    initiated: "primary",
    committee_review: "orange",
    approved: "success",
    condemned: "dark",
    rejected: "danger",
  };

  const columns = [
    { key: "condemnation_number", label: "Number", render: (row: EquipmentCondemnation) => <Text fw={600} size="sm">{row.condemnation_number}</Text> },
    { key: "catalog_item_id", label: "Catalog Item", render: (row: EquipmentCondemnation) => <Text size="sm" truncate>{row.catalog_item_id}</Text> },
    {
      key: "status",
      label: "Status",
      render: (row: EquipmentCondemnation) => (
        <Badge color={condemnationStatusColors[row.status] ?? "slate"} variant="filled" size="sm">
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    { key: "reason", label: "Reason", render: (row: EquipmentCondemnation) => <Text size="sm" lineClamp={2}>{row.reason}</Text> },
    { key: "current_value", label: "Current Value", render: (row: EquipmentCondemnation) => `\u20B9${row.current_value}` },
    { key: "purchase_value", label: "Purchase Value", render: (row: EquipmentCondemnation) => `\u20B9${row.purchase_value}` },
    {
      key: "created_at",
      label: "Date",
      render: (row: EquipmentCondemnation) => new Date(row.created_at).toLocaleDateString(),
    },
    {
      key: "actions",
      label: "",
      render: (row: EquipmentCondemnation) =>
        canManage && !["condemned", "rejected"].includes(row.status) ? (
          <ActionIcon
            variant="subtle"
            onClick={() => {
              setStatusItem(row);
              openStatus();
            }}
            aria-label="View details"
          >
            <IconEye size={16} />
          </ActionIcon>
        ) : null,
    },
  ];

  return (
    <>
      {canManage && (
        <Group justify="flex-end" mb="md">
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Initiate Condemnation
          </Button>
        </Group>
      )}
      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyTitle="No condemnation records"
      />
      <Drawer opened={createOpened} onClose={closeCreate} title="Initiate Condemnation" position="right" size="md">
        <CreateCondemnationForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["condemnations"] });
            closeCreate();
          }}
        />
      </Drawer>
      <Drawer opened={statusOpened} onClose={closeStatus} title="Update Condemnation Status" position="right" size="md">
        {statusItem && (
          <UpdateCondemnationStatusForm
            item={statusItem}
            onSuccess={() => {
              void queryClient.invalidateQueries({ queryKey: ["condemnations"] });
              closeStatus();
            }}
          />
        )}
      </Drawer>
    </>
  );
}

function CreateCondemnationForm({ onSuccess }: { onSuccess: () => void }) {
  const [catalogItemId, setCatalogItemId] = useState("");
  const [reason, setReason] = useState("");
  const [currentValue, setCurrentValue] = useState(0);
  const [purchaseValue, setPurchaseValue] = useState(0);
  const [notes, setNotes] = useState("");

  const { data: catalog } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => api.listStoreCatalog({ active_only: "true" }),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload: CreateCondemnationRequest = {
        catalog_item_id: catalogItemId,
        reason,
        current_value: currentValue,
        purchase_value: purchaseValue,
        notes: notes || undefined,
      };
      return api.createCondemnation(payload);
    },
    onSuccess: () => {
      notifications.show({ title: "Created", message: "Condemnation initiated", color: "success" });
      onSuccess();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  return (
    <Stack>
      <Select
        label="Catalog Item"
        placeholder="Select item"
        data={(catalog ?? []).map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
        value={catalogItemId}
        onChange={(v) => setCatalogItemId(v ?? "")}
        searchable
        required
      />
      <Textarea
        label="Reason for Condemnation"
        value={reason}
        onChange={(e) => setReason(e.currentTarget.value)}
        required
        minRows={3}
      />
      <NumberInput
        label="Current Value"
        value={currentValue}
        onChange={(v) => setCurrentValue(Number(v))}
        decimalScale={2}
        min={0}
        prefix={"\u20B9"}
      />
      <NumberInput
        label="Purchase Value"
        value={purchaseValue}
        onChange={(v) => setPurchaseValue(Number(v))}
        decimalScale={2}
        min={0}
        prefix={"\u20B9"}
      />
      <Textarea
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
      />
      <Button
        loading={mutation.isPending}
        onClick={() => mutation.mutate()}
        disabled={!catalogItemId || !reason}
      >
        Initiate Condemnation
      </Button>
    </Stack>
  );
}

function UpdateCondemnationStatusForm({
  item,
  onSuccess,
}: {
  item: EquipmentCondemnation;
  onSuccess: () => void;
}) {
  const nextStatusMap: Record<string, string[]> = {
    initiated: ["committee_review", "rejected"],
    committee_review: ["approved", "rejected"],
    approved: ["condemned"],
  };

  const availableStatuses = nextStatusMap[item.status] ?? [];
  const [newStatus, setNewStatus] = useState<string>(availableStatuses[0] ?? "");
  const [committeeRemarks, setCommitteeRemarks] = useState("");
  const [disposalMethod, setDisposalMethod] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const payload: UpdateCondemnationStatusRequest = {
        status: newStatus as EquipmentCondemnation["status"],
        committee_remarks: committeeRemarks || undefined,
        disposal_method: disposalMethod || undefined,
      };
      return api.updateCondemnationStatus(item.id, payload);
    },
    onSuccess: () => {
      notifications.show({ title: "Updated", message: "Condemnation status updated", color: "success" });
      onSuccess();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Current status: <Badge color="primary" size="sm">{item.status.replace(/_/g, " ")}</Badge>
      </Text>
      <Text size="sm">Condemnation #{item.condemnation_number}</Text>
      <Text size="sm">Reason: {item.reason}</Text>

      <Select
        label="New Status"
        data={availableStatuses.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))}
        value={newStatus}
        onChange={(v) => setNewStatus(v ?? "")}
        required
      />
      <Textarea
        label="Committee Remarks"
        value={committeeRemarks}
        onChange={(e) => setCommitteeRemarks(e.currentTarget.value)}
      />
      {newStatus === "condemned" && (
        <Select
          label="Disposal Method"
          data={[
            { value: "auction", label: "Auction" },
            { value: "scrap", label: "Scrap" },
            { value: "donation", label: "Donation" },
            { value: "trade_in", label: "Trade-In" },
            { value: "destruction", label: "Destruction" },
          ]}
          value={disposalMethod}
          onChange={(v) => setDisposalMethod(v ?? "")}
        />
      )}
      <Button
        loading={mutation.isPending}
        onClick={() => mutation.mutate()}
        disabled={!newStatus}
      >
        Update Status
      </Button>
    </Stack>
  );
}
