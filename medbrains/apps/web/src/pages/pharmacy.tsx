import { useMemo, useState } from "react";
import { DrugSearchSelect } from "../components/DrugSearchSelect";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
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
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconCashRegister,
  IconCheck,
  IconClipboardList,
  IconClock,
  IconEye,
  IconLock,
  IconPackage,
  IconPill,
  IconPlus,
  IconPrescription,
  IconShieldCheck,
  IconShoppingCart,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  AwareCategory,
  ComplianceSettings,
  CreateNdpsEntryRequest,
  CreateOtcSaleRequest,
  CreatePharmacyCatalogRequest,
  CreatePharmacyOrderRequest,
  CreateStockTransactionRequest,
  PharmacyDeadStockRow,
  DrugSchedule,
  DrugUtilizationRow,
  FormularyStatus,
  NdpsRegisterEntry,
  NearExpiryRow,
  PharmacyAbcVedRow,
  PharmacyBatch,
  PharmacyCatalog,
  PharmacyConsumptionRow,
  PharmacyOrder,
  PharmacyOrderDetailResponse,
  PharmacyOrderItemInput,
  PharmacyPaymentMode,
  PharmacyPosSale,
  PharmacyStoreAssignment,
  PharmacyTransferRequest,
  RxQueueRow,
  StockTransactionType,
  TenantSettingsRow,
  DrugInteractionCheckRequest,
  DrugInteractionResult,
  PrescriptionAuditEntry,
  FormularyCheckResult,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { ClinicalEventProvider, useClinicalEmit, DataTable, PageHeader, PrescriptionViews, StatusDot } from "../components";
import { PharmacyDispensingView } from "../components/Pharmacy/PharmacyDispensingView";
import { PharmacyLabel } from "../components/Pharmacy/PharmacyLabel";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import { useRequirePermission } from "../hooks/useRequirePermission";
import type { PrescriptionWithItems } from "@medbrains/types";

const statusColors: Record<string, string> = {
  ordered: "primary",
  dispensed: "success",
  cancelled: "danger",
  returned: "orange",
};

const dispensingTypeLabels: Record<string, string> = {
  prescription: "Rx",
  otc: "OTC",
  discharge: "Discharge",
  package: "Package",
  emergency: "Emergency",
};

// Dropdown options for categorical fields - aligned with ATC classification
const DRUG_CATEGORIES = [
  { value: "alimentary", label: "Alimentary Tract & Metabolism" },
  { value: "blood", label: "Blood & Blood-Forming Organs" },
  { value: "cardiovascular", label: "Cardiovascular System" },
  { value: "dermatologicals", label: "Dermatologicals" },
  { value: "genitourinary", label: "Genitourinary & Sex Hormones" },
  { value: "hormones", label: "Systemic Hormones" },
  { value: "antiinfectives", label: "Antiinfectives for Systemic Use" },
  { value: "antineoplastic", label: "Antineoplastic & Immunomodulating" },
  { value: "musculoskeletal", label: "Musculoskeletal System" },
  { value: "nervous", label: "Nervous System" },
  { value: "antiparasitic", label: "Antiparasitic Products" },
  { value: "respiratory", label: "Respiratory System" },
  { value: "sensory", label: "Sensory Organs" },
  { value: "various", label: "Various" },
  { value: "consumables", label: "Medical Consumables" },
  { value: "other", label: "Other" },
];

export function PharmacyPage() {
  useRequirePermission(P.PHARMACY.PRESCRIPTIONS_LIST);

  return (
    <ClinicalEventProvider moduleCode="pharmacy" contextCode="pharmacy-orders">
      <PharmacyPageInner />
    </ClinicalEventProvider>
  );
}

