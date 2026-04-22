import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
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
  IconBuildingWarehouse,
  IconCash,
  IconChartBar,
  IconContract,
  IconEye,
  IconFileInvoice,
  IconPackage,
  IconPlus,
  IconTruck,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  BatchStock,
  CreateGrnItemInput,
  CreatePoItemInput,
  CreateRcItemInput,
  GoodsReceiptNote,
  IndentRequisition,
  PurchaseOrder,
  PurchaseOrderItem,
  RateContract,
  StoreLocation,
  SupplierPayment,
  Vendor,
  VendorComparisonRow,
  VendorPerformanceRow,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";

// ── Status colors ────────────────────────────────────────────

const poStatusColors: Record<string, string> = {
  draft: "slate",
  submitted: "primary",
  approved: "success",
  sent_to_vendor: "teal",
  partially_received: "primary",
  fully_received: "violet",
  closed: "dark",
  cancelled: "danger",
};

const grnStatusColors: Record<string, string> = {
  draft: "slate",
  inspecting: "primary",
  accepted: "success",
  partially_accepted: "teal",
  rejected: "danger",
  completed: "violet",
};

const vendorStatusColors: Record<string, string> = {
  active: "success",
  inactive: "slate",
  blacklisted: "danger",
  pending_approval: "orange",
};

const rcStatusColors: Record<string, string> = {
  draft: "slate",
  active: "success",
  expired: "orange",
  terminated: "danger",
};

const poLinkableIndentStatuses = new Set([
  "approved",
  "partially_approved",
  "partially_issued",
]);

