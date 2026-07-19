import { Group, Stack, Stepper, Tabs, Text, TextInput, Timeline } from "@mantine/core";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import type {
  IndentRequisitionDetailResponse,
  PurchaseOrder,
  ResolvedSidecar,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconChartBar,
  IconCheck,
  IconClipboardList,
  IconEye,
  IconHeart,
  IconPackage,
  IconPill,
  IconPlus,
  IconRefresh,
  IconTruckDelivery,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ClinicalEventProvider, PageHeader } from "@/components";
import { Badge, Button, IconButton, Table, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { indentService } from "@/services/indent.service";
import { AnalyticsPanel } from "./indent/analytics-panel";
import { AssetsImplantsPanel } from "./indent/assets-implants-panel";
import { CatalogPanel } from "./indent/catalog-panel";
import { CreateIndentPanel } from "./indent/create-indent-panel";
import { IndentListPanel } from "./indent/indent-list-panel";
import { PatientConsumablesPanel } from "./indent/patient-consumables-panel";
import { colorToBadgeTone, indentTypeLabels, statusColors, statusToStep } from "./indent/shared";
import { StockPanel } from "./indent/stock-panel";

// ── Status colors ─────────────────────────────────────────

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

// ── Status to stepper step mapping ────────────────────────

const indentWorkflowEvents = [
  "indent.requisition.submitted",
  "indent.requisition.approved",
  "indent.requisition.issued",
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
  const headerQueryClient = useQueryClient();
  const reorderMutation = useMutation({
    mutationFn: () => indentService.createReorderIndent(),
    onSuccess: () => {
      void headerQueryClient.invalidateQueries({ queryKey: ["indent-requisitions"] });
      toast.success("Reorder indent generated from below-reorder stock", { title: "Reorder" });
      setActiveTab("my-indents");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Nothing to reorder" }),
  });

  return (
    <div>
      <PageHeader
        title="Indent & Store"
        subtitle="Requisitions, approvals, and store management"
        icon={<IconClipboardList size={20} stroke={1.5} />}
        color="info"
        actions={
          canCreate ? (
            <Group gap="xs">
              {canStock && (
                <Button
                  tone="secondary"
                  leftSection={<IconRefresh size={16} />}
                  onClick={() => reorderMutation.mutate()}
                  loading={reorderMutation.isPending}
                >
                  Generate reorder indent
                </Button>
              )}
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                onClick={() => setActiveTab("create")}
              >
                New Indent
              </Button>
            </Group>
          ) : undefined
        }
      />

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="my-indents" leftSection={<IconClipboardList size={16} />}>
            My Indents
          </Tabs.Tab>
          {canApprove && (
            <Tabs.Tab value="pending-approval" leftSection={<IconCheck size={16} />}>
              Pending Approval
            </Tabs.Tab>
          )}
          <Tabs.Tab value="all-indents" leftSection={<IconClipboardList size={16} />}>
            All Indents
          </Tabs.Tab>
          <Tabs.Tab value="flow-tracker" leftSection={<IconTruckDelivery size={16} />}>
            Flow Tracker
          </Tabs.Tab>
          {canStock && (
            <>
              <Tabs.Tab value="catalog" leftSection={<IconPackage size={16} />}>
                Store Catalog
              </Tabs.Tab>
              <Tabs.Tab value="stock" leftSection={<IconTruckDelivery size={16} />}>
                Stock
              </Tabs.Tab>
            </>
          )}
          {canAnalytics && (
            <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
              Analytics
            </Tabs.Tab>
          )}
          {canConsumables && (
            <Tabs.Tab value="patient-consumables" leftSection={<IconPill size={16} />}>
              Patient Consumables
            </Tabs.Tab>
          )}
          {canImplants && (
            <Tabs.Tab value="assets-implants" leftSection={<IconHeart size={16} />}>
              Assets &amp; Implants
            </Tabs.Tab>
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

// ── Approve Button with quantity editing ──────────────────

// ── Issue Button ──────────────────────────────────────────

// ══════════════════════════════════════════════════════════
//  Flow Tracker Panel
// ══════════════════════════════════════════════════════════

function FlowTrackerPanel() {
  const [indentNumber, setIndentNumber] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["indent-requisition", selectedId],
    queryFn: () => (selectedId ? indentService.getIndentRequisition(selectedId) : undefined),
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

      {selectedId && detailQuery.data && <IndentTimeline data={detailQuery.data} />}
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
    queryFn: () => indentService.listIndentRequisitions({ page: "1", per_page: "10" }),
  });

  const filtered = (data?.requisitions ?? []).filter((req) =>
    req.indent_number.toLowerCase().includes(searchTerm.trim().toLowerCase()),
  );

  if (!filtered.length) {
    return searchTerm.trim() ? (
      <Text size="sm" c="dimmed">
        No indents match that number yet.
      </Text>
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
            <Table.Td>
              <Text fw={600} size="sm">
                {req.indent_number}
              </Text>
            </Table.Td>
            <Table.Td>
              <Badge tone="neutral" size="sm">
                {indentTypeLabels[req.indent_type]}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Badge tone={colorToBadgeTone(statusColors[req.status])} variant="filled" size="sm">
                {req.status.replace(/_/g, " ")}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{new Date(req.created_at).toLocaleDateString()}</Text>
            </Table.Td>
            <Table.Td>
              <IconButton size="sm" aria-label="View details">
                <IconEye size={14} />
              </IconButton>
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
    queryFn: () =>
      indentService.listPurchaseOrders({
        indent_requisition_id: requisition.id,
        page: "1",
        per_page: "10",
      }),
    staleTime: 30_000,
  });
  const sidecarsQuery = { data: [] as ResolvedSidecar[] };

  const timelineItems = [
    {
      title: "Created",
      description: `Indent ${requisition.indent_number} created`,
      date: requisition.created_at,
      active: true,
    },
    ...(requisition.status !== "draft"
      ? [
          {
            title: "Submitted",
            description: "Submitted for approval",
            date: requisition.updated_at,
            active: true,
          },
        ]
      : []),
    ...(requisition.approved_at
      ? [
          {
            title: requisition.status === "rejected" ? "Rejected" : "Approved",
            description:
              requisition.status === "rejected"
                ? "Requisition rejected"
                : `Approved${requisition.status === "partially_approved" ? " (partial)" : ""}`,
            date: requisition.approved_at,
            active: true,
          },
        ]
      : []),
    ...(["issued", "partially_issued", "closed"].includes(requisition.status)
      ? [
          {
            title: "Issued",
            description: `Items ${requisition.status === "partially_issued" ? "partially " : ""}issued`,
            date: requisition.updated_at,
            active: true,
          },
        ]
      : []),
    ...(requisition.status === "closed"
      ? [
          {
            title: "Closed",
            description: "Requisition closed",
            date: requisition.updated_at,
            active: true,
          },
        ]
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
        {timelineItems.map((item) => (
          <Timeline.Item key={`${item.title}-${item.date}`} title={item.title}>
            <Text c="dimmed" size="sm">
              {item.description}
            </Text>
            <Text size="xs" mt={4}>
              {new Date(item.date).toLocaleString()}
            </Text>
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
        <Badge tone="accent">{relevantSidecars.length} configured</Badge>
      </Group>

      {relevantSidecars.length === 0 ? (
        <Text size="sm" c="dimmed">
          No module sidecars are configured for indent events yet. Add a pipeline or inline action
          from the screen builder to automate this flow.
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
                  <Badge tone="neutral" size="sm">
                    {sidecar.trigger_event}
                  </Badge>
                </Table.Td>
                <Table.Td>{sidecar.name}</Table.Td>
                <Table.Td>
                  {sidecar.pipeline_id ? (
                    <Badge tone="accent" variant="outline">
                      Pipeline
                    </Badge>
                  ) : sidecar.inline_action ? (
                    <Badge tone="success" variant="outline">
                      Inline Action
                    </Badge>
                  ) : (
                    <Badge tone="neutral" variant="outline">
                      Passive
                    </Badge>
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
        <Badge tone="info">{purchaseOrders.length} linked</Badge>
      </Group>

      {purchaseOrders.length === 0 ? (
        <Text size="sm" c="dimmed">
          No purchase orders are linked to this indent yet. Create a PO from Procurement and select
          this indent to continue the chain.
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
                  <Text fw={600} size="sm">
                    {po.po_number}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge tone={colorToBadgeTone(linkedPoStatusColors[po.status])} size="sm">
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