function PharmacyPageInner() {
  const canDispense = useHasPermission(P.PHARMACY.DISPENSING_CREATE);
  const canManageStock = useHasPermission(P.PHARMACY.STOCK_MANAGE);
  const canViewNdps = useHasPermission(P.PHARMACY.NDPS_LIST);
  const canViewStores = useHasPermission(P.PHARMACY.STORES_LIST);
  const canViewAnalytics = useHasPermission(P.PHARMACY.ANALYTICS_VIEW);
  const canViewReturns = useHasPermission(P.PHARMACY.RETURNS_LIST);
  const canViewRxQueue = useHasPermission(P.PHARMACY.RX_QUEUE_LIST);
  const canReviewRx = useHasPermission(P.PHARMACY.RX_QUEUE_REVIEW);
  const canCreatePos = useHasPermission(P.PHARMACY.POS_CREATE);
  const canViewPos = useHasPermission(P.PHARMACY.POS_VIEW);

  const { data: complianceRaw = [] } = useQuery<TenantSettingsRow[]>({
    queryKey: ["tenant-settings", "compliance"],
    queryFn: () => api.getTenantSettings("compliance"),
    staleTime: 300_000,
  });

  const compliance = useMemo(() => {
    const defaults: ComplianceSettings = {
      enforce_drug_scheduling: false,
      enforce_ndps_tracking: false,
      enforce_formulary: false,
      enforce_drug_interactions: false,
      enforce_antibiotic_stewardship: false,
      enforce_lasa_warnings: false,
      enforce_max_dose_check: false,
      enforce_batch_tracking: false,
      show_schedule_badges: true,
      show_controlled_warnings: true,
      show_formulary_status: true,
      show_aware_category: true,
    };
    for (const row of complianceRaw) {
      const key = row.key as keyof ComplianceSettings;
      if (key in defaults) {
        defaults[key] = row.value === true || row.value === "true";
      }
    }
    return defaults;
  }, [complianceRaw]);

  const [interactionModalOpen, { open: openInteractionModal, close: closeInteractionModal }] = useDisclosure(false);
  const [formularyModalOpen, { open: openFormularyModal, close: closeFormularyModal }] = useDisclosure(false);

  return (
    <div>
      <PageHeader
        title="Pharmacy"
        subtitle="Drug inventory & dispensing"
        icon={<IconPill size={20} stroke={1.5} />}
        color="success"
        actions={
          <Group gap="xs">
            <Button size="xs" variant="light" color="orange" leftSection={<IconAlertTriangle size={14} />} onClick={openInteractionModal}>
              Drug Interactions
            </Button>
            <Button size="xs" variant="light" color="info" leftSection={<IconShieldCheck size={14} />} onClick={openFormularyModal}>
              Formulary Check
            </Button>
          </Group>
        }
      />

      <DrugInteractionModal opened={interactionModalOpen} onClose={closeInteractionModal} />
      <FormularyCheckModal opened={formularyModalOpen} onClose={closeFormularyModal} />

      <Tabs defaultValue={canViewRxQueue ? "rx-queue" : "orders"}>
        <Tabs.List mb="md">
          {canViewRxQueue && <Tabs.Tab value="rx-queue" leftSection={<IconPrescription size={14} />}>Rx Queue</Tabs.Tab>}
          {(canCreatePos || canViewPos) && <Tabs.Tab value="pos" leftSection={<IconCashRegister size={14} />}>POS Counter</Tabs.Tab>}
          <Tabs.Tab value="orders">Orders</Tabs.Tab>
          <Tabs.Tab value="catalog">Drug Catalog</Tabs.Tab>
          <Tabs.Tab value="stock">Stock</Tabs.Tab>
          {canViewNdps && <Tabs.Tab value="ndps">NDPS Register</Tabs.Tab>}
          {canManageStock && <Tabs.Tab value="batches">Batch & Expiry</Tabs.Tab>}
          {canViewStores && <Tabs.Tab value="stores">Stores & Transfers</Tabs.Tab>}
          {canViewAnalytics && <Tabs.Tab value="analytics">Analytics & Reports</Tabs.Tab>}
        </Tabs.List>

        {canViewRxQueue && (
          <Tabs.Panel value="rx-queue">
            <RxQueueTab canReview={canReviewRx} />
          </Tabs.Panel>
        )}
        {(canCreatePos || canViewPos) && (
          <Tabs.Panel value="pos">
            <PosCounterTab canCreate={canCreatePos} />
          </Tabs.Panel>
        )}
        <Tabs.Panel value="orders">
          <PharmacyOrdersTab canDispense={canDispense} canViewReturns={canViewReturns} />
        </Tabs.Panel>
        <Tabs.Panel value="catalog">
          <PharmacyCatalogTab canManage={canManageStock} compliance={compliance} />
        </Tabs.Panel>
        <Tabs.Panel value="stock">
          <StockTab canManage={canManageStock} />
        </Tabs.Panel>
        {canViewNdps && (
          <Tabs.Panel value="ndps">
            <NdpsRegisterTab />
          </Tabs.Panel>
        )}
        {canManageStock && (
          <Tabs.Panel value="batches">
            <BatchExpiryTab />
          </Tabs.Panel>
        )}
        {canViewStores && (
          <Tabs.Panel value="stores">
            <StoresTransfersTab />
          </Tabs.Panel>
        )}
        {canViewAnalytics && (
          <Tabs.Panel value="analytics">
            <AnalyticsTab />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Orders Tab (enhanced)
// ══════════════════════════════════════════════════════════

function PharmacyOrdersTab({ canDispense, canViewReturns }: { canDispense: boolean; canViewReturns: boolean }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [otcOpened, { open: openOtc, close: closeOtc }] = useDisclosure(false);

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (filterStatus) params.status = filterStatus;

  const { data, isLoading } = useQuery({
    queryKey: ["pharmacy-orders", params],
    queryFn: () => api.listPharmacyOrders(params),
  });

  const emit = useClinicalEmit();

  const dispenseMutation = useMutation({
    mutationFn: (id: string) => api.dispenseOrder(id),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      notifications.show({ title: "Dispensed", message: "Order dispensed successfully", color: "success" });
      emit("order.dispensed", { order_id: id });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelPharmacyOrder(id),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      emit("order.cancelled", { order_id: id });
    },
  });

  const columns = [
    {
      key: "patient_id",
      label: "Patient",
      render: (row: PharmacyOrder) => <Text size="sm">{row.patient_id.slice(0, 8)}...</Text>,
    },
    {
      key: "dispensing_type",
      label: "Type",
      render: (row: PharmacyOrder) => (
        <Badge size="xs" variant="light" color={row.dispensing_type === "otc" ? "teal" : row.dispensing_type === "emergency" ? "danger" : "primary"}>
          {dispensingTypeLabels[row.dispensing_type] ?? row.dispensing_type}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: PharmacyOrder) => (
        <StatusDot color={statusColors[row.status] ?? "gray"} label={row.status} />
      ),
    },
    {
      key: "created_at",
      label: "Date",
      render: (row: PharmacyOrder) => <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: PharmacyOrder) => (
        <Group gap="xs">
          <Tooltip label="View">
            <ActionIcon variant="subtle" onClick={() => { setSelectedOrderId(row.id); openDetail(); }}>
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          {canDispense && row.status === "ordered" && (
            <>
              <Tooltip label="Dispense">
                <ActionIcon variant="subtle" color="success" onClick={() => dispenseMutation.mutate(row.id)}>
                  <IconCheck size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Cancel">
                <ActionIcon variant="subtle" color="danger" onClick={() => cancelMutation.mutate(row.id)}>
                  <IconX size={16} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group>
        <Select
          placeholder="Status"
          data={[
            { value: "ordered", label: "Ordered" },
            { value: "dispensed", label: "Dispensed" },
            { value: "cancelled", label: "Cancelled" },
            { value: "returned", label: "Returned" },
          ]}
          value={filterStatus}
          onChange={setFilterStatus}
          clearable
          w={160}
        />
        {canDispense && (
          <>
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreate}>
              New Order
            </Button>
            <Button size="xs" variant="light" color="teal" leftSection={<IconShoppingCart size={14} />} onClick={openOtc}>
              OTC Sale
            </Button>
          </>
        )}
      </Group>
      <DataTable
        columns={columns}
        data={data?.orders ?? []}
        loading={isLoading}
        page={page}
        totalPages={data ? Math.ceil(data.total / data.per_page) : 1}
        onPageChange={setPage}
        rowKey={(row) => row.id}
      />

      <CreatePharmacyOrderDrawer opened={createOpened} onClose={closeCreate} />
      <OtcSaleDrawer opened={otcOpened} onClose={closeOtc} />

      <Drawer opened={detailOpened} onClose={closeDetail} title="Order Detail" position="right" size="md">
        {selectedOrderId && <PharmacyOrderDetail orderId={selectedOrderId} canViewReturns={canViewReturns} />}
      </Drawer>
    </Stack>
  );
}

function OtcSaleDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<(PharmacyOrderItemInput & { catalog_item_id?: string })[]>([
    { drug_name: "", quantity: 1, unit_price: 0 },
  ]);

  const createMutation = useMutation({
    mutationFn: (data: CreateOtcSaleRequest) => api.createOtcSale(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      notifications.show({ title: "OTC Sale", message: "Walk-in sale recorded", color: "teal" });
      onClose();
      setNotes("");
      setItems([{ drug_name: "", quantity: 1, unit_price: 0 }]);
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to record OTC sale", color: "danger" });
    },
  });

  return (
    <Drawer opened={opened} onClose={onClose} title="OTC Walk-in Sale" position="right" size="lg">
      <Stack>
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Text fw={600} size="sm">Items</Text>
        {items.map((item, idx) => (
          <Card key={idx} withBorder padding="xs">
            <Stack gap="xs">
              <DrugSearchSelect
                value={item.catalog_item_id ?? ""}
                onChange={(drugId, drug) => {
                  const updated = [...items];
                  updated[idx] = {
                    ...item,
                    catalog_item_id: drugId,
                    drug_name: drug?.name ?? "",
                    unit_price: drug ? Number(drug.base_price) : 0,
                  };
                  setItems(updated);
                }}
                label={`Drug #${idx + 1}`}
                required
              />
              <Group grow>
            <NumberInput label="Qty" min={1} value={item.quantity} onChange={(v) => {
              const updated = [...items];
              updated[idx] = { ...item, quantity: Number(v) };
              setItems(updated);
            }} />
            <NumberInput label="Price" min={0} decimalScale={2} prefix="₹" value={item.unit_price} onChange={(v) => {
              const updated = [...items];
              updated[idx] = { ...item, unit_price: Number(v) };
              setItems(updated);
            }} />
              </Group>
            </Stack>
          </Card>
        ))}
        <Group>
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setItems([...items, { drug_name: "", quantity: 1, unit_price: 0 }])}>
            Add Drug
          </Button>
          <Button
            size="xs"
            color="teal"
            onClick={() => createMutation.mutate({ items, notes: notes || undefined })}
            loading={createMutation.isPending}
          >
            Record OTC Sale
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}

function CreatePharmacyOrderDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<(PharmacyOrderItemInput & { catalog_item_id?: string })[]>([
    { drug_name: "", quantity: 1, unit_price: 0 },
  ]);

  const createMutation = useMutation({
    mutationFn: (data: CreatePharmacyOrderRequest) => api.createPharmacyOrder(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      notifications.show({ title: "Order created", message: "Pharmacy order placed", color: "success" });
      onClose();
      setPatientId("");
      setNotes("");
      setItems([{ drug_name: "", quantity: 1, unit_price: 0 }]);
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create order", color: "danger" });
    },
  });

  const orderTotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  return (
    <Drawer opened={opened} onClose={onClose} title="New Pharmacy Order" position="right" size="lg">
      <Stack>
        <PatientSearchSelect value={patientId} onChange={setPatientId} required />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Text fw={600} size="sm">Medications</Text>
        {items.map((item, idx) => (
          <Card key={idx} withBorder padding="xs">
            <Stack gap="xs">
              <DrugSearchSelect
                value={item.catalog_item_id ?? ""}
                onChange={(drugId, drug) => {
                  const updated = [...items];
                  updated[idx] = {
                    ...item,
                    catalog_item_id: drugId,
                    drug_name: drug?.name ?? "",
                    unit_price: drug ? Number(drug.base_price) : 0,
                  };
                  setItems(updated);
                }}
                label={`Drug #${idx + 1}`}
                required
              />
              <Group grow>
                <NumberInput label="Qty" min={1} value={item.quantity} onChange={(v) => {
                  const updated = [...items];
                  updated[idx] = { ...item, quantity: Number(v) };
                  setItems(updated);
                }} />
                <NumberInput label="Unit Price" min={0} decimalScale={2} prefix="₹" value={item.unit_price} onChange={(v) => {
                  const updated = [...items];
                  updated[idx] = { ...item, unit_price: Number(v) };
                  setItems(updated);
                }} />
                <Stack gap={0} justify="flex-end" pb={2}>
                  <Text size="xs" c="dimmed">Subtotal</Text>
                  <Text size="sm" fw={600}>₹{(item.quantity * item.unit_price).toFixed(2)}</Text>
                </Stack>
              </Group>
              {items.length > 1 && (
                <Button size="xs" variant="subtle" color="danger" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                  Remove
                </Button>
              )}
            </Stack>
          </Card>
        ))}
        <Group justify="space-between">
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setItems([...items, { drug_name: "", quantity: 1, unit_price: 0 }])}>
            Add Drug
          </Button>
          <Text fw={700}>Total: ₹{orderTotal.toFixed(2)}</Text>
        </Group>
        <Button
          fullWidth
          onClick={() => createMutation.mutate({ patient_id: patientId, notes: notes || undefined, items })}
          loading={createMutation.isPending}
          disabled={!patientId || items.every((i) => !i.drug_name)}
        >
          Place Order
        </Button>
      </Stack>
    </Drawer>
  );
}

function PharmacyOrderDetail({ orderId, canViewReturns }: { orderId: string; canViewReturns: boolean }) {
  const [showAudit, setShowAudit] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "schedule">("schedule");
  const { data } = useQuery({
    queryKey: ["pharmacy-order-detail", orderId],
    queryFn: () => api.getPharmacyOrder(orderId),
  });

  // Fetch linked prescription for structured timing data
  const detail = data as PharmacyOrderDetailResponse | undefined;
  const prescriptionId = detail?.order.prescription_id;
  const { data: rxData } = useQuery<PrescriptionWithItems>({
    queryKey: ["prescription-detail", prescriptionId],
    queryFn: () => api.getPrescription(prescriptionId as string),
    enabled: !!prescriptionId,
  });

  if (!detail) return <Text c="dimmed">Loading...</Text>;

  const hasRxItems = rxData && rxData.items.length > 0;

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={700}>Order: {detail.order.id.slice(0, 8)}...</Text>
        <Group gap="xs">
          <Badge color={statusColors[detail.order.status] ?? "gray"} variant="light" size="lg">
            {detail.order.status}
          </Badge>
          <Badge variant="outline" size="sm">
            {dispensingTypeLabels[detail.order.dispensing_type] ?? detail.order.dispensing_type}
          </Badge>
        </Group>
      </Group>
      {detail.order.dispensed_at && (
        <Text size="xs" c="dimmed">Dispensed: {new Date(detail.order.dispensed_at).toLocaleString()}</Text>
      )}

      {/* View mode toggle — show schedule view when prescription data is available */}
      {hasRxItems && (
        <SegmentedControl
          size="xs"
          value={viewMode}
          onChange={(v) => setViewMode(v as "table" | "schedule")}
          data={[
            { value: "schedule", label: "Medication Schedule" },
            { value: "table", label: "Order Table" },
          ]}
        />
      )}

      {/* Schedule view — time-grouped with timing/food instructions */}
      {viewMode === "schedule" && hasRxItems ? (
        <PharmacyDispensingView items={rxData.items} />
      ) : (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Drug</Table.Th>
              <Table.Th>Qty</Table.Th>
              <Table.Th>Unit Price</Table.Th>
              <Table.Th>Total</Table.Th>
              {canViewReturns && <Table.Th>Returned</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {detail.items.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.drug_name}</Table.Td>
                <Table.Td>{item.quantity}</Table.Td>
                <Table.Td>{"\u20B9"}{item.unit_price}</Table.Td>
                <Table.Td>{"\u20B9"}{item.total_price}</Table.Td>
                {canViewReturns && <Table.Td>{item.quantity_returned > 0 ? item.quantity_returned : "—"}</Table.Td>}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Group gap="xs">
        <Button variant="light" size="xs" leftSection={<IconClipboardList size={14} />} onClick={() => setShowAudit(!showAudit)}>
          {showAudit ? "Hide" : "Show"} Prescription Audit Trail
        </Button>
        {hasRxItems && (
          <Button variant="light" size="xs" color="teal" onClick={() => setShowLabels(!showLabels)}>
            {showLabels ? "Hide" : "Print"} Medication Labels
          </Button>
        )}
      </Group>
      {showAudit && <PrescriptionAuditTrail prescriptionId={orderId} />}
      {showLabels && hasRxItems && (
        <PharmacyLabel items={rxData.items} patientName={detail.order.patient_id.slice(0, 8)} uhid={detail.order.patient_id.slice(0, 8)} date={new Date().toLocaleDateString()} />
      )}

      {hasRxItems && (
        <PrescriptionViews
          prescriptions={[rxData]}
          patientName={detail.order.patient_id.slice(0, 8)}
          uhid={detail.order.patient_id.slice(0, 8)}
          allergies={[]}
        />
      )}
    </Stack>
  );
}

// ── Prescription Audit Trail ──────────────────────────────

function PrescriptionAuditTrail({ prescriptionId }: { prescriptionId: string }) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["prescription-audit", prescriptionId],
    queryFn: () => api.prescriptionAudit(prescriptionId),
  });

  if (isLoading) return <Text size="sm" c="dimmed">Loading audit trail...</Text>;
  if (entries.length === 0) return <Text size="sm" c="dimmed">No audit entries found.</Text>;

  return (
    <Table striped>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Action</Table.Th>
          <Table.Th>Field</Table.Th>
          <Table.Th>Old Value</Table.Th>
          <Table.Th>New Value</Table.Th>
          <Table.Th>Changed By</Table.Th>
          <Table.Th>Time</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {(entries as PrescriptionAuditEntry[]).map((entry, idx) => (
          <Table.Tr key={idx}>
            <Table.Td><Badge size="xs" variant="light">{entry.action}</Badge></Table.Td>
            <Table.Td><Text size="sm">{entry.field_name}</Text></Table.Td>
            <Table.Td><Text size="sm" c="dimmed">{entry.old_value ?? "—"}</Text></Table.Td>
            <Table.Td><Text size="sm">{entry.new_value ?? "—"}</Text></Table.Td>
            <Table.Td><Text size="sm">{entry.changed_by.slice(0, 8)}...</Text></Table.Td>
            <Table.Td><Text size="xs" c="dimmed">{new Date(entry.changed_at).toLocaleString()}</Text></Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

// ── Drug Interaction Check Modal ──────────────────────────

function DrugInteractionModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [patientId, setPatientId] = useState("");
  const [drugId, setDrugId] = useState("");

  const checkMutation = useMutation({
    mutationFn: (data: DrugInteractionCheckRequest) => api.checkDrugInteractions(data),
  });

  const severityColors: Record<string, string> = {
    severe: "danger",
    moderate: "orange",
    mild: "warning",
    minor: "gray",
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Drug Interaction Check" size="lg">
      <Stack>
        <PatientSearchSelect value={patientId} onChange={setPatientId} required />
        <DrugSearchSelect
          value={drugId}
          onChange={(id) => setDrugId(id)}
          label="Drug to Check"
          required
        />
        <Button
          onClick={() => checkMutation.mutate({ patient_id: patientId, drug_id: drugId })}
          loading={checkMutation.isPending}
          disabled={!patientId.trim() || !drugId.trim()}
        >
          Check Interactions
        </Button>

        {checkMutation.data && (checkMutation.data as DrugInteractionResult[]).length > 0 && (
          <Stack gap="xs">
            <Text fw={600} size="sm">Interactions Found:</Text>
            {(checkMutation.data as DrugInteractionResult[]).map((r, idx) => (
              <Alert key={idx} color={severityColors[r.severity] ?? "gray"} variant="light" title={r.interacting_drug}>
                <Group gap="xs" mb={4}>
                  <Badge color={severityColors[r.severity] ?? "gray"} size="sm">{r.severity}</Badge>
                  <Badge variant="outline" size="sm">{r.interaction_type}</Badge>
                </Group>
                <Text size="sm">{r.description}</Text>
              </Alert>
            ))}
          </Stack>
        )}

        {checkMutation.data && (checkMutation.data as DrugInteractionResult[]).length === 0 && (
          <Alert color="success" variant="light" title="No Interactions">
            <Text size="sm">No drug interactions found for this combination.</Text>
          </Alert>
        )}
      </Stack>
    </Modal>
  );
}

// ── Formulary Check Modal ─────────────────────────────────

function FormularyCheckModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [drugId, setDrugId] = useState("");

  const checkMutation = useMutation({
    mutationFn: (data: { drug_id: string }) => api.formularyCheck(data),
  });

  const result = checkMutation.data as FormularyCheckResult | undefined;

  return (
    <Modal opened={opened} onClose={onClose} title="Formulary Check" size="md">
      <Stack>
        <DrugSearchSelect
          value={drugId}
          onChange={(id) => setDrugId(id)}
          label="Drug"
          required
        />
        <Button
          onClick={() => checkMutation.mutate({ drug_id: drugId })}
          loading={checkMutation.isPending}
          disabled={!drugId.trim()}
        >
          Check Formulary Status
        </Button>

        {result && (
          <Card withBorder>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={600}>{result.drug_name}</Text>
                <Badge color={result.is_formulary ? "success" : "danger"} variant="filled">
                  {result.is_formulary ? "In Formulary" : "Not in Formulary"}
                </Badge>
              </Group>
              {result.requires_approval && (
                <Alert color="orange" variant="light">
                  <Text size="sm">This drug requires DTC approval before prescribing.</Text>
                </Alert>
              )}
              {result.alternative_drugs?.length > 0 && (
                <Stack gap={4}>
                  <Text size="sm" fw={500}>Formulary Alternatives:</Text>
                  <Group gap={4}>
                    {result.alternative_drugs.map((alt, idx) => (
                      <Badge key={idx} variant="light" color="primary" size="sm">{alt}</Badge>
                    ))}
                  </Group>
                </Stack>
              )}
            </Stack>
          </Card>
        )}
      </Stack>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════
//  Catalog Tab
// ══════════════════════════════════════════════════════════

function PharmacyCatalogTab({ canManage, compliance }: { canManage: boolean; compliance: ComplianceSettings }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formularyFilter, setFormularyFilter] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<CreatePharmacyCatalogRequest>>({});

  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ["pharmacy-catalog"],
    queryFn: () => api.listPharmacyCatalog(),
  });

  const filtered = useMemo(() => {
    if (!formularyFilter) return catalog;
    return catalog.filter((d) => d.formulary_status === formularyFilter);
  }, [catalog, formularyFilter]);

  const createMutation = useMutation({
    mutationFn: (data: CreatePharmacyCatalogRequest) => api.createPharmacyCatalog(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-catalog"] });
      setShowForm(false);
      setForm({});
    },
  });

  const columns = [
    { key: "code", label: "Code", render: (row: PharmacyCatalog) => <Text fw={500}>{row.code}</Text> },
    { key: "name", label: "Name", render: (row: PharmacyCatalog) => <Text size="sm">{row.name}</Text> },
    { key: "generic_name", label: "Generic", render: (row: PharmacyCatalog) => <Text size="sm">{row.generic_name ?? "\u2014"}</Text> },
    { key: "category", label: "Category", render: (row: PharmacyCatalog) => <Text size="sm">{row.category ?? "\u2014"}</Text> },
    { key: "base_price", label: "Price", render: (row: PharmacyCatalog) => <Text size="sm">{"\u20B9"}{row.base_price}</Text> },
    { key: "current_stock", label: "Stock", render: (row: PharmacyCatalog) => (
      <Text size="sm" c={row.current_stock < row.reorder_level ? "danger" : undefined} fw={row.current_stock < row.reorder_level ? 700 : undefined}>
        {row.current_stock}
        {row.current_stock < row.reorder_level && <IconAlertTriangle size={12} style={{ marginLeft: 4, verticalAlign: "middle" }} />}
      </Text>
    )},
    {
      key: "regulatory",
      label: "Regulatory",
      render: (row: PharmacyCatalog) => (
        <Group gap={2}>
          {compliance.show_schedule_badges && row.drug_schedule && (
            <Badge size="xs" variant="light" color={row.drug_schedule === "X" || row.drug_schedule === "NDPS" ? "danger" : row.drug_schedule === "H1" ? "orange" : "primary"}>
              Sch-{row.drug_schedule}
            </Badge>
          )}
          {compliance.show_controlled_warnings && row.is_controlled && (
            <Badge size="xs" variant="filled" color="danger">CTRL</Badge>
          )}
          {compliance.show_formulary_status && row.formulary_status !== "approved" && (
            <Badge size="xs" variant="light" color={row.formulary_status === "restricted" ? "warning" : "gray"}>
              {row.formulary_status === "restricted" ? "Restricted" : "Non-Formulary"}
            </Badge>
          )}
          {compliance.show_aware_category && row.aware_category && (
            <Badge size="xs" variant="light" color={row.aware_category === "reserve" ? "danger" : row.aware_category === "watch" ? "orange" : "success"}>
              AWaRe: {row.aware_category}
            </Badge>
          )}
        </Group>
      ),
    },
    { key: "is_active", label: "Active", render: (row: PharmacyCatalog) => row.is_active ? <IconCheck size={14} color="success" /> : <IconX size={14} color="danger" /> },
  ];

  return (
    <Stack>
      <Group>
        {canManage && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>
            Add Drug
          </Button>
        )}
        <Select
          placeholder="Formulary filter"
          data={[
            { value: "approved", label: "Approved" },
            { value: "restricted", label: "Restricted" },
            { value: "non_formulary", label: "Non-Formulary" },
          ]}
          value={formularyFilter}
          onChange={setFormularyFilter}
          clearable
          w={180}
        />
      </Group>
      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Code" required onChange={(e) => setForm({ ...form, code: e.currentTarget.value })} />
            <TextInput label="Name" required onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
          </Group>
          <Group grow>
            <TextInput label="Generic Name" onChange={(e) => setForm({ ...form, generic_name: e.currentTarget.value || undefined })} />
            <Select label="Category" data={DRUG_CATEGORIES} onChange={(v) => setForm({ ...form, category: v || undefined })} clearable searchable />
          </Group>
          <Group grow>
            <TextInput label="Manufacturer" onChange={(e) => setForm({ ...form, manufacturer: e.currentTarget.value || undefined })} />
            <TextInput label="Unit" onChange={(e) => setForm({ ...form, unit: e.currentTarget.value || undefined })} />
          </Group>
          <Group grow>
            <NumberInput label="Base Price" required min={0} decimalScale={2} onChange={(v) => setForm({ ...form, base_price: Number(v) })} />
            <NumberInput label="Tax %" min={0} max={100} decimalScale={2} onChange={(v) => setForm({ ...form, tax_percent: Number(v) })} />
            <NumberInput label="Reorder Level" min={0} onChange={(v) => setForm({ ...form, reorder_level: Number(v) || undefined })} />
          </Group>
          <Text fw={600} size="sm" mt="xs">Regulatory Classification</Text>
          <Group grow>
            <Select label="Drug Schedule" placeholder="Select schedule" data={[
              { value: "H", label: "H" }, { value: "H1", label: "H1" }, { value: "X", label: "X" },
              { value: "G", label: "G" }, { value: "OTC", label: "OTC" }, { value: "NDPS", label: "NDPS" },
            ]} value={form.drug_schedule ?? null} onChange={(v) => setForm({ ...form, drug_schedule: (v as DrugSchedule) || undefined })} clearable />
            <Select label="Formulary Status" placeholder="Select status" data={[
              { value: "approved", label: "Approved" }, { value: "restricted", label: "Restricted" }, { value: "non_formulary", label: "Non-Formulary" },
            ]} value={form.formulary_status ?? null} onChange={(v) => setForm({ ...form, formulary_status: (v as FormularyStatus) || undefined })} clearable />
            <Select label="AWaRe Category" description="For antibiotics only" placeholder="Select category" data={[
              { value: "access", label: "Access" }, { value: "watch", label: "Watch" }, { value: "reserve", label: "Reserve" },
            ]} value={form.aware_category ?? null} onChange={(v) => setForm({ ...form, aware_category: (v as AwareCategory) || undefined })} clearable />
          </Group>
          <Group grow>
            <TextInput label="INN Name" placeholder="International Nonproprietary Name" onChange={(e) => setForm({ ...form, inn_name: e.currentTarget.value || undefined })} />
            <TextInput label="ATC Code" placeholder="e.g. J01CA04" onChange={(e) => setForm({ ...form, atc_code: e.currentTarget.value || undefined })} />
          </Group>
          <Switch label="Controlled Substance" checked={form.is_controlled ?? false} onChange={(e) => setForm({ ...form, is_controlled: e.currentTarget.checked || undefined })} />
          <Button size="xs" onClick={() => createMutation.mutate(form as CreatePharmacyCatalogRequest)} loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={filtered} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Stock Tab
// ══════════════════════════════════════════════════════════

function StockTab({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateStockTransactionRequest>>({ transaction_type: "receipt" as StockTransactionType });

  const { data: stock = [], isLoading } = useQuery({
    queryKey: ["pharmacy-stock"],
    queryFn: () => api.listStock(),
  });

  const emit = useClinicalEmit();

  const createTxMutation = useMutation({
    mutationFn: (data: CreateStockTransactionRequest) => api.createStockTransaction(data),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-stock"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-catalog"] });
      notifications.show({ title: "Stock updated", message: "Transaction recorded", color: "success" });
      emit("stock.movement", { transaction_type: variables.transaction_type, quantity: variables.quantity });
      setShowForm(false);
      setForm({ transaction_type: "receipt" as StockTransactionType });
    },
  });

  const columns = [
    { key: "code", label: "Code", render: (row: PharmacyCatalog) => <Text fw={500}>{row.code}</Text> },
    { key: "name", label: "Drug Name", render: (row: PharmacyCatalog) => <Text size="sm">{row.name}</Text> },
    {
      key: "current_stock",
      label: "Current Stock",
      render: (row: PharmacyCatalog) => (
        <Badge color={row.current_stock < row.reorder_level ? "danger" : "success"} variant="light">
          {row.current_stock}
        </Badge>
      ),
    },
    { key: "reorder_level", label: "Reorder Level", render: (row: PharmacyCatalog) => <Text size="sm">{row.reorder_level}</Text> },
    {
      key: "status",
      label: "Status",
      render: (row: PharmacyCatalog) =>
        row.current_stock < row.reorder_level ? (
          <Badge color="danger" variant="filled" size="sm">Low Stock</Badge>
        ) : (
          <Badge color="success" variant="light" size="sm">OK</Badge>
        ),
    },
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button size="xs" leftSection={<IconPackage size={14} />} onClick={() => setShowForm(!showForm)}>
            New Stock Transaction
          </Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <DrugSearchSelect value={form.catalog_item_id ?? ""} onChange={(id) => setForm({ ...form, catalog_item_id: id })} required />
          <Group grow>
            <Select label="Type" data={[
              { value: "receipt", label: "Receipt (In)" }, { value: "issue", label: "Issue (Out)" },
              { value: "return", label: "Return" }, { value: "adjustment", label: "Adjustment" },
            ]} value={form.transaction_type} onChange={(v) => setForm({ ...form, transaction_type: (v ?? "receipt") as StockTransactionType })} />
            <NumberInput label="Quantity" required min={1} onChange={(v) => setForm({ ...form, quantity: Number(v) })} />
          </Group>
          <TextInput label="Notes" onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })} />
          <Button size="xs" onClick={() => createTxMutation.mutate(form as CreateStockTransactionRequest)} loading={createTxMutation.isPending}>
            Record Transaction
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={stock} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  NDPS Register Tab
// ══════════════════════════════════════════════════════════