function formatLinkedIndentLabel(requisition: IndentRequisition) {
  return `${requisition.indent_number} • ${requisition.status.replace(/_/g, " ")}`;
}

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function ProcurementPage() {
  useRequirePermission(P.PROCUREMENT.VENDORS_LIST);

  const canCreateVendor = useHasPermission(P.PROCUREMENT.VENDORS_CREATE);
  const canCreatePo = useHasPermission(P.PROCUREMENT.PO_CREATE);
  const canCreateGrn = useHasPermission(P.PROCUREMENT.GRN_CREATE);
  const canManageRc = useHasPermission(P.PROCUREMENT.RC_MANAGE);
  const canManageStores = useHasPermission(P.PROCUREMENT.STORES_MANAGE);
  const canViewPerformance = useHasPermission(P.PROCUREMENT.PERFORMANCE_VIEW);
  const canViewPayments = useHasPermission(P.PROCUREMENT.PAYMENTS_LIST);

  const [activeTab, setActiveTab] = useState<string | null>("vendors");

  return (
    <div>
      <PageHeader
        title="Procurement"
        subtitle="Vendors, purchase orders, GRN, rate contracts, and batch stock"
        icon={<IconTruck size={20} stroke={1.5} />}
        color="violet"
      />

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="vendors" leftSection={<IconUsers size={16} />}>Vendors</Tabs.Tab>
          <Tabs.Tab value="purchase-orders" leftSection={<IconFileInvoice size={16} />}>Purchase Orders</Tabs.Tab>
          <Tabs.Tab value="grn" leftSection={<IconPackage size={16} />}>GRN</Tabs.Tab>
          <Tabs.Tab value="rate-contracts" leftSection={<IconContract size={16} />}>Rate Contracts</Tabs.Tab>
          <Tabs.Tab value="batch-stock" leftSection={<IconBuildingWarehouse size={16} />}>Batch Stock</Tabs.Tab>
          {canManageStores && (
            <Tabs.Tab value="store-locations" leftSection={<IconBuildingWarehouse size={16} />}>Store Locations</Tabs.Tab>
          )}
          {canViewPerformance && (
            <Tabs.Tab value="vendor-performance" leftSection={<IconChartBar size={16} />}>Vendor Performance</Tabs.Tab>
          )}
          {canViewPayments && (
            <Tabs.Tab value="supplier-payments" leftSection={<IconCash size={16} />}>Supplier Payments</Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="vendors">
          <VendorPanel canCreate={canCreateVendor} />
        </Tabs.Panel>
        <Tabs.Panel value="purchase-orders">
          <PurchaseOrderPanel canCreate={canCreatePo} />
        </Tabs.Panel>
        <Tabs.Panel value="grn">
          <GrnPanel canCreate={canCreateGrn} />
        </Tabs.Panel>
        <Tabs.Panel value="rate-contracts">
          <RateContractPanel canManage={canManageRc} />
        </Tabs.Panel>
        <Tabs.Panel value="batch-stock">
          <BatchStockPanel />
        </Tabs.Panel>
        {canManageStores && (
          <Tabs.Panel value="store-locations">
            <StoreLocationPanel />
          </Tabs.Panel>
        )}
        {canViewPerformance && (
          <Tabs.Panel value="vendor-performance">
            <VendorPerformancePanel />
          </Tabs.Panel>
        )}
        {canViewPayments && (
          <Tabs.Panel value="supplier-payments">
            <SupplierPaymentsPanel />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Vendors Panel
// ══════════════════════════════════════════════════════════

function VendorPanel({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [detailVendor, setDetailVendor] = useState<Vendor | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => api.listVendors(),
  });

  const columns = [
    { key: "code", label: "Code", render: (row: Vendor) => <Text fw={600}>{row.code}</Text> },
    { key: "name", label: "Name", render: (row: Vendor) => row.name },
    {
      key: "status",
      label: "Status",
      render: (row: Vendor) => (
        <Badge color={vendorStatusColors[row.status] ?? "slate"} variant="light" size="sm">
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    { key: "vendor_type", label: "Type", render: (row: Vendor) => <Badge variant="outline" size="sm">{row.vendor_type}</Badge> },
    { key: "contact_person", label: "Contact", render: (row: Vendor) => row.contact_person ?? "-" },
    { key: "phone", label: "Phone", render: (row: Vendor) => row.phone ?? "-" },
    { key: "city", label: "City", render: (row: Vendor) => row.city ?? "-" },
    { key: "gst_number", label: "GST", render: (row: Vendor) => row.gst_number ?? "-" },
    {
      key: "actions",
      label: "",
      render: (row: Vendor) => (
        <Tooltip label="View details">
          <ActionIcon variant="subtle" onClick={() => { setDetailVendor(row); openDetail(); }}>
            <IconEye size={16} />
          </ActionIcon>
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      {canCreate && (
        <Group justify="flex-end" mb="md">
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Add Vendor</Button>
        </Group>
      )}

      <DataTable
        columns={columns}
        data={vendors ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyTitle="No vendors found"
      />

      <Drawer opened={createOpened} onClose={closeCreate} title="Register New Vendor" position="right" size="lg">
        <VendorForm
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["vendors"] });
            closeCreate();
          }}
        />
      </Drawer>

      <Drawer opened={detailOpened} onClose={closeDetail} title="Vendor Details" position="right" size="lg">
        {detailVendor && (
          <Stack>
            <Group>
              <Badge color={vendorStatusColors[detailVendor.status]} variant="filled">{detailVendor.status}</Badge>
              <Badge variant="outline">{detailVendor.vendor_type}</Badge>
            </Group>
            <Text fw={600} size="lg">{detailVendor.name}</Text>
            {detailVendor.contact_person && <Text size="sm">Contact: {detailVendor.contact_person}</Text>}
            {detailVendor.phone && <Text size="sm">Phone: {detailVendor.phone}</Text>}
            {detailVendor.email && <Text size="sm">Email: {detailVendor.email}</Text>}
            {detailVendor.gst_number && <Text size="sm">GST: {detailVendor.gst_number}</Text>}
            {detailVendor.pan_number && <Text size="sm">PAN: {detailVendor.pan_number}</Text>}
            {detailVendor.drug_license_number && <Text size="sm">Drug License: {detailVendor.drug_license_number}</Text>}
            {detailVendor.city && <Text size="sm">Location: {[detailVendor.city, detailVendor.state].filter(Boolean).join(", ")}</Text>}
            <Text size="sm">Payment Terms: {detailVendor.payment_terms ?? "N/A"}</Text>
            <Text size="sm">Credit Limit: ₹{detailVendor.credit_limit} ({detailVendor.credit_days} days)</Text>
          </Stack>
        )}
      </Drawer>
    </>
  );
}

function VendorForm({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [vendorType, setVendorType] = useState("supplier");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("net_30");

  const mutation = useMutation({
    mutationFn: () =>
      api.createVendor({
        code,
        name,
        vendor_type: vendorType,
        contact_person: contactPerson || undefined,
        phone: phone || undefined,
        email: email || undefined,
        city: city || undefined,
        gst_number: gstNumber || undefined,
        payment_terms: paymentTerms,
      }),
    onSuccess: () => {
      notifications.show({ title: "Created", message: "Vendor registered", color: "success" });
      onSuccess();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  return (
    <Stack>
      <TextInput label="Vendor Code" value={code} onChange={(e) => setCode(e.currentTarget.value)} required />
      <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
      <Select
        label="Type"
        data={[
          { value: "supplier", label: "Supplier" },
          { value: "manufacturer", label: "Manufacturer" },
          { value: "distributor", label: "Distributor" },
          { value: "importer", label: "Importer" },
        ]}
        value={vendorType}
        onChange={(v) => setVendorType(v ?? "supplier")}
      />
      <TextInput label="Contact Person" value={contactPerson} onChange={(e) => setContactPerson(e.currentTarget.value)} />
      <TextInput label="Phone" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
      <TextInput label="Email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
      <TextInput label="City" value={city} onChange={(e) => setCity(e.currentTarget.value)} />
      <TextInput label="GST Number" value={gstNumber} onChange={(e) => setGstNumber(e.currentTarget.value)} />
      <Select
        label="Payment Terms"
        data={[
          { value: "net_30", label: "Net 30 Days" },
          { value: "net_60", label: "Net 60 Days" },
          { value: "net_90", label: "Net 90 Days" },
          { value: "advance", label: "Advance Payment" },
          { value: "cod", label: "Cash on Delivery" },
        ]}
        value={paymentTerms}
        onChange={(v) => setPaymentTerms(v ?? "net_30")}
      />
      <Button loading={mutation.isPending} onClick={() => mutation.mutate()} disabled={!code || !name}>
        Register Vendor
      </Button>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Purchase Orders Panel
// ══════════════════════════════════════════════════════════

function PurchaseOrderPanel({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const canApprove = useHasPermission(P.PROCUREMENT.PO_APPROVE);
  const [page, setPage] = useState(1);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const { data, isLoading } = useQuery({
    queryKey: ["purchase-orders", page],
    queryFn: () => api.listPurchaseOrders({ page: String(page), per_page: "20" }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approvePurchaseOrder(id),
    onSuccess: () => {
      notifications.show({ title: "Approved", message: "Purchase order approved", color: "success" });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => api.sendPurchaseOrder(id),
    onSuccess: () => {
      notifications.show({ title: "Sent", message: "PO sent to vendor", color: "success" });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });

  const columns = [
    { key: "po_number", label: "PO #", render: (row: PurchaseOrder) => <Text fw={600}>{row.po_number}</Text> },
    {
      key: "status",
      label: "Status",
      render: (row: PurchaseOrder) => (
        <Badge color={poStatusColors[row.status] ?? "slate"} variant="light" size="sm">
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    { key: "total_amount", label: "Amount", render: (row: PurchaseOrder) => `₹${row.total_amount}` },
    { key: "order_date", label: "Date", render: (row: PurchaseOrder) => row.order_date },
    { key: "expected_delivery", label: "Expected", render: (row: PurchaseOrder) => row.expected_delivery ?? "-" },
    {
      key: "actions",
      label: "",
      render: (row: PurchaseOrder) => (
        <Group gap={4}>
          <Tooltip label="View">
            <ActionIcon variant="subtle" onClick={() => { setDetailId(row.id); openDetail(); }}>
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          {row.status === "draft" && canApprove && (
            <Button size="compact-xs" variant="light" color="success" loading={approveMutation.isPending} onClick={() => approveMutation.mutate(row.id)}>
              Approve
            </Button>
          )}
          {row.status === "approved" && (
            <Button size="compact-xs" variant="light" color="teal" loading={sendMutation.isPending} onClick={() => sendMutation.mutate(row.id)}>
              Send
            </Button>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      {canCreate && (
        <Group justify="flex-end" mb="md">
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>New PO</Button>
        </Group>
      )}

      <DataTable
        columns={columns}
        data={data?.purchase_orders ?? []}
        loading={isLoading}
        page={page}
        totalPages={Math.ceil((data?.total ?? 0) / 20)}
        onPageChange={setPage}
        rowKey={(row) => row.id}
        emptyTitle="No purchase orders"
      />

      <Drawer opened={createOpened} onClose={closeCreate} title="Create Purchase Order" position="right" size="xl">
        <CreatePoForm
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
            closeCreate();
          }}
        />
      </Drawer>

      <Drawer opened={detailOpened} onClose={closeDetail} title="Purchase Order Details" position="right" size="lg">
        {detailId && <PoDetailView id={detailId} />}
      </Drawer>
    </>
  );
}

function PoDetailView({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["purchase-order", id],
    queryFn: () => api.getPurchaseOrder(id),
  });

  const linkedIndentId = data?.purchase_order.indent_requisition_id ?? null;
  const linkedIndentQuery = useQuery({
    queryKey: ["indent-requisition", "procurement-link", linkedIndentId],
    queryFn: () => api.getIndentRequisition(linkedIndentId!),
    enabled: Boolean(linkedIndentId),
  });

  if (isLoading || !data) return <Text>Loading...</Text>;

  const { purchase_order: po, items } = data;
  const linkedIndent = linkedIndentQuery.data?.requisition;

  return (
    <Stack>
      <Group>
        <Badge color={poStatusColors[po.status]} variant="filled">{po.status.replace(/_/g, " ")}</Badge>
        <Text size="sm" c="dimmed">PO #{po.po_number}</Text>
      </Group>

      <Text size="sm">Order Date: {po.order_date}</Text>
      {po.indent_requisition_id && (
        <Group gap="xs">
          <Text size="sm">Linked Indent:</Text>
          <Badge variant="light" color="info">
            {linkedIndent?.indent_number ?? po.indent_requisition_id}
          </Badge>
          {linkedIndent && (
            <Badge variant="outline" size="sm">
              {linkedIndent.status.replace(/_/g, " ")}
            </Badge>
          )}
        </Group>
      )}
      {po.expected_delivery && <Text size="sm">Expected Delivery: {po.expected_delivery}</Text>}
      {po.payment_terms && <Text size="sm">Payment Terms: {po.payment_terms}</Text>}
      {po.notes && <Text size="sm">{po.notes}</Text>}

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item</Table.Th>
            <Table.Th>Qty</Table.Th>
            <Table.Th>Received</Table.Th>
            <Table.Th>Price</Table.Th>
            <Table.Th>Total</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item: PurchaseOrderItem) => (
            <Table.Tr key={item.id}>
              <Table.Td>{item.item_name}</Table.Td>
              <Table.Td>{item.quantity_ordered}</Table.Td>
              <Table.Td>{item.quantity_received}</Table.Td>
              <Table.Td>₹{item.unit_price}</Table.Td>
              <Table.Td>₹{item.total_amount}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Group>
        <Text size="sm">Subtotal: ₹{po.subtotal}</Text>
        <Text size="sm">Tax: ₹{po.tax_amount}</Text>
        <Text size="sm">Discount: ₹{po.discount_amount}</Text>
        <Text fw={600}>Total: ₹{po.total_amount}</Text>
      </Group>
    </Stack>
  );
}

function CreatePoForm({ onSuccess }: { onSuccess: () => void }) {
  const [vendorId, setVendorId] = useState("");
  const [linkedIndentId, setLinkedIndentId] = useState<string | null>(null);
  const [isSyncingIndent, setIsSyncingIndent] = useState(false);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<CreatePoItemInput[]>([{ item_name: "", quantity_ordered: 1, unit_price: 0 }]);

  const { data: vendors } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => api.listVendors({ status: "active" }),
  });

  const { data: catalog } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => api.listStoreCatalog({ active_only: "true" }),
  });

  const { data: linkableIndents } = useQuery({
    queryKey: ["indent-requisitions", "procurement-linkable"],
    queryFn: async () => {
      const [approved, partiallyApproved, partiallyIssued] = await Promise.all([
        api.listIndentRequisitions({ status: "approved", page: "1", per_page: "50" }),
        api.listIndentRequisitions({ status: "partially_approved", page: "1", per_page: "50" }),
        api.listIndentRequisitions({ status: "partially_issued", page: "1", per_page: "50" }),
      ]);

      const merged = [
        ...approved.requisitions,
        ...partiallyApproved.requisitions,
        ...partiallyIssued.requisitions,
      ];

      const seen = new Set<string>();
      return merged.filter((requisition) => {
        if (seen.has(requisition.id)) {
          return false;
        }
        seen.add(requisition.id);
        return poLinkableIndentStatuses.has(requisition.status);
      });
    },
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.createPurchaseOrder({
        vendor_id: vendorId,
        indent_requisition_id: linkedIndentId ?? undefined,
        notes: notes || undefined,
        items,
      }),
    onSuccess: () => {
      notifications.show({ title: "Created", message: "Purchase order created", color: "success" });
      onSuccess();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  const addItem = () => setItems([...items, { item_name: "", quantity_ordered: 1, unit_price: 0 }]);
  const removeItem = (idx: number) => { if (items.length > 1) setItems(items.filter((_, i) => i !== idx)); };
  const updateItem = (idx: number, field: string, value: unknown) => {
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const syncLinkedIndent = async (value: string | null) => {
    setLinkedIndentId(value);

    if (!value) {
      return;
    }

    setIsSyncingIndent(true);
    try {
      const detail = await api.getIndentRequisition(value);
      const syncedItems = detail.items
        .map((item) => ({
          catalog_item_id: item.catalog_item_id ?? undefined,
          item_name: item.item_name,
          item_code: undefined,
          unit: undefined,
          quantity_ordered: item.quantity_approved - item.quantity_issued,
          unit_price: Number(item.unit_price ?? 0),
          indent_item_id: item.id,
          notes: item.notes ?? undefined,
        }))
        .filter((item) => item.quantity_ordered > 0);

      setItems(syncedItems.length > 0 ? syncedItems : [{ item_name: "", quantity_ordered: 1, unit_price: 0 }]);
      if (!notes.trim()) {
        setNotes(`Linked to indent ${detail.requisition.indent_number}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load linked indent";
      notifications.show({
        title: "Indent sync failed",
        message,
        color: "danger",
      });
    } finally {
      setIsSyncingIndent(false);
    }
  };

  return (
    <Stack>
      <Select
        label="Vendor"
        placeholder="Select vendor"
        data={(vendors ?? []).map((v) => ({ value: v.id, label: `${v.code} - ${v.name}` }))}
        value={vendorId}
        onChange={(v) => setVendorId(v ?? "")}
        searchable
        required
      />
      <Select
        label="Linked Indent"
        description="Optional cross-module link. Selecting an indent syncs approved items into this PO."
        placeholder="Select approved indent"
        data={(linkableIndents ?? []).map((requisition) => ({
          value: requisition.id,
          label: formatLinkedIndentLabel(requisition),
        }))}
        value={linkedIndentId}
        onChange={(value) => {
          void syncLinkedIndent(value);
        }}
        searchable
        clearable
      />
      {linkedIndentId && (
        <Text size="xs" c="dimmed">
          {isSyncingIndent
            ? "Syncing indent items into the PO..."
            : "PO items are linked back to the indent requisition for downstream tracking."}
        </Text>
      )}
      <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />

      <Text fw={600}>Items</Text>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item</Table.Th>
            <Table.Th>Catalog</Table.Th>
            <Table.Th>Qty</Table.Th>
            <Table.Th>Price</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item, idx) => (
            <Table.Tr key={idx}>
              <Table.Td>
                <TextInput size="xs" value={item.item_name} onChange={(e) => updateItem(idx, "item_name", e.currentTarget.value)} required />
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
                <NumberInput size="xs" w={80} min={1} value={item.quantity_ordered} onChange={(v) => updateItem(idx, "quantity_ordered", Number(v))} />
              </Table.Td>
              <Table.Td>
                <NumberInput size="xs" w={100} min={0} decimalScale={2} value={item.unit_price} onChange={(v) => updateItem(idx, "unit_price", Number(v))} />
              </Table.Td>
              <Table.Td>
                <ActionIcon variant="subtle" color="danger" size="sm" onClick={() => removeItem(idx)}>×</ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Button variant="outline" size="xs" leftSection={<IconPlus size={14} />} onClick={addItem} w="fit-content">Add Item</Button>

      <Button loading={mutation.isPending} onClick={() => mutation.mutate()} disabled={!vendorId || items.every((i) => !i.item_name)}>
        Create PO
      </Button>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  GRN Panel
// ══════════════════════════════════════════════════════════

function GrnPanel({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const { data, isLoading } = useQuery({
    queryKey: ["grns", page],
    queryFn: () => api.listGrns({ page: String(page), per_page: "20" }),
  });

  const columns = [
    { key: "grn_number", label: "GRN #", render: (row: GoodsReceiptNote) => <Text fw={600}>{row.grn_number}</Text> },
    {
      key: "status",
      label: "Status",
      render: (row: GoodsReceiptNote) => (
        <Badge color={grnStatusColors[row.status] ?? "slate"} variant="light" size="sm">
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    { key: "total_amount", label: "Amount", render: (row: GoodsReceiptNote) => `₹${row.total_amount}` },
    { key: "receipt_date", label: "Receipt Date", render: (row: GoodsReceiptNote) => row.receipt_date },
    { key: "invoice_number", label: "Invoice", render: (row: GoodsReceiptNote) => row.invoice_number ?? "-" },
    {
      key: "actions",
      label: "",
      render: (row: GoodsReceiptNote) => (
        <Tooltip label="View">
          <ActionIcon variant="subtle" onClick={() => { setDetailId(row.id); openDetail(); }}>
            <IconEye size={16} />
          </ActionIcon>
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      {canCreate && (
        <Group justify="flex-end" mb="md">
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>New GRN</Button>
        </Group>
      )}

      <DataTable
        columns={columns}
        data={data?.grns ?? []}
        loading={isLoading}
        page={page}
        totalPages={Math.ceil((data?.total ?? 0) / 20)}
        onPageChange={setPage}
        rowKey={(row) => row.id}
        emptyTitle="No goods receipt notes"
      />

      <Drawer opened={createOpened} onClose={closeCreate} title="Create GRN" position="right" size="xl">
        <CreateGrnForm
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["grns"] });
            queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
            closeCreate();
          }}
        />
      </Drawer>

      <Drawer opened={detailOpened} onClose={closeDetail} title="GRN Details" position="right" size="lg">
        {detailId && <GrnDetailView id={detailId} />}
      </Drawer>
    </>
  );
}

function GrnDetailView({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["grn", id],
    queryFn: () => api.getGrn(id),
  });

  if (isLoading || !data) return <Text>Loading...</Text>;

  return (
    <Stack>
      <Group>
        <Badge color={grnStatusColors[data.grn.status]} variant="filled">{data.grn.status}</Badge>
        <Text size="sm" c="dimmed">GRN #{data.grn.grn_number}</Text>
      </Group>
      <Text size="sm">Receipt Date: {data.grn.receipt_date}</Text>
      {data.grn.invoice_number && <Text size="sm">Invoice: {data.grn.invoice_number}</Text>}

      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item</Table.Th>
            <Table.Th>Received</Table.Th>
            <Table.Th>Accepted</Table.Th>
            <Table.Th>Rejected</Table.Th>
            <Table.Th>Batch</Table.Th>
            <Table.Th>Expiry</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.items.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td>{item.item_name}</Table.Td>
              <Table.Td>{item.quantity_received}</Table.Td>
              <Table.Td><Text c="success">{item.quantity_accepted}</Text></Table.Td>
              <Table.Td>{item.quantity_rejected > 0 ? <Text c="danger">{item.quantity_rejected}</Text> : "-"}</Table.Td>
              <Table.Td>{item.batch_number ?? "-"}</Table.Td>
              <Table.Td>{item.expiry_date ?? "-"}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Text fw={600}>Total: ₹{data.grn.total_amount}</Text>
    </Stack>
  );
}

function CreateGrnForm({ onSuccess }: { onSuccess: () => void }) {
  const [poId, setPoId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<CreateGrnItemInput[]>([
    { item_name: "", quantity_received: 1, quantity_accepted: 1, unit_price: 0 },
  ]);

  const { data: poData } = useQuery({
    queryKey: ["purchase-orders", "receivable"],
    queryFn: () => api.listPurchaseOrders({ status: "sent_to_vendor", per_page: "100" }),
  });

  const poDetailQuery = useQuery({
    queryKey: ["purchase-order", poId],
    queryFn: () => api.getPurchaseOrder(poId),
    enabled: !!poId,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.createGrn({
        po_id: poId,
        invoice_number: invoiceNumber || undefined,
        notes: notes || undefined,
        items,
      }),
    onSuccess: () => {
      notifications.show({ title: "Created", message: "GRN created and stock updated", color: "success" });
      onSuccess();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  const updateItem = (idx: number, field: string, value: unknown) => {
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  // Auto-populate items when PO is selected
  const handlePoSelect = (v: string | null) => {
    setPoId(v ?? "");
    if (v && poDetailQuery.data) {
      setItems(
        poDetailQuery.data.items.map((pi) => ({
          po_item_id: pi.id,
          catalog_item_id: pi.catalog_item_id ?? undefined,
          item_name: pi.item_name,
          quantity_received: pi.quantity_ordered - pi.quantity_received,
          quantity_accepted: pi.quantity_ordered - pi.quantity_received,
          unit_price: pi.unit_price as unknown as number,
        })),
      );
    }
  };

  return (
    <Stack>
      <Select
        label="Purchase Order"
        placeholder="Select PO to receive against"
        data={(poData?.purchase_orders ?? []).map((po) => ({ value: po.id, label: `${po.po_number} - ₹${po.total_amount}` }))}
        value={poId}
        onChange={handlePoSelect}
        searchable
        required
      />
      <TextInput label="Invoice Number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.currentTarget.value)} />
      <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />

      <Text fw={600}>Items</Text>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item</Table.Th>
            <Table.Th>Received</Table.Th>
            <Table.Th>Accepted</Table.Th>
            <Table.Th>Batch</Table.Th>
            <Table.Th>Expiry</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item, idx) => (
            <Table.Tr key={idx}>
              <Table.Td><Text size="sm">{item.item_name || "-"}</Text></Table.Td>
              <Table.Td>
                <NumberInput size="xs" w={80} min={0} value={item.quantity_received} onChange={(v) => updateItem(idx, "quantity_received", Number(v))} />
              </Table.Td>
              <Table.Td>
                <NumberInput size="xs" w={80} min={0} max={item.quantity_received} value={item.quantity_accepted} onChange={(v) => updateItem(idx, "quantity_accepted", Number(v))} />
              </Table.Td>
              <Table.Td>
                <TextInput size="xs" w={100} placeholder="Batch #" value={item.batch_number ?? ""} onChange={(e) => updateItem(idx, "batch_number", e.currentTarget.value)} />
              </Table.Td>
              <Table.Td>
                <TextInput size="xs" w={120} placeholder="YYYY-MM-DD" value={item.expiry_date ?? ""} onChange={(e) => updateItem(idx, "expiry_date", e.currentTarget.value)} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Button loading={mutation.isPending} onClick={() => mutation.mutate()} disabled={!poId}>
        Create GRN
      </Button>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Rate Contracts Panel
// ══════════════════════════════════════════════════════════

function RateContractPanel({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["rate-contracts"],
    queryFn: () => api.listRateContracts(),
  });

  const columns = [
    { key: "contract_number", label: "Contract #", render: (row: RateContract) => <Text fw={600}>{row.contract_number}</Text> },
    {
      key: "status",
      label: "Status",
      render: (row: RateContract) => (
        <Badge color={rcStatusColors[row.status] ?? "slate"} variant="light" size="sm">{row.status}</Badge>
      ),
    },
    { key: "start_date", label: "Start", render: (row: RateContract) => row.start_date },
    { key: "end_date", label: "End", render: (row: RateContract) => row.end_date },
    { key: "notes", label: "Notes", render: (row: RateContract) => row.notes ?? "-" },
  ];

  return (
    <>
      {canManage && (
        <Group justify="flex-end" mb="md">
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>New Contract</Button>
        </Group>
      )}

      <DataTable
        columns={columns}
        data={contracts ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyTitle="No rate contracts"
      />

      <Drawer opened={createOpened} onClose={closeCreate} title="Create Rate Contract" position="right" size="lg">
        <CreateRcForm
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["rate-contracts"] });
            closeCreate();
          }}
        />
      </Drawer>
    </>
  );
}

function CreateRcForm({ onSuccess }: { onSuccess: () => void }) {
  const [vendorId, setVendorId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<CreateRcItemInput[]>([{ catalog_item_id: "", contracted_price: 0 }]);

  const { data: vendors } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => api.listVendors({ status: "active" }),
  });

  const { data: catalog } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => api.listStoreCatalog({ active_only: "true" }),
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.createRateContract({
        vendor_id: vendorId,
        start_date: startDate,
        end_date: endDate,
        notes: notes || undefined,
        items,
      }),
    onSuccess: () => {
      notifications.show({ title: "Created", message: "Rate contract created", color: "success" });
      onSuccess();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  return (
    <Stack>
      <Select
        label="Vendor"
        data={(vendors ?? []).map((v) => ({ value: v.id, label: `${v.code} - ${v.name}` }))}
        value={vendorId}
        onChange={(v) => setVendorId(v ?? "")}
        searchable
        required
      />
      <TextInput label="Start Date" placeholder="YYYY-MM-DD" value={startDate} onChange={(e) => setStartDate(e.currentTarget.value)} required />
      <TextInput label="End Date" placeholder="YYYY-MM-DD" value={endDate} onChange={(e) => setEndDate(e.currentTarget.value)} required />
      <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />

      <Text fw={600}>Contract Items</Text>
      {items.map((item, idx) => (
        <Group key={idx}>
          <Select
            size="xs"
            placeholder="Catalog item"
            data={(catalog ?? []).map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
            value={item.catalog_item_id}
            onChange={(v) => {
              setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, catalog_item_id: v ?? "" } : it)));
            }}
            searchable
            style={{ flex: 1 }}
          />
          <NumberInput
            size="xs"
            w={100}
            label="Price"
            min={0}
            decimalScale={2}
            value={item.contracted_price}
            onChange={(v) => {
              setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, contracted_price: Number(v) } : it)));
            }}
          />
        </Group>
      ))}
      <Button variant="outline" size="xs" onClick={() => setItems([...items, { catalog_item_id: "", contracted_price: 0 }])} w="fit-content">
        Add Item
      </Button>

      <Button loading={mutation.isPending} onClick={() => mutation.mutate()} disabled={!vendorId || !startDate || !endDate}>
        Create Contract
      </Button>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Batch Stock Panel
// ══════════════════════════════════════════════════════════

function BatchStockPanel() {
  const { data: batches, isLoading } = useQuery({
    queryKey: ["batch-stock"],
    queryFn: () => api.listBatchStock(),
  });

  const columns = [
    { key: "batch_number", label: "Batch", render: (row: BatchStock) => <Text fw={600}>{row.batch_number}</Text> },
    { key: "serial_number", label: "Serial #", render: (row: BatchStock) => row.serial_number ?? "-" },
    { key: "quantity", label: "Qty", render: (row: BatchStock) => row.quantity },
    { key: "unit_cost", label: "Cost", render: (row: BatchStock) => `₹${row.unit_cost}` },
    {
      key: "expiry_date",
      label: "Expiry",
      render: (row: BatchStock) => {
        if (!row.expiry_date) return "-";
        const isExpiring = new Date(row.expiry_date) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        return <Text c={isExpiring ? "danger" : undefined} fw={isExpiring ? 600 : undefined}>{row.expiry_date}</Text>;
      },
    },
    {
      key: "is_consignment",
      label: "Consignment",
      render: (row: BatchStock) => row.is_consignment ? <Badge color="orange" size="sm">Yes</Badge> : "-",
    },
    { key: "created_at", label: "Received", render: (row: BatchStock) => new Date(row.created_at).toLocaleDateString() },
  ];

  return (
    <DataTable
      columns={columns}
      data={batches ?? []}
      loading={isLoading}
      rowKey={(row) => row.id}
      emptyTitle="No batch stock records"
    />
  );
}

// ══════════════════════════════════════════════════════════
//  Store Locations Panel
// ══════════════════════════════════════════════════════════

function StoreLocationPanel() {
  const queryClient = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data: locations, isLoading } = useQuery({
    queryKey: ["store-locations"],
    queryFn: () => api.listStoreLocations(),
  });

  const columns = [
    { key: "code", label: "Code", render: (row: StoreLocation) => <Text fw={600}>{row.code}</Text> },
    { key: "name", label: "Name", render: (row: StoreLocation) => row.name },
    { key: "location_type", label: "Type", render: (row: StoreLocation) => <Badge variant="outline" size="sm">{row.location_type}</Badge> },
    {
      key: "is_active",
      label: "Active",
      render: (row: StoreLocation) => <Badge color={row.is_active ? "success" : "slate"} size="sm">{row.is_active ? "Yes" : "No"}</Badge>,
    },
    { key: "address", label: "Address", render: (row: StoreLocation) => row.address ?? "-" },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Add Location</Button>
      </Group>

      <DataTable
        columns={columns}
        data={locations ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyTitle="No store locations"
      />

      <Drawer opened={createOpened} onClose={closeCreate} title="Add Store Location" position="right" size="md">
        <StoreLocationForm
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["store-locations"] });
            closeCreate();
          }}
        />
      </Drawer>
    </>
  );
}

function StoreLocationForm({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [locationType, setLocationType] = useState("main_store");
  const [address, setAddress] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.createStoreLocation({
        code,
        name,
        location_type: locationType,
        address: address || undefined,
      }),
    onSuccess: () => {
      notifications.show({ title: "Created", message: "Store location created", color: "success" });
      onSuccess();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  return (
    <Stack>
      <TextInput label="Code" value={code} onChange={(e) => setCode(e.currentTarget.value)} required />
      <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
      <Select
        label="Type"
        data={[
          { value: "main_store", label: "Main Store" },
          { value: "sub_store", label: "Sub Store" },
          { value: "department_store", label: "Department Store" },
          { value: "pharmacy_store", label: "Pharmacy Store" },
          { value: "warehouse", label: "Warehouse" },
        ]}
        value={locationType}
        onChange={(v) => setLocationType(v ?? "main_store")}
      />
      <Textarea label="Address" value={address} onChange={(e) => setAddress(e.currentTarget.value)} />
      <Button loading={mutation.isPending} onClick={() => mutation.mutate()} disabled={!code || !name}>
        Create Location
      </Button>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Vendor Performance Panel
// ══════════════════════════════════════════════════════════

function VendorPerformancePanel() {
  const [compareOpened, { open: openCompare, close: closeCompare }] = useDisclosure(false);
  const [compareItemId, setCompareItemId] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-performance"],
    queryFn: () => api.getVendorPerformance(),
  });

  const columns = [
    {
      key: "vendor_name",
      label: "Vendor",
      render: (row: VendorPerformanceRow) => <Text fw={600}>{row.vendor_name}</Text>,
    },
    {
      key: "total_orders",
      label: "Orders",
      render: (row: VendorPerformanceRow) => row.total_orders,
    },
    {
      key: "on_time_pct",
      label: "On-Time %",
      render: (row: VendorPerformanceRow) => {
        const pct = Number(row.on_time_pct);
        const color = pct >= 80 ? "success" : pct >= 60 ? "warning" : "danger";
        return (
          <Badge color={color} variant="light">
            {row.on_time_pct}%
          </Badge>
        );
      },
    },
    {
      key: "rejection_rate",
      label: "Rejection Rate",
      render: (row: VendorPerformanceRow) => {
        const rate = Number(row.rejection_rate);
        const color = rate <= 5 ? "success" : rate <= 15 ? "warning" : "danger";
        return (
          <Badge color={color} variant="light">
            {row.rejection_rate}%
          </Badge>
        );
      },
    },
    {
      key: "avg_delivery_days",
      label: "Avg Delivery (days)",
      render: (row: VendorPerformanceRow) => row.avg_delivery_days,
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button variant="outline" leftSection={<IconChartBar size={16} />} onClick={openCompare}>
          Compare Vendors
        </Button>
      </Group>

      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        rowKey={(row) => row.vendor_name}
        emptyTitle="No vendor performance data"
      />

      <Modal opened={compareOpened} onClose={closeCompare} title="Compare Vendors by Item" size="lg">
        <VendorComparisonView itemId={compareItemId} onItemChange={setCompareItemId} />
      </Modal>
    </>
  );
}

function VendorComparisonView({
  itemId,
  onItemChange,
}: {
  itemId: string;
  onItemChange: (id: string) => void;
}) {
  const { data: catalog } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => api.listStoreCatalog({ active_only: "true" }),
  });

  const { data: comparison, isLoading } = useQuery({
    queryKey: ["vendor-comparison", itemId],
    queryFn: () => api.getVendorComparison(itemId),
    enabled: !!itemId,
  });

  const columns = [
    {
      key: "vendor_name",
      label: "Vendor",
      render: (row: VendorComparisonRow) => <Text fw={600}>{row.vendor_name}</Text>,
    },
    {
      key: "item_name",
      label: "Item",
      render: (row: VendorComparisonRow) => row.item_name,
    },
    {
      key: "unit_price",
      label: "Unit Price",
      render: (row: VendorComparisonRow) => `₹${row.unit_price}`,
    },
    {
      key: "delivery_days",
      label: "Delivery (days)",
      render: (row: VendorComparisonRow) => row.delivery_days ?? "-",
    },
    {
      key: "rejection_rate",
      label: "Rejection Rate",
      render: (row: VendorComparisonRow) => {
        if (row.rejection_rate == null) return "-";
        const rate = Number(row.rejection_rate);
        const color = rate <= 5 ? "success" : rate <= 15 ? "warning" : "danger";
        return (
          <Badge color={color} variant="light" size="sm">
            {row.rejection_rate}%
          </Badge>
        );
      },
    },
  ];

  return (
    <Stack>
      <Select
        label="Select Catalog Item"
        placeholder="Choose an item to compare vendors"
        data={(catalog ?? []).map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
        value={itemId || null}
        onChange={(v) => onItemChange(v ?? "")}
        searchable
      />

      {itemId && (
        <DataTable
          columns={columns}
          data={comparison ?? []}
          loading={isLoading}
          rowKey={(row) => `${row.vendor_name}-${row.item_name}`}
          emptyTitle="No comparison data for this item"
        />
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Supplier Payments Panel
// ══════════════════════════════════════════════════════════

const paymentStatusColors: Record<string, string> = {
  pending: "orange",
  partially_paid: "primary",
  paid: "success",
  overdue: "danger",
  disputed: "violet",
};

function SupplierPaymentsPanel() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(P.PROCUREMENT.PAYMENTS_MANAGE);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data, isLoading } = useQuery({
    queryKey: ["supplier-payments"],
    queryFn: () => api.listSupplierPayments(),
  });

  const columns = [
    {
      key: "payment_number",
      label: "Payment #",
      render: (row: SupplierPayment) => <Text fw={600}>{row.payment_number}</Text>,
    },
    {
      key: "invoice_amount",
      label: "Invoice",
      render: (row: SupplierPayment) => `₹${row.invoice_amount}`,
    },
    {
      key: "paid_amount",
      label: "Paid",
      render: (row: SupplierPayment) => `₹${row.paid_amount}`,
    },
    {
      key: "balance_amount",
      label: "Balance",
      render: (row: SupplierPayment) => `₹${row.balance_amount}`,
    },
    {
      key: "status",
      label: "Status",
      render: (row: SupplierPayment) => (
        <Badge color={paymentStatusColors[row.status] ?? "slate"} variant="light" size="sm">
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "due_date",
      label: "Due Date",
      render: (row: SupplierPayment) => {
        if (!row.due_date) return "-";
        const overdue = new Date(row.due_date) < new Date() && row.status !== "paid";
        return (
          <Text c={overdue ? "danger" : undefined} fw={overdue ? 600 : undefined}>
            {row.due_date}
          </Text>
        );
      },
    },
    {
      key: "payment_date",
      label: "Payment Date",
      render: (row: SupplierPayment) => row.payment_date ?? "-",
    },
  ];

  return (
    <>
      {canManage && (
        <Group justify="flex-end" mb="md">
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New Payment
          </Button>
        </Group>
      )}

      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyTitle="No supplier payments"
      />

      <Drawer opened={createOpened} onClose={closeCreate} title="Record Payment" position="right" size="md">
        <CreatePaymentForm
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["supplier-payments"] });
            closeCreate();
          }}
        />
      </Drawer>
    </>
  );
}

function CreatePaymentForm({ onSuccess }: { onSuccess: () => void }) {
  const [vendorId, setVendorId] = useState("");
  const [poId, setPoId] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  const { data: vendors } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => api.listVendors({ status: "active" }),
  });

  const { data: poData } = useQuery({
    queryKey: ["purchase-orders", "for-vendor", vendorId],
    queryFn: () => api.listPurchaseOrders({ vendor_id: vendorId, per_page: "100" }),
    enabled: !!vendorId,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.createSupplierPayment({
        vendor_id: vendorId,
        po_id: poId || undefined,
        invoice_amount: invoiceAmount,
        paid_amount: paidAmount || undefined,
        due_date: dueDate || undefined,
        payment_method: paymentMethod || undefined,
        reference_number: referenceNumber || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      notifications.show({ title: "Created", message: "Payment recorded", color: "success" });
      onSuccess();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  return (
    <Stack>
      <Select
        label="Vendor"
        placeholder="Select vendor"
        data={(vendors ?? []).map((v) => ({ value: v.id, label: `${v.code} - ${v.name}` }))}
        value={vendorId || null}
        onChange={(v) => { setVendorId(v ?? ""); setPoId(""); }}
        searchable
        required
      />
      <Select
        label="Purchase Order (optional)"
        placeholder="Link to PO"
        data={(poData?.purchase_orders ?? []).map((po) => ({
          value: po.id,
          label: `${po.po_number} - ₹${po.total_amount}`,
        }))}
        value={poId || null}
        onChange={(v) => setPoId(v ?? "")}
        searchable
        clearable
        disabled={!vendorId}
      />
      <NumberInput
        label="Invoice Amount"
        min={0}
        decimalScale={2}
        value={invoiceAmount}
        onChange={(v) => setInvoiceAmount(Number(v))}
        required
      />
      <NumberInput
        label="Paid Amount"
        min={0}
        decimalScale={2}
        value={paidAmount}
        onChange={(v) => setPaidAmount(Number(v))}
      />
      <TextInput
        label="Due Date"
        placeholder="YYYY-MM-DD"
        value={dueDate}
        onChange={(e) => setDueDate(e.currentTarget.value)}
      />
      <Select
        label="Payment Method"
        placeholder="Select method"
        data={[
          { value: "bank_transfer", label: "Bank Transfer" },
          { value: "cheque", label: "Cheque" },
          { value: "cash", label: "Cash" },
          { value: "upi", label: "UPI" },
          { value: "demand_draft", label: "Demand Draft" },
        ]}
        value={paymentMethod || null}
        onChange={(v) => setPaymentMethod(v ?? "")}
        clearable
      />
      <TextInput
        label="Reference Number"
        placeholder="Txn / Cheque number"
        value={referenceNumber}
        onChange={(e) => setReferenceNumber(e.currentTarget.value)}
      />
      <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
      <Button loading={mutation.isPending} onClick={() => mutation.mutate()} disabled={!vendorId || invoiceAmount <= 0}>
        Record Payment
      </Button>
    </Stack>
  );
}
