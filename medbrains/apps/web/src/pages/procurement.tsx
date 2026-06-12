import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  type ProcurementGrnFormInput,
  type ProcurementPurchaseOrderFormInput,
  type ProcurementRateContractFormInput,
  type ProcurementStoreLocationFormInput,
  type ProcurementSupplierPaymentFormInput,
  type ProcurementVendorFormInput,
  procurementGrnFormSchema,
  procurementPurchaseOrderFormSchema,
  procurementRateContractFormSchema,
  procurementStoreLocationFormSchema,
  procurementSupplierPaymentFormSchema,
  procurementVendorFormSchema,
} from "@medbrains/schemas";
import { useHasAnyPermission, useHasPermission } from "@medbrains/stores";
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
import { type ReactNode, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { DataTable, PageHeader, TableValueBadge, VendorSearchSelect } from "@/components";
import { statusColor } from "@/lib/status-colors";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { procurementService } from "@/services/procurement.service";

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

const optionalText = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
};

const formNumber = (value: string | number | undefined | null) => {
  if (value == null || (typeof value === "string" && value.trim().length === 0)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const requiredFormNumber = (value: string | number) => Number(value);

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

function VendorPanel({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [detailVendor, setDetailVendor] = useState<Vendor | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => procurementService.listVendors(),
  });

  const columns = [
    { key: "code", label: "Code", render: (row: Vendor) => <Text fw={600}>{row.code}</Text> },
    { key: "name", label: "Name", render: (row: Vendor) => row.name },
    {
      key: "status",
      label: "Status",
      render: (row: Vendor) => (
        <TableValueBadge
          value={row.status}
          kind="status"
          color={statusColor(row.status) ?? "slate"}
        />
      ),
    },
    {
      key: "vendor_type",
      label: "Type",
      render: (row: Vendor) => (
        <TableValueBadge value={row.vendor_type} kind="store" variant="outline" />
      ),
    },
    { key: "contact_person", label: "Contact", render: (row: Vendor) => row.contact_person ?? "-" },
    { key: "phone", label: "Phone", render: (row: Vendor) => row.phone ?? "-" },
    { key: "city", label: "City", render: (row: Vendor) => row.city ?? "-" },
    { key: "gst_number", label: "GST", render: (row: Vendor) => row.gst_number ?? "-" },
    {
      key: "actions",
      label: "",
      render: (row: Vendor) => (
        <Tooltip label="View details">
          <ActionIcon
            variant="subtle"
            size={44}
            onClick={() => {
              setDetailVendor(row);
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
      {canCreate && (
        <Group justify="flex-end" mb="md">
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Add Vendor
          </Button>
        </Group>
      )}

      <DataTable
        columns={columns}
        data={vendors ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyTitle="No vendors found"
      />

      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title="Register New Vendor"
        closeButtonProps={{ "aria-label": "Close Register New Vendor" }}
        position="right"
        size="lg"
      >
        <VendorForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["vendors"] });
            closeCreate();
          }}
        />
      </Drawer>

      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title="Vendor Details"
        closeButtonProps={{ "aria-label": "Close Vendor Details" }}
        position="right"
        size="lg"
      >
        {detailVendor && (
          <Stack>
            <Group>
              <Badge color={statusColor(detailVendor.status)} variant="filled">
                {detailVendor.status}
              </Badge>
              <Badge variant="outline">{detailVendor.vendor_type}</Badge>
            </Group>
            <Text fw={600} size="lg">
              {detailVendor.name}
            </Text>
            {detailVendor.contact_person && (
              <Text size="sm">Contact: {detailVendor.contact_person}</Text>
            )}
            {detailVendor.phone && <Text size="sm">Phone: {detailVendor.phone}</Text>}
            {detailVendor.email && <Text size="sm">Email: {detailVendor.email}</Text>}
            {detailVendor.gst_number && <Text size="sm">GST: {detailVendor.gst_number}</Text>}
            {detailVendor.pan_number && <Text size="sm">PAN: {detailVendor.pan_number}</Text>}
            {detailVendor.drug_license_number && (
              <Text size="sm">Drug License: {detailVendor.drug_license_number}</Text>
            )}
            {detailVendor.city && (
              <Text size="sm">
                Location: {[detailVendor.city, detailVendor.state].filter(Boolean).join(", ")}
              </Text>
            )}
            <Text size="sm">Payment Terms: {detailVendor.payment_terms ?? "N/A"}</Text>
            <Text size="sm">
              Credit Limit: ₹{detailVendor.credit_limit} ({detailVendor.credit_days} days)
            </Text>
          </Stack>
        )}
      </Drawer>
    </>
  );
}

const SUPPLY_CATEGORIES = [
  { value: "pharmacy", label: "Pharmacy" },
  { value: "surgical", label: "Surgical" },
  { value: "general", label: "General Stores" },
  { value: "lab", label: "Laboratory" },
  { value: "radiology", label: "Radiology" },
  { value: "dietary", label: "Dietary / F&B" },
  { value: "it", label: "IT Equipment" },
  { value: "housekeeping", label: "Housekeeping" },
];

function VendorForm({ onSuccess }: { onSuccess: () => void }) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProcurementVendorFormInput>({
    resolver: zodResolver(procurementVendorFormSchema),
    defaultValues: {
      code: "",
      name: "",
      vendor_type: "supplier",
      contact_person: "",
      phone: "",
      email: "",
      city: "",
      gst_number: "",
      payment_terms: "net_30",
      supply_categories: [],
      drug_license_number: "",
      is_pharmacy_vendor: false,
      product_lines: "",
    },
  });

  const supplyCategories = useWatch({ control, name: "supply_categories" });

  const mutation = useMutation({
    mutationFn: (values: ProcurementVendorFormInput) =>
      procurementService.createVendor({
        code: values.code.trim(),
        name: values.name.trim(),
        vendor_type: values.vendor_type,
        contact_person: optionalText(values.contact_person),
        phone: optionalText(values.phone),
        email: optionalText(values.email),
        city: optionalText(values.city),
        gst_number: optionalText(values.gst_number),
        payment_terms: values.payment_terms,
        supply_categories:
          values.supply_categories.length > 0 ? values.supply_categories : undefined,
        drug_license_number: optionalText(values.drug_license_number),
        is_pharmacy_vendor: values.is_pharmacy_vendor || undefined,
        product_lines: optionalText(values.product_lines),
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
    <Stack component="form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <TextInput label="Vendor Code" required error={errors.code?.message} {...register("code")} />
      <TextInput label="Name" required error={errors.name?.message} {...register("name")} />
      <Controller
        control={control}
        name="vendor_type"
        render={({ field }) => (
          <Select
            label="Type"
            data={[
              { value: "supplier", label: "Supplier" },
              { value: "manufacturer", label: "Manufacturer" },
              { value: "distributor", label: "Distributor" },
              { value: "importer", label: "Importer" },
            ]}
            value={field.value}
            onChange={(value) => field.onChange(value ?? "supplier")}
            error={errors.vendor_type?.message}
          />
        )}
      />
      <TextInput
        label="Contact Person"
        error={errors.contact_person?.message}
        {...register("contact_person")}
      />
      <TextInput label="Phone" error={errors.phone?.message} {...register("phone")} />
      <TextInput label="Email" error={errors.email?.message} {...register("email")} />
      <TextInput label="City" error={errors.city?.message} {...register("city")} />
      <TextInput
        label="GST Number"
        error={errors.gst_number?.message}
        {...register("gst_number")}
      />
      <Controller
        control={control}
        name="payment_terms"
        render={({ field }) => (
          <Select
            label="Payment Terms"
            data={[
              { value: "net_30", label: "Net 30 Days" },
              { value: "net_60", label: "Net 60 Days" },
              { value: "net_90", label: "Net 90 Days" },
              { value: "advance", label: "Advance Payment" },
              { value: "cod", label: "Cash on Delivery" },
            ]}
            value={field.value}
            onChange={(value) => field.onChange(value ?? "net_30")}
            error={errors.payment_terms?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="supply_categories"
        render={({ field }) => (
          <MultiSelect
            label="Supply Categories"
            placeholder="Select categories this vendor supplies"
            data={SUPPLY_CATEGORIES}
            value={field.value}
            onChange={field.onChange}
            searchable
            clearable
            error={errors.supply_categories?.message}
          />
        )}
      />
      {(supplyCategories ?? []).includes("pharmacy") && (
        <TextInput
          label="Drug License Number"
          placeholder="DL-XX-XXXXXXX"
          error={errors.drug_license_number?.message}
          {...register("drug_license_number")}
        />
      )}
      <Controller
        control={control}
        name="is_pharmacy_vendor"
        render={({ field }) => (
          <Switch
            label="Pharmacy Vendor"
            description="Mark if this vendor supplies pharmaceutical products"
            checked={field.value}
            onChange={(event) => field.onChange(event.currentTarget.checked)}
          />
        )}
      />
      <TextInput
        label="Product Lines"
        placeholder="e.g. Antibiotics, Surgical Sutures, Lab Reagents"
        error={errors.product_lines?.message}
        {...register("product_lines")}
      />
      <Button loading={mutation.isPending} type="submit">
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
    queryFn: () => procurementService.listPurchaseOrders({ page: String(page), per_page: "20" }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => procurementService.approvePurchaseOrder(id),
    onSuccess: () => {
      notifications.show({
        title: "Approved",
        message: "Purchase order approved",
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => procurementService.sendPurchaseOrder(id),
    onSuccess: () => {
      notifications.show({ title: "Sent", message: "PO sent to vendor", color: "success" });
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
            <ActionIcon
              variant="subtle"
              size={44}
              onClick={() => {
                setDetailId(row.id);
                openDetail();
              }}
              aria-label="View details"
            >
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          {row.status === "draft" && canApprove && (
            <Button
              size="compact-xs"
              variant="light"
              color="success"
              loading={approveMutation.isPending}
              onClick={() => approveMutation.mutate(row.id)}
            >
              Approve
            </Button>
          )}
          {row.status === "approved" && (
            <Button
              size="compact-xs"
              variant="light"
              color="teal"
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
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
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
        <Badge color={poStatusColors[po.status]} variant="filled">
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
      notifications.show({ title: "Created", message: "Purchase order created", color: "success" });
      onSuccess();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
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
                <ActionIcon
                  variant="subtle"
                  color="danger"
                  size={44}
                  aria-label={`Remove purchase order item ${idx + 1}`}
                  onClick={() => removeItem(idx)}
                >
                  ×
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Button
        variant="outline"
        size="xs"
        leftSection={<IconPlus size={14} />}
        onClick={addItem}
        w="fit-content"
      >
        Add Item
      </Button>

      <Button loading={mutation.isPending} type="submit">
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
          <ActionIcon
            variant="subtle"
            size={44}
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
      {canCreate && (
        <Group justify="flex-end" mb="md">
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
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
        <Badge color={grnStatusColors[data.grn.status]} variant="filled">
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
      notifications.show({
        title: "Created",
        message: "GRN created and stock updated",
        color: "success",
      });
      onSuccess();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
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
      notifications.show({ title: "PO load failed", message, color: "danger" });
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

      <Button loading={mutation.isPending} type="submit">
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
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
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
      notifications.show({ title: "Created", message: "Rate contract created", color: "success" });
      onSuccess();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
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
          <ActionIcon
            variant="subtle"
            color="danger"
            size={44}
            mt={24}
            aria-label={`Remove rate contract item ${idx + 1}`}
            onClick={() => {
              if (fields.length > 1) remove(idx);
            }}
          >
            ×
          </ActionIcon>
        </Group>
      ))}
      <Button variant="outline" size="xs" onClick={() => append(emptyRcItem())} w="fit-content">
        Add Item
      </Button>

      <Button loading={mutation.isPending} type="submit">
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
    queryFn: () => procurementService.listBatchStock(),
  });

  const columns = [
    {
      key: "batch_number",
      label: "Batch",
      render: (row: BatchStock) => <Text fw={600}>{row.batch_number}</Text>,
    },
    {
      key: "serial_number",
      label: "Serial #",
      render: (row: BatchStock) => row.serial_number ?? "-",
    },
    { key: "quantity", label: "Qty", render: (row: BatchStock) => row.quantity },
    { key: "unit_cost", label: "Cost", render: (row: BatchStock) => `₹${row.unit_cost}` },
    {
      key: "expiry_date",
      label: "Expiry",
      render: (row: BatchStock) => {
        if (!row.expiry_date) return "-";
        const isExpiring =
          new Date(row.expiry_date) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        return (
          <Text c={isExpiring ? "danger" : undefined} fw={isExpiring ? 600 : undefined}>
            {row.expiry_date}
          </Text>
        );
      },
    },
    {
      key: "is_consignment",
      label: "Consignment",
      render: (row: BatchStock) =>
        row.is_consignment ? (
          <TableValueBadge value="store" kind="store" color="orange" label="Yes" variant="filled" />
        ) : (
          "-"
        ),
    },
    {
      key: "created_at",
      label: "Received",
      render: (row: BatchStock) => new Date(row.created_at).toLocaleDateString(),
    },
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

function StoreLocationPanel({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data: locations, isLoading } = useQuery({
    queryKey: ["store-locations"],
    queryFn: () => procurementService.listStoreLocations(),
  });

  const columns = [
    {
      key: "code",
      label: "Code",
      render: (row: StoreLocation) => <Text fw={600}>{row.code}</Text>,
    },
    { key: "name", label: "Name", render: (row: StoreLocation) => row.name },
    {
      key: "location_type",
      label: "Type",
      render: (row: StoreLocation) => (
        <TableValueBadge value={row.location_type} kind="store" variant="outline" />
      ),
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: StoreLocation) => (
        <TableValueBadge
          value={row.is_active ? "active" : "inactive"}
          label={row.is_active ? "Yes" : "No"}
          color={row.is_active ? "success" : "slate"}
          variant="filled"
        />
      ),
    },
    { key: "address", label: "Address", render: (row: StoreLocation) => row.address ?? "-" },
  ];

  return (
    <>
      {canManage && (
        <Group justify="flex-end" mb="md">
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Add Location
          </Button>
        </Group>
      )}

      <DataTable
        columns={columns}
        data={locations ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyTitle="No store locations"
      />

      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title="Add Store Location"
        closeButtonProps={{ "aria-label": "Close Add Store Location" }}
        position="right"
        size="xl"
      >
        <StoreLocationForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["store-locations"] });
            closeCreate();
          }}
        />
      </Drawer>
    </>
  );
}

function StoreLocationForm({ onSuccess }: { onSuccess: () => void }) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProcurementStoreLocationFormInput>({
    resolver: zodResolver(procurementStoreLocationFormSchema),
    defaultValues: {
      code: "",
      name: "",
      location_type: "main_store",
      address: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: ProcurementStoreLocationFormInput) =>
      procurementService.createStoreLocation({
        code: values.code.trim(),
        name: values.name.trim(),
        location_type: values.location_type,
        address: optionalText(values.address),
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
    <Stack component="form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <TextInput label="Code" required error={errors.code?.message} {...register("code")} />
      <TextInput label="Name" required error={errors.name?.message} {...register("name")} />
      <Controller
        control={control}
        name="location_type"
        render={({ field }) => (
          <Select
            label="Type"
            data={[
              { value: "main_store", label: "Main Store" },
              { value: "sub_store", label: "Sub Store" },
              { value: "department_store", label: "Department Store" },
              { value: "pharmacy_store", label: "Pharmacy Store" },
              { value: "warehouse", label: "Warehouse" },
            ]}
            value={field.value}
            onChange={(value) => field.onChange(value ?? "main_store")}
            error={errors.location_type?.message}
          />
        )}
      />
      <Textarea label="Address" error={errors.address?.message} {...register("address")} />
      <Button loading={mutation.isPending} type="submit">
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
    queryFn: () => procurementService.getVendorPerformance(),
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

      <Modal
        opened={compareOpened}
        onClose={closeCompare}
        title="Compare Vendors by Item"
        closeButtonProps={{ "aria-label": "Close Compare Vendors" }}
        size="lg"
      >
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
    queryFn: () => procurementService.listStoreCatalog({ active_only: "true" }),
  });

  const { data: comparison, isLoading } = useQuery({
    queryKey: ["vendor-comparison", itemId],
    queryFn: () => procurementService.getVendorComparison(itemId),
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

function SupplierPaymentsPanel({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data, isLoading } = useQuery({
    queryKey: ["supplier-payments"],
    queryFn: () => procurementService.listSupplierPayments(),
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
        <TableValueBadge
          value={row.status}
          kind="billing"
          color={paymentStatusColors[row.status] ?? "slate"}
        />
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

      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title="Record Payment"
        closeButtonProps={{ "aria-label": "Close Record Payment" }}
        position="right"
        size="xl"
      >
        <CreatePaymentForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["supplier-payments"] });
            closeCreate();
          }}
        />
      </Drawer>
    </>
  );
}

function CreatePaymentForm({ onSuccess }: { onSuccess: () => void }) {
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProcurementSupplierPaymentFormInput>({
    resolver: zodResolver(procurementSupplierPaymentFormSchema),
    defaultValues: {
      vendor_id: "",
      po_id: null,
      invoice_amount: 0,
      paid_amount: 0,
      due_date: "",
      payment_method: null,
      reference_number: "",
      notes: "",
    },
  });
  const vendorId = useWatch({ control, name: "vendor_id" });

  const { data: poData } = useQuery({
    queryKey: ["purchase-orders", "for-vendor", vendorId],
    queryFn: () => procurementService.listPurchaseOrders({ vendor_id: vendorId, per_page: "100" }),
    enabled: !!vendorId,
  });

  const mutation = useMutation({
    mutationFn: (values: ProcurementSupplierPaymentFormInput) =>
      procurementService.createSupplierPayment({
        vendor_id: values.vendor_id,
        po_id: optionalText(values.po_id),
        invoice_amount: requiredFormNumber(values.invoice_amount),
        paid_amount: formNumber(values.paid_amount),
        due_date: optionalText(values.due_date),
        payment_method: values.payment_method ?? undefined,
        reference_number: optionalText(values.reference_number),
        notes: optionalText(values.notes),
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
    <Stack component="form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <Controller
        control={control}
        name="vendor_id"
        render={({ field }) => (
          <VendorSearchSelect
            label="Vendor"
            placeholder="Select vendor"
            value={field.value}
            onChange={(value) => {
              field.onChange(value);
              setValue("po_id", null, { shouldDirty: true, shouldValidate: true });
            }}
            required
            error={errors.vendor_id?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="po_id"
        render={({ field }) => (
          <Select
            label="Purchase Order (optional)"
            placeholder="Link to PO"
            data={(poData?.purchase_orders ?? []).map((po) => ({
              value: po.id,
              label: `${po.po_number} - ₹${po.total_amount}`,
            }))}
            value={field.value}
            onChange={field.onChange}
            searchable
            clearable
            disabled={!vendorId}
            error={errors.po_id?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="invoice_amount"
        render={({ field }) => (
          <NumberInput
            label="Invoice Amount"
            min={0}
            decimalScale={2}
            value={field.value}
            onChange={field.onChange}
            error={errors.invoice_amount?.message}
            required
          />
        )}
      />
      <Controller
        control={control}
        name="paid_amount"
        render={({ field }) => (
          <NumberInput
            label="Paid Amount"
            min={0}
            decimalScale={2}
            value={field.value}
            onChange={field.onChange}
            error={errors.paid_amount?.message}
          />
        )}
      />
      <TextInput
        label="Due Date"
        placeholder="YYYY-MM-DD"
        error={errors.due_date?.message}
        {...register("due_date")}
      />
      <Controller
        control={control}
        name="payment_method"
        render={({ field }) => (
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
            value={field.value}
            onChange={field.onChange}
            clearable
            error={errors.payment_method?.message}
          />
        )}
      />
      <TextInput
        label="Reference Number"
        placeholder="Txn / Cheque number"
        error={errors.reference_number?.message}
        {...register("reference_number")}
      />
      <Textarea label="Notes" error={errors.notes?.message} {...register("notes")} />
      <Button loading={mutation.isPending} type="submit">
        Record Payment
      </Button>
    </Stack>
  );
}