function NdpsRegisterTab() {
  const canManage = useHasPermission(P.PHARMACY.NDPS_MANAGE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateNdpsEntryRequest>>({ action: "receipt" });

  const { data, isLoading } = useQuery({
    queryKey: ["pharmacy-ndps"],
    queryFn: () => api.listNdpsEntries(),
  });

  const { data: balance } = useQuery({
    queryKey: ["pharmacy-ndps-balance"],
    queryFn: () => api.getNdpsBalance(),
  });

  const createMutation = useMutation({
    mutationFn: (d: CreateNdpsEntryRequest) => api.createNdpsEntry(d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-ndps"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-ndps-balance"] });
      notifications.show({ title: "NDPS Entry", message: "Register entry recorded", color: "success" });
      setShowForm(false);
      setForm({ action: "receipt" });
    },
  });

  const actionColors: Record<string, string> = {
    receipt: "success", dispensed: "primary", destroyed: "danger", transferred: "orange", adjustment: "gray",
  };

  const columns = [
    { key: "action", label: "Action", render: (row: NdpsRegisterEntry) => (
      <Badge size="xs" color={actionColors[row.action] ?? "gray"}>{row.action}</Badge>
    )},
    { key: "quantity", label: "Qty", render: (row: NdpsRegisterEntry) => <Text size="sm">{row.quantity}</Text> },
    { key: "balance_after", label: "Balance", render: (row: NdpsRegisterEntry) => <Text size="sm" fw={700}>{row.balance_after}</Text> },
    { key: "dispensed_by", label: "By", render: (row: NdpsRegisterEntry) => <Text size="sm">{row.dispensed_by?.slice(0, 8) ?? "\u2014"}</Text> },
    { key: "witnessed_by", label: "Witness", render: (row: NdpsRegisterEntry) => <Text size="sm">{row.witnessed_by?.slice(0, 8) ?? "\u2014"}</Text> },
    { key: "created_at", label: "Date", render: (row: NdpsRegisterEntry) => <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text> },
  ];

  return (
    <Stack>
      {balance?.entries && balance.entries.length > 0 && (
        <Group gap="sm">
          {balance.entries.map((b) => (
            <Badge key={b.catalog_item_id} size="lg" variant="light" leftSection={<IconLock size={12} />}>
              {b.drug_name}: {b.balance}
            </Badge>
          ))}
        </Group>
      )}
      {canManage && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>
            Manual Entry
          </Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <DrugSearchSelect value={form.catalog_item_id ?? ""} onChange={(id) => setForm({ ...form, catalog_item_id: id })} required />
          <Group grow>
            <Select label="Action" data={[
              { value: "receipt", label: "Receipt" }, { value: "destroyed", label: "Destroyed" },
              { value: "transferred", label: "Transferred" }, { value: "adjustment", label: "Adjustment" },
            ]} value={form.action ?? "receipt"} onChange={(v) => setForm({ ...form, action: v as CreateNdpsEntryRequest["action"] })} />
            <NumberInput label="Quantity" required min={1} onChange={(v) => setForm({ ...form, quantity: Number(v) })} />
          </Group>
          <TextInput label="Notes" onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })} />
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateNdpsEntryRequest)} loading={createMutation.isPending}>
            Record
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={data?.entries ?? []} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Batch & Expiry Tab
// ══════════════════════════════════════════════════════════

