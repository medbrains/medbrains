import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type {
  PharmacyCashDrawerCloseFormInput,
  PharmacyCashDrawerOpenFormInput,
} from "@medbrains/schemas";
import {
  pharmacyCashDrawerCloseFormSchema,
  pharmacyCashDrawerOpenFormSchema,
} from "@medbrains/schemas";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import { type FieldAccessLevel, P } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { Alert, Badge, type BadgeTone, Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { pharmacyService } from "@/services/pharmacy.service";
import { pharmacyFinanceService } from "@/services/pharmacyFinance.service";

interface CashDrawerRow {
  id: string;
  pharmacy_location_id: string;
  cashier_user_id: string;
  opened_at: string;
  opening_float: string;
  closed_at?: string | null;
  expected_close_amount?: string | null;
  actual_close_amount?: string | null;
  variance?: string | null;
  status: string;
}

interface PettyCashRow {
  id: string;
  category: string;
  amount: string;
  paid_to: string;
  status: string;
  created_at: string;
}

interface SupplierPaymentRow {
  id: string;
  supplier_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  gross_amount: string;
  net_payable: string;
  status: string;
  paid_at?: string | null;
}

interface FreeDispensingRow {
  id: string;
  pharmacy_order_id: string;
  category: string;
  scheme_code?: string | null;
  cost_value: string;
  notes?: string | null;
  created_at: string;
}

interface DrugMarginRow {
  id: string;
  drug_id: string;
  drug_name?: string | null;
  snapshot_date: string;
  sale_price: string;
  margin_pct: string;
  qty_sold: number;
  revenue: string;
  margin_total: string;
}

const drawerStatusColor: Record<string, BadgeTone> = {
  open: "success",
  closed: "neutral",
  variance_pending_signoff: "warning",
  reopened: "info",
};

const PHARMACY_FINANCE_PAGE_PERMISSIONS = [
  P.PHARMACY_FINANCE.CASH_DRAWER_VIEW,
  P.PHARMACY_FINANCE.CASH_DRAWER_OPEN,
  P.PHARMACY_FINANCE.CASH_DRAWER_CLOSE,
  P.PHARMACY_FINANCE.PETTY_CASH_VIEW,
  P.PHARMACY_FINANCE.FREE_DISPENSING_VIEW,
  P.PHARMACY_FINANCE.SUPPLIER_PAYMENTS_VIEW,
  P.PHARMACY_FINANCE.SUPPLIER_PAYMENTS_MANAGE,
  P.PHARMACY_FINANCE.FINANCE_REPORTS_VIEW,
] as const;

function canEditFinanceAmount(access: FieldAccessLevel): boolean {
  return access === "edit";
}

function canViewFinanceAmount(access: FieldAccessLevel): boolean {
  return access === "edit" || access === "view";
}

function financeAmountText(access: FieldAccessLevel, value: string | number | null | undefined) {
  return fieldAccessText(access, value == null || value === "" ? undefined : `₹${value}`, "amount");
}

export function PharmacyFinancePage() {
  useRequirePermission(PHARMACY_FINANCE_PAGE_PERMISSIONS);
  const amountAccess = useFieldAccess("billing.amount");
  const canViewCashDrawer = useHasPermission(P.PHARMACY_FINANCE.CASH_DRAWER_VIEW);
  const canOpenCashDrawer = useHasPermission(P.PHARMACY_FINANCE.CASH_DRAWER_OPEN);
  const canCloseCashDrawer = useHasPermission(P.PHARMACY_FINANCE.CASH_DRAWER_CLOSE);
  const canViewPettyCash = useHasPermission(P.PHARMACY_FINANCE.PETTY_CASH_VIEW);
  const canRecordPettyCash = useHasPermission(P.PHARMACY_FINANCE.PETTY_CASH_RECORD);
  const canViewFreeDispensing = useHasPermission(P.PHARMACY_FINANCE.FREE_DISPENSING_VIEW);
  const canViewSupplierPayments = useHasPermission(P.PHARMACY_FINANCE.SUPPLIER_PAYMENTS_VIEW);
  const canManageSupplierPayments = useHasPermission(P.PHARMACY_FINANCE.SUPPLIER_PAYMENTS_MANAGE);
  const canViewFinanceReports = useHasPermission(P.PHARMACY_FINANCE.FINANCE_REPORTS_VIEW);
  const [tab, setTab] = useState<string>("cash-drawer");
  const visibleTabs = [
    {
      value: "cash-drawer",
      label: "Cash Drawer",
      visible: canViewCashDrawer || canOpenCashDrawer || canCloseCashDrawer,
    },
    { value: "petty-cash", label: "Petty Cash", visible: canViewPettyCash },
    {
      value: "supplier-payments",
      label: "Supplier Payments",
      visible: canViewSupplierPayments || canManageSupplierPayments,
    },
    {
      value: "free-dispensing",
      label: "Free Dispensing",
      visible: canViewFreeDispensing,
    },
    { value: "margins", label: "Margins", visible: canViewFinanceReports },
  ].filter((item) => item.visible);
  const activeTab = visibleTabs.some((item) => item.value === tab)
    ? tab
    : (visibleTabs[0]?.value ?? "cash-drawer");

  return (
    <div>
      <PageHeader
        title="Pharmacy Finance"
        subtitle="Day-end close, petty cash, free dispensings, supplier payments"
      />
      <Tabs
        value={activeTab}
        onChange={(value) => {
          if (value && visibleTabs.some((item) => item.value === value)) {
            setTab(value);
          }
        }}
        variant="outline"
      >
        <Tabs.List>
          {visibleTabs.map((item) => (
            <Tabs.Tab key={item.value} value={item.value}>
              {item.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {(canViewCashDrawer || canOpenCashDrawer || canCloseCashDrawer) && (
          <Tabs.Panel value="cash-drawer" pt="md">
            <CashDrawerTab
              canView={canViewCashDrawer}
              canOpen={canOpenCashDrawer}
              canClose={canCloseCashDrawer}
              amountAccess={amountAccess}
            />
          </Tabs.Panel>
        )}
        {canViewPettyCash && (
          <Tabs.Panel value="petty-cash" pt="md">
            <PettyCashTab canRecord={canRecordPettyCash} amountAccess={amountAccess} />
          </Tabs.Panel>
        )}
        {(canViewSupplierPayments || canManageSupplierPayments) && (
          <Tabs.Panel value="supplier-payments" pt="md">
            <SupplierPaymentsTab
              canView={canViewSupplierPayments}
              canManage={canManageSupplierPayments}
              amountAccess={amountAccess}
            />
          </Tabs.Panel>
        )}
        {canViewFreeDispensing && (
          <Tabs.Panel value="free-dispensing" pt="md">
            <FreeDispensingTab amountAccess={amountAccess} />
          </Tabs.Panel>
        )}
        {canViewFinanceReports && (
          <Tabs.Panel value="margins" pt="md">
            <MarginsTab amountAccess={amountAccess} />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}

// ── Cash Drawer Tab ─────────────────────────────────────────────────

function CashDrawerTab({
  canView,
  canOpen,
  canClose,
  amountAccess,
}: {
  canView: boolean;
  canOpen: boolean;
  canClose: boolean;
  amountAccess: FieldAccessLevel;
}) {
  const qc = useQueryClient();
  const [openModal, { open: openOpenDrawerModal, close: closeOpenDrawerModal }] =
    useDisclosure(false);
  const [closeFor, setCloseFor] = useState<CashDrawerRow | null>(null);
  const canUseOwnDrawer = canView || canOpen || canClose;
  const canEditAmount = canEditFinanceAmount(amountAccess);
  const canOpenWithAmount = canOpen && canEditAmount;
  const canCloseWithAmount = canClose && canEditAmount;

  const { data: active } = useQuery({
    queryKey: ["cash-drawer", "active"],
    queryFn: () => pharmacyFinanceService.getMyActiveCashDrawer() as Promise<CashDrawerRow | null>,
    enabled: canUseOwnDrawer,
  });
  const { data: list } = useQuery({
    queryKey: ["cash-drawers"],
    queryFn: () =>
      pharmacyFinanceService.listCashDrawers({ limit: 50 }) as Promise<CashDrawerRow[]>,
    enabled: canView,
  });

  return (
    <Stack>
      {active ? (
        <Card withBorder padding="md">
          <Group justify="space-between">
            <Stack gap={2}>
              <Group gap="xs">
                <Badge tone={drawerStatusColor[active.status] ?? "neutral"}>{active.status}</Badge>
                <Text fw={600}>Drawer {active.id.slice(0, 8)}</Text>
              </Group>
              <Text size="sm" c="dimmed">
                Opened {new Date(active.opened_at).toLocaleString()} · Float{" "}
                {financeAmountText(amountAccess, active.opening_float)}
              </Text>
            </Stack>
            {canCloseWithAmount ? (
              <Button tone="danger" onClick={() => setCloseFor(active)}>
                Close drawer
              </Button>
            ) : canClose ? (
              <Button tone="danger" disabled>
                Close drawer
              </Button>
            ) : (
              <Badge>Active drawer</Badge>
            )}
          </Group>
        </Card>
      ) : (
        <Card withBorder padding="md">
          <Group justify="space-between">
            <Text>No active drawer.</Text>
            {canOpen && (
              <Button tone="primary" onClick={openOpenDrawerModal} disabled={!canOpenWithAmount}>
                Open drawer
              </Button>
            )}
          </Group>
        </Card>
      )}

      {(canOpen || canClose) && !canEditAmount && (
        <Alert tone="warning">
          Cash drawer opening and closing need billing amount edit access.
        </Alert>
      )}

      {canView ? (
        <Stack gap="xs">
          <Text fw={600}>Recent drawers</Text>
          {list?.map((row) => (
            <Card key={row.id} withBorder padding="sm">
              <Group justify="space-between">
                <Group gap="xs">
                  <Badge tone={drawerStatusColor[row.status] ?? "neutral"}>{row.status}</Badge>
                  <Text>Opened {new Date(row.opened_at).toLocaleDateString()}</Text>
                </Group>
                <Text>
                  Float {financeAmountText(amountAccess, row.opening_float)}
                  {row.actual_close_amount &&
                    ` · Closed ${financeAmountText(amountAccess, row.actual_close_amount)}`}
                  {row.variance && ` · Var ${financeAmountText(amountAccess, row.variance)}`}
                </Text>
              </Group>
            </Card>
          ))}
        </Stack>
      ) : (
        <Alert tone="neutral">Recent drawer history requires cash-drawer view permission.</Alert>
      )}

      <OpenDrawerModal
        opened={openModal && canOpenWithAmount}
        onClose={closeOpenDrawerModal}
        onOpened={() => {
          qc.invalidateQueries({ queryKey: ["cash-drawer"] });
          qc.invalidateQueries({ queryKey: ["cash-drawers"] });
        }}
        amountAccess={amountAccess}
      />
      <CloseDrawerModal
        drawer={closeFor}
        onClose={() => setCloseFor(null)}
        onClosed={() => {
          qc.invalidateQueries({ queryKey: ["cash-drawer"] });
          qc.invalidateQueries({ queryKey: ["cash-drawers"] });
        }}
        amountAccess={amountAccess}
      />
    </Stack>
  );
}

function OpenDrawerModal({
  opened,
  onClose,
  onOpened,
  amountAccess,
}: {
  opened: boolean;
  onClose: () => void;
  onOpened: () => void;
  amountAccess: FieldAccessLevel;
}) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PharmacyCashDrawerOpenFormInput>({
    resolver: zodResolver(pharmacyCashDrawerOpenFormSchema),
    defaultValues: { pharmacy_location_id: "", opening_float: 0, notes: "" },
  });

  const { data: storeLocations = [] } = useQuery({
    queryKey: ["pharmacy-store-locations"],
    queryFn: () => pharmacyService.listStoreLocations(),
  });
  const locationOptions = storeLocations.map((store) => ({
    value: store.id,
    label: [store.name, store.location_type, store.code].filter(Boolean).join(" - "),
  }));

  const open = useMutation({
    mutationFn: (values: PharmacyCashDrawerOpenFormInput) =>
      pharmacyFinanceService.openCashDrawer({
        pharmacy_location_id: values.pharmacy_location_id,
        opening_float: Number(values.opening_float),
        notes: values.notes.trim() || undefined,
      }),
    onSuccess: () => {
      onOpened();
      reset({ pharmacy_location_id: "", opening_float: 0, notes: "" });
      onClose();
    },
  });
  const closeModal = () => {
    reset({ pharmacy_location_id: "", opening_float: 0, notes: "" });
    onClose();
  };
  const canEditAmount = canEditFinanceAmount(amountAccess);

  return (
    <Modal opened={opened} onClose={closeModal} title="Open cash drawer">
      <form onSubmit={handleSubmit((values) => open.mutate(values))}>
        <Stack>
          <Controller
            control={control}
            name="pharmacy_location_id"
            render={({ field }) => (
              <Select
                label="Pharmacy location"
                placeholder="Select the dispensing location"
                required
                searchable
                data={locationOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "")}
                error={errors.pharmacy_location_id?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="opening_float"
            render={({ field }) => (
              <NumberInput
                label="Opening float (₹)"
                value={field.value}
                onChange={(value) => field.onChange(typeof value === "number" ? value : 0)}
                min={0}
                step={100}
                disabled={!canEditAmount}
                error={errors.opening_float?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="notes"
            render={({ field }) => <Textarea label="Notes" minRows={2} {...field} />}
          />
          <Group justify="flex-end">
            <Button tone="primary" type="submit" loading={open.isPending} disabled={!canEditAmount}>
              Open
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function CloseDrawerModal({
  drawer,
  onClose,
  onClosed,
  amountAccess,
}: {
  drawer: CashDrawerRow | null;
  onClose: () => void;
  onClosed: () => void;
  amountAccess: FieldAccessLevel;
}) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PharmacyCashDrawerCloseFormInput>({
    resolver: zodResolver(pharmacyCashDrawerCloseFormSchema),
    defaultValues: { actual_close_amount: 0, variance_reason: "" },
  });

  const close = useMutation({
    mutationFn: (values: PharmacyCashDrawerCloseFormInput) => {
      if (!drawer) throw new Error("no drawer");
      return pharmacyFinanceService.closeCashDrawer(drawer.id, {
        actual_close_amount: Number(values.actual_close_amount),
        variance_reason: values.variance_reason.trim() || undefined,
      });
    },
    onSuccess: () => {
      onClosed();
      onClose();
      reset({ actual_close_amount: 0, variance_reason: "" });
    },
  });
  const closeModal = () => {
    reset({ actual_close_amount: 0, variance_reason: "" });
    onClose();
  };
  const canEditAmount = canEditFinanceAmount(amountAccess);

  return (
    <Modal opened={drawer !== null} onClose={closeModal} title="Close cash drawer">
      <form onSubmit={handleSubmit((values) => close.mutate(values))}>
        <Stack>
          <Text size="sm" c="dimmed">
            Opening float: {financeAmountText(amountAccess, drawer?.opening_float)}. Variance &gt;
            ₹100 requires sign-off.
          </Text>
          <Controller
            control={control}
            name="actual_close_amount"
            render={({ field }) => (
              <NumberInput
                label="Actual cash counted (₹)"
                value={field.value}
                onChange={(value) => field.onChange(typeof value === "number" ? value : 0)}
                min={0}
                step={100}
                disabled={!canEditAmount}
                error={errors.actual_close_amount?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="variance_reason"
            render={({ field }) => (
              <Textarea label="Variance reason (optional)" minRows={2} {...field} />
            )}
          />
          <Group justify="flex-end">
            <Button
              tone="primary"
              type="submit"
              loading={close.isPending}
              disabled={!canEditAmount}
            >
              Close
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

// ── Petty Cash Tab ──────────────────────────────────────────────────

function PettyCashTab({
  canRecord,
  amountAccess,
}: {
  canRecord: boolean;
  amountAccess: FieldAccessLevel;
}) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["petty-cash"],
    queryFn: () => pharmacyFinanceService.listPettyCash({ limit: 100 }) as Promise<PettyCashRow[]>,
  });
  const decide = useMutation({
    mutationFn: (vars: { id: string; approved: boolean }) =>
      pharmacyFinanceService.decidePettyCash(vars.id, { approved: vars.approved }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["petty-cash"] }),
  });
  const canDecideVoucher = canRecord && canViewFinanceAmount(amountAccess);

  return (
    <Stack gap="xs">
      {canRecord && !canViewFinanceAmount(amountAccess) && (
        <Alert tone="warning">Petty cash approval needs billing amount view access.</Alert>
      )}
      {data?.map((row) => (
        <Card key={row.id} withBorder padding="sm">
          <Group justify="space-between">
            <Group gap="xs">
              <Badge
                tone={
                  row.status === "approved"
                    ? "success"
                    : row.status === "rejected"
                      ? "danger"
                      : "warning"
                }
              >
                {row.status}
              </Badge>
              <Text fw={500}>{row.category}</Text>
              <Text>{financeAmountText(amountAccess, row.amount)}</Text>
              <Text c="dimmed">→ {row.paid_to}</Text>
            </Group>
            {row.status === "pending" && canDecideVoucher && (
              <Group>
                <Button
                  size="xs"
                  tone="primary"
                  onClick={() => decide.mutate({ id: row.id, approved: true })}
                >
                  Approve
                </Button>
                <Button
                  size="xs"
                  tone="subtle-danger"
                  onClick={() => decide.mutate({ id: row.id, approved: false })}
                >
                  Reject
                </Button>
              </Group>
            )}
          </Group>
        </Card>
      ))}
      {data?.length === 0 && <Text c="dimmed">No vouchers.</Text>}
    </Stack>
  );
}

// ── Supplier Payments Tab ───────────────────────────────────────────

function SupplierPaymentsTab({
  canManage,
  amountAccess,
}: {
  canView: boolean;
  canManage: boolean;
  amountAccess: FieldAccessLevel;
}) {
  const [overdueOnly, setOverdueOnly] = useState(false);

  const { data } = useQuery({
    queryKey: ["supplier-payments", overdueOnly],
    queryFn: () =>
      pharmacyFinanceService.listPharmacySupplierPayments({
        overdue_only: overdueOnly,
        limit: 100,
      }) as Promise<SupplierPaymentRow[]>,
  });

  return (
    <Stack>
      <Group>
        <Button
          tone={overdueOnly ? "primary" : "secondary"}
          onClick={() => setOverdueOnly((v) => !v)}
        >
          Overdue only
        </Button>
        {canManage && <Badge tone="primary">Manage payments</Badge>}
      </Group>
      <Stack gap="xs">
        {data?.map((row) => (
          <Card key={row.id} withBorder padding="sm">
            <Group justify="space-between">
              <Stack gap={2}>
                <Group gap="xs">
                  <Badge>{row.status}</Badge>
                  <Text fw={500}>{row.invoice_number}</Text>
                </Group>
                <Text size="sm" c="dimmed">
                  Invoice {row.invoice_date} · Due {row.due_date}
                </Text>
              </Stack>
              <Text>
                Net {financeAmountText(amountAccess, row.net_payable)} (Gross{" "}
                {financeAmountText(amountAccess, row.gross_amount)})
              </Text>
            </Group>
          </Card>
        ))}
        {data?.length === 0 && <Text c="dimmed">No payments.</Text>}
      </Stack>
    </Stack>
  );
}

// ── Free Dispensing Tab ─────────────────────────────────────────────

function FreeDispensingTab({ amountAccess }: { amountAccess: FieldAccessLevel }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["pharmacy-free-dispensings"],
    queryFn: () =>
      pharmacyFinanceService.listFreeDispensings({ limit: 200 }) as Promise<FreeDispensingRow[]>,
  });

  const columns: Column<FreeDispensingRow>[] = [
    {
      key: "created_at",
      label: "Date",
      render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>,
    },
    {
      key: "category",
      label: "Category",
      render: (r) => (
        <Badge tone="neutral" size="sm">
          {r.category}
        </Badge>
      ),
    },
    {
      key: "scheme_code",
      label: "Scheme",
      render: (r) => <Text size="sm">{r.scheme_code || "—"}</Text>,
    },
    {
      key: "cost_value",
      label: "Cost",
      render: (r) => <Text size="sm">{financeAmountText(amountAccess, r.cost_value)}</Text>,
    },
    {
      key: "notes",
      label: "Notes",
      render: (r) => (
        <Text size="sm" c="dimmed">
          {r.notes || "—"}
        </Text>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={isLoading}
      rowKey={(r) => r.id}
      emptyTitle="No free dispensings"
      emptyDescription="Approved free or subsidised dispensings will appear here."
    />
  );
}

// ── Margins Tab ─────────────────────────────────────────────────────

function marginTone(pct: string): BadgeTone {
  const value = Number(pct);
  if (Number.isNaN(value)) return "neutral";
  if (value < 0) return "danger";
  if (value < 10) return "warning";
  return "success";
}

function MarginsTab({ amountAccess }: { amountAccess: FieldAccessLevel }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["pharmacy-drug-margins"],
    queryFn: () =>
      pharmacyFinanceService.listDrugMargins({ limit: 500 }) as Promise<DrugMarginRow[]>,
  });

  const columns: Column<DrugMarginRow>[] = [
    {
      key: "snapshot_date",
      label: "Date",
      render: (r) => <Text size="sm">{r.snapshot_date}</Text>,
    },
    {
      key: "drug_name",
      label: "Drug",
      render: (r) => <Text size="sm">{r.drug_name || r.drug_id.slice(0, 8)}</Text>,
    },
    {
      key: "qty_sold",
      label: "Qty sold",
      render: (r) => <Text size="sm">{r.qty_sold}</Text>,
    },
    {
      key: "sale_price",
      label: "Sale price",
      render: (r) => <Text size="sm">{financeAmountText(amountAccess, r.sale_price)}</Text>,
    },
    {
      key: "margin_pct",
      label: "Margin %",
      render: (r) => (
        <Badge tone={marginTone(r.margin_pct)} size="sm">
          {r.margin_pct}%
        </Badge>
      ),
    },
    {
      key: "revenue",
      label: "Revenue",
      render: (r) => <Text size="sm">{financeAmountText(amountAccess, r.revenue)}</Text>,
    },
    {
      key: "margin_total",
      label: "Margin total",
      render: (r) => <Text size="sm">{financeAmountText(amountAccess, r.margin_total)}</Text>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={isLoading}
      rowKey={(r) => r.id}
      emptyTitle="No margin data"
      emptyDescription="Daily drug-margin snapshots will appear here."
    />
  );
}
