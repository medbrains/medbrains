import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  type ProcurementGrnFormInput,
  type ProcurementPurchaseOrderFormInput,
  type ProcurementRateContractFormInput,
  procurementGrnFormSchema,
  procurementPurchaseOrderFormSchema,
  procurementRateContractFormSchema,
} from "@medbrains/schemas";
import { useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import type {
  CreateGrnItemInput,
  CreatePoItemInput,
  CreateRcItemInput,
  GoodsReceiptNote,
  IndentRequisition,
  PurchaseOrder,
  PurchaseOrderItem,
  RateContract,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconBuildingWarehouse,
  IconCash,
  IconChartBar,
  IconContract,
  IconEye,
  IconFileInvoice,
  IconPackage,
  IconPlus,
  IconReceipt,
  IconTruck,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { DataTable, PageHeader, TableValueBadge, VendorSearchSelect } from "@/components";
import { ConsignmentPanel } from "@/components/Procurement/ConsignmentPanel";
import { Badge, Button, IconButton, Table, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { procurementService } from "@/services/procurement.service";
import { BatchStockPanel } from "./procurement/batch-stock-panel";
import {
  colorToBadgeTone,
  formNumber,
  optionalText,
  requiredFormNumber,
} from "./procurement/shared";
import { StoreLocationPanel } from "./procurement/store-location-panel";
import { SupplierPaymentsPanel } from "./procurement/supplier-payments-panel";
import { VendorPanel } from "./procurement/vendor-panel";
import { VendorPerformancePanel } from "./procurement/vendor-performance-panel";

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

const rcStatusColors: Record<string, string> = {
  draft: "slate",
  active: "success",
  expired: "orange",
  terminated: "danger",
};

const poLinkableIndentStatuses = new Set(["approved", "partially_approved", "partially_issued"]);

const emptyPoItem = (): ProcurementPurchaseOrderFormInput["items"][number] => ({
  catalog_item_id: null,
  item_name: "",
  item_code: "",
  unit: "",
  quantity_ordered: 1,
  unit_price: 0,
  tax_percent: "",
  discount_percent: "",
  indent_item_id: null,
  notes: "",
});

const emptyGrnItem = (): ProcurementGrnFormInput["items"][number] => ({
  po_item_id: null,
  catalog_item_id: null,
  item_name: "",
  quantity_received: 1,
  quantity_accepted: 1,
  quantity_rejected: 0,
  batch_number: "",
  expiry_date: "",
  manufacture_date: "",
  unit_price: 0,
  rejection_reason: "",
  notes: "",
});

const emptyRcItem = (): ProcurementRateContractFormInput["items"][number] => ({
  catalog_item_id: "",
  contracted_price: 0,
  max_quantity: "",
  notes: "",
});

const toPoItemInput = (
  item: ProcurementPurchaseOrderFormInput["items"][number],
): CreatePoItemInput => ({
  catalog_item_id: optionalText(item.catalog_item_id),
  item_name: item.item_name.trim(),
  item_code: optionalText(item.item_code),
  unit: optionalText(item.unit),
  quantity_ordered: requiredFormNumber(item.quantity_ordered),
  unit_price: requiredFormNumber(item.unit_price),
  tax_percent: formNumber(item.tax_percent),
  discount_percent: formNumber(item.discount_percent),
  indent_item_id: optionalText(item.indent_item_id),
  notes: optionalText(item.notes),
});

const toGrnItemInput = (item: ProcurementGrnFormInput["items"][number]): CreateGrnItemInput => ({
  po_item_id: optionalText(item.po_item_id),
  catalog_item_id: optionalText(item.catalog_item_id),
  item_name: item.item_name.trim(),
  quantity_received: requiredFormNumber(item.quantity_received),
  quantity_accepted: requiredFormNumber(item.quantity_accepted),
  quantity_rejected: requiredFormNumber(item.quantity_rejected),
  batch_number: optionalText(item.batch_number),
  expiry_date: optionalText(item.expiry_date),
  manufacture_date: optionalText(item.manufacture_date),
  unit_price: requiredFormNumber(item.unit_price),
  rejection_reason: optionalText(item.rejection_reason),
  notes: optionalText(item.notes),
});

const toRcItemInput = (
  item: ProcurementRateContractFormInput["items"][number],
): CreateRcItemInput => ({
  catalog_item_id: item.catalog_item_id,
  contracted_price: requiredFormNumber(item.contracted_price),
  max_quantity: formNumber(item.max_quantity),
  notes: optionalText(item.notes),
});

function formatLinkedIndentLabel(requisition: IndentRequisition) {
  return `${requisition.indent_number} • ${requisition.status.replace(/_/g, " ")}`;
}

const PROCUREMENT_PAGE_PERMISSIONS: readonly string[] = [
  P.PROCUREMENT.VENDORS_LIST,
  P.PROCUREMENT.PO_LIST,
  P.PROCUREMENT.GRN_LIST,
  P.PROCUREMENT.RC_LIST,
  P.PROCUREMENT.STORES_LIST,
  P.PROCUREMENT.STORES_MANAGE,
  P.PROCUREMENT.PAYMENTS_LIST,
  P.PROCUREMENT.PERFORMANCE_VIEW,
  P.INDENT.STOCK_MANAGE,
];

interface ProcurementTabConfig {
  value: string;
  label: string;
  icon: ReactNode;
}

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function ProcurementPage() {
  useRequirePermission(PROCUREMENT_PAGE_PERMISSIONS);

  const canViewVendors = useHasPermission(P.PROCUREMENT.VENDORS_LIST);
  const canViewPo = useHasPermission(P.PROCUREMENT.PO_LIST);
  const canViewGrn = useHasPermission(P.PROCUREMENT.GRN_LIST);
  const canViewRc = useHasPermission(P.PROCUREMENT.RC_LIST);
  const canViewBatchStock = useHasPermission(P.INDENT.STOCK_MANAGE);
  const canViewStores = useHasAnyPermission([
    P.PROCUREMENT.STORES_LIST,
    P.PROCUREMENT.STORES_MANAGE,
  ]);
  const canCreateVendorPermission = useHasPermission(P.PROCUREMENT.VENDORS_CREATE);
  const canCreatePoPermission = useHasPermission(P.PROCUREMENT.PO_CREATE);
  const canCreateGrnPermission = useHasPermission(P.PROCUREMENT.GRN_CREATE);
  const canManageRcPermission = useHasPermission(P.PROCUREMENT.RC_MANAGE);
  const canManageStores = useHasPermission(P.PROCUREMENT.STORES_MANAGE);
  const canViewPerformancePermission = useHasPermission(P.PROCUREMENT.PERFORMANCE_VIEW);
  const canViewPayments = useHasPermission(P.PROCUREMENT.PAYMENTS_LIST);
  const canManagePaymentsPermission = useHasPermission(P.PROCUREMENT.PAYMENTS_MANAGE);
  const canCreateVendor = canViewVendors && canCreateVendorPermission;
  const canCreatePo = canViewVendors && canViewPo && canCreatePoPermission;
  const canCreateGrn = canViewPo && canCreateGrnPermission;
  const canManageRc = canViewVendors && canManageRcPermission;
  const canViewPerformance = canViewVendors && canViewPerformancePermission;
  const canManagePayments = canViewVendors && canManagePaymentsPermission;

  const visibleTabs: ProcurementTabConfig[] = [];
  if (canViewVendors) {
    visibleTabs.push({
      value: "vendors",
      label: "Vendors",
      icon: <IconUsers size={16} />,
    });
  }
  if (canViewPo) {
    visibleTabs.push({
      value: "purchase-orders",
      label: "Purchase Orders",
      icon: <IconFileInvoice size={16} />,
    });
  }
  if (canViewGrn) {
    visibleTabs.push({
      value: "grn",
      label: "GRN",
      icon: <IconPackage size={16} />,
    });
  }
  if (canViewRc) {
    visibleTabs.push({
      value: "rate-contracts",
      label: "Rate Contracts",
      icon: <IconContract size={16} />,
    });
  }
  if (canViewBatchStock) {
    visibleTabs.push({
      value: "batch-stock",
      label: "Batch Stock",
      icon: <IconBuildingWarehouse size={16} />,
    });
  }
  if (canViewBatchStock) {
    visibleTabs.push({
      value: "consignment",
      label: "Consignment",
      icon: <IconReceipt size={16} />,
    });
  }
  if (canViewStores) {
    visibleTabs.push({
      value: "store-locations",
      label: "Store Locations",
      icon: <IconBuildingWarehouse size={16} />,
    });
  }
  if (canViewPerformance) {
    visibleTabs.push({
      value: "vendor-performance",
      label: "Vendor Performance",
      icon: <IconChartBar size={16} />,
    });
  }
  if (canViewPayments) {
    visibleTabs.push({
      value: "supplier-payments",
      label: "Supplier Payments",
      icon: <IconCash size={16} />,
    });
  }

  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const activeTab = visibleTabs.some((tab) => tab.value === selectedTab)
    ? selectedTab
    : (visibleTabs[0]?.value ?? null);

  return (
    <div>
      <PageHeader
        title="Procurement"
        subtitle="Vendors, purchase orders, GRN, rate contracts, and batch stock"
        icon={<IconTruck size={20} stroke={1.5} />}
        color="violet"
      />

      <Tabs value={activeTab} onChange={setSelectedTab}>
        <Tabs.List mb="md">
          {visibleTabs.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value} leftSection={tab.icon}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {canViewVendors && (
          <Tabs.Panel value="vendors">
            <VendorPanel canCreate={canCreateVendor} />
          </Tabs.Panel>
        )}
        {canViewPo && (
          <Tabs.Panel value="purchase-orders">
            <PurchaseOrderPanel canCreate={canCreatePo} />
          </Tabs.Panel>
        )}
        {canViewGrn && (
          <Tabs.Panel value="grn">
            <GrnPanel canCreate={canCreateGrn} />
          </Tabs.Panel>
        )}
        {canViewRc && (
          <Tabs.Panel value="rate-contracts">
            <RateContractPanel canManage={canManageRc} />
          </Tabs.Panel>
        )}
        {canViewBatchStock && (
          <Tabs.Panel value="batch-stock">
            <BatchStockPanel />
          </Tabs.Panel>
        )}
        {canViewBatchStock && (
          <Tabs.Panel value="consignment">
            <ConsignmentPanel />
          </Tabs.Panel>
        )}
        {canViewStores && (
          <Tabs.Panel value="store-locations">
            <StoreLocationPanel canManage={canManageStores} />
          </Tabs.Panel>
        )}
        {canViewPerformance && (
          <Tabs.Panel value="vendor-performance">
            <VendorPerformancePanel />
          </Tabs.Panel>
        )}
        {canViewPayments && (
          <Tabs.Panel value="supplier-payments">
            <SupplierPaymentsPanel canManage={canManagePayments} />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Vendors Panel
// ══════════════════════════════════════════════════════════

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
    queryFn: () => procurementService.listPurchaseOrders({ page: String(page), per_page: "20" }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => procurementService.approvePurchaseOrder(id),
    onSuccess: () => {
      toast.success("Purchase order approved", { title: "Approved" });
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => procurementService.sendPurchaseOrder(id),
    onSuccess: () => {
      toast.success("PO sent to vendor", { title: "Sent" });
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });

  const columns = [
    {
      key: "po_number",
      label: "PO #",
      render: (row: PurchaseOrder) => <Text fw={600}>{row.po_number}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: PurchaseOrder) => (
        <TableValueBadge
          value={row.status}
          kind="status"
          color={poStatusColors[row.status] ?? "slate"}
        />
      ),
    },
    {
      key: "total_amount",
      label: "Amount",
      render: (row: PurchaseOrder) => `₹${row.total_amount}`,
    },
    { key: "order_date", label: "Date", render: (row: PurchaseOrder) => row.order_date },
    {
      key: "expected_delivery",
      label: "Expected",
      render: (row: PurchaseOrder) => row.expected_delivery ?? "-",
    },
    {
      key: "actions",
      label: "",
      render: (row: PurchaseOrder) => (
        <Group gap={4}>
          <Tooltip label="View">
            <IconButton
              size={44}
              onClick={() => {
                setDetailId(row.id);
                openDetail();
              }}
              aria-label="View details"
            >
              <IconEye size={16} />
            </IconButton>
          </Tooltip>
          {row.status === "draft" && canApprove && (
            <Button
              tone="secondary"
              size="compact-xs"
              loading={approveMutation.isPending}
              onClick={() => approveMutation.mutate(row.id)}
            >
              Approve
            </Button>
          )}
          {row.status === "approved" && (
            <Button
              tone="secondary"
              size="compact-xs"
              loading={sendMutation.isPending}
              onClick={() => sendMutation.mutate(row.id)}
            >
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
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New PO
          </Button>
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

      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title="Create Purchase Order"
        closeButtonProps={{ "aria-label": "Close Create Purchase Order" }}
        position="right"
        size="xl"
      >
        <CreatePoForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
            closeCreate();
          }}
        />
      </Drawer>

      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title="Purchase Order Details"
        closeButtonProps={{ "aria-label": "Close Purchase Order Details" }}
        position="right"
        size="lg"
      >
        {detailId && <PoDetailView id={detailId} />}
      </Drawer>
    </>
  );
}

function PoDetailView({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["purchase-order", id],
    queryFn: () => procurementService.getPurchaseOrder(id),
  });

  const linkedIndentId = data?.purchase_order.indent_requisition_id ?? null;
  const linkedIndentQuery = useQuery({
    queryKey: ["indent-requisition", "procurement-link", linkedIndentId],
    queryFn: () => {
      if (!linkedIndentId) {
        throw new Error("Missing linked indent");
      }
      return procurementService.getIndentRequisition(linkedIndentId);
    },
    enabled: Boolean(linkedIndentId),
  });

  if (isLoading || !data) return <Text>Loading...</Text>;

  const { purchase_order: po, items } = data;
  const linkedIndent = linkedIndentQuery.data?.requisition;

  return (
    <Stack>
      <Group>
        <Badge tone={colorToBadgeTone(poStatusColors[po.status])} variant="filled">
          {po.status.replace(/_/g, " ")}
        </Badge>
        <Text size="sm" c="dimmed">
          PO #{po.po_number}
        </Text>
      </Group>

      <Text size="sm">Order Date: {po.order_date}</Text>
      {po.indent_requisition_id && (
        <Group gap="xs">
          <Text size="sm">Linked Indent:</Text>
          <Badge tone="info">{linkedIndent?.indent_number ?? po.indent_requisition_id}</Badge>
          {linkedIndent && (
            <Badge tone="neutral" variant="outline" size="sm">
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
  const [isSyncingIndent, setIsSyncingIndent] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ProcurementPurchaseOrderFormInput>({
    resolver: zodResolver(procurementPurchaseOrderFormSchema),
    defaultValues: {
      vendor_id: "",
      indent_requisition_id: null,
      notes: "",
      items: [emptyPoItem()],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const linkedIndentId = useWatch({ control, name: "indent_requisition_id" });

  const { data: catalog } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => procurementService.listStoreCatalog({ active_only: "true" }),
  });

  const { data: linkableIndents } = useQuery({
    queryKey: ["indent-requisitions", "procurement-linkable"],
    queryFn: async () => {
      const [approved, partiallyApproved, partiallyIssued] = await Promise.all([
        procurementService.listIndentRequisitions({
          status: "approved",
          page: "1",
          per_page: "50",
        }),
        procurementService.listIndentRequisitions({
          status: "partially_approved",
          page: "1",
          per_page: "50",
        }),
        procurementService.listIndentRequisitions({
          status: "partially_issued",
          page: "1",
          per_page: "50",
        }),
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
    mutationFn: (values: ProcurementPurchaseOrderFormInput) =>
      procurementService.createPurchaseOrder({
        vendor_id: values.vendor_id,
        indent_requisition_id: optionalText(values.indent_requisition_id),
        notes: optionalText(values.notes),
        items: values.items.map(toPoItemInput),
      }),
    onSuccess: () => {
      toast.success("Purchase order created", { title: "Created" });
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message, { title: "Error" });
    },
  });

  const addItem = () => append(emptyPoItem());
  const removeItem = (index: number) => {
    if (fields.length > 1) remove(index);
  };

  const syncLinkedIndent = async (value: string | null) => {
    setValue("indent_requisition_id", value, { shouldDirty: true, shouldValidate: true });

    if (!value) {
      return;
    }

    setIsSyncingIndent(true);
    try {
      const detail = await procurementService.getIndentRequisition(value);
      const syncedItems = detail.items
        .map((item) => ({
          catalog_item_id: item.catalog_item_id ?? null,
          item_name: item.item_name,
          item_code: "",
          unit: "",
          quantity_ordered: item.quantity_approved - item.quantity_issued,
          unit_price: Number(item.unit_price ?? 0),
          tax_percent: "",
          discount_percent: "",
          indent_item_id: item.id,
          notes: item.notes ?? "",
        }))
        .filter((item) => item.quantity_ordered > 0);

      setValue("items", syncedItems.length > 0 ? syncedItems : [emptyPoItem()], {
        shouldDirty: true,
        shouldValidate: true,
      });
      if (!getValues("notes").trim()) {
        setValue("notes", `Linked to indent ${detail.requisition.indent_number}`, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load linked indent";
      toast.error(message, { title: "Indent sync failed" });
    } finally {
      setIsSyncingIndent(false);
    }
  };

  return (
    <Stack component="form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <Controller
        control={control}
        name="vendor_id"
        render={({ field }) => (
          <VendorSearchSelect
            label="Vendor"
            placeholder="Select vendor"
            value={field.value}
            onChange={field.onChange}
            required
            error={errors.vendor_id?.message}
          />
        )}
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
        error={errors.indent_requisition_id?.message}
      />
      {linkedIndentId && (
        <Text size="xs" c="dimmed">
          {isSyncingIndent
            ? "Syncing indent items into the PO..."
            : "PO items are linked back to the indent requisition for downstream tracking."}
        </Text>
      )}
      <Textarea label="Notes" error={errors.notes?.message} {...register("notes")} />

      <Text fw={600}>Items</Text>
      {errors.items?.message && (
        <Text c="danger" size="sm">
          {errors.items.message}
        </Text>
      )}
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
          {fields.map((field, idx) => (
            <Table.Tr key={field.id}>
              <Table.Td>
                <Controller
                  control={control}
                  name={`items.${idx}.item_name`}
                  render={({ field: itemField }) => (
                    <TextInput
                      size="xs"
                      value={itemField.value}
                      onChange={itemField.onChange}
                      error={errors.items?.[idx]?.item_name?.message}
                      required
                    />
                  )}
                />
              </Table.Td>
              <Table.Td>
                <Controller
                  control={control}
                  name={`items.${idx}.catalog_item_id`}
                  render={({ field: itemField }) => (
                    <Select
                      size="xs"
                      placeholder="From catalog"
                      data={(catalog ?? []).map((c) => ({
                        value: c.id,
                        label: `${c.code} - ${c.name}`,
                      }))}
                      value={itemField.value}
                      onChange={(value) => {
                        itemField.onChange(value);
                        const cat = catalog?.find((candidate) => candidate.id === value);
                        if (cat) {
                          setValue(`items.${idx}.item_name`, cat.name, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          setValue(`items.${idx}.unit_price`, Number(cat.base_price), {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }
                      }}
                      searchable
                      clearable
                    />
                  )}
                />
              </Table.Td>
              <Table.Td>
                <Controller
                  control={control}
                  name={`items.${idx}.quantity_ordered`}
                  render={({ field: itemField }) => (
                    <NumberInput
                      size="xs"
                      w={80}
                      min={1}
                      value={itemField.value}
                      onChange={itemField.onChange}
                      error={errors.items?.[idx]?.quantity_ordered?.message}
                    />
                  )}
                />
              </Table.Td>
              <Table.Td>
                <Controller
                  control={control}
                  name={`items.${idx}.unit_price`}
                  render={({ field: itemField }) => (
                    <NumberInput
                      size="xs"
                      w={100}
                      min={0}
                      decimalScale={2}
                      value={itemField.value}
                      onChange={itemField.onChange}
                      error={errors.items?.[idx]?.unit_price?.message}
                    />
                  )}
                />
              </Table.Td>
              <Table.Td>
                <IconButton
                  tone="danger"
                  size={44}
                  aria-label={`Remove purchase order item ${idx + 1}`}
                  onClick={() => removeItem(idx)}
                >
                  ×
                </IconButton>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Button
        tone="secondary"
        size="xs"
        leftSection={<IconPlus size={14} />}
        onClick={addItem}
        w="fit-content"
      >
        Add Item
      </Button>

      <Button tone="primary" loading={mutation.isPending} type="submit">
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
    queryFn: () => procurementService.listGrns({ page: String(page), per_page: "20" }),
  });

  const columns = [
    {
      key: "grn_number",
      label: "GRN #",
      render: (row: GoodsReceiptNote) => <Text fw={600}>{row.grn_number}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: GoodsReceiptNote) => (
        <TableValueBadge
          value={row.status}
          kind="status"
          color={grnStatusColors[row.status] ?? "slate"}
        />
      ),
    },
    {
      key: "total_amount",
      label: "Amount",
      render: (row: GoodsReceiptNote) => `₹${row.total_amount}`,
    },
    {
      key: "receipt_date",
      label: "Receipt Date",
      render: (row: GoodsReceiptNote) => row.receipt_date,
    },
    {
      key: "invoice_number",
      label: "Invoice",
      render: (row: GoodsReceiptNote) => row.invoice_number ?? "-",
    },
    {
      key: "actions",
      label: "",
      render: (row: GoodsReceiptNote) => (
        <Tooltip label="View">
          <IconButton
            size={44}
            onClick={() => {
              setDetailId(row.id);
              openDetail();
            }}
            aria-label="View details"
          >
            <IconEye size={16} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      {canCreate && (
        <Group justify="flex-end" mb="md">
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New GRN
          </Button>
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

      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title="Create GRN"
        closeButtonProps={{ "aria-label": "Close Create GRN" }}
        position="right"
        size="xl"
      >
        <CreateGrnForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["grns"] });
            void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
            closeCreate();
          }}
        />
      </Drawer>

      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title="GRN Details"
        closeButtonProps={{ "aria-label": "Close GRN Details" }}
        position="right"
        size="lg"
      >
        {detailId && <GrnDetailView id={detailId} />}
      </Drawer>
    </>
  );
}

function GrnDetailView({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["grn", id],
    queryFn: () => procurementService.getGrn(id),
  });

  if (isLoading || !data) return <Text>Loading...</Text>;

  return (
    <Stack>
      <Group>
        <Badge tone={colorToBadgeTone(grnStatusColors[data.grn.status])} variant="filled">
          {data.grn.status}
        </Badge>
        <Text size="sm" c="dimmed">
          GRN #{data.grn.grn_number}
        </Text>
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
              <Table.Td>
                <Text c="success">{item.quantity_accepted}</Text>
              </Table.Td>
              <Table.Td>
                {item.quantity_rejected > 0 ? (
                  <Text c="danger">{item.quantity_rejected}</Text>
                ) : (
                  "-"
                )}
              </Table.Td>
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
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProcurementGrnFormInput>({
    resolver: zodResolver(procurementGrnFormSchema),
    defaultValues: {
      po_id: "",
      invoice_number: "",
      notes: "",
      items: [emptyGrnItem()],
    },
  });
  const { fields } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });

  const { data: poData } = useQuery({
    queryKey: ["purchase-orders", "receivable"],
    queryFn: () =>
      procurementService.listPurchaseOrders({ status: "sent_to_vendor", per_page: "100" }),
  });

  const mutation = useMutation({
    mutationFn: (values: ProcurementGrnFormInput) =>
      procurementService.createGrn({
        po_id: values.po_id,
        invoice_number: optionalText(values.invoice_number),
        notes: optionalText(values.notes),
        items: values.items.map(toGrnItemInput),
      }),
    onSuccess: () => {
      toast.success("GRN created and stock updated", { title: "Created" });
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message, { title: "Error" });
    },
  });

  const handlePoSelect = async (value: string | null) => {
    setValue("po_id", value ?? "", { shouldDirty: true, shouldValidate: true });
    if (!value) {
      setValue("items", [emptyGrnItem()], { shouldDirty: true, shouldValidate: true });
      return;
    }

    try {
      const detail = await procurementService.getPurchaseOrder(value);
      const receivableItems = detail.items
        .map((item) => {
          const remaining = item.quantity_ordered - item.quantity_received;
          return {
            po_item_id: item.id,
            catalog_item_id: item.catalog_item_id ?? null,
            item_name: item.item_name,
            quantity_received: remaining,
            quantity_accepted: remaining,
            quantity_rejected: 0,
            batch_number: "",
            expiry_date: "",
            manufacture_date: "",
            unit_price: Number(item.unit_price),
            rejection_reason: "",
            notes: "",
          };
        })
        .filter((item) => item.quantity_received > 0);

      setValue("items", receivableItems.length > 0 ? receivableItems : [emptyGrnItem()], {
        shouldDirty: true,
        shouldValidate: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load purchase order";
      toast.error(message, { title: "PO load failed" });
    }
  };

  return (
    <Stack component="form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <Controller
        control={control}
        name="po_id"
        render={({ field }) => (
          <Select
            label="Purchase Order"
            placeholder="Select PO to receive against"
            data={(poData?.purchase_orders ?? []).map((po) => ({
              value: po.id,
              label: `${po.po_number} - ₹${po.total_amount}`,
            }))}
            value={field.value}
            onChange={(value) => {
              void handlePoSelect(value);
            }}
            searchable
            required
            error={errors.po_id?.message}
          />
        )}
      />
      <TextInput
        label="Invoice Number"
        error={errors.invoice_number?.message}
        {...register("invoice_number")}
      />
      <Textarea label="Notes" error={errors.notes?.message} {...register("notes")} />

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
          {fields.map((field, idx) => (
            <Table.Tr key={field.id}>
              <Table.Td>
                <Text size="sm">{items?.[idx]?.item_name || "-"}</Text>
              </Table.Td>
              <Table.Td>
                <Controller
                  control={control}
                  name={`items.${idx}.quantity_received`}
                  render={({ field: itemField }) => (
                    <NumberInput
                      size="xs"
                      w={80}
                      min={1}
                      value={itemField.value}
                      onChange={itemField.onChange}
                      error={errors.items?.[idx]?.quantity_received?.message}
                    />
                  )}
                />
              </Table.Td>
              <Table.Td>
                <Controller
                  control={control}
                  name={`items.${idx}.quantity_accepted`}
                  render={({ field: itemField }) => (
                    <NumberInput
                      size="xs"
                      w={80}
                      min={0}
                      max={Number(items?.[idx]?.quantity_received ?? 0)}
                      value={itemField.value}
                      onChange={itemField.onChange}
                      error={errors.items?.[idx]?.quantity_accepted?.message}
                    />
                  )}
                />
              </Table.Td>
              <Table.Td>
                <TextInput
                  size="xs"
                  w={100}
                  placeholder="Batch #"
                  error={errors.items?.[idx]?.batch_number?.message}
                  {...register(`items.${idx}.batch_number`)}
                />
              </Table.Td>
              <Table.Td>
                <TextInput
                  size="xs"
                  w={120}
                  placeholder="YYYY-MM-DD"
                  error={errors.items?.[idx]?.expiry_date?.message}
                  {...register(`items.${idx}.expiry_date`)}
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Button tone="primary" loading={mutation.isPending} type="submit">
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
    queryFn: () => procurementService.listRateContracts(),
  });

  const columns = [
    {
      key: "contract_number",
      label: "Contract #",
      render: (row: RateContract) => <Text fw={600}>{row.contract_number}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: RateContract) => (
        <TableValueBadge
          value={row.status}
          kind="status"
          color={rcStatusColors[row.status] ?? "slate"}
        />
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
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New Contract
          </Button>
        </Group>
      )}

      <DataTable
        columns={columns}
        data={contracts ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyTitle="No rate contracts"
      />

      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title="Create Rate Contract"
        closeButtonProps={{ "aria-label": "Close Create Rate Contract" }}
        position="right"
        size="lg"
      >
        <CreateRcForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["rate-contracts"] });
            closeCreate();
          }}
        />
      </Drawer>
    </>
  );
}

function CreateRcForm({ onSuccess }: { onSuccess: () => void }) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProcurementRateContractFormInput>({
    resolver: zodResolver(procurementRateContractFormSchema),
    defaultValues: {
      vendor_id: "",
      start_date: "",
      end_date: "",
      notes: "",
      items: [emptyRcItem()],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const { data: catalog } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => procurementService.listStoreCatalog({ active_only: "true" }),
  });

  const mutation = useMutation({
    mutationFn: (values: ProcurementRateContractFormInput) =>
      procurementService.createRateContract({
        vendor_id: values.vendor_id,
        start_date: values.start_date,
        end_date: values.end_date,
        notes: optionalText(values.notes),
        items: values.items.map(toRcItemInput),
      }),
    onSuccess: () => {
      toast.success("Rate contract created", { title: "Created" });
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message, { title: "Error" });
    },
  });

  return (
    <Stack component="form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <Controller
        control={control}
        name="vendor_id"
        render={({ field }) => (
          <VendorSearchSelect
            label="Vendor"
            value={field.value}
            onChange={field.onChange}
            required
            error={errors.vendor_id?.message}
          />
        )}
      />
      <TextInput
        label="Start Date"
        placeholder="YYYY-MM-DD"
        required
        error={errors.start_date?.message}
        {...register("start_date")}
      />
      <TextInput
        label="End Date"
        placeholder="YYYY-MM-DD"
        required
        error={errors.end_date?.message}
        {...register("end_date")}
      />
      <Textarea label="Notes" error={errors.notes?.message} {...register("notes")} />

      <Text fw={600}>Contract Items</Text>
      {fields.map((field, idx) => (
        <Group key={field.id} align="flex-start">
          <Controller
            control={control}
            name={`items.${idx}.catalog_item_id`}
            render={({ field: itemField }) => (
              <Select
                size="xs"
                placeholder="Catalog item"
                data={(catalog ?? []).map((c) => ({
                  value: c.id,
                  label: `${c.code} - ${c.name}`,
                }))}
                value={itemField.value}
                onChange={(value) => itemField.onChange(value ?? "")}
                searchable
                error={errors.items?.[idx]?.catalog_item_id?.message}
                style={{ flex: 1 }}
              />
            )}
          />
          <Controller
            control={control}
            name={`items.${idx}.contracted_price`}
            render={({ field: itemField }) => (
              <NumberInput
                size="xs"
                w={120}
                label="Price"
                min={0}
                decimalScale={2}
                value={itemField.value}
                onChange={itemField.onChange}
                error={errors.items?.[idx]?.contracted_price?.message}
              />
            )}
          />
          <IconButton
            tone="danger"
            size={44}
            mt={24}
            aria-label={`Remove rate contract item ${idx + 1}`}
            onClick={() => {
              if (fields.length > 1) remove(idx);
            }}
          >
            ×
          </IconButton>
        </Group>
      ))}
      <Button tone="secondary" size="xs" onClick={() => append(emptyRcItem())} w="fit-content">
        Add Item
      </Button>

      <Button tone="primary" loading={mutation.isPending} type="submit">
        Create Contract
      </Button>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Batch Stock Panel
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Vendor Performance Panel
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Supplier Payments Panel
// ══════════════════════════════════════════════════════════