function BatchExpiryTab() {
  const [view, setView] = useState("batches");

  return (
    <Stack>
      <SegmentedControl
        value={view}
        onChange={setView}
        data={[
          { label: "Batch Ledger", value: "batches" },
          { label: "Near Expiry", value: "near-expiry" },
          { label: "Dead Stock", value: "dead-stock" },
        ]}
      />
      {view === "batches" && <BatchLedgerView />}
      {view === "near-expiry" && <NearExpiryView />}
      {view === "dead-stock" && <DeadStockView />}
    </Stack>
  );
}

function BatchLedgerView() {
  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["pharmacy-batches"],
    queryFn: () => api.listPharmacyBatches(),
  });

  const columns = [
    { key: "batch_number", label: "Batch #", render: (row: PharmacyBatch) => <Text fw={500} size="sm">{row.batch_number}</Text> },
    { key: "expiry_date", label: "Expiry", render: (row: PharmacyBatch) => {
      const days = Math.ceil((new Date(row.expiry_date).getTime() - Date.now()) / 86400000);
      return <Text size="sm" c={days < 30 ? "danger" : days < 60 ? "orange" : undefined}>{row.expiry_date}</Text>;
    }},
    { key: "quantity_received", label: "Received", render: (row: PharmacyBatch) => <Text size="sm">{row.quantity_received}</Text> },
    { key: "quantity_dispensed", label: "Dispensed", render: (row: PharmacyBatch) => <Text size="sm">{row.quantity_dispensed}</Text> },
    { key: "quantity_on_hand", label: "On Hand", render: (row: PharmacyBatch) => <Badge size="sm" color={row.quantity_on_hand <= 0 ? "danger" : "success"} variant="light">{row.quantity_on_hand}</Badge> },
    { key: "store_location_id", label: "Location", render: (row: PharmacyBatch) => <Text size="sm">{row.store_location_id?.slice(0, 8) ?? "\u2014"}</Text> },
  ];

  return <DataTable columns={columns} data={batches} loading={isLoading} rowKey={(row) => row.id} />;
}

function NearExpiryView() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pharmacy-near-expiry"],
    queryFn: () => api.getNearExpiryReport({ days: "90" }),
  });

  const columns = [
    { key: "drug_name", label: "Drug", render: (row: NearExpiryRow) => <Text size="sm">{row.drug_name}</Text> },
    { key: "batch_number", label: "Batch #", render: (row: NearExpiryRow) => <Text size="sm">{row.batch_number}</Text> },
    { key: "expiry_date", label: "Expiry", render: (row: NearExpiryRow) => (
      <Text size="sm" c={row.days_until_expiry < 30 ? "danger" : row.days_until_expiry < 60 ? "orange" : "warning"} fw={700}>
        {row.expiry_date}
      </Text>
    )},
    { key: "quantity_on_hand", label: "On Hand", render: (row: NearExpiryRow) => <Text size="sm">{row.quantity_on_hand}</Text> },
    { key: "days_until_expiry", label: "Days Left", render: (row: NearExpiryRow) => (
      <Badge size="sm" color={row.days_until_expiry < 30 ? "danger" : row.days_until_expiry < 60 ? "orange" : "warning"}>
        {row.days_until_expiry}d
      </Badge>
    )},
  ];

  return <DataTable columns={columns} data={rows} loading={isLoading} rowKey={(row) => `${row.batch_number}-${row.expiry_date}`} />;
}

function DeadStockView() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pharmacy-dead-stock"],
    queryFn: () => api.getPharmacyDeadStock({ idle_days: "90" }),
  });

  const columns = [
    { key: "drug_name", label: "Drug", render: (row: PharmacyDeadStockRow) => <Text size="sm">{row.drug_name}</Text> },
    { key: "current_stock", label: "Stock", render: (row: PharmacyDeadStockRow) => <Text size="sm">{row.current_stock}</Text> },
    { key: "stock_value", label: "Value", render: (row: PharmacyDeadStockRow) => <Text size="sm">{"\u20B9"}{Number(row.stock_value).toLocaleString()}</Text> },
    { key: "last_dispensed_date", label: "Last Dispensed", render: (row: PharmacyDeadStockRow) => <Text size="sm">{row.last_dispensed_date ? new Date(row.last_dispensed_date).toLocaleDateString() : "Never"}</Text> },
    { key: "days_idle", label: "Days Idle", render: (row: PharmacyDeadStockRow) => <Badge size="sm" color="orange">{row.days_idle ?? "N/A"}</Badge> },
  ];

  return <DataTable columns={columns} data={rows} loading={isLoading} rowKey={(row) => row.drug_name} />;
}

// ══════════════════════════════════════════════════════════
//  Stores & Transfers Tab
// ══════════════════════════════════════════════════════════

function StoresTransfersTab() {
  const [view, setView] = useState("locations");

  return (
    <Stack>
      <SegmentedControl
        value={view}
        onChange={setView}
        data={[
          { label: "Pharmacy Locations", value: "locations" },
          { label: "Transfers", value: "transfers" },
        ]}
      />
      {view === "locations" && <PharmacyLocationsView />}
      {view === "transfers" && <TransfersView />}
    </Stack>
  );
}

function PharmacyLocationsView() {
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["pharmacy-store-assignments"],
    queryFn: () => api.listPharmacyStoreAssignments(),
  });

  const columns = [
    { key: "store_location_id", label: "Location", render: (row: PharmacyStoreAssignment) => <Text size="sm">{row.store_location_id.slice(0, 8)}...</Text> },
    { key: "is_central", label: "Central", render: (row: PharmacyStoreAssignment) => row.is_central ? <Badge color="primary" size="xs">Central</Badge> : <Text size="sm">Satellite</Text> },
    { key: "serves_departments", label: "Departments", render: (row: PharmacyStoreAssignment) => <Text size="sm">{row.serves_departments?.length ?? 0} depts</Text> },
    { key: "created_at", label: "Created", render: (row: PharmacyStoreAssignment) => <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text> },
  ];

  return <DataTable columns={columns} data={assignments} loading={isLoading} rowKey={(row) => row.id} />;
}

function TransfersView() {
  const canManage = useHasPermission(P.PHARMACY.STORES_MANAGE);
  const queryClient = useQueryClient();

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ["pharmacy-transfers"],
    queryFn: () => api.listPharmacyTransfers(),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approvePharmacyTransfer(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-transfers"] });
      notifications.show({ title: "Transfer Approved", message: "Transfer request approved", color: "success" });
    },
  });

  const transferStatusColors: Record<string, string> = {
    draft: "gray", approved: "primary", transferred: "success", cancelled: "danger",
  };

  const columns = [
    { key: "from_location_id", label: "From", render: (row: PharmacyTransferRequest) => <Text size="sm">{row.from_location_id.slice(0, 8)}...</Text> },
    { key: "to_location_id", label: "To", render: (row: PharmacyTransferRequest) => <Text size="sm">{row.to_location_id.slice(0, 8)}...</Text> },
    { key: "status", label: "Status", render: (row: PharmacyTransferRequest) => <Badge size="xs" color={transferStatusColors[row.status] ?? "gray"}>{row.status}</Badge> },
    { key: "created_at", label: "Date", render: (row: PharmacyTransferRequest) => <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text> },
    { key: "actions", label: "Actions", render: (row: PharmacyTransferRequest) => (
      <Group gap="xs">
        {canManage && row.status === "draft" && (
          <Tooltip label="Approve">
            <ActionIcon variant="subtle" color="success" onClick={() => approveMutation.mutate(row.id)}>
              <IconCheck size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    )},
  ];

  return <DataTable columns={columns} data={transfers} loading={isLoading} rowKey={(row) => row.id} />;
}

// ══════════════════════════════════════════════════════════
//  Analytics & Reports Tab
// ══════════════════════════════════════════════════════════

function AnalyticsTab() {
  const [view, setView] = useState("consumption");

  return (
    <Stack>
      <SegmentedControl
        value={view}
        onChange={setView}
        data={[
          { label: "Consumption", value: "consumption" },
          { label: "ABC-VED", value: "abc-ved" },
          { label: "Drug Utilization", value: "utilization" },
        ]}
      />
      {view === "consumption" && <ConsumptionView />}
      {view === "abc-ved" && <AbcVedView />}
      {view === "utilization" && <UtilizationView />}
    </Stack>
  );
}

function ConsumptionView() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pharmacy-consumption"],
    queryFn: () => api.getPharmacyConsumption(),
  });

  const columns = [
    { key: "drug_name", label: "Drug", render: (row: PharmacyConsumptionRow) => <Text size="sm">{row.drug_name}</Text> },
    { key: "category", label: "Category", render: (row: PharmacyConsumptionRow) => <Text size="sm">{row.category ?? "\u2014"}</Text> },
    { key: "total_dispensed", label: "Total Dispensed", render: (row: PharmacyConsumptionRow) => <Text size="sm" fw={700}>{row.total_dispensed}</Text> },
    { key: "total_value", label: "Total Value", render: (row: PharmacyConsumptionRow) => <Text size="sm">{"\u20B9"}{Number(row.total_value).toLocaleString()}</Text> },
  ];

  return <DataTable columns={columns} data={rows} loading={isLoading} rowKey={(row) => row.drug_name} />;
}

function AbcVedView() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pharmacy-abc-ved"],
    queryFn: () => api.getPharmacyAbcVed(),
  });

  const abcColors: Record<string, string> = { A: "danger", B: "orange", C: "success" };
  const vedColors: Record<string, string> = { V: "danger", E: "orange", D: "success" };

  const columns = [
    { key: "drug_name", label: "Drug", render: (row: PharmacyAbcVedRow) => <Text size="sm">{row.drug_name}</Text> },
    { key: "annual_value", label: "Annual Value", render: (row: PharmacyAbcVedRow) => <Text size="sm">{"\u20B9"}{Number(row.annual_value).toLocaleString()}</Text> },
    { key: "abc_class", label: "ABC", render: (row: PharmacyAbcVedRow) => <Badge size="xs" color={abcColors[row.abc_class] ?? "gray"}>{row.abc_class}</Badge> },
    { key: "ved_class", label: "VED", render: (row: PharmacyAbcVedRow) => row.ved_class ? <Badge size="xs" color={vedColors[row.ved_class] ?? "gray"}>{row.ved_class}</Badge> : <Text size="sm">{"\u2014"}</Text> },
  ];

  return <DataTable columns={columns} data={rows} loading={isLoading} rowKey={(row) => row.drug_name} />;
}

function UtilizationView() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pharmacy-utilization"],
    queryFn: () => api.getDrugUtilization(),
  });

  const columns = [
    { key: "drug_name", label: "Drug", render: (row: DrugUtilizationRow) => <Text size="sm">{row.drug_name}</Text> },
    { key: "generic_name", label: "Generic", render: (row: DrugUtilizationRow) => <Text size="sm">{row.generic_name ?? "\u2014"}</Text> },
    { key: "aware_category", label: "AWaRe", render: (row: DrugUtilizationRow) => row.aware_category
      ? <Badge size="xs" color={row.aware_category === "reserve" ? "danger" : row.aware_category === "watch" ? "orange" : "success"}>{row.aware_category}</Badge>
      : <Text size="sm">{"\u2014"}</Text>
    },
    { key: "total_dispensed", label: "Dispensed", render: (row: DrugUtilizationRow) => <Text size="sm" fw={700}>{row.total_dispensed}</Text> },
    { key: "unique_patients", label: "Patients", render: (row: DrugUtilizationRow) => <Text size="sm">{row.unique_patients}</Text> },
  ];

  return <DataTable columns={columns} data={rows} loading={isLoading} rowKey={(row) => row.drug_name} />;
}

// ══════════════════════════════════════════════════════════
//  Rx Queue Tab (Phase 3)
// ══════════════════════════════════════════════════════════

const rxStatusColors: Record<string, string> = {
  pending_review: "orange",
  approved: "success",
  rejected: "danger",
  on_hold: "gray",
  dispensing: "info",
  dispensed: "primary",
  partially_dispensed: "teal",
  cancelled: "dimmed",
};

function RxQueueTab({ canReview }: { canReview: boolean }) {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewOpened, { open: openReview, close: closeReview }] = useDisclosure(false);
  const [reviewAction, setReviewAction] = useState<string>("approved");
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const params = filterStatus ? { status: filterStatus } : undefined;
  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["pharmacy-rx-queue", params],
    queryFn: () => api.listRxQueue(params),
    refetchInterval: 15_000,
  });

  const reviewMutation = useMutation({
    mutationFn: (data: { id: string; action: string; notes?: string; rejection_reason?: string }) =>
      api.reviewPrescription(data.id, { action: data.action, notes: data.notes, rejection_reason: data.rejection_reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharmacy-rx-queue"] });
      closeReview();
      setReviewNotes("");
      setRejectionReason("");
      notifications.show({ title: "Success", message: "Prescription reviewed", color: "green" });
    },
  });

  function handleOpenReview(id: string, action: string) {
    setSelectedId(id);
    setReviewAction(action);
    openReview();
  }

  function handleSubmitReview() {
    if (!selectedId) return;
    reviewMutation.mutate({
      id: selectedId,
      action: reviewAction,
      notes: reviewNotes || undefined,
      rejection_reason: reviewAction === "rejected" ? rejectionReason || undefined : undefined,
    });
  }

  const columns = [
    { key: "patient_name", label: "Patient", render: (row: RxQueueRow) => <Text size="sm" fw={600}>{row.patient_name}</Text> },
    { key: "doctor_name", label: "Doctor", render: (row: RxQueueRow) => <Text size="sm">{row.doctor_name}</Text> },
    { key: "source", label: "Source", render: (row: RxQueueRow) => <Badge size="xs" variant="light">{row.source}</Badge> },
    { key: "priority", label: "Priority", render: (row: RxQueueRow) => (
      <Badge size="xs" color={row.priority === "urgent" ? "danger" : row.priority === "high" ? "orange" : "gray"}>{row.priority}</Badge>
    ) },
    { key: "status", label: "Status", render: (row: RxQueueRow) => (
      <Badge size="xs" color={rxStatusColors[row.status] ?? "gray"}>{row.status.replace(/_/g, " ")}</Badge>
    ) },
    { key: "allergy_count", label: "Allergies", render: (row: RxQueueRow) => (
      row.allergy_count > 0 ? <Badge size="xs" color="danger">{row.allergy_count} alerts</Badge> : <Text size="sm" c="dimmed">None</Text>
    ) },
    { key: "received_at", label: "Received", render: (row: RxQueueRow) => <Text size="sm">{new Date(row.received_at).toLocaleTimeString()}</Text> },
    {
      key: "actions", label: "Actions", render: (row: RxQueueRow) => (
        <Group gap={4}>
          <Tooltip label="View prescription">
            <ActionIcon size="sm" variant="subtle" onClick={() => { setSelectedId(row.id); }} aria-label="View details">
              <IconEye size={14} />
            </ActionIcon>
          </Tooltip>
          {canReview && row.status === "pending_review" && (
            <>
              <Tooltip label="Approve & dispense">
                <ActionIcon size="sm" color="success" variant="light" onClick={() => handleOpenReview(row.id, "approved")} aria-label="Approve">
                  <IconCheck size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Hold for review">
                <ActionIcon size="sm" color="warning" variant="light" onClick={() => handleOpenReview(row.id, "on_hold")} aria-label="Hold">
                  <IconClock size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Reject prescription">
                <ActionIcon size="sm" color="danger" variant="light" onClick={() => handleOpenReview(row.id, "rejected")} aria-label="Reject">
                  <IconX size={14} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>Prescription Queue</Text>
        <Select size="xs" placeholder="All statuses" clearable w={180}
          data={[
            { value: "pending_review", label: "Pending Review" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
            { value: "on_hold", label: "On Hold" },
          ]}
          value={filterStatus} onChange={setFilterStatus}
        />
      </Group>
      <DataTable columns={columns} data={queue} loading={isLoading} rowKey={(row) => row.id} />

      <Modal opened={reviewOpened} onClose={closeReview} title={`${reviewAction === "approved" ? "Approve" : reviewAction === "rejected" ? "Reject" : "Review"} Prescription`} size="sm">
        <Stack>
          <Textarea label="Notes" value={reviewNotes} onChange={(e) => setReviewNotes(e.currentTarget.value)} />
          {reviewAction === "rejected" && (
            <Textarea label="Rejection Reason" required value={rejectionReason} onChange={(e) => setRejectionReason(e.currentTarget.value)} />
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={closeReview}>Cancel</Button>
            <Button color={reviewAction === "rejected" ? "red" : "green"} loading={reviewMutation.isPending} onClick={handleSubmitReview}>
              {reviewAction === "approved" ? "Approve" : "Reject"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  POS Counter Tab (Phase 3)
// ══════════════════════════════════════════════════════════

interface CartItem {
  catalog_item_id: string;
  drug_name: string;
  quantity: number;
  unit_price: number;
}

function PosCounterTab({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<PharmacyPaymentMode>("cash");
  const [amountReceived, setAmountReceived] = useState<number | string>(0);
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [discountPercent, setDiscountPercent] = useState<number | string>(0);
  const [drugSelectValue, setDrugSelectValue] = useState("");

  const { data: daySummary } = useQuery({
    queryKey: ["pharmacy-pos-day-summary"],
    queryFn: () => api.getPosDaySummary(),
    refetchInterval: 60_000,
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ["pharmacy-pos-sales"],
    queryFn: () => api.listPosSales(),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.createPosSale(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharmacy-pos"] });
      queryClient.invalidateQueries({ queryKey: ["pharmacy-pos-day-summary"] });
      queryClient.invalidateQueries({ queryKey: ["pharmacy-pos-sales"] });
      setCart([]);
      setAmountReceived(0);
      setPatientName("");
      setPatientPhone("");
      setDiscountPercent(0);
      notifications.show({ title: "Sale Complete", message: "POS sale recorded", color: "green" });
    },
  });

  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const discount = subtotal * (Number(discountPercent) / 100);
  const gstAmount = (subtotal - discount) * 0.05;
  const totalAmount = subtotal - discount + gstAmount;
  const changeDue = Number(amountReceived) - totalAmount;

  function addToCart(itemId: string, drugName: string) {
    setCart((prev) => {
      const existing = prev.find((c) => c.catalog_item_id === itemId);
      if (existing) {
        return prev.map((c) => c.catalog_item_id === itemId ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { catalog_item_id: itemId, drug_name: drugName, quantity: 1, unit_price: 0 }];
    });
  }

  function removeFromCart(itemId: string) {
    setCart((prev) => prev.filter((c) => c.catalog_item_id !== itemId));
  }

  function updateQuantity(itemId: string, quantity: number) {
    setCart((prev) => prev.map((c) => c.catalog_item_id === itemId ? { ...c, quantity } : c));
  }

  function updatePrice(itemId: string, price: number) {
    setCart((prev) => prev.map((c) => c.catalog_item_id === itemId ? { ...c, unit_price: price } : c));
  }

  function handleSubmitSale() {
    if (cart.length === 0) return;
    createMutation.mutate({
      items: cart.map((c) => ({
        catalog_item_id: c.catalog_item_id,
        drug_name: c.drug_name,
        quantity: c.quantity,
        mrp: c.unit_price,
        selling_price: c.unit_price,
        gst_rate: 5,
      })),
      payment_mode: paymentMode,
      amount_received: Number(amountReceived),
      patient_name: patientName || undefined,
      patient_phone: patientPhone || undefined,
      discount_percent: Number(discountPercent) || undefined,
      discount_amount: discount > 0 ? discount : undefined,
    });
  }

  const saleColumns = [
    { key: "sale_number", label: "Sale #", render: (row: PharmacyPosSale) => <Text size="sm" fw={600}>{row.sale_number}</Text> },
    { key: "patient_name", label: "Customer", render: (row: PharmacyPosSale) => <Text size="sm">{row.patient_name ?? "Walk-in"}</Text> },
    { key: "total_amount", label: "Total", render: (row: PharmacyPosSale) => <Text size="sm" fw={700}>{"\u20B9"}{Number(row.total_amount).toLocaleString()}</Text> },
    { key: "payment_mode", label: "Payment", render: (row: PharmacyPosSale) => <Badge size="xs" variant="light">{row.payment_mode}</Badge> },
    { key: "created_at", label: "Time", render: (row: PharmacyPosSale) => <Text size="sm">{new Date(row.created_at).toLocaleTimeString()}</Text> },
  ];

  return (
    <Stack>
      {daySummary && (
        <Group gap="lg">
          <Card withBorder p="xs" style={{ flex: 1 }}>
            <Text size="xs" c="dimmed">Sales Today</Text>
            <Text size="lg" fw={700}>{daySummary.total_sales}</Text>
          </Card>
          <Card withBorder p="xs" style={{ flex: 1 }}>
            <Text size="xs" c="dimmed">Revenue</Text>
            <Text size="lg" fw={700}>{"\u20B9"}{Number(daySummary.total_revenue).toLocaleString()}</Text>
          </Card>
          <Card withBorder p="xs" style={{ flex: 1 }}>
            <Text size="xs" c="dimmed">Cash</Text>
            <Text size="lg" fw={700}>{"\u20B9"}{Number(daySummary.cash_total).toLocaleString()}</Text>
          </Card>
          <Card withBorder p="xs" style={{ flex: 1 }}>
            <Text size="xs" c="dimmed">Card/UPI</Text>
            <Text size="lg" fw={700}>{"\u20B9"}{Number(daySummary.card_total + daySummary.upi_total).toLocaleString()}</Text>
          </Card>
        </Group>
      )}

      {canCreate && (
        <Card withBorder p="md">
          <Text fw={600} mb="sm">New Sale</Text>
          <Group mb="sm" align="flex-end">
            <DrugSearchSelect
              label="Add Drug"
              value={drugSelectValue}
              onChange={(id: string, drug) => {
                setDrugSelectValue(id);
                addToCart(id, drug?.name ?? id);
              }}
            />
            <TextInput size="xs" label="Customer" value={patientName} onChange={(e) => setPatientName(e.currentTarget.value)} w={160} />
            <TextInput size="xs" label="Phone" value={patientPhone} onChange={(e) => setPatientPhone(e.currentTarget.value)} w={130} />
          </Group>

          {cart.length > 0 && (
            <Table striped highlightOnHover mb="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Drug</Table.Th>
                  <Table.Th>Qty</Table.Th>
                  <Table.Th>Price</Table.Th>
                  <Table.Th>Line Total</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {cart.map((item) => (
                  <Table.Tr key={item.catalog_item_id}>
                    <Table.Td><Text size="sm">{item.drug_name}</Text></Table.Td>
                    <Table.Td>
                      <NumberInput size="xs" w={70} min={1} value={item.quantity} onChange={(val) => updateQuantity(item.catalog_item_id, Number(val))} />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput size="xs" w={90} min={0} decimalScale={2} prefix={"\u20B9"} value={item.unit_price} onChange={(val) => updatePrice(item.catalog_item_id, Number(val))} />
                    </Table.Td>
                    <Table.Td><Text size="sm" fw={600}>{"\u20B9"}{(item.quantity * item.unit_price).toFixed(2)}</Text></Table.Td>
                    <Table.Td>
                      <ActionIcon size="sm" color="red" variant="light" onClick={() => removeFromCart(item.catalog_item_id)}><IconX size={14} /></ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}

          {cart.length > 0 && (
            <Group justify="space-between" align="flex-end">
              <Group gap="sm">
                <NumberInput size="xs" label="Discount %" w={80} min={0} max={100} value={discountPercent} onChange={setDiscountPercent} />
                <Select size="xs" label="Payment" w={120}
                  data={[
                    { value: "cash", label: "Cash" },
                    { value: "card", label: "Card" },
                    { value: "upi", label: "UPI" },
                    { value: "mixed", label: "Mixed" },
                  ]}
                  value={paymentMode} onChange={(v) => setPaymentMode((v ?? "cash") as PharmacyPaymentMode)}
                />
                <NumberInput size="xs" label="Received" w={100} min={0} decimalScale={2} prefix={"\u20B9"} value={amountReceived} onChange={setAmountReceived} />
              </Group>
              <Stack gap={2} align="flex-end">
                <Text size="sm">Subtotal: {"\u20B9"}{subtotal.toFixed(2)} | GST: {"\u20B9"}{gstAmount.toFixed(2)} | Total: <b>{"\u20B9"}{totalAmount.toFixed(2)}</b></Text>
                {changeDue > 0 && <Text size="xs" c="green">Change: {"\u20B9"}{changeDue.toFixed(2)}</Text>}
                <Button size="xs" color="primary" loading={createMutation.isPending} onClick={handleSubmitSale}
                  disabled={cart.length === 0 || Number(amountReceived) < totalAmount}
                  leftSection={<IconShoppingCart size={14} />}>
                  Complete Sale
                </Button>
              </Stack>
            </Group>
          )}
        </Card>
      )}

      <Text fw={600} mt="md">Today's Sales</Text>
      <DataTable columns={saleColumns} data={sales} loading={salesLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}
